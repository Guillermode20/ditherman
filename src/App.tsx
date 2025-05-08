import React, { useCallback, useMemo, useEffect } from 'react';

// Import dithering methods
import { floydSteinbergDither, bayerOrderedDither } from './components/dithering';
// Import image adjustment methods
import { applyContrast, applyHighlights, applyMidtones, applyBlur } from './components/ImageAdjustments';

function App() {
  const [ditherScale, setDitherScale] = React.useState(1);
  const [contrast, setContrast] = React.useState(100);
  const [highlights, setHighlights] = React.useState(0);
  const [midtones, setMidtones] = React.useState(0);
  const [blur, setBlur] = React.useState(0);
  const [palette, setPalette] = React.useState('bw');
  const [imageLoaded, setImageLoaded] = React.useState(false);

  // New states for dithering algorithm and its settings
  const [ditheringAlgorithm, setDitheringAlgorithm] = React.useState('floyd-steinberg');
  const [bayerMatrixSize, setBayerMatrixSize] = React.useState(4); // Default Bayer matrix size (e.g., 4x4)

  const [debouncedUpdates, setDebouncedUpdates] = React.useState({
    ditherScale: 1,
    contrast: 100,
    highlights: 0,
    midtones: 0,
    blur: 0,
    palette: 'bw',
    ditheringAlgorithm: 'floyd-steinberg',
    bayerMatrixSize: 4,
  });

  const originalImageRef = React.useRef<HTMLImageElement | null>(null);
  const processedImageRef = React.useRef<ImageData | null>(null);
  const updateTimerRef = React.useRef<number | null>(null);

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
        palette,
        ditheringAlgorithm,
        bayerMatrixSize,
      });
    }, 100); // 100ms debounce time

    return () => {
      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
      }
    };
  }, [ditherScale, contrast, highlights, midtones, blur, palette, ditheringAlgorithm, bayerMatrixSize]);

  useEffect(() => {
    if (imageLoaded) {
      applyDithering();
    }
  }, [debouncedUpdates, imageLoaded]); // applyDithering is memoized, safe to include

  const applyDithering = useCallback(() => {
    if (!originalImageRef.current) return;

    const img = originalImageRef.current;
    const originalCanvas = document.getElementById('originalCanvas') as HTMLCanvasElement;
    const ditheredCanvas = document.getElementById('ditheredCanvas') as HTMLCanvasElement;

    if (!originalCanvas || !ditheredCanvas) return;

    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    ditheredCanvas.width = img.width;
    ditheredCanvas.height = img.height;

    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    if (!originalCtx) return;
    originalCtx.drawImage(img, 0, 0);

    let imageData = originalCtx.getImageData(0, 0, img.width, img.height);

    // Apply adjustments if parameters changed or no cached version
    const needsAdjustment = debouncedUpdates.contrast !== 100 ||
      debouncedUpdates.highlights !== 0 ||
      debouncedUpdates.midtones !== 0 ||
      debouncedUpdates.blur > 0;

    if (needsAdjustment) {
      // Create a fresh copy for adjustments if we are going to adjust
      let adjustedImageData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      if (debouncedUpdates.contrast !== 100) {
        adjustedImageData = applyContrast(adjustedImageData, debouncedUpdates.contrast);
      }
      if (debouncedUpdates.highlights !== 0) {
        adjustedImageData = applyHighlights(adjustedImageData, debouncedUpdates.highlights);
      }
      if (debouncedUpdates.midtones !== 0) {
        adjustedImageData = applyMidtones(adjustedImageData, debouncedUpdates.midtones);
      }
      if (debouncedUpdates.blur > 0) {
        adjustedImageData = applyBlur(adjustedImageData, debouncedUpdates.blur);
      }
      processedImageRef.current = adjustedImageData; // Cache adjusted
      imageData = adjustedImageData; // Use adjusted for dithering
    } else if (processedImageRef.current) {
      imageData = processedImageRef.current; // Use cached adjusted image
    }
    // If no adjustments and no cache, imageData is the original from originalCtx.getImageData

    // Apply dithering
    const ditheredCtx = ditheredCanvas.getContext('2d', { willReadFrequently: true });
    if (ditheredCtx) {
      let ditheredData;
      if (debouncedUpdates.ditheringAlgorithm === 'bayer') {
        ditheredData = bayerOrderedDither({
          imageData,
          scale: debouncedUpdates.ditherScale,
          paletteType: debouncedUpdates.palette,
          matrixSize: debouncedUpdates.bayerMatrixSize
        });
      } else { // Default to Floyd-Steinberg
        ditheredData = floydSteinbergDither({
          imageData,
          scale: debouncedUpdates.ditherScale,
          paletteType: debouncedUpdates.palette
        });
      }
      ditheredCtx.putImageData(ditheredData, 0, 0);
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
        processedImageRef.current = null; // Clear cache for new image
        setImageLoaded(true);
        // applyDithering will be called by useEffect due to imageLoaded change
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Slider/Select change handlers
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

  const handleDitheringAlgorithmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDitheringAlgorithm(e.target.value);
  };

  const handleBayerMatrixSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBayerMatrixSize(parseInt(e.target.value, 10));
    const output = document.getElementById('bayerMatrixSizeValue') as HTMLOutputElement;
    if (output) output.value = e.target.value; // Show selected size
  };

  // Reset functions
  const handleReset = (controlId: string, defaultValue: number | string, isSelect = false) => {
    const element = document.getElementById(controlId) as HTMLInputElement | HTMLSelectElement;
    const outputId = `${controlId}Value`;
    const output = document.getElementById(outputId) as HTMLOutputElement;

    if (element) {
      element.value = defaultValue.toString();
      if (output && !isSelect) output.value = defaultValue.toString(); // Output for sliders
      if (output && isSelect && controlId === 'bayerMatrixSize') output.value = defaultValue.toString(); // Special output for bayer matrix size

      let invalidateAdjustmentCache = false;

      switch (controlId) {
        case 'ditherScale':
          setDitherScale(defaultValue as number);
          break;
        case 'contrastSlider':
          setContrast(defaultValue as number);
          invalidateAdjustmentCache = true;
          break;
        case 'highlightsSlider':
          setHighlights(defaultValue as number);
          invalidateAdjustmentCache = true;
          break;
        case 'midtonesSlider':
          setMidtones(defaultValue as number);
          invalidateAdjustmentCache = true;
          break;
        case 'blurSlider':
          setBlur(defaultValue as number);
          invalidateAdjustmentCache = true;
          break;
        case 'ditheringAlgorithm':
          setDitheringAlgorithm(defaultValue as string);
          break;
        case 'bayerMatrixSize':
          setBayerMatrixSize(defaultValue as number);
          break;
        // Palette is handled separately for global reset or direct change
      }
      if (invalidateAdjustmentCache) {
        processedImageRef.current = null;
      }
    } else {
      console.error(`Could not find element for controlId: ${controlId}`);
    }
  };

  const handleGlobalReset = () => {
    handleReset('ditherScale', 1);
    handleReset('contrastSlider', 100);
    handleReset('highlightsSlider', 0);
    handleReset('midtonesSlider', 0);
    handleReset('blurSlider', 0);

    handleReset('ditheringAlgorithm', 'floyd-steinberg', true);
    handleReset('bayerMatrixSize', 4, true);


    const paletteSelect = document.getElementById('palette') as HTMLSelectElement;
    if (paletteSelect) {
      paletteSelect.value = 'bw';
      setPalette('bw');
    }
    processedImageRef.current = null;
  };

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
    link.href = canvas.toDataURL('image/jpeg', 0.9); // 0.9 quality
    link.click();
  };


  return (
    <>
      {/* Ensure body tag is not part of React component if this is inside an existing HTML structure */}
      {/* For a full page app, this is fine. */}
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
              <h2>Output Options</h2>
              <label htmlFor="palette">Palette:</label>
              <select id="palette" value={palette} onChange={handlePaletteChange}>
                <option value="bw">Black & White</option>
                <option value="grayscale">Grayscale (8 levels)</option>
              </select>

              <div className="buttons-group">
                <button id="downloadPng" onClick={handleDownloadPng} disabled={!imageLoaded}>Download PNG</button>
                <button id="downloadJpg" onClick={handleDownloadJpg} disabled={!imageLoaded}>Download JPG</button>
              </div>
            </div>

            <div className="controls">
              <h2>Dithering Method</h2>
              <div className="control-row">
                <label htmlFor="ditheringAlgorithm">Algorithm:</label>
                <select id="ditheringAlgorithm" value={ditheringAlgorithm} onChange={handleDitheringAlgorithmChange}>
                  <option value="floyd-steinberg">Floyd-Steinberg</option>
                  <option value="bayer">Bayer (Ordered)</option>
                </select>
                <button className="reset-btn" onClick={() => handleReset('ditheringAlgorithm', 'floyd-steinberg', true)}>Reset</button>
              </div>

              {ditheringAlgorithm === 'bayer' && (
                <div className="control-row">
                  <label htmlFor="bayerMatrixSize">Matrix Size:</label>
                  <select id="bayerMatrixSize" value={bayerMatrixSize} onChange={handleBayerMatrixSizeChange}>
                    <option value="2">2x2</option>
                    <option value="4">4x4</option>
                    <option value="8">8x8</option>
                  </select>
                  <output id="bayerMatrixSizeValue" style={{ minWidth: '20px', textAlign: 'right', marginLeft: '5px' }}>{bayerMatrixSize}</output>
                  <button className="reset-btn" onClick={() => handleReset('bayerMatrixSize', 4, true)}>Reset</button>
                </div>
              )}
            </div>

            <div className="controls">
              <h2>Dither Scale</h2>
              <div className="control-row">
                <label htmlFor="ditherScale">Scale:</label>
                <input type="range" id="ditherScale" min="1" max="10" value={ditherScale} onChange={handleDitherScaleChange} />
                <output id="ditherScaleValue">{ditherScale}</output>
                <button className="reset-btn" onClick={() => handleReset('ditherScale', 1)}>Reset</button>
              </div>
            </div>

            <div className="controls">
              <h2>Image Adjustments</h2>
              <div className="control-row">
                <label htmlFor="contrastSlider">Contrast:</label>
                <input type="range" id="contrastSlider" min="0" max="200" value={contrast} onChange={handleContrastChange} />
                <output id="contrastSliderValue">{contrast}</output>
                <button className="reset-btn" onClick={() => handleReset('contrastSlider', 100)}>Reset</button>
              </div>
              <div className="control-row">
                <label htmlFor="highlightsSlider">Highlights:</label>
                <input type="range" id="highlightsSlider" min="-100" max="100" value={highlights} onChange={handleHighlightsChange} />
                <output id="highlightsSliderValue">{highlights}</output>
                <button className="reset-btn" onClick={() => handleReset('highlightsSlider', 0)}>Reset</button>
              </div>
              <div className="control-row">
                <label htmlFor="midtonesSlider">Midtones:</label>
                <input type="range" id="midtonesSlider" min="-100" max="100" value={midtones} onChange={handleMidtonesChange} />
                <output id="midtonesSliderValue">{midtones}</output>
                <button className="reset-btn" onClick={() => handleReset('midtonesSlider', 0)}>Reset</button>
              </div>
              <div className="control-row">
                <label htmlFor="blurSlider">Blur:</label>
                <input type="range" id="blurSlider" min="0" max="10" value={blur} onChange={handleBlurChange} />
                <output id="blurSliderValue">{blur}</output>
                <button className="reset-btn" onClick={() => handleReset('blurSlider', 0)}>Reset</button>
              </div>
            </div>

            <button id="globalReset" className="reset-btn global-reset-btn" onClick={handleGlobalReset}>Reset All Settings</button>

          </aside>

          <main className="main-content">
            <div className="canvas-container">
              <canvas id="originalCanvas" style={{ display: 'none' }}></canvas>
              <canvas id="ditheredCanvas"></canvas>
              {!imageLoaded && <div className="placeholder-text">Upload an image to begin</div>}
            </div>
          </main>
        </div>
      </body>
    </>
  );
}

export default App;