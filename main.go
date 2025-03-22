package main

import (
    "bytes"
    "image"
    "image/color"
    "image/jpeg"
    "image/png"
    "log"
    "math"
    "strconv"

    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/cors"
)

// Register image formats
func init() {
    image.RegisterFormat("jpeg", "jpeg", jpeg.Decode, jpeg.DecodeConfig)
    image.RegisterFormat("jpg", "\xff\xd8\xff", jpeg.Decode, jpeg.DecodeConfig)
}

func main() {
app := fiber.New(fiber.Config{
    ErrorHandler: func(c *fiber.Ctx, err error) error {
        log.Printf("Error: %v\n", err)
        return c.Status(500).JSON(fiber.Map{
            "error": err.Error(),
        })
    },
})

// Enable CORS with specific configuration
app.Use(cors.New(cors.Config{
    AllowOrigins: "*",
    AllowMethods: "GET,POST,HEAD,PUT,DELETE,PATCH",
    AllowHeaders: "Origin, Content-Type, Accept",
}))

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

// Get parameters
algorithm := c.FormValue("algorithm", "floyd-steinberg")
threshold, err := strconv.ParseFloat(c.FormValue("threshold", "128"), 64)
if err != nil {
    return c.Status(400).JSON(fiber.Map{
        "error": "Invalid threshold value",
    })
}

contrast, err := strconv.ParseFloat(c.FormValue("contrast", "0"), 64)
if err != nil {
    return c.Status(400).JSON(fiber.Map{
        "error": "Invalid contrast value",
    })
}

midtones, err := strconv.ParseFloat(c.FormValue("midtones", "0"), 64)
if err != nil {
    return c.Status(400).JSON(fiber.Map{
        "error": "Invalid midtones value",
    })
}

highlights, err := strconv.ParseFloat(c.FormValue("highlights", "0"), 64)
if err != nil {
    return c.Status(400).JSON(fiber.Map{
        "error": "Invalid highlights value",
    })
}

luminanceThreshold, err := strconv.ParseFloat(c.FormValue("luminanceThreshold", "128"), 64)
if err != nil {
    return c.Status(400).JSON(fiber.Map{
        "error": "Invalid luminance threshold value",
    })
}

blur, err := strconv.ParseFloat(c.FormValue("blur", "0"), 64)
if err != nil {
    return c.Status(400).JSON(fiber.Map{
        "error": "Invalid blur value",
    })
}
scale, err := strconv.ParseFloat(c.FormValue("scale", "1.0"), 64)
if err != nil {
    return c.Status(400).JSON(fiber.Map{
        "error": "Invalid scale value",
    })
}
ditherScale, err := strconv.ParseInt(c.FormValue("ditherScale", "1"), 10, 64)
if err != nil {
    return c.Status(400).JSON(fiber.Map{
        "error": "Invalid dither scale value",
    })
}

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

// Process image
img = adjustImage(img, contrast, midtones, highlights, luminanceThreshold)
if blur > 0 {
    img = applyBlur(img, blur)
}

// Apply dithering
var dithered image.Image
switch algorithm {
case "floyd-steinberg":
    dithered = floydSteinberg(img, threshold, scale, int(ditherScale))
case "ordered":
    dithered = ordered(img, threshold, int(ditherScale))
default:
    dithered = floydSteinberg(img, threshold, scale, int(ditherScale))
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
func floydSteinberg(img image.Image, threshold, scale float64, ditherScale int) image.Image {
    bounds := img.Bounds()
    width, height := bounds.Max.X, bounds.Max.Y
    result := image.NewGray(bounds)
    
    // Ensure minimum scale of 1
    if ditherScale < 1 {
        ditherScale = 1
    }
    
    // Calculate scaled dimensions with ceiling division to ensure we cover all pixels
    scaledWidth := (width + ditherScale - 1) / ditherScale
    scaledHeight := (height + ditherScale - 1) / ditherScale

    // Create error diffusion buffer for scaled dimensions
    errors := make([][]float64, scaledHeight)
    for i := range errors {
        errors[i] = make([]float64, scaledWidth)
    }

    // Create averaged input buffer for scaled dimensions
    scaled := make([][]float64, scaledHeight)
    for i := range scaled {
        scaled[i] = make([]float64, scaledWidth)
        for j := range scaled[i] {
            scaled[i][j] = 0
        }
    }

    // Count pixels in each block for proper averaging
    blockCounts := make([][]int, scaledHeight)
    for i := range blockCounts {
        blockCounts[i] = make([]int, scaledWidth)
    }

    // Average pixels in each block
    for y := 0; y < height; y++ {
        sy := y / ditherScale
        if sy >= scaledHeight {
            continue
        }
        for x := 0; x < width; x++ {
            sx := x / ditherScale
            if sx >= scaledWidth {
                continue
            }
            oldPixel := color.GrayModel.Convert(img.At(x, y)).(color.Gray)
            scaled[sy][sx] += float64(oldPixel.Y)
            blockCounts[sy][sx]++
        }
    }

    // Normalize the values by the actual number of pixels in each block
    for y := 0; y < scaledHeight; y++ {
        for x := 0; x < scaledWidth; x++ {
            if blockCounts[y][x] > 0 {
                scaled[y][x] /= float64(blockCounts[y][x])
            }
        }
    }

    // Apply dithering to scaled image
    for y := 0; y < scaledHeight; y++ {
        for x := 0; x < scaledWidth; x++ {
            // Get scaled pixel value with error
            oldValue := scaled[y][x] + errors[y][x]

// Determine new binary value
var newValue float64
if oldValue < threshold {
    newValue = 0
} else {
    newValue = 255
}

            // Set all pixels in the block
            for dy := 0; dy < int(ditherScale); dy++ {
                if y*int(ditherScale)+dy >= height {
                    continue
                }
                for dx := 0; dx < int(ditherScale); dx++ {
                    if x*int(ditherScale)+dx >= width {
                        continue
                    }
                    result.Set(x*int(ditherScale)+dx, y*int(ditherScale)+dy, color.Gray{Y: uint8(newValue)})
                }
            }

			// Calculate error
			quantError := oldValue - newValue

// Distribute error with scaling
if x < scaledWidth-1 {
    errors[y][x+1] += quantError * 7 / 16 * scale
}
if y < scaledHeight-1 {
    if x > 0 {
        errors[y+1][x-1] += quantError * 3 / 16 * scale
    }
    errors[y+1][x] += quantError * 5 / 16 * scale
    if x < scaledWidth-1 {
        errors[y+1][x+1] += quantError * 1 / 16 * scale
    }
}
		}
	}

return result
}

// adjustImage applies contrast, midtones, highlights, and luminance threshold adjustments
func adjustImage(img image.Image, contrast, midtones, highlights, luminanceThreshold float64) image.Image {
    bounds := img.Bounds()
    adjusted := image.NewRGBA(bounds)
    
    // Normalize parameters
    contrast = contrast / 100.0 // Convert to -1.0 to 1.0
    midtones = midtones / 100.0
    highlights = highlights / 100.0
    
    for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
        for x := bounds.Min.X; x < bounds.Max.X; x++ {
            pixel := img.At(x, y)
            r, g, b, a := pixel.RGBA()
            
            // Convert to 0-1 range
            r = r >> 8
            g = g >> 8
            b = b >> 8
            a = a >> 8
            
            // Calculate luminance
            luminance := (0.299*float64(r) + 0.587*float64(g) + 0.114*float64(b)) / 255.0
            
            // Apply contrast
            if contrast != 0 {
                luminance = (luminance - 0.5) * (1.0 + contrast) + 0.5
            }
            
            // Apply midtones
            if midtones != 0 {
                if luminance < 0.5 {
                    luminance = luminance * (1.0 - midtones)
                } else {
                    luminance = luminance + (1.0 - luminance) * midtones
                }
            }
            
            // Apply highlights
            if highlights != 0 {
                if luminance > 0.5 {
                    luminance = luminance + (1.0 - luminance) * highlights
                }
            }
            
            // Apply luminance threshold
            if luminance * 255.0 < luminanceThreshold {
                luminance = 0.0
            }
            
            // Clamp values
            luminance = math.Max(0.0, math.Min(1.0, luminance))
            
            // Convert back to RGB
            gray := uint8(luminance * 255.0)
            adjusted.Set(x, y, color.RGBA{gray, gray, gray, uint8(a)})
        }
    }
    
    return adjusted
}

// applyBlur applies a Gaussian blur effect
func applyBlur(img image.Image, radius float64) image.Image {
    bounds := img.Bounds()
    blurred := image.NewRGBA(bounds)
    
    // Create kernel
    size := int(radius * 2)
    if size < 1 {
        size = 1
    }
    kernel := make([][]float64, size)
    sigma := radius / 2.0
    twoSigmaSquare := 2 * sigma * sigma
    sum := 0.0
    
    for i := 0; i < size; i++ {
        kernel[i] = make([]float64, size)
        for j := 0; j < size; j++ {
            x := float64(i - size/2)
            y := float64(j - size/2)
            kernel[i][j] = math.Exp(-(x*x + y*y) / twoSigmaSquare)
            sum += kernel[i][j]
        }
    }
    
    // Normalize kernel
    for i := 0; i < size; i++ {
        for j := 0; j < size; j++ {
            kernel[i][j] /= sum
        }
    }
    
    // Apply convolution
    offset := size / 2
    for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
        for x := bounds.Min.X; x < bounds.Max.X; x++ {
            var r, g, b, a float64
            
            // Apply kernel
            for ky := 0; ky < size; ky++ {
                for kx := 0; kx < size; kx++ {
                    ix := x + kx - offset
                    iy := y + ky - offset
                    
                    if ix >= bounds.Min.X && ix < bounds.Max.X && iy >= bounds.Min.Y && iy < bounds.Max.Y {
                        pixel := img.At(ix, iy)
                        pr, pg, pb, pa := pixel.RGBA()
                        weight := kernel[ky][kx]
                        
                        r += float64(pr>>8) * weight
                        g += float64(pg>>8) * weight
                        b += float64(pb>>8) * weight
                        a += float64(pa>>8) * weight
                    }
                }
            }
            
            // Set pixel
            gray := uint8((r*0.299 + g*0.587 + b*0.114))
            blurred.Set(x, y, color.RGBA{gray, gray, gray, uint8(a)})
        }
    }
    
    return blurred
}

