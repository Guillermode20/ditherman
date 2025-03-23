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

    contrast, err := strconv.ParseFloat(c.FormValue("contrast", "0"), 64)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "Invalid contrast value",
        })
    }
    // Scale to 0-100 range
    contrast = math.Min(math.Max(contrast, 0), 100)

    midtones, err := strconv.ParseFloat(c.FormValue("midtones", "0"), 64)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "Invalid midtones value",
        })
    }
    // Scale to 0-100 range
    midtones = math.Min(math.Max(midtones, 0), 100)

    highlights, err := strconv.ParseFloat(c.FormValue("highlights", "0"), 64)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "Invalid highlights value",
        })
    }
    // Scale to 0-100 range
    highlights = math.Min(math.Max(highlights, 0), 100)

    luminance, err := strconv.ParseFloat(c.FormValue("luminanceThreshold", "0"), 64)
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

    // Apply dithering
    for y := 0; y < height; y++ {
        for x := 0; x < width; x++ {
            oldPixel := color.GrayModel.Convert(img.At(x, y)).(color.Gray)
            oldValue := float64(oldPixel.Y) + errors[y][x]

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

            result.Set(x, y, color.Gray{Y: uint8(newValue)})

            // Calculate error
            quantError := oldValue - newValue

            // Scale error diffusion based on scale parameter (0-20)
            errorScale := scale / 20.0

            // Distribute error
            if x < width-1 {
                errors[y][x+1] += quantError * 7 / 16 * errorScale
            }
            if y < height-1 {
                if x > 0 {
                    errors[y+1][x-1] += quantError * 3 / 16 * errorScale
                }
                errors[y+1][x] += quantError * 5 / 16 * errorScale
                if x < width-1 {
                    errors[y+1][x+1] += quantError * 1 / 16 * errorScale
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

    // Calculate threshold based on scale (0-20)
    scaleNormalized := scale / 20.0

    for y := 0; y < height; y++ {
        for x := 0; x < width; x++ {
            oldPixel := color.GrayModel.Convert(img.At(x, y)).(color.Gray)
            oldValue := float64(oldPixel.Y)

            // Get threshold from Bayer matrix
            bayerThreshold := float64(bayerMatrix[y%4][x%4]) / 16.0 * 255.0
            scaledThreshold := 128 + (bayerThreshold-128)*scaleNormalized

            // Determine output value with inversion
            var newValue uint8
            if oldValue < scaledThreshold {
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

            result.Set(x, y, color.Gray{Y: newValue})
        }
    }

    return result
}

// adjustImage applies contrast, midtones, highlights, and luminance adjustments
func adjustImage(img image.Image, contrast, midtones, highlights, luminance float64) image.Image {
    bounds := img.Bounds()
    adjusted := image.NewRGBA(bounds)
    
    // Normalize parameters to 0-1 range
    contrast = contrast / 100.0
    midtones = midtones / 100.0
    highlights = highlights / 100.0
    luminance = luminance / 100.0
    
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
            
            // Apply contrast
            if contrast > 0 {
                lum = (lum - 0.5) * (1.0 + contrast) + 0.5
            }
            
            // Apply midtones
            if midtones > 0 {
                if lum < 0.5 {
                    lum = lum * (1.0 - midtones)
                } else {
                    lum = lum + (1.0 - lum) * midtones
                }
            }
            
            // Apply highlights
            if highlights > 0 {
                if lum > 0.5 {
                    lum = lum + (1.0 - lum) * highlights
                }
            }
            
            // Apply luminance threshold
            if lum < luminance {
                lum = 0
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
