// Web Worker for image adjustments and dithering

import { floydSteinbergDither, bayerOrderedDither, atkinsonDither, sierraDither } from './components/dithering';
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

self.onmessage = function (e: MessageEvent) {
  try {
    const { imageData, adjustments, dithering }: WorkerRequest = e.data;

    let processed = imageData;

    // Apply adjustments
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

    // Apply dithering
    let dithered: ImageData;
    switch (dithering.algorithm) {
      case 'bayer':
        dithered = bayerOrderedDither({
          imageData: processed,
          scale: dithering.ditherScale,
          paletteType: dithering.palette,
          matrixSize: dithering.bayerMatrixSize,
        });
        break;
      case 'atkinson':
        dithered = atkinsonDither({
          imageData: processed,
          scale: dithering.ditherScale,
          paletteType: dithering.palette,
        });
        break;
      case 'sierra':
        dithered = sierraDither({
          imageData: processed,
          scale: dithering.ditherScale,
          paletteType: dithering.palette,
        });
        break;
      default:
        dithered = floydSteinbergDither({
          imageData: processed,
          scale: dithering.ditherScale,
          paletteType: dithering.palette,
        });
        break;
    }

    // Post result back to main thread
    self.postMessage(dithered);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
