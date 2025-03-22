package main

import (
"bytes"
"image"
"image/color"
"image/jpeg" // Add JPEG support
"image/png"
"log"

"github.com/gofiber/fiber/v2"
"github.com/gofiber/fiber/v2/middleware/cors"
)

// Register image formats
func init() {
    image.RegisterFormat("jpeg", "jpeg", jpeg.Decode, jpeg.DecodeConfig)
    image.RegisterFormat("jpg", "\xff\xd8\xff", jpeg.Decode, jpeg.DecodeConfig)
}

func main() {
	app := fiber.New()

	// Enable CORS
	app.Use(cors.New())

	// Serve static files
	app.Static("/", "./static")

	// Upload endpoint
	app.Post("/dither", handleDither)

	log.Fatal(app.Listen(":3000"))
}

func handleDither(c *fiber.Ctx) error {
	// Get the uploaded file
	file, err := c.FormFile("image")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "No image provided",
		})
	}

	// Get dithering algorithm choice
	algorithm := c.FormValue("algorithm", "floyd-steinberg")

// Open the file
src, err := file.Open()
if err != nil {
return c.Status(500).JSON(fiber.Map{
    "error": "Failed to open uploaded file: " + err.Error(),
})
}
	defer src.Close()

// Decode the image
img, _, err := image.Decode(src)
if err != nil {
return c.Status(400).JSON(fiber.Map{
    "error": "Failed to decode image: " + err.Error(),
})
}

	// Apply dithering
	var dithered image.Image
	switch algorithm {
	case "floyd-steinberg":
		dithered = floydSteinberg(img)
	case "ordered":
		dithered = ordered(img)
	default:
		dithered = floydSteinberg(img)
	}

// Encode the result
var buf bytes.Buffer
if err := png.Encode(&buf, dithered); err != nil {
return c.Status(500).JSON(fiber.Map{
    "error": "Failed to encode result: " + err.Error(),
})
}

	c.Set("Content-Type", "image/png")
	return c.Send(buf.Bytes())
}

// Floyd-Steinberg dithering algorithm
func floydSteinberg(img image.Image) image.Image {
	bounds := img.Bounds()
	width, height := bounds.Max.X, bounds.Max.Y
	result := image.NewGray(bounds)

	// Create error diffusion buffer
	errors := make([][]float64, height)
	for i := range errors {
		errors[i] = make([]float64, width)
	}

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			// Get original pixel value
			oldPixel := color.GrayModel.Convert(img.At(x, y)).(color.Gray)
			oldValue := float64(oldPixel.Y)

			// Add error from previous pixels
			oldValue += errors[y][x]

			// Determine new binary value
			var newValue float64
			if oldValue < 128 {
				newValue = 0
			} else {
				newValue = 255
			}

			// Set the pixel
			result.Set(x, y, color.Gray{Y: uint8(newValue)})

			// Calculate error
			quantError := oldValue - newValue

			// Distribute error
			if x < width-1 {
				errors[y][x+1] += quantError * 7 / 16
			}
			if y < height-1 {
				if x > 0 {
					errors[y+1][x-1] += quantError * 3 / 16
				}
				errors[y+1][x] += quantError * 5 / 16
				if x < width-1 {
					errors[y+1][x+1] += quantError * 1 / 16
				}
			}
		}
	}

	return result
}

// Ordered dithering algorithm using 4x4 Bayer matrix
func ordered(img image.Image) image.Image {
	bounds := img.Bounds()
	result := image.NewGray(bounds)

	// 4x4 Bayer matrix
	threshold := [][]int{
		{0, 8, 2, 10},
		{12, 4, 14, 6},
		{3, 11, 1, 9},
		{15, 7, 13, 5},
	}

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			// Get pixel value
			oldPixel := color.GrayModel.Convert(img.At(x, y)).(color.Gray)
			oldValue := float64(oldPixel.Y)

			// Get threshold value
			t := float64(threshold[y%4][x%4]) / 16 * 255

			// Compare and set new value
			if oldValue < t {
				result.Set(x, y, color.Gray{Y: 0})
			} else {
				result.Set(x, y, color.Gray{Y: 255})
			}
		}
	}

	return result
}
