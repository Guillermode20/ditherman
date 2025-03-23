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
    image.RegisterFormat("jpg", "", jpeg.Decode, jpeg.DecodeConfig)
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

    // Decode the image
    img, _, err := image.Decode(src)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "Failed to decode image: " + err.Error(),
        })
    }

    // Process image
    img = adjustImage(img, contrast, midtones, highlights, luminance)
    if blur > 0 {
        img = applyBlur(img, blur)
    }

    // Apply dithering
    var dithered image.Image
    switch algorithm {
    case "floyd-steinberg":
        dithered = floydSteinberg(img, scale, invert)
    case "ordered":
        dithered = ordered(img, scale, invert)
    default:
        dithered = floydSteinberg(img, scale, invert)
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

// Ordered dithering algorithm using 4x4 Bayer matrix
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

// adjustImage applies contrast, midtones, highlights, and luminance adjustments
func adjustImage(img image.Image, contrast, midtones, highlights, luminance float64) image.Image {
    bounds := img.Bounds()
    adjusted := image.NewRGBA(bounds)
    
    // Normalize parameters to -1 to 1 range for contrast, 0-1 for others
    contrast = (contrast - 50.0) / 50.0  // Convert 0-100 to -1 to 1
    midtones = midtones / 100.0
    highlights = highlights / 100.0
    luminance = luminance / 100.0
    
    // Pre-calculate contrast curve parameters
    contrastFactor := math.Tan((contrast + 1) * math.Pi/4)
    
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
                lum = 0.5 + (math.Atan((lum-0.5)*contrastFactor) / math.Pi * 2.0) * 0.5
            }
            
            // Apply midtones using power curve
            if midtones != 0.5 {
                gamma := 1.0 + (midtones - 0.5)*2.0  // Convert 0-1 to gamma range 0.0-3.0
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
                    lum = lum + (1.0 - lum) * boost * (1.0 - factor)  // Reduce boost near white
                }
            }
            
            // Apply luminance threshold with smooth transition
            if luminance > 0 {
                threshold := luminance
                transition := 0.1  // 10% smooth transition zone
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
