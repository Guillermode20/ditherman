// Web Worker for image adjustments and dithering (optimized)

import { optimizedDitherImage, DITHERING_CONFIG } from './components/dithering';
import { applyContrast, applyHighlights, applyMidtones, applyBlur, applyLuminance, applyInvert } from './components/ImageAdjustments';

interface WorkerRequest {
  imageData: ImageData;
  adjustments: {
    contrast: number;
    highlights: number;
    midtones: number;
    blur: number;
    luminance: number;
    invertColors: boolean;
  };
  dithering: {
    algorithm: string;
    ditherScale: number;
    palette: string;
    bayerMatrixSize: number;
  };
}

// Performance monitoring
const startTime = performance.now();

self.onmessage = function (e: MessageEvent) {
  const processingStart = performance.now();
  const { imageData, adjustments, dithering }: WorkerRequest = e.data;

  let processed = imageData;

  // Apply adjustments sequentially (could be optimized further with SIMD)
  if (adjustments.contrast !== 100) {
    processed = applyContrast(processed, adjustments.contrast);
  }
  if (adjustments.highlights !== 0) {
    processed = applyHighlights(processed, adjustments.highlights);
  }
  if (adjustments.midtones !== 0) {
    processed = applyMidtones(processed, adjustments.midtones);
  }
  if (adjustments.blur > 0) {
    processed = applyBlur(processed, adjustments.blur);
  }
  if (adjustments.luminance !== 0) {
    processed = applyLuminance(processed, adjustments.luminance);
  }
  if (adjustments.invertColors) {
    processed = applyInvert(processed);
  }

  // Apply optimized dithering
  const ditherStart = performance.now();
  
  // Map algorithm names to our standardized names
  const algorithmMap: Record<string, 'floydSteinberg' | 'atkinson' | 'sierra' | 'bayer'> = {
    'floyd-steinberg': 'floydSteinberg',
    'floydsteinberg': 'floydSteinberg',
    'floyd': 'floydSteinberg',
    'bayer': 'bayer',
    'ordered': 'bayer',
    'atkinson': 'atkinson',
    'sierra': 'sierra'
  };
  
  const algorithmKey = algorithmMap[dithering.algorithm.toLowerCase()] || 'floydSteinberg';
  
  const dithered = optimizedDitherImage({
    imageData: processed,
    scale: dithering.ditherScale,
    paletteType: dithering.palette,
    matrixSize: dithering.bayerMatrixSize,
  }, algorithmKey);

  const ditherEnd = performance.now();
  const processingEnd = performance.now();

  // Performance logging for optimization
  const performance_stats = {
    total: processingEnd - processingStart,
    dithering: ditherEnd - ditherStart,
    imageSize: imageData.width * imageData.height,
    algorithm: algorithmKey,
    optimized: DITHERING_CONFIG.useOptimized
  };
  
  // Debug performance in development
  if (typeof console !== 'undefined') {
    console.log('Worker performance:', performance_stats);
  }

  // Post result back to main thread
  self.postMessage(dithered);
};
