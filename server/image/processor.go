package image

import (
	"image"
	"image/color"
	"io"
	"math"
)

// ProcessImage handles all image processing steps: decoding, adjustments, and blur
func ProcessImage(src io.Reader, contrast, midtones, highlights, luminance, blur float64) (image.Image, error) {
	// Decode the image
	img, _, err := image.Decode(src)
	if err != nil {
		return nil, err
	}

	// Apply adjustments
	img = adjustImage(img, contrast, midtones, highlights, luminance)

	// Apply blur if needed
	if blur > 0 {
		img = applyBlur(img, blur)
	}

	return img, nil
}

// adjustImage applies contrast, midtones, highlights, and luminance adjustments
func adjustImage(img image.Image, contrast, midtones, highlights, luminance float64) image.Image {
	bounds := img.Bounds()
	adjusted := image.NewRGBA(bounds)

	// Normalize parameters to -1 to 1 range for contrast, 0-1 for others
	contrast = (contrast - 50.0) / 50.0 // Convert 0-100 to -1 to 1
	midtones = midtones / 100.0
	highlights = highlights / 100.0
	luminance = luminance / 100.0

	// Pre-calculate contrast curve parameters
	contrastFactor := math.Tan((contrast + 1) * math.Pi / 4)

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			pixel := img.At(x, y)
			r, g, b, a := pixel.RGBA()

			// Convert to 0-1 range
			r = r >> 8
			g = g >> 8
			b = b >> 8
			a = a >> 8

			// Calculate luminance value
			lum := (0.299*float64(r) + 0.587*float64(g) + 0.114*float64(b)) / 255.0

			// Apply contrast using smooth S-curve
			if contrast != 0 {
				lum = 0.5 + (math.Atan((lum-0.5)*contrastFactor)/math.Pi*2.0)*0.5
			}

			// Apply midtones using power curve
			if midtones != 0.5 {
				gamma := 1.0 + (midtones-0.5)*2.0 // Convert 0-1 to gamma range 0.0-3.0
				if gamma != 0 {
					lum = math.Pow(lum, 1.0/gamma)
				}
			}

			// Apply highlights with smooth rolloff
			if highlights > 0 {
				threshold := 0.5
				if lum > threshold {
					factor := (lum - threshold) / (1.0 - threshold)
					boost := factor * highlights
					lum = lum + (1.0-lum)*boost*(1.0-factor) // Reduce boost near white
				}
			}

			// Apply luminance threshold with smooth transition
			if luminance > 0 {
				threshold := luminance
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
			adjusted.Set(x, y, color.RGBA{gray, gray, gray, uint8(a)})
		}
	}

	return adjusted
}

// applyBlur applies a Gaussian blur effect using separable convolution
func applyBlur(img image.Image, radius float64) image.Image {
	if radius <= 0 {
		return img
	}

	bounds := img.Bounds()
	sigma := radius / 2.0
	kernelSize := int(math.Ceil(radius * 3)) // Cover 3 standard deviations
	if kernelSize%2 == 0 {
		kernelSize++
	}

	// Create 1D Gaussian kernel
	kernel := make([]float64, kernelSize)
	sum := 0.0
	offset := kernelSize / 2
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

	// Horizontal pass
	horizontal := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			var sum float64
			var totalWeight float64

			for i := 0; i < kernelSize; i++ {
				ix := x + i - offset
				if ix >= bounds.Min.X && ix < bounds.Max.X {
					pixel := color.GrayModel.Convert(img.At(ix, y)).(color.Gray)
					weight := kernel[i]
					sum += float64(pixel.Y) * weight
					totalWeight += weight
				}
			}

			if totalWeight > 0 {
				sum /= totalWeight
			}
			value := uint8(math.Min(math.Max(sum, 0), 255))
			horizontal.Set(x, y, color.Gray{Y: value})
		}
	}

	// Vertical pass
	result := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			var sum float64
			var totalWeight float64

			for i := 0; i < kernelSize; i++ {
				iy := y + i - offset
				if iy >= bounds.Min.Y && iy < bounds.Max.Y {
					pixel := color.GrayModel.Convert(horizontal.At(x, iy)).(color.Gray)
					weight := kernel[i]
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

	return result
}
