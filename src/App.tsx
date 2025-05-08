import React, { useCallback, useMemo, useEffect } from 'react';

function App() {
  const [ditherScale, setDitherScale] = React.useState(1);
  const [contrast, setContrast] = React.useState(100);
  const [highlights, setHighlights] = React.useState(0);
  const [midtones, setMidtones] = React.useState(0);
  const [blur, setBlur] = React.useState(0);
  const [palette, setPalette] = React.useState('bw');
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [debouncedUpdates, setDebouncedUpdates] = React.useState({
    ditherScale: 1,
    contrast: 100,
    highlights: 0,
    midtones: 0,
    blur: 0,
    palette: 'bw'
  });

  // Reference to store the original image data
  const originalImageRef = React.useRef<HTMLImageElement | null>(null);
  // Store processed image data to avoid reprocessing
  const processedImageRef = React.useRef<ImageData | null>(null);
  const updateTimerRef = React.useRef<number | null>(null);

  // Debounce the parameter updates to avoid processing on every slider change
  useEffect(() => {
    if (updateTimerRef.current) {
      window.clearTimeout(updateTimerRef.current);
    }

    updateTimerRef.current = window.setTimeout(() => {
      setDebouncedUpdates({
        ditherScale,
        contrast,
        highlights,
        midtones,
        blur,
        palette
      });
    }, 100); // 100ms debounce time

    return () => {
      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
      }
    };
  }, [ditherScale, contrast, highlights, midtones, blur, palette]);

  // Apply dithering when debounced parameters change
  useEffect(() => {
    if (imageLoaded) {
      applyDithering();
    }
  }, [debouncedUpdates, imageLoaded]);

  const applyDithering = useCallback(() => {
    if (!originalImageRef.current) return;

    const img = originalImageRef.current;
    const originalCanvas = document.getElementById('originalCanvas') as HTMLCanvasElement;
    const ditheredCanvas = document.getElementById('ditheredCanvas') as HTMLCanvasElement;

    // Set canvas dimensions
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    ditheredCanvas.width = img.width;
    ditheredCanvas.height = img.height;

    // Draw the original image
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    originalCtx?.drawImage(img, 0, 0);

    // Apply adjustments and dithering
    if (originalCtx) {
      let imageData = originalCtx.getImageData(0, 0, img.width, img.height);

      // Apply adjustments only if needed
      if (debouncedUpdates.contrast !== 100 || debouncedUpdates.highlights !== 0 ||
        debouncedUpdates.midtones !== 0 || debouncedUpdates.blur > 0) {

        // Process image with worker if available, otherwise do it in the main thread
        if (debouncedUpdates.contrast !== 100) {
          imageData = applyContrast(imageData, debouncedUpdates.contrast);
        }

        if (debouncedUpdates.highlights !== 0) {
          imageData = applyHighlights(imageData, debouncedUpdates.highlights);
        }

        if (debouncedUpdates.midtones !== 0) {
          imageData = applyMidtones(imageData, debouncedUpdates.midtones);
        }

        if (debouncedUpdates.blur > 0) {
          imageData = applyBlur(imageData, debouncedUpdates.blur);
        }

        // Cache processed image data
        processedImageRef.current = imageData;
      } else if (processedImageRef.current) {
        // Use cached processed image data if available
        imageData = processedImageRef.current;
      }

      // Apply dithering
      const ditheredCtx = ditheredCanvas.getContext('2d', { willReadFrequently: true });
      if (ditheredCtx) {
        const ditheredData = floydSteinbergDither(
          imageData,
          debouncedUpdates.ditherScale,
          debouncedUpdates.palette
        );
        ditheredCtx.putImageData(ditheredData, 0, 0);
      }
    }
  }, [debouncedUpdates]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        originalImageRef.current = img;
        // Clear cached data when new image is loaded
        processedImageRef.current = null;
        setImageLoaded(true);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle slider changes - using debounced state update
  const handleDitherScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setDitherScale(value);
    const output = document.getElementById('ditherScaleValue') as HTMLOutputElement;
    if (output) output.value = value.toString();
  };

  const handleContrastChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setContrast(value);
    const output = document.getElementById('contrastSliderValue') as HTMLOutputElement;
    if (output) output.value = value.toString();
  };

  const handleHighlightsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setHighlights(value);
    const output = document.getElementById('highlightsSliderValue') as HTMLOutputElement;
    if (output) output.value = value.toString();
  };

  const handleMidtonesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setMidtones(value);
    const output = document.getElementById('midtonesSliderValue') as HTMLOutputElement;
    if (output) output.value = value.toString();
  };

  const handleBlurChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setBlur(value);
    const output = document.getElementById('blurSliderValue') as HTMLOutputElement;
    if (output) output.value = value.toString();
  };

  const handlePaletteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPalette(e.target.value);
  };

  // Reset functions
  const handleReset = (sliderId: string, defaultValue: number) => {
    console.log(`Attempting to reset slider: ${sliderId}`);
    const slider = document.getElementById(sliderId) as HTMLInputElement;
    const output = document.getElementById(`${sliderId}Value`) as HTMLOutputElement;

    console.log(`Found slider element: ${!!slider}`);
    console.log(`Found output element: ${!!output}`);

    if (slider && output) {
      console.log(`Resetting values for ${sliderId} to ${defaultValue}`);
      slider.value = defaultValue.toString();
      output.value = defaultValue.toString();

      let invalidateAdjustmentCache = false;

      switch (sliderId) {
        case 'ditherScale':
          setDitherScale(defaultValue);
          // Dither scale does not use the processedImageRef cache for adjustments
          break;
        case 'contrastSlider':
          setContrast(defaultValue);
          invalidateAdjustmentCache = true;
          break;
        case 'highlightsSlider':
          setHighlights(defaultValue);
          invalidateAdjustmentCache = true;
          break;
        case 'midtonesSlider':
          setMidtones(defaultValue);
          invalidateAdjustmentCache = true;
          break;
        case 'blurSlider':
          setBlur(defaultValue);
          invalidateAdjustmentCache = true;
          break;
      }

      if (invalidateAdjustmentCache) {
        // Clear cached processed image so adjustments are re-applied or skipped correctly
        processedImageRef.current = null;
      }

    } else {
      console.error(`Could not find elements for sliderId: ${sliderId}`);
    }
  };

  const handleGlobalReset = () => {
    console.log('Performing global reset');
    handleReset('ditherScale', 1);
    handleReset('contrastSlider', 100);
    handleReset('highlightsSlider', 0);
    handleReset('midtonesSlider', 0);
    handleReset('blurSlider', 0);

    const paletteSelect = document.getElementById('palette') as HTMLSelectElement;
    if (paletteSelect) {
      paletteSelect.value = 'bw';
      setPalette('bw');
    }

    // Clear cached processed image
    processedImageRef.current = null;
  };

  // Memoized image adjustment functions for better performance
  const applyContrast = useCallback((imageData: ImageData, contrastValue: number): ImageData => {
    const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
    const data = imageData.data;
    const length = data.length;

    for (let i = 0; i < length; i += 4) {
      data[i] = clamp(factor * (data[i] - 128) + 128);
      data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
      data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
    }

    return imageData;
  }, []);

  const applyHighlights = useCallback((imageData: ImageData, highlightsValue: number): ImageData => {
    const data = imageData.data;
    const factor = highlightsValue / 100;
    const length = data.length;

    for (let i = 0; i < length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Affect only brighter areas (simple threshold-based approach)
      if ((r + g + b) / 3 > 180) {
        data[i] = clamp(r + r * factor);
        data[i + 1] = clamp(g + g * factor);
        data[i + 2] = clamp(b + b * factor);
      }
    }

    return imageData;
  }, []);

  const applyMidtones = useCallback((imageData: ImageData, midtonesValue: number): ImageData => {
    const data = imageData.data;
    const factor = midtonesValue / 100;
    const length = data.length;

    for (let i = 0; i < length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Affect only midtone areas
      const luminance = (r + g + b) / 3;
      if (luminance > 70 && luminance < 180) {
        data[i] = clamp(r + r * factor);
        data[i + 1] = clamp(g + g * factor);
        data[i + 2] = clamp(b + b * factor);
      }
    }

    return imageData;
  }, []);

  const applyBlur = useCallback((imageData: ImageData, blurRadius: number): ImageData => {
    // Optimized box blur implementation
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outputData = output.data;

    // Use a smaller blur kernel for performance
    const effectiveRadius = Math.min(blurRadius, 5);

    // Use a faster blur algorithm for larger images
    if (width * height > 500000) { // 500k pixels threshold
      // Simplified blur for large images - only sample every other pixel
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, count = 0;

          for (let ky = -effectiveRadius; ky <= effectiveRadius; ky += 2) {
            for (let kx = -effectiveRadius; kx <= effectiveRadius; kx += 2) {
              const px = x + kx;
              const py = y + ky;

              if (px >= 0 && px < width && py >= 0 && py < height) {
                const idx = (py * width + px) * 4;
                r += data[idx];
                g += data[idx + 1];
                b += data[idx + 2];
                count++;
              }
            }
          }

          const outIdx = (y * width + x) * 4;
          if (count > 0) {
            outputData[outIdx] = Math.round(r / count);
            outputData[outIdx + 1] = Math.round(g / count);
            outputData[outIdx + 2] = Math.round(b / count);
          }
          // Keep alpha channel unchanged
          outputData[outIdx + 3] = data[(y * width + x) * 4 + 3];
        }
      }
    } else {
      // Regular blur for smaller images
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, count = 0;

          for (let ky = -effectiveRadius; ky <= effectiveRadius; ky++) {
            for (let kx = -effectiveRadius; kx <= effectiveRadius; kx++) {
              const px = x + kx;
              const py = y + ky;

              if (px >= 0 && px < width && py >= 0 && py < height) {
                const idx = (py * width + px) * 4;
                r += data[idx];
                g += data[idx + 1];
                b += data[idx + 2];
                count++;
              }
            }
          }

          const outIdx = (y * width + x) * 4;
          outputData[outIdx] = Math.round(r / count);
          outputData[outIdx + 1] = Math.round(g / count);
          outputData[outIdx + 2] = Math.round(b / count);
          outputData[outIdx + 3] = data[(y * width + x) * 4 + 3];
        }
      }
    }

    return output;
  }, []);

  const clamp = useCallback((value: number): number => {
    return Math.max(0, Math.min(255, Math.round(value)));
  }, []);

  const floydSteinbergDither = useCallback((imageData: ImageData, scale: number, paletteType: string): ImageData => {
    const { data, width, height } = imageData;
    const scaledWidth = Math.floor(width / scale);
    const scaledHeight = Math.floor(height / scale);

    // Create a scaled-down version for faster processing if scale > 1
    let processData, processWidth, processHeight;

    if (scale > 1) {
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = scaledWidth;
      scaledCanvas.height = scaledHeight;
      const ctx = scaledCanvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) return imageData;

      // Draw scaled down version
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) return imageData;

      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, scaledWidth, scaledHeight);
      const scaledData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);

      processData = scaledData.data;
      processWidth = scaledWidth;
      processHeight = scaledHeight;
    } else {
      processData = new Uint8ClampedArray(data);
      processWidth = width;
      processHeight = height;
    }

    // Create palette lookup for faster color matching
    const createPalette = (type: string) => {
      if (type === 'bw') {
        return [0, 255];
      } else {
        // Grayscale palette with 8 levels
        const levels = 8;
        const interval = 255 / (levels - 1);
        return Array.from({ length: levels }, (_, i) => Math.round(i * interval));
      }
    };

    const palette = createPalette(paletteType);

    // Find closest palette color (optimized)
    const findClosestColor = (gray: number) => {
      if (paletteType === 'bw') {
        return gray < 128 ? 0 : 255;
      } else {
        const interval = 255 / (palette.length - 1);
        return Math.round(Math.round(gray / interval) * interval);
      }
    };

    // Apply Floyd-Steinberg dithering
    for (let y = 0; y < processHeight; y++) {
      for (let x = 0; x < processWidth; x++) {
        const idx = (y * processWidth + x) * 4;
        const oldR = processData[idx];
        const oldG = processData[idx + 1];
        const oldB = processData[idx + 2];

        // Calculate grayscale value
        const gray = Math.round(0.299 * oldR + 0.587 * oldG + 0.114 * oldB);
        const newPixel = findClosestColor(gray);

        // Set new pixel value
        processData[idx] = newPixel;
        processData[idx + 1] = newPixel;
        processData[idx + 2] = newPixel;

        // Calculate quantization error
        const errVal = gray - newPixel;

        // Distribute error to neighboring pixels (Floyd-Steinberg)
        if (x + 1 < processWidth) {
          const idxRight = idx + 4;
          processData[idxRight] = clamp(processData[idxRight] + errVal * 7 / 16);
          processData[idxRight + 1] = clamp(processData[idxRight + 1] + errVal * 7 / 16);
          processData[idxRight + 2] = clamp(processData[idxRight + 2] + errVal * 7 / 16);
        }

        if (y + 1 < processHeight) {
          if (x > 0) {
            const idxBottomLeft = idx + processWidth * 4 - 4;
            processData[idxBottomLeft] = clamp(processData[idxBottomLeft] + errVal * 3 / 16);
            processData[idxBottomLeft + 1] = clamp(processData[idxBottomLeft + 1] + errVal * 3 / 16);
            processData[idxBottomLeft + 2] = clamp(processData[idxBottomLeft + 2] + errVal * 3 / 16);
          }

          const idxBottom = idx + processWidth * 4;
          processData[idxBottom] = clamp(processData[idxBottom] + errVal * 5 / 16);
          processData[idxBottom + 1] = clamp(processData[idxBottom + 1] + errVal * 5 / 16);
          processData[idxBottom + 2] = clamp(processData[idxBottom + 2] + errVal * 5 / 16);

          if (x + 1 < processWidth) {
            const idxBottomRight = idx + processWidth * 4 + 4;
            processData[idxBottomRight] = clamp(processData[idxBottomRight] + errVal * 1 / 16);
            processData[idxBottomRight + 1] = clamp(processData[idxBottomRight + 1] + errVal * 1 / 16);
            processData[idxBottomRight + 2] = clamp(processData[idxBottomRight + 2] + errVal * 1 / 16);
          }
        }
      }
    }

    // If we scaled the image down, now scale it back up
    if (scale > 1) {
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = height;
      const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });

      if (!finalCtx) return imageData;

      // Create a temporary canvas with the processed data
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = processWidth;
      tempCanvas.height = processHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

      if (!tempCtx) return imageData;

      // Put the processed data on the temp canvas
      const tempImageData = new ImageData(processData, processWidth, processHeight);
      tempCtx.putImageData(tempImageData, 0, 0);

      // Scale it back up with nearest-neighbor interpolation
      finalCtx.imageSmoothingEnabled = false;
      finalCtx.drawImage(tempCanvas, 0, 0, processWidth, processHeight, 0, 0, width, height);

      return finalCtx.getImageData(0, 0, width, height);
    }

    return new ImageData(processData, processWidth, processHeight);
  }, [clamp]);

  const handleDownloadPng = () => {
    if (!imageLoaded) return;

    const canvas = document.getElementById('ditheredCanvas') as HTMLCanvasElement;
    const link = document.createElement('a');
    link.download = 'dithered-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleDownloadJpg = () => {
    if (!imageLoaded) return;

    const canvas = document.getElementById('ditheredCanvas') as HTMLCanvasElement;
    const link = document.createElement('a');
    link.download = 'dithered-image.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  return (
    <>
      <body>
        <div className="main-app-container">
          <aside className="sidebar">
            <pre className="ascii-header" style={{ whiteSpace: 'pre' }}>
              {`
██████╗ ██╗████████╗██╗  ██╗███████╗██████╗ ███╗   ███╗ █████╗ ███╗   ██╗
██╔══██╗██║╚══██╔══╝██║  ██║██╔════╝██╔══██╗████╗ ████║██╔══██╗████╗  ██║
██║  ██║██║   ██║   ███████║█████╗  ██████╔╝██╔████╔██║███████║██╔██╗ ██║
██║  ██║██║   ██║   ██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══██║██║╚██╗██║
██████╔╝██║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║
╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
              `}
            </pre>
            <div className="image-upload-container">
              <input type="file" id="imageUpload" accept="image/png, image/jpeg" onChange={handleImageUpload} />
              <label htmlFor="imageUpload">Choose an Image</label>
            </div>

            <div className="controls">
              <h2>Controls</h2>
              <label htmlFor="palette">Palette:</label>
              <select id="palette" defaultValue="bw" onChange={handlePaletteChange}>
                <option value="bw">Black & White</option>
                <option value="grayscale">Grayscale</option>
              </select>

              <div className="buttons-group">
                <button id="downloadPng" onClick={handleDownloadPng}>Download PNG</button>
                <button id="downloadJpg" onClick={handleDownloadJpg}>Download JPG</button>
              </div>
            </div>

            <div className="controls">
              <h2>Dither Scale</h2>
              <div className="control-row">
                <label htmlFor="ditherScale">Scale:</label>
                <input type="range" id="ditherScale" min="1" max="10" defaultValue="1" onChange={handleDitherScaleChange} />
                <output id="ditherScaleValue">1</output>
                <button className="reset-btn" onClick={() => handleReset('ditherScale', 1)}>Reset</button>
              </div>
            </div>

            <div className="controls">
              <h2>Image Adjustments</h2>

              <div className="control-row">
                <label htmlFor="contrastSlider">Contrast:</label>
                <input type="range" id="contrastSlider" min="0" max="200" defaultValue="100" onChange={handleContrastChange} />
                <output id="contrastSliderValue">100</output>
                <button className="reset-btn" onClick={() => handleReset('contrastSlider', 100)}>Reset</button>
              </div>

              <div className="control-row">
                <label htmlFor="highlightsSlider">Highlights:</label>
                <input type="range" id="highlightsSlider" min="-100" max="100" defaultValue="0" onChange={handleHighlightsChange} />
                <output id="highlightsSliderValue">0</output>
                <button className="reset-btn" onClick={() => handleReset('highlightsSlider', 0)}>Reset</button>
              </div>

              <div className="control-row">
                <label htmlFor="midtonesSlider">Midtones:</label>
                <input type="range" id="midtonesSlider" min="-100" max="100" defaultValue="0" onChange={handleMidtonesChange} />
                <output id="midtonesSliderValue">0</output>
                <button className="reset-btn" onClick={() => handleReset('midtonesSlider', 0)}>Reset</button>
              </div>

              <div className="control-row">
                <label htmlFor="blurSlider">Blur:</label>
                <input type="range" id="blurSlider" min="0" max="10" defaultValue="0" onChange={handleBlurChange} />
                <output id="blurSliderValue">0</output>
                <button className="reset-btn" onClick={() => handleReset('blurSlider', 0)}>Reset</button>
              </div>
            </div>

            <button id="globalReset" className="reset-btn" onClick={handleGlobalReset}>Reset All</button>

          </aside>

          <main className="main-content">
            <div className="canvas-container">
              <canvas id="originalCanvas" style={{ display: 'none' }}></canvas>
              <canvas id="ditheredCanvas"></canvas>
            </div>
          </main>
        </div>
      </body>
    </>
  );
}

export default App;
