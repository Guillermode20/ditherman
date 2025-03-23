package dither

import (
	"image"
	"image/color"
	"math"
	"runtime"
	"sync"
)

// DitherWorker handles concurrent dithering operations
type DitherWorker struct {
	pixelSize   int
	bayerMatrix [][]int
	invert      bool
}

// NewDitherWorker creates a new worker for dithering operations
func NewDitherWorker(scale float64, invert bool) *DitherWorker {
	return &DitherWorker{
		pixelSize: int(math.Max(1, math.Round(scale))),
		bayerMatrix: [][]int{
			{0, 8, 2, 10},
			{12, 4, 14, 6},
			{3, 11, 1, 9},
			{15, 7, 13, 5},
		},
		invert: invert,
	}
}

// Apply applies the selected dithering algorithm to the image
func Apply(img image.Image, algorithm string, scale float64, invert bool) image.Image {
	switch algorithm {
	case "floyd-steinberg":
		return floydSteinberg(img, scale, invert)
	case "ordered":
		return ordered(img, scale, invert)
	case "atkinson":
		return atkinson(img, scale, invert)
	case "stucki":
		return stucki(img, scale, invert)
	case "sierra":
		return sierra(img, scale, invert)
	default:
		return floydSteinberg(img, scale, invert)
	}
}

// floydSteinberg applies the Floyd-Steinberg dithering algorithm in parallel
func floydSteinberg(img image.Image, scale float64, invert bool) image.Image {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	result := image.NewGray(bounds)

	worker := NewDitherWorker(scale, invert)
	var wg sync.WaitGroup

	// Create error diffusion buffers (one per goroutine to prevent race conditions)
	numGoroutines := runtime.NumCPU()
	rowsPerGoroutine := (height + numGoroutines - 1) / numGoroutines
	errorBuffers := make([][][]float64, numGoroutines)

	for i := range errorBuffers {
		startY := i * rowsPerGoroutine
		endY := startY + rowsPerGoroutine
		if endY > height {
			endY = height
		}
		bufferHeight := endY - startY + worker.pixelSize // Add extra row for error diffusion
		errorBuffers[i] = make([][]float64, bufferHeight)
		for j := range errorBuffers[i] {
			errorBuffers[i][j] = make([]float64, width)
		}
	}

	// Process image in parallel by rows
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(workerIndex int) {
			defer wg.Done()
			startY := workerIndex * rowsPerGoroutine
			endY := startY + rowsPerGoroutine
			if endY > height {
				endY = height
			}

			errors := errorBuffers[workerIndex]

			// Process rows in chunks
			for y := startY; y < endY; y += worker.pixelSize {
				for x := 0; x < width; x += worker.pixelSize {
					// Average the pixel block
					var sum float64
					count := 0
					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							oldPixel := color.GrayModel.Convert(img.At(x+dx, y+dy)).(color.Gray)
							sum += float64(oldPixel.Y) + errors[dy][x+dx]
							count++
						}
					}
					oldValue := sum / float64(count)

					// Determine new binary value with inversion
					newValue := float64(255)
					if (oldValue < 128) != worker.invert {
						newValue = 0
					}

					// Set the block atomically
					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							result.Set(x+dx, y+dy, color.Gray{Y: uint8(newValue)})
						}
					}

					// Calculate and distribute error locally within the worker's buffer
					quantError := oldValue - newValue
					if x+worker.pixelSize < width {
						errors[y-startY][x+worker.pixelSize] += quantError * 7 / 16
					}
					if y+worker.pixelSize < height {
						if x >= worker.pixelSize {
							errors[y-startY+worker.pixelSize][x-worker.pixelSize] += quantError * 3 / 16
						}
						errors[y-startY+worker.pixelSize][x] += quantError * 5 / 16
						if x+worker.pixelSize < width {
							errors[y-startY+worker.pixelSize][x+worker.pixelSize] += quantError * 1 / 16
						}
					}
				}
			}
		}(i)
	}

	wg.Wait()
	return result
}

