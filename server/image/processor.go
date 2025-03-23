package image

import (
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math"
	"runtime"
	"sync"
)

// WorkerPool handles concurrent image processing
type WorkerPool struct {
	workers int
	jobs    chan processJob
	wg      sync.WaitGroup
}

type processJob struct {
	x, y     int
	img      image.Image
	adjusted *image.RGBA
	params   adjustParams
	bounds   image.Rectangle
}

type adjustParams struct {
	contrast       float64
	midtones       float64
	highlights     float64
	luminance      float64
	contrastFactor float64
}

// NewWorkerPool creates a new worker pool with the specified number of workers
func NewWorkerPool(workers int) *WorkerPool {
	if workers <= 0 {
		workers = runtime.NumCPU()
	}
	return &WorkerPool{
		workers: workers,
		jobs:    make(chan processJob, workers*2),
	}
}

// ProcessImage handles all image processing steps with parallel execution
func ProcessImage(src io.Reader, contrast, midtones, highlights, luminance, blur float64) (image.Image, error) {
	// Decode image directly from source - Go's image package handles format detection
	img, format, err := image.Decode(src)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image (format: %s): %w", format, err)
	}

	// Initialize worker pool
	pool := NewWorkerPool(0) // Use number of CPU cores

	// Apply adjustments in parallel
	img = pool.adjustImage(img, contrast, midtones, highlights, luminance)

	// Apply blur if needed
	if blur > 0 {
		img = applyBlur(img, blur)
	}

	return img, nil
}

// adjustImage applies contrast, midtones, highlights, and luminance adjustments
func (p *WorkerPool) adjustImage(img image.Image, contrast, midtones, highlights, luminance float64) image.Image {
	bounds := img.Bounds()
	adjusted := image.NewRGBA(bounds)

	// Normalize parameters
	params := adjustParams{
		contrast:       (contrast - 50.0) / 50.0,
		midtones:       midtones / 100.0,
		highlights:     highlights / 100.0,
		luminance:      luminance / 100.0,
		contrastFactor: math.Tan(((contrast-50.0)/50.0 + 1) * math.Pi / 4),
	}

	// Start worker goroutines
	for i := 0; i < p.workers; i++ {
		go p.worker(adjusted, params)
	}

	// Distribute work
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			p.wg.Add(1)
			p.jobs <- processJob{
				x:        x,
				y:        y,
				img:      img,
				adjusted: adjusted,
				params:   params,
				bounds:   bounds,
			}
		}
	}

	// Wait for completion and close jobs channel
	go func() {
		p.wg.Wait()
		close(p.jobs)
	}()

	p.wg.Wait()
	return adjusted
}

func (p *WorkerPool) worker(adjusted *image.RGBA, params adjustParams) {
	for job := range p.jobs {
		processPixel(job)
		p.wg.Done()
	}
}

func processPixel(job processJob) {
	pixel := job.img.At(job.x, job.y)
	r, g, b, a := pixel.RGBA()

	// Convert to 0-1 range
	r = r >> 8
	g = g >> 8
	b = b >> 8
	a = a >> 8

	// Calculate luminance value
	lum := (0.299*float64(r) + 0.587*float64(g) + 0.114*float64(b)) / 255.0

	// Apply contrast using smooth S-curve
	if job.params.contrast != 0 {
		lum = 0.5 + (math.Atan((lum-0.5)*job.params.contrastFactor)/math.Pi*2.0)*0.5
	}

	// Apply midtones using power curve
	if job.params.midtones != 0.5 {
		gamma := 1.0 + (job.params.midtones-0.5)*2.0 // Convert 0-1 to gamma range 0.0-3.0
		if gamma != 0 {
			lum = math.Pow(lum, 1.0/gamma)
		}
	}

	// Apply highlights with smooth rolloff
	if job.params.highlights > 0 {
		threshold := 0.5
		if lum > threshold {
			factor := (lum - threshold) / (1.0 - threshold)
			boost := factor * job.params.highlights
			lum = lum + (1.0-lum)*boost*(1.0-factor) // Reduce boost near white
		}
	}

	// Apply luminance threshold with smooth transition
	if job.params.luminance > 0 {
		threshold := job.params.luminance
		transition := 0.1 // 10% smooth transition zone
		if lum < threshold {
			factor := (threshold - lum) / transition
			if factor > 1.0 {
				lum = 0
			} else {
				lum *= (1.0 - factor)
			}
		}
	}

	// Clamp values
	lum = math.Max(0.0, math.Min(1.0, lum))

	// Convert back to RGB
	gray := uint8(lum * 255.0)
	job.adjusted.Set(job.x, job.y, color.RGBA{gray, gray, gray, uint8(a)})
}