// Ordered dithering algorithm using 4x4 Bayer matrix
func ordered(img image.Image, threshold float64, ditherScale int) image.Image {
    bounds := img.Bounds()
    width, height := bounds.Max.X, bounds.Max.Y
    result := image.NewGray(bounds)

    // Ensure minimum scale of 1
    if ditherScale < 1 {
        ditherScale = 1
    }

    // Calculate scaled dimensions with ceiling division to ensure we cover all pixels
    scaledWidth := (width + ditherScale - 1) / ditherScale
    scaledHeight := (height + ditherScale - 1) / ditherScale

    // 4x4 Bayer matrix
    bayerMatrix := [][]int{
        {0, 8, 2, 10},
        {12, 4, 14, 6},
        {3, 11, 1, 9},
        {15, 7, 13, 5},
    }

    // Create averaged input buffer for scaled dimensions
    scaled := make([][]float64, scaledHeight)
    for i := range scaled {
        scaled[i] = make([]float64, scaledWidth)
    }

    // Count pixels in each block for proper averaging
    blockCounts := make([][]int, scaledHeight)
    for i := range blockCounts {
        blockCounts[i] = make([]int, scaledWidth)
    }

    // Average pixels in each block
    for y := 0; y < height; y++ {
        sy := y / ditherScale
        if sy >= scaledHeight {
            continue
        }
        for x := 0; x < width; x++ {
            sx := x / ditherScale
            if sx >= scaledWidth {
                continue
            }
            oldPixel := color.GrayModel.Convert(img.At(x, y)).(color.Gray)
            scaled[sy][sx] += float64(oldPixel.Y)
            blockCounts[sy][sx]++
        }
    }

    // Normalize the values by the actual number of pixels in each block
    for y := 0; y < scaledHeight; y++ {
        for x := 0; x < scaledWidth; x++ {
            if blockCounts[y][x] > 0 {
                scaled[y][x] /= float64(blockCounts[y][x])
            }
        }
    }

    // Apply ordered dithering to scaled image
    for y := 0; y < scaledHeight; y++ {
        for x := 0; x < scaledWidth; x++ {
            oldValue := scaled[y][x]

// Get threshold value and scale it based on input threshold
baseThreshold := float64(bayerMatrix[y%4][x%4]) / 16 * 255
scaledThreshold := (baseThreshold / 128) * threshold

            // Compare and set value for all pixels in the block
            var newValue uint8
            if oldValue < scaledThreshold {
                newValue = 0
            } else {
                newValue = 255
            }

            for dy := 0; dy < int(ditherScale); dy++ {
                if y*int(ditherScale)+dy >= height {
                    continue
                }
                for dx := 0; dx < int(ditherScale); dx++ {
                    if x*int(ditherScale)+dx >= width {
                        continue
                    }
                    result.Set(x*int(ditherScale)+dx, y*int(ditherScale)+dy, color.Gray{Y: newValue})
                }
            }
		}
	}

	return result
}
