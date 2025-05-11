// Refactored: Consolidate state management with useReducer for adjustments and dithering settings

import React, { useCallback, useEffect, useRef, useReducer } from "react";
import Sidebar from "./components/Sidebar";
import CanvasDisplay from "./components/CanvasDisplay";


export type State = {
  ditherScale: number;
  contrast: number;
  highlights: number;
  midtones: number;
  blur: number;
  luminance: number;
  invertColors: boolean;
  palette: string;
  ditheringAlgorithm: string;
  bayerMatrixSize: number;
};

type Action =
  | { type: "SET"; key: keyof State; value: State[keyof State] }
  | { type: "RESET_ALL" };

const initialState: State = {
  ditherScale: 1,
  contrast: 100,
  highlights: 0,
  midtones: 0,
  blur: 0,
  luminance: 0,
  invertColors: false,
  palette: "bw",
  ditheringAlgorithm: "floyd-steinberg",
  bayerMatrixSize: 4,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET":
      return { ...state, [action.key]: action.value };
    case "RESET_ALL":
      return { ...initialState };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [debouncedUpdates, setDebouncedUpdates] = React.useState(initialState);

  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const processedImageRef = useRef<ImageData | null>(null);
  const updateTimerRef = useRef<number | null>(null);

  // Web Worker ref
  const workerRef = useRef<Worker | null>(null);

  // Store latest canvas size for worker result
  const canvasSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Canvas refs (React-idiomatic)
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const ditheredCanvasRef = useRef<HTMLCanvasElement>(null);

  // Setup worker on mount
  useEffect(() => {
    workerRef.current = new Worker(new URL("./imageWorker.ts", import.meta.url), { type: "module" });
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Listen for worker messages and update canvas
  useEffect(() => {
    if (!workerRef.current) return;
    const handleWorkerMessage = (e: MessageEvent) => {
      const ditheredData = e.data as ImageData;
      const ditheredCanvas = ditheredCanvasRef.current;
      if (ditheredCanvas && ditheredData) {
        ditheredCanvas.width = canvasSizeRef.current.width;
        ditheredCanvas.height = canvasSizeRef.current.height;
        const ctx = ditheredCanvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.clearRect(0, 0, ditheredCanvas.width, ditheredCanvas.height);
          ctx.putImageData(ditheredData, 0, 0);
        }
      }
    };
    workerRef.current.addEventListener("message", handleWorkerMessage);
    return () => {
      workerRef.current?.removeEventListener("message", handleWorkerMessage);
    };
  }, []);

  useEffect(() => {
    if (updateTimerRef.current) {
      window.clearTimeout(updateTimerRef.current);
    }

    updateTimerRef.current = window.setTimeout(() => {
      setDebouncedUpdates(state);
    }, 100); // 100ms debounce time

    return () => {
      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
      }
    };
  }, [state]);

  useEffect(() => {
    if (imageLoaded) {
      applyDithering();
    }
    // eslint-disable-next-line
  }, [debouncedUpdates, imageLoaded]);

  // Offload image processing to worker
  const applyDithering = useCallback(() => {
    if (!originalImageRef.current || !workerRef.current) return;

    const img = originalImageRef.current;
    const originalCanvas = originalCanvasRef.current;

    if (!originalCanvas) return;

    originalCanvas.width = img.width;
    originalCanvas.height = img.height;

    const originalCtx = originalCanvas.getContext("2d", { willReadFrequently: true });
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

  // Handlers for all controls
  const handleChange =
    (key: keyof State) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value: string | number = e.target.value;
        if (e.target.type === "range" || e.target.type === "number") {
          value = parseInt(value as string, 10);
        }
        dispatch({ type: "SET", key, value });
      };

  function handleDitheringAlgorithmChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    dispatch({ type: "SET", key: "ditheringAlgorithm", value });
    if (value !== "bayer") {
      dispatch({ type: "SET", key: "bayerMatrixSize", value: 4 });
    }
  }

  // Reset functions
  function handleReset(key: keyof State, defaultValue: State[keyof State]) {
    dispatch({ type: "SET", key, value: defaultValue });
    processedImageRef.current = null;
  }

  function handleGlobalReset() {
    dispatch({ type: "RESET_ALL" });
    processedImageRef.current = null;
  }

  function handleDownloadPng() {
    if (!imageLoaded) return;
    const canvas = ditheredCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "dithered-image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function handleDownloadJpg() {
    if (!imageLoaded) return;
    const canvas = ditheredCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "dithered-image.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.9); // 0.9 quality
    link.click();
  }

  return (
    <>
      <div className="main-app-container">
        <Sidebar
          state={state}
          imageLoaded={imageLoaded}
          handleImageUpload={handleImageUpload}
          handleChange={handleChange}
          handleDitheringAlgorithmChange={handleDitheringAlgorithmChange}
          handleReset={handleReset}
          handleGlobalReset={handleGlobalReset}
          handleDownloadPng={handleDownloadPng}
          handleDownloadJpg={handleDownloadJpg}
          dispatch={dispatch}
        />
        <CanvasDisplay
          originalCanvasRef={originalCanvasRef}
          ditheredCanvasRef={ditheredCanvasRef}
          imageLoaded={imageLoaded}
        />
      </div>
    </>
  );
}

export default App;
