import type { DitherProps } from './types';
import { 
  clamp, 
  createDitherPalette, 
  findClosestDitherColor, 
  scaleImageData, 
  upscaleImageData 
} from './utils';

/**
 * Floyd-Steinberg dithering algorithm
 */
function floydSteinbergDither({ imageData, scale, paletteType }: DitherProps): ImageData {
  const { width, height } = imageData;
  const { processData, processWidth, processHeight } = scaleImageData(imageData, scale);

  const currentPalette = createDitherPalette(paletteType);

  for (let y = 0; y < processHeight; y++) {
    for (let x = 0; x < processWidth; x++) {
      const idx = (y * processWidth + x) * 4;
      const oldR = processData[idx];
      const oldG = processData[idx + 1];
      const oldB = processData[idx + 2];

      const gray = Math.round(0.299 * oldR + 0.587 * oldG + 0.114 * oldB);
      const newPixel = findClosestDitherColor(gray, currentPalette, paletteType);

      processData[idx] = newPixel;
      processData[idx + 1] = newPixel;
      processData[idx + 2] = newPixel;

      const errVal = gray - newPixel;

      // Distribute error (Floyd-Steinberg)
      if (x + 1 < processWidth) {
        const idxR = idx + 4;
        processData[idxR] = clamp(processData[idxR] + errVal * 7 / 16);
        processData[idxR + 1] = clamp(processData[idxR + 1] + errVal * 7 / 16);
        processData[idxR + 2] = clamp(processData[idxR + 2] + errVal * 7 / 16);
      }
      if (y + 1 < processHeight) {
        if (x > 0) {
          const idxBL = idx + processWidth * 4 - 4;
          processData[idxBL] = clamp(processData[idxBL] + errVal * 3 / 16);
          processData[idxBL + 1] = clamp(processData[idxBL + 1] + errVal * 3 / 16);
          processData[idxBL + 2] = clamp(processData[idxBL + 2] + errVal * 3 / 16);
        }
        const idxB = idx + processWidth * 4;
        processData[idxB] = clamp(processData[idxB] + errVal * 5 / 16);
        processData[idxB + 1] = clamp(processData[idxB + 1] + errVal * 5 / 16);
        processData[idxB + 2] = clamp(processData[idxB + 2] + errVal * 5 / 16);
        if (x + 1 < processWidth) {
          const idxBR = idx + processWidth * 4 + 4;
          processData[idxBR] = clamp(processData[idxBR] + errVal * 1 / 16);
          processData[idxBR + 1] = clamp(processData[idxBR + 1] + errVal * 1 / 16);
          processData[idxBR + 2] = clamp(processData[idxBR + 2] + errVal * 1 / 16);
        }
      }
    }
  }

  if (scale > 1) {
    return upscaleImageData(processData, processWidth, processHeight, width, height);
  }

  return new ImageData(processData, processWidth, processHeight);
}

export default floydSteinbergDither; 