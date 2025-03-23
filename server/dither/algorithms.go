package dither

import (
	"image"
	"image/color"
	"math"
)

// Apply applies the selected dithering algorithm to the image
func Apply(img image.Image, algorithm string, scale float64, invert bool) image.Image {
	switch algorithm {
	case "floyd-steinberg":
		return floydSteinberg(img, scale, invert)
	case "ordered":
		return ordered(img, scale, invert)
	default:
		return floydSteinberg(img, scale, invert)
	}
}

// floydSteinberg applies the Floyd-Steinberg dithering algorithm
func floydSteinberg(img image.Image, scale float64, invert bool) image.Image {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	result := image.NewGray(bounds)

	// Create error diffusion buffer
	errors := make([][]float64, height)
	for i := range errors {
		errors[i] = make([]float64, width)
	}

	// Calculate pixel size based on scale (1-20)
	pixelSize := int(math.Max(1, math.Round(scale)))

	// Apply dithering with scaled pixels
	for y := 0; y < height; y += pixelSize {
		for x := 0; x < width; x += pixelSize {
			// Average the pixel block
			var sum float64
			count := 0
			for dy := 0; dy < pixelSize && y+dy < height; dy++ {
				for dx := 0; dx < pixelSize && x+dx < width; dx++ {
					oldPixel := color.GrayModel.Convert(img.At(x+dx, y+dy)).(color.Gray)
					sum += float64(oldPixel.Y) + errors[y+dy][x+dx]
					count++
				}
			}
			oldValue := sum / float64(count)

			// Determine new binary value with inversion
			var newValue float64
			if oldValue < 128 {
				if invert {
					newValue = 255
				} else {
					newValue = 0
				}
			} else {
				if invert {
					newValue = 0
				} else {
					newValue = 255
				}
			}

			// Set the entire block to the same value
			for dy := 0; dy < pixelSize && y+dy < height; dy++ {
				for dx := 0; dx < pixelSize && x+dx < width; dx++ {
					result.Set(x+dx, y+dy, color.Gray{Y: uint8(newValue)})
				}
			}

			// Calculate error
			quantError := oldValue - newValue

			// Distribute error to the next block
			if x+pixelSize < width {
				errors[y][x+pixelSize] += quantError * 7 / 16
			}
			if y+pixelSize < height {
				if x >= pixelSize {
					errors[y+pixelSize][x-pixelSize] += quantError * 3 / 16
				}
				errors[y+pixelSize][x] += quantError * 5 / 16
				if x+pixelSize < width {
					errors[y+pixelSize][x+pixelSize] += quantError * 1 / 16
				}
			}
		}
	}

	return result
}

// ordered applies ordered dithering using 4x4 Bayer matrix
func ordered(img image.Image, scale float64, invert bool) image.Image {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	result := image.NewGray(bounds)

	// 4x4 Bayer matrix
	bayerMatrix := [][]int{
		{0, 8, 2, 10},
		{12, 4, 14, 6},
		{3, 11, 1, 9},
		{15, 7, 13, 5},
	}

	// Calculate pixel size based on scale (1-20)
	pixelSize := int(math.Max(1, math.Round(scale)))

	for y := 0; y < height; y += pixelSize {
		for x := 0; x < width; x += pixelSize {
			// Average the pixel block
			var sum float64
			count := 0
			for dy := 0; dy < pixelSize && y+dy < height; dy++ {
				for dx := 0; dx < pixelSize && x+dx < width; dx++ {
					oldPixel := color.GrayModel.Convert(img.At(x+dx, y+dy)).(color.Gray)
					sum += float64(oldPixel.Y)
					count++
				}
			}
			oldValue := sum / float64(count)

			// Get threshold from Bayer matrix using the block position
			bayerThreshold := float64(bayerMatrix[(y/pixelSize)%4][(x/pixelSize)%4]) / 16.0 * 255.0
			threshold := 128 + (bayerThreshold - 128)

			// Determine output value with inversion
			var newValue uint8
			if oldValue < threshold {
				if invert {
					newValue = 255
				} else {
					newValue = 0
				}
			} else {
				if invert {
					newValue = 0
				} else {
					newValue = 255
				}
			}

			// Set the entire block to the same value
			for dy := 0; dy < pixelSize && y+dy < height; dy++ {
				for dx := 0; dx < pixelSize && x+dx < width; dx++ {
					result.Set(x+dx, y+dy, color.Gray{Y: newValue})
				}
			}
		}
	}

	return result
}
