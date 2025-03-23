# Ditherman

Ditherman is a Go-based clone of Dither Boy. It's relatively shameless and nowhere near as feature complete as the original, but it provides similar functionality for applying dithering effects to images.

## Overview

This project provides an API for applying various dithering algorithms to images. It's built using Go and also has a basic built-in frontend all powered by Fiber, a fast HTTP web framework.

## Requirements

- Go 1.23 or higher
- Supported image formats: JPEG and PNG

## Usage

1.  **Clone the repository:**

    ```bash
    git clone <repository_url>
    cd ditherman
    ```

2.  **Build the server:**

    ```bash
    go build -o ditherman main.go
    ```

3.  **Run the server:**

    ```bash
    ./ditherman
    ```

    The server will start on port 3000.

4.  **Access the web interface:**

    Open your browser and go to `http://localhost:3000`.

## Project Structure

```
ditherman/
├── main.go                   # Application entry point
├── go.mod                    # Go module dependencies
├── go.sum                    # Go module checksums
├── server/                   # Server implementation
│   ├── app.go                # Server setup and routes
│   ├── dither/               # Dithering algorithm implementations
│   │   └── algorithms.go     # Different dithering algorithms (Floyd-Steinberg, Ordered, etc.)
│   ├── handlers/             # HTTP request handlers
│   │   └── dither.go         # Handles dithering requests
│   └── image/                # Image processing utilities
│       └── processor.go      # Image preprocessing/manipulation
└── static/                   # Frontend assets
    ├── index.html            # Web interface HTML
    ├── script.js             # Web interface JavaScript
    └── styles.css            # Web interface CSS
```

## API Endpoints

-   `POST /dither`: Applies a dithering algorithm to an uploaded image.
    
    **Request Format:**
    Multipart form data with the following parameters:
    - `image`: The image file to process (supported formats: JPEG, PNG)
    - `algorithm`: The dithering algorithm to use (default: "floyd-steinberg")
      - Available options: "floyd-steinberg", "ordered", "atkinson", "stucki", "sierra"
    - `invert`: Set to "1" to invert the output (default: "0")
    - `scale`: Pixel scaling factor from 0-20 (default: "1.0")
    - `contrast`: Contrast adjustment from 0-100 (default: "50")
    - `midtones`: Midtones adjustment from 0-100 (default: "50")
    - `highlights`: Highlights adjustment from 0-100 (default: "50")
    - `luminanceThreshold`: Luminance threshold from 0-100 (default: "50")
    - `blur`: Blur amount from 0-10 (default: "0")
    
    **Response:**
    Returns the dithered image as a PNG file with appropriate Content-Type and Content-Disposition headers.

## Dithering Algorithms

The following dithering algorithms are implemented:

-   Floyd-Steinberg: A popular error-diffusion algorithm that distributes quantization error to neighboring pixels
-   Ordered: Uses a 4x4 Bayer matrix for ordered dithering
-   Atkinson: Similar to Floyd-Steinberg but distributes error to six neighboring pixels
-   Stucki: An improved error-diffusion algorithm with a wider error distribution pattern
-   Sierra: Another error-diffusion algorithm with a balanced distribution pattern

## Web Interface

The application includes a simple web interface that allows you to:

- Upload images directly from your browser
- Choose between different dithering algorithms
- Adjust parameters like scale, contrast, and invert options
- Preview and download the dithered results

## Example

Converting a photo to a dithered black and white image:

1. Access the web interface at `http://localhost:3000`
2. Upload your image using the file selector
3. Choose "floyd-steinberg" algorithm for natural-looking results
4. Adjust scale and contrast to your preference
5. Click "Submit" to process the image
6. Download the dithered result

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request.

## License

This project is licensed under MIT.