// BlurWorker handles parallel blur operations
type BlurWorker struct {
	kernel     []float64
	offset     int
	kernelSize int
}

// NewBlurWorker creates a new blur worker with precalculated kernel
func NewBlurWorker(radius float64) *BlurWorker {
	kernelSize := int(math.Ceil(radius * 3))
	if kernelSize%2 == 0 {
		kernelSize++
	}

	kernel := make([]float64, kernelSize)
	sum := 0.0
	offset := kernelSize / 2
	sigma := radius / 2.0
	twoSigmaSquare := 2 * sigma * sigma

	for i := 0; i < kernelSize; i++ {
		x := float64(i - offset)
		kernel[i] = math.Exp(-(x * x) / twoSigmaSquare)
		sum += kernel[i]
	}

	// Normalize kernel
	for i := range kernel {
		kernel[i] /= sum
	}

	return &BlurWorker{
		kernel:     kernel,
		offset:     offset,
		kernelSize: kernelSize,
	}
}

// applyBlur applies a Gaussian blur effect using parallel separable convolution
func applyBlur(img image.Image, radius float64) image.Image {
	if radius <= 0 {
		return img
	}

	bounds := img.Bounds()

	// Create blur worker with precalculated kernel
	worker := NewBlurWorker(radius)

	// Horizontal pass with parallel processing
	horizontal := image.NewRGBA(bounds)
	var wg sync.WaitGroup
	numGoroutines := runtime.NumCPU()
	rowsPerGoroutine := (bounds.Max.Y - bounds.Min.Y + numGoroutines - 1) / numGoroutines

	// Preallocate slices for intermediate calculations
	buffers := make([][]float64, numGoroutines)
	for i := range buffers {
		buffers[i] = make([]float64, bounds.Max.X-bounds.Min.X)
	}

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(startY int) {
			defer wg.Done()
			endY := startY + rowsPerGoroutine
			if endY > bounds.Max.Y {
				endY = bounds.Max.Y
			}

			buffer := buffers[i]
			for y := startY; y < endY; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					var sum float64
					var totalWeight float64

					for k := 0; k < worker.kernelSize; k++ {
						ix := x + k - worker.offset
						if ix >= bounds.Min.X && ix < bounds.Max.X {
							pixel := color.GrayModel.Convert(img.At(ix, y)).(color.Gray)
							weight := worker.kernel[k]
							sum += float64(pixel.Y) * weight
							totalWeight += weight
						}
					}

					if totalWeight > 0 {
						buffer[x-bounds.Min.X] = sum / totalWeight
					} else {
						buffer[x-bounds.Min.X] = 0
					}
				}

				// Set values in a separate loop to improve cache locality
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					value := uint8(math.Min(math.Max(buffer[x-bounds.Min.X], 0), 255))
					horizontal.Set(x, y, color.Gray{Y: value})
				}
			}
		}(bounds.Min.Y + i*rowsPerGoroutine)
	}
	wg.Wait()

	// Vertical pass with parallel processing
	result := image.NewRGBA(bounds)
	numGoroutines = runtime.NumCPU()
	colsPerGoroutine := (bounds.Max.X - bounds.Min.X + numGoroutines - 1) / numGoroutines

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(startX int) {
			defer wg.Done()
			endX := startX + colsPerGoroutine
			if endX > bounds.Max.X {
				endX = bounds.Max.X
			}

			for x := startX; x < endX; x++ {
				for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
					var sum float64
					var totalWeight float64

					for i := 0; i < worker.kernelSize; i++ {
						iy := y + i - worker.offset
						if iy >= bounds.Min.Y && iy < bounds.Max.Y {
							pixel := color.GrayModel.Convert(horizontal.At(x, iy)).(color.Gray)
							weight := worker.kernel[i]
							sum += float64(pixel.Y) * weight
							totalWeight += weight
						}
					}

					if totalWeight > 0 {
						sum /= totalWeight
					}
					value := uint8(math.Min(math.Max(sum, 0), 255))
					result.Set(x, y, color.RGBA{value, value, value, 255})
				}
			}
		}(bounds.Min.X + i*colsPerGoroutine)
	}
	wg.Wait()

	return result
}
