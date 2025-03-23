package handlers

import (
	"bytes"
	"image/png"
	"math"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/willhick/ditherman/server/dither"
	"github.com/willhick/ditherman/server/image"
)

func HandleDither(c *fiber.Ctx) error {
	// Get the uploaded file
	file, err := c.FormFile("image")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "No image provided",
		})
	}

	// Get parameters
	algorithm := c.FormValue("algorithm", "floyd-steinberg")
	invert := c.FormValue("invert", "0") == "1"

	scale, err := strconv.ParseFloat(c.FormValue("scale", "1.0"), 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid scale value",
		})
	}
	// Scale to 0-20 range
	scale = math.Min(math.Max(scale, 0), 20)

	contrast, err := strconv.ParseFloat(c.FormValue("contrast", "50"), 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid contrast value",
		})
	}
	// Scale to 0-100 range
	contrast = math.Min(math.Max(contrast, 0), 100)

	midtones, err := strconv.ParseFloat(c.FormValue("midtones", "50"), 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid midtones value",
		})
	}
	// Scale to 0-100 range
	midtones = math.Min(math.Max(midtones, 0), 100)

	highlights, err := strconv.ParseFloat(c.FormValue("highlights", "50"), 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid highlights value",
		})
	}
	// Scale to 0-100 range
	highlights = math.Min(math.Max(highlights, 0), 100)

	luminance, err := strconv.ParseFloat(c.FormValue("luminanceThreshold", "50"), 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid luminance value",
		})
	}
	// Scale to 0-100 range
	luminance = math.Min(math.Max(luminance, 0), 100)

	blur, err := strconv.ParseFloat(c.FormValue("blur", "0"), 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid blur value",
		})
	}
	// Scale to 0-10 range
	blur = math.Min(math.Max(blur, 0), 10)

	// Open the file
	src, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to open uploaded file: " + err.Error(),
		})
	}
	defer src.Close()

	// Decode and process the image
	img, err := image.ProcessImage(src, contrast, midtones, highlights, luminance, blur)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Failed to process image: " + err.Error(),
		})
	}

	// Apply dithering
	var dithered = dither.Apply(img, algorithm, scale, invert)

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
