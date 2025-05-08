import type { DitherProps } from './types';
import { createDitherPalette, scaleImageData, upscaleImageData } from './utils';

/**
 * Sierra dithering algorithm
 */
function sierraDither({
  imageData,
  scale,
  paletteType,
}: DitherProps): ImageData {
  const { width, height } = imageData;
  const { processData, processWidth, processHeight } = scaleImageData(imageData, scale);

  const currentPalette = createDitherPalette(paletteType);

  // Implement Sierra dithering logic here
  // This involves iterating through pixels, quantizing, and propagating the error

  for (let y = 0; y < processHeight; y++) {
    for (let x = 0; x < processWidth; x++) {
      const idx = (y * processWidth + x) * 4;
      const oldPixelR = processData[idx];
      const oldPixelG = processData[idx + 1];
      const oldPixelB = processData[idx + 2];

      // Convert to grayscale for simplicity in this example, as palettes are grayscale/bw
      const oldPixelGray = Math.round(0.299 * oldPixelR + 0.587 * oldPixelG + 0.114 * oldPixelB);

      // Find the closest color in the palette
      let newPixelGray = currentPalette[0];
      let minDiff = Math.abs(oldPixelGray - newPixelGray);

      for (let i = 1; i < currentPalette.length; i++) {
        const diff = Math.abs(oldPixelGray - currentPalette[i]);
        if (diff < minDiff) {
          minDiff = diff;
          newPixelGray = currentPalette[i];
        }
      }

      // Set the pixel to the new palette color
      processData[idx] = newPixelGray;
      processData[idx + 1] = newPixelGray;
      processData[idx + 2] = newPixelGray;

      // Calculate the error
      const error = oldPixelGray - newPixelGray;

      // Distribute the error to neighboring pixels
      // Sierra error diffusion kernel:
      //       *  5/32  3/32
      // 2/32  4/32  5/32  4/32  2/32
      //       2/32  3/32

      const errorDiv32 = error / 32;

      // (x+1, y)
      if (x + 1 < processWidth) {
        const neighborIdx = (y * processWidth + (x + 1)) * 4;
        processData[neighborIdx] += errorDiv32 * 5;
        processData[neighborIdx + 1] += errorDiv32 * 5;
        processData[neighborIdx + 2] += errorDiv32 * 5;
      }

      // (x+2, y)
      if (x + 2 < processWidth) {
        const neighborIdx = (y * processWidth + (x + 2)) * 4;
        processData[neighborIdx] += errorDiv32 * 3;
        processData[neighborIdx + 1] += errorDiv32 * 3;
        processData[neighborIdx + 2] += errorDiv32 * 3;
      }

      // (x-2, y+1)
      if (x - 2 >= 0 && y + 1 < processHeight) {
        const neighborIdx = ((y + 1) * processWidth + (x - 2)) * 4;
        processData[neighborIdx] += errorDiv32 * 2;
        processData[neighborIdx + 1] += errorDiv32 * 2;
        processData[neighborIdx + 2] += errorDiv32 * 2;
      }

      // (x-1, y+1)
      if (x - 1 >= 0 && y + 1 < processHeight) {
        const neighborIdx = ((y + 1) * processWidth + (x - 1)) * 4;
        processData[neighborIdx] += errorDiv32 * 4;
        processData[neighborIdx + 1] += errorDiv32 * 4;
        processData[neighborIdx + 2] += errorDiv32 * 4;
      }

      // (x, y+1)
      if (y + 1 < processHeight) {
        const neighborIdx = ((y + 1) * processWidth + x) * 4;
        processData[neighborIdx] += errorDiv32 * 5;
        processData[neighborIdx + 1] += errorDiv32 * 5;
        processData[neighborIdx + 2] += errorDiv32 * 5;
      }

      // (x+1, y+1)
      if (x + 1 < processWidth && y + 1 < processHeight) {
        const neighborIdx = ((y + 1) * processWidth + (x + 1)) * 4;
        processData[neighborIdx] += errorDiv32 * 4;
        processData[neighborIdx + 1] += errorDiv32 * 4;
        processData[neighborIdx + 2] += errorDiv32 * 4;
      }

      // (x+2, y+1)
      if (x + 2 < processWidth && y + 1 < processHeight) {
        const neighborIdx = ((y + 1) * processWidth + (x + 2)) * 4;
        processData[neighborIdx] += errorDiv32 * 2;
        processData[neighborIdx + 1] += errorDiv32 * 2;
        processData[neighborIdx + 2] += errorDiv32 * 2;
      }

      // (x-1, y+2)
      if (x - 1 >= 0 && y + 2 < processHeight) {
        const neighborIdx = ((y + 2) * processWidth + (x - 1)) * 4;
        processData[neighborIdx] += errorDiv32 * 2;
        processData[neighborIdx + 1] += errorDiv32 * 2;
        processData[neighborIdx + 2] += errorDiv32 * 2;
      }

      // (x, y+2)
      if (y + 2 < processHeight) {
        const neighborIdx = ((y + 2) * processWidth + x) * 4;
        processData[neighborIdx] += errorDiv32 * 3;
        processData[neighborIdx + 1] += errorDiv32 * 3;
        processData[neighborIdx + 2] += errorDiv32 * 3;
      }

      // (x+1, y+2)
      if (x + 1 < processWidth && y + 2 < processHeight) {
        const neighborIdx = ((y + 2) * processWidth + (x + 1)) * 4;
        processData[neighborIdx] += errorDiv32 * 2;
        processData[neighborIdx + 1] += errorDiv32 * 2;
        processData[neighborIdx + 2] += errorDiv32 * 2;
      }

      // Clamp pixel values to 0-255 after error propagation (optional but good practice)
      processData[idx] = Math.max(0, Math.min(255, processData[idx]));
      processData[idx + 1] = Math.max(0, Math.min(255, processData[idx + 1]));
      processData[idx + 2] = Math.max(0, Math.min(255, processData[idx + 2]));
    }
  }

  if (scale > 1) {
    return upscaleImageData(processData, processWidth, processHeight, width, height);
  }

  return new ImageData(processData, processWidth, processHeight);
}

export default sierraDither; 