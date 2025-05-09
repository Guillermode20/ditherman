import React, { useCallback, useEffect, useRef } from 'react';

// Import worker using Vite's syntax
const ImageWorker = () =>
  new Worker(new URL('./imageWorker.ts', import.meta.url), { type: 'module' });

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

  // New states for luminance and invert
  const [luminance, setLuminance] = React.useState(0);
  const [invertColors, setInvertColors] = React.useState(false);

  const [debouncedUpdates, setDebouncedUpdates] = React.useState({
    ditherScale: 1,
    contrast: 100,
    highlights: 0,
    midtones: 0,
    blur: 0,
    luminance: 0,
    invertColors: false,
    palette: 'bw',
    ditheringAlgorithm: 'floyd-steinberg',
    bayerMatrixSize: 4,
  });

  const originalImageRef = React.useRef<HTMLImageElement | null>(null);
  const processedImageRef = React.useRef<ImageData | null>(null);
  const updateTimerRef = React.useRef<number | null>(null);

  // Web Worker ref
  const workerRef = useRef<Worker | null>(null);

  // Store latest canvas size for worker result
  const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Setup worker on mount
  useEffect(() => {
    workerRef.current = ImageWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Listen for worker messages and update canvas
  useEffect(() => {
    if (!workerRef.current) return;
    const handleWorkerMessage = (e: MessageEvent) => {
      const ditheredData = e.data as ImageData;
      const ditheredCanvas = document.getElementById('ditheredCanvas') as HTMLCanvasElement;
      if (ditheredCanvas && ditheredData) {
        ditheredCanvas.width = canvasSizeRef.current.width;
        ditheredCanvas.height = canvasSizeRef.current.height;
        const ctx = ditheredCanvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.clearRect(0, 0, ditheredCanvas.width, ditheredCanvas.height);
          ctx.putImageData(ditheredData, 0, 0);
        }
      }
    };
    workerRef.current.addEventListener('message', handleWorkerMessage);
    return () => {
      workerRef.current?.removeEventListener('message', handleWorkerMessage);
    };
  }, []);

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
        luminance,
        invertColors,
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
  }, [ditherScale, contrast, highlights, midtones, blur, luminance, invertColors, palette, ditheringAlgorithm, bayerMatrixSize]);

  useEffect(() => {
    if (imageLoaded) {
      applyDithering();
    }
  }, [debouncedUpdates, imageLoaded]); // applyDithering is memoized, safe to include

  // Offload image processing to worker
  const applyDithering = useCallback(() => {
    if (!originalImageRef.current || !workerRef.current) return;

    const img = originalImageRef.current;
    const originalCanvas = document.getElementById('originalCanvas') as HTMLCanvasElement;

    if (!originalCanvas) return;

    originalCanvas.width = img.width;
    originalCanvas.height = img.height;

    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    if (!originalCtx) return;
    originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    originalCtx.drawImage(img, 0, 0);

    const imageData = originalCtx.getImageData(0, 0, img.width, img.height);

    // Store canvas size for later use in worker result
    canvasSizeRef.current = { width: img.width, height: img.height };

    // Send data to worker
    workerRef.current.postMessage({
      imageData,
      adjustments: {
        contrast: debouncedUpdates.contrast,
        highlights: debouncedUpdates.highlights,
        midtones: debouncedUpdates.midtones,
        blur: debouncedUpdates.blur,
        luminance: debouncedUpdates.luminance,
        invertColors: debouncedUpdates.invertColors,
      },
      dithering: {
        algorithm: debouncedUpdates.ditheringAlgorithm,
        ditherScale: debouncedUpdates.ditherScale,
        palette: debouncedUpdates.palette,
        bayerMatrixSize: debouncedUpdates.bayerMatrixSize,
      },
    });
  }, [debouncedUpdates]);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        originalImageRef.current = img;
        processedImageRef.current = null; // Clear cache for new image
        setImageLoaded(true);
        applyDithering(); // Apply dithering immediately on image load
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // Slider/Select change handlers
  const handleLuminanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLuminance(parseInt(e.target.value));
  }, [setLuminance]);

  const handleInvertColorsToggle = useCallback(() => {
    setInvertColors((prev) => !prev);
  }, []);
  const handleDitherScaleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDitherScale(parseInt(e.target.value));
  }, [setDitherScale]);

  const handleContrastChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setContrast(parseInt(e.target.value));
  }, [setContrast]);

  const handleHighlightsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHighlights(parseInt(e.target.value));
  }, [setHighlights]);

  const handleMidtonesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMidtones(parseInt(e.target.value));
  }, [setMidtones]);

  const handleBlurChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBlur(parseInt(e.target.value));
  }, [setBlur]);

  const handlePaletteChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPalette(e.target.value);
  }, [setPalette]);

  const handleDitheringAlgorithmChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setDitheringAlgorithm(value);
    // Reset bayerMatrixSize if switching away from Bayer
    if (value !== 'bayer') {
      setBayerMatrixSize(4); // Reset to default 4x4
    }
  }, [setDitheringAlgorithm, setBayerMatrixSize]);

  const handleBayerMatrixSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setBayerMatrixSize(parseInt(e.target.value, 10));
  }, [setBayerMatrixSize]);

  // Reset functions
  const handleReset = useCallback((controlId: string, defaultValue: number | string | boolean, isSelect = false) => {
    const element = document.getElementById(controlId) as HTMLInputElement | HTMLSelectElement;
    const outputId = `${controlId}Value`;
    const output = document.getElementById(outputId) as HTMLOutputElement;

    if (element && typeof defaultValue !== "boolean") {
      element.value = defaultValue.toString();
      if (output && !isSelect) output.value = defaultValue.toString(); // Output for sliders
    }

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
      case 'luminanceSlider':
        setLuminance(defaultValue as number);
        invalidateAdjustmentCache = true;
        break;
      case 'invertColors':
        setInvertColors(defaultValue as boolean);
        invalidateAdjustmentCache = true;
        break;
      case 'ditheringAlgorithm':
        setDitheringAlgorithm(defaultValue as string);
        break;
      case 'bayerMatrixSize':
        setBayerMatrixSize(defaultValue as number);
        break;
    }
    if (invalidateAdjustmentCache) {
      processedImageRef.current = null;
    }
  }, [setDitherScale, setContrast, setHighlights, setMidtones, setBlur, setLuminance, setInvertColors, setDitheringAlgorithm, setBayerMatrixSize, processedImageRef]);

  const handleGlobalReset = useCallback(() => {
    handleReset('ditherScale', 1);
    handleReset('contrastSlider', 100);
    handleReset('highlightsSlider', 0);
    handleReset('midtonesSlider', 0);
    handleReset('blurSlider', 0);
    handleReset('luminanceSlider', 0);
    handleReset('invertColors', false);

    handleReset('ditheringAlgorithm', 'floyd-steinberg', true);

    const paletteSelect = document.getElementById('palette') as HTMLSelectElement;
    if (paletteSelect) {
      paletteSelect.value = 'bw';
      setPalette('bw');
    }
    processedImageRef.current = null;
  }, [handleReset, setPalette, processedImageRef]);

  const handleDownloadPng = useCallback(() => {
    if (!imageLoaded) return;
    const canvas = document.getElementById('ditheredCanvas') as HTMLCanvasElement;
    const link = document.createElement('a');
    link.download = 'dithered-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [imageLoaded]);

  const handleDownloadJpg = useCallback(() => {
    if (!imageLoaded) return;
    const canvas = document.getElementById('ditheredCanvas') as HTMLCanvasElement;
    const link = document.createElement('a');
    link.download = 'dithered-image.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.9); // 0.9 quality
    link.click();
  }, [imageLoaded]);


  return (
    <>
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
                  <option value="atkinson">Atkinson</option>
                  <option value="sierra">Sierra</option>
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
              <div className="control-row">
                <label htmlFor="luminanceSlider">Luminance:</label>
                <input type="range" id="luminanceSlider" min="-100" max="100" value={luminance} onChange={handleLuminanceChange} />
                <output id="luminanceSliderValue">{luminance}</output>
                <button className="reset-btn" onClick={() => handleReset('luminanceSlider', 0)}>Reset</button>
              </div>
              <div className="control-row">
                <label htmlFor="invertColors">Invert:</label>
                <button
                  id="invertColors"
                  className={`invert-btn${invertColors ? ' active' : ''}`}
                  type="button"
                  onClick={handleInvertColorsToggle}
                  aria-pressed={invertColors}
                >
                  {invertColors ? 'Inverted' : 'Invert Colors'}
                </button>
                <button className="reset-btn" onClick={() => handleReset('invertColors', false)}>Reset</button>
              </div>
            </div>

            <button id="globalReset" className="reset-btn global-reset-btn" onClick={handleGlobalReset}>Reset All Settings</button>

          </aside>

          <main className="main-content">
            <div className="canvas-container">
              <canvas id="originalCanvas" style={{ display: 'none' }}></canvas>
              <canvas id="ditheredCanvas"></canvas>
              {!imageLoaded && <div className="placeholder-text"></div>}
            </div>
          </main>
        </div>
    </>
  );
}

export default App;