// atkinson applies the Atkinson dithering algorithm in parallel
func atkinson(img image.Image, scale float64, invert bool) image.Image {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	result := image.NewGray(bounds)

	worker := NewDitherWorker(scale, invert)
	var wg sync.WaitGroup

	numGoroutines := runtime.NumCPU()
	rowsPerGoroutine := (height + numGoroutines - 1) / numGoroutines
	errorBuffers := make([][][]float64, numGoroutines)

	for i := range errorBuffers {
		startY := i * rowsPerGoroutine
		endY := startY + rowsPerGoroutine
		if endY > height {
			endY = height
		}
		bufferHeight := endY - startY + worker.pixelSize*2 // Two extra rows for error diffusion
		errorBuffers[i] = make([][]float64, bufferHeight)
		for j := range errorBuffers[i] {
			errorBuffers[i][j] = make([]float64, width)
		}
	}

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(workerIndex int) {
			defer wg.Done()
			startY := workerIndex * rowsPerGoroutine
			endY := startY + rowsPerGoroutine
			if endY > height {
				endY = height
			}

			errors := errorBuffers[workerIndex]

			for y := startY; y < endY; y += worker.pixelSize {
				for x := 0; x < width; x += worker.pixelSize {
					var sum float64
					count := 0
					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							oldPixel := color.GrayModel.Convert(img.At(x+dx, y+dy)).(color.Gray)
							sum += float64(oldPixel.Y) + errors[dy][x+dx]
							count++
						}
					}
					oldValue := sum / float64(count)

					newValue := float64(255)
					if (oldValue < 128) != worker.invert {
						newValue = 0
					}

					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							result.Set(x+dx, y+dy, color.Gray{Y: uint8(newValue)})
						}
					}

					quantError := (oldValue - newValue) / 8.0

					// Atkinson pattern
					//    *  1  1
					// 1  1  1
					//    1
					if x+worker.pixelSize < width {
						errors[y-startY][x+worker.pixelSize] += quantError
					}
					if x+worker.pixelSize*2 < width {
						errors[y-startY][x+worker.pixelSize*2] += quantError
					}
					if y+worker.pixelSize < height {
						if x >= worker.pixelSize {
							errors[y-startY+worker.pixelSize][x-worker.pixelSize] += quantError
						}
						errors[y-startY+worker.pixelSize][x] += quantError
						if x+worker.pixelSize < width {
							errors[y-startY+worker.pixelSize][x+worker.pixelSize] += quantError
						}
					}
					if y+worker.pixelSize*2 < height {
						errors[y-startY+worker.pixelSize*2][x] += quantError
					}
				}
			}
		}(i)
	}

	wg.Wait()
	return result
}

// stucki applies the Stucki dithering algorithm in parallel
func stucki(img image.Image, scale float64, invert bool) image.Image {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	result := image.NewGray(bounds)

	worker := NewDitherWorker(scale, invert)
	var wg sync.WaitGroup

	numGoroutines := runtime.NumCPU()
	rowsPerGoroutine := (height + numGoroutines - 1) / numGoroutines
	errorBuffers := make([][][]float64, numGoroutines)

	for i := range errorBuffers {
		startY := i * rowsPerGoroutine
		endY := startY + rowsPerGoroutine
		if endY > height {
			endY = height
		}
		bufferHeight := endY - startY + worker.pixelSize*2 // Two extra rows for error diffusion
		errorBuffers[i] = make([][]float64, bufferHeight)
		for j := range errorBuffers[i] {
			errorBuffers[i][j] = make([]float64, width)
		}
	}

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(workerIndex int) {
			defer wg.Done()
			startY := workerIndex * rowsPerGoroutine
			endY := startY + rowsPerGoroutine
			if endY > height {
				endY = height
			}

			errors := errorBuffers[workerIndex]

			for y := startY; y < endY; y += worker.pixelSize {
				for x := 0; x < width; x += worker.pixelSize {
					var sum float64
					count := 0
					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							oldPixel := color.GrayModel.Convert(img.At(x+dx, y+dy)).(color.Gray)
							sum += float64(oldPixel.Y) + errors[dy][x+dx]
							count++
						}
					}
					oldValue := sum / float64(count)

					newValue := float64(255)
					if (oldValue < 128) != worker.invert {
						newValue = 0
					}

					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							result.Set(x+dx, y+dy, color.Gray{Y: uint8(newValue)})
						}
					}

					quantError := (oldValue - newValue) / 42.0

					// Stucki pattern
					//     *  8  4
					// 2  4  8  4  2
					// 1  2  4  2  1
					if x+worker.pixelSize < width {
						errors[y-startY][x+worker.pixelSize] += quantError * 8
					}
					if x+worker.pixelSize*2 < width {
						errors[y-startY][x+worker.pixelSize*2] += quantError * 4
					}
					if y+worker.pixelSize < height {
						if x >= worker.pixelSize*2 {
							errors[y-startY+worker.pixelSize][x-worker.pixelSize*2] += quantError * 2
						}
						if x >= worker.pixelSize {
							errors[y-startY+worker.pixelSize][x-worker.pixelSize] += quantError * 4
						}
						errors[y-startY+worker.pixelSize][x] += quantError * 8
						if x+worker.pixelSize < width {
							errors[y-startY+worker.pixelSize][x+worker.pixelSize] += quantError * 4
						}
						if x+worker.pixelSize*2 < width {
							errors[y-startY+worker.pixelSize][x+worker.pixelSize*2] += quantError * 2
						}
					}
					if y+worker.pixelSize*2 < height {
						if x >= worker.pixelSize*2 {
							errors[y-startY+worker.pixelSize*2][x-worker.pixelSize*2] += quantError
						}
						if x >= worker.pixelSize {
							errors[y-startY+worker.pixelSize*2][x-worker.pixelSize] += quantError * 2
						}
						errors[y-startY+worker.pixelSize*2][x] += quantError * 4
						if x+worker.pixelSize < width {
							errors[y-startY+worker.pixelSize*2][x+worker.pixelSize] += quantError * 2
						}
						if x+worker.pixelSize*2 < width {
							errors[y-startY+worker.pixelSize*2][x+worker.pixelSize*2] += quantError
						}
					}
				}
			}
		}(i)
	}

	wg.Wait()
	return result
}

// sierra applies the Sierra dithering algorithm in parallel
func sierra(img image.Image, scale float64, invert bool) image.Image {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	result := image.NewGray(bounds)

	worker := NewDitherWorker(scale, invert)
	var wg sync.WaitGroup

	numGoroutines := runtime.NumCPU()
	rowsPerGoroutine := (height + numGoroutines - 1) / numGoroutines
	errorBuffers := make([][][]float64, numGoroutines)

	for i := range errorBuffers {
		startY := i * rowsPerGoroutine
		endY := startY + rowsPerGoroutine
		if endY > height {
			endY = height
		}
		bufferHeight := endY - startY + worker.pixelSize*2 // Two extra rows for error diffusion
		errorBuffers[i] = make([][]float64, bufferHeight)
		for j := range errorBuffers[i] {
			errorBuffers[i][j] = make([]float64, width)
		}
	}

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(workerIndex int) {
			defer wg.Done()
			startY := workerIndex * rowsPerGoroutine
			endY := startY + rowsPerGoroutine
			if endY > height {
				endY = height
			}

			errors := errorBuffers[workerIndex]

			for y := startY; y < endY; y += worker.pixelSize {
				for x := 0; x < width; x += worker.pixelSize {
					var sum float64
					count := 0
					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							oldPixel := color.GrayModel.Convert(img.At(x+dx, y+dy)).(color.Gray)
							sum += float64(oldPixel.Y) + errors[dy][x+dx]
							count++
						}
					}
					oldValue := sum / float64(count)

					newValue := float64(255)
					if (oldValue < 128) != worker.invert {
						newValue = 0
					}

					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							result.Set(x+dx, y+dy, color.Gray{Y: uint8(newValue)})
						}
					}

					quantError := (oldValue - newValue) / 32.0

					// Sierra pattern
					//     *  5  3
					// 2  4  5  4  2
					//    2  3  2
					if x+worker.pixelSize < width {
						errors[y-startY][x+worker.pixelSize] += quantError * 5
					}
					if x+worker.pixelSize*2 < width {
						errors[y-startY][x+worker.pixelSize*2] += quantError * 3
					}
					if y+worker.pixelSize < height {
						if x >= worker.pixelSize*2 {
							errors[y-startY+worker.pixelSize][x-worker.pixelSize*2] += quantError * 2
						}
						if x >= worker.pixelSize {
							errors[y-startY+worker.pixelSize][x-worker.pixelSize] += quantError * 4
						}
						errors[y-startY+worker.pixelSize][x] += quantError * 5
						if x+worker.pixelSize < width {
							errors[y-startY+worker.pixelSize][x+worker.pixelSize] += quantError * 4
						}
						if x+worker.pixelSize*2 < width {
							errors[y-startY+worker.pixelSize][x+worker.pixelSize*2] += quantError * 2
						}
					}
					if y+worker.pixelSize*2 < height {
						if x >= worker.pixelSize {
							errors[y-startY+worker.pixelSize*2][x-worker.pixelSize] += quantError * 2
						}
						errors[y-startY+worker.pixelSize*2][x] += quantError * 3
						if x+worker.pixelSize < width {
							errors[y-startY+worker.pixelSize*2][x+worker.pixelSize] += quantError * 2
						}
					}
				}
			}
		}(i)
	}

	wg.Wait()
	return result
}

// ordered applies ordered dithering using 4x4 Bayer matrix in parallel
func ordered(img image.Image, scale float64, invert bool) image.Image {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	result := image.NewGray(bounds)

	worker := NewDitherWorker(scale, invert)
	var wg sync.WaitGroup

	// Process image in parallel by rows
	numGoroutines := runtime.NumCPU()
	rowsPerGoroutine := (height + numGoroutines - 1) / numGoroutines

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(workerIndex int) {
			defer wg.Done()
			startY := workerIndex * rowsPerGoroutine
			endY := startY + rowsPerGoroutine
			if endY > height {
				endY = height
			}

			// Process rows
			for y := startY; y < endY; y += worker.pixelSize {
				for x := 0; x < width; x += worker.pixelSize {
					// Average the pixel block with local buffer
					sum := float64(0)
					count := 0
					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							oldPixel := color.GrayModel.Convert(img.At(x+dx, y+dy)).(color.Gray)
							sum += float64(oldPixel.Y)
							count++
						}
					}
					oldValue := sum / float64(count)

					// Get threshold from Bayer matrix using the block position
					bayerThreshold := float64(worker.bayerMatrix[(y/worker.pixelSize)%4][(x/worker.pixelSize)%4]) / 16.0 * 255.0
					threshold := 128 + (bayerThreshold - 128)

					// Determine output value with inversion
					newValue := uint8(255)
					if (oldValue < threshold) != worker.invert {
						newValue = 0
					}

					// Set the block atomically
					for dy := 0; dy < worker.pixelSize && y+dy < height; dy++ {
						for dx := 0; dx < worker.pixelSize && x+dx < width; dx++ {
							result.Set(x+dx, y+dy, color.Gray{Y: newValue})
						}
					}
				}
			}
		}(i)
	}

	wg.Wait()
	return result
}
