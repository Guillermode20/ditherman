import type { DitherProps } from './types';
import { 
  BAYER_MATRICES, 
  createDitherPalette, 
  scaleImageData, 
  upscaleImageData 
} from './utils';

/**
 * Bayer ordered dithering algorithm
 */
function bayerOrderedDither({ 
  imageData, 
  scale, 
  paletteType, 
  matrixSize = 4 
}: DitherProps): ImageData {
  const { width, height } = imageData;
  const { processData, processWidth, processHeight } = scaleImageData(imageData, scale);

  const currentPalette = createDitherPalette(paletteType);
  const bayerMatrix = BAYER_MATRICES[matrixSize];
  const mSize = bayerMatrix.length; // Actual size of the matrix (2, 4, or 8)
  const bayerFactor = 1 / (mSize * mSize); // Normalization factor for bayer matrix

  for (let y = 0; y < processHeight; y++) {
    for (let x = 0; x < processWidth; x++) {
      const idx = (y * processWidth + x) * 4;
      const r = processData[idx];
      const g = processData[idx + 1];
      const b = processData[idx + 2];

      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      const bayerValue = bayerMatrix[y % mSize][x % mSize];
      const threshold = bayerValue * bayerFactor; // Normalized threshold [0, 1)

      let newPixel;
      if (paletteType === 'bw') {
        newPixel = gray / 255 > threshold ? 255 : 0;
      } else { // Grayscale palette
        const numPaletteLevels = currentPalette.length;
        const qStep = 255 / (numPaletteLevels - 1); // Quantization step size

        let levelIndex = Math.floor(gray / qStep);
        const fractionalPart = (gray % qStep) / qStep; // How far into the current bin, normalized [0,1)

        if (fractionalPart > threshold) {
          levelIndex = Math.min(levelIndex + 1, numPaletteLevels - 1);
        }
        newPixel = currentPalette[levelIndex];
      }

      processData[idx] = newPixel;
      processData[idx + 1] = newPixel;
      processData[idx + 2] = newPixel;
      // Alpha remains unchanged processData[idx + 3]
    }
  }

  if (scale > 1) {
    return upscaleImageData(processData, processWidth, processHeight, width, height);
  }

  return new ImageData(processData, processWidth, processHeight);
}

export default bayerOrderedDither; 