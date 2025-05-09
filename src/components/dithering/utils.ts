// Common utility functions and constants for dithering algorithms

export const clamp = (value: number, min = 0, max = 255): number => {
  return Math.max(min, Math.min(max, Math.round(value)));
};

export const BAYER_MATRICES: Record<number, number[][]> = {
  2: [
    [0, 2],
    [3, 1],
  ],
  4: [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ],
  8: [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ],
};

export const createDitherPalette = (type: string): number[] => {
  if (type === 'bw') {
    return [0, 255];
  } else { // grayscale
    const levels = 8; // 8 levels of gray
    const interval = 255 / (levels - 1);
    return Array.from({ length: levels }, (_, i) => Math.round(i * interval));
  }
};

export const findClosestDitherColor = (gray: number, palette: number[], paletteType: string): number => {
  if (paletteType === 'bw') {
    return gray < 128 ? 0 : 255;
  } else { // grayscale
    // For grayscale, palette is already sorted and evenly spaced
    const interval = 255 / (palette.length - 1);
    return Math.round(Math.round(gray / interval) * interval);
  }
};

// Helper function to process image scaling (pure JS, nearest-neighbor)
export const scaleImageData = (
  imageData: ImageData,
  scale: number
): { processData: Uint8ClampedArray, processWidth: number, processHeight: number } => {
  const { data, width, height } = imageData;
  if (scale <= 1) {
    return {
      processData: new Uint8ClampedArray(data),
      processWidth: width,
      processHeight: height
    };
  }
  const scaledWidth = Math.floor(width / scale);
  const scaledHeight = Math.floor(height / scale);
  const scaledData = new Uint8ClampedArray(scaledWidth * scaledHeight * 4);

  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      const srcX = Math.floor(x * scale);
      const srcY = Math.floor(y * scale);
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * scaledWidth + x) * 4;
      scaledData[dstIdx] = data[srcIdx];
      scaledData[dstIdx + 1] = data[srcIdx + 1];
      scaledData[dstIdx + 2] = data[srcIdx + 2];
      scaledData[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return {
    processData: scaledData,
    processWidth: scaledWidth,
    processHeight: scaledHeight
  };
};

// Helper function to upscale processed image back to original size (pure JS, nearest-neighbor)
export const upscaleImageData = (
  processedData: Uint8ClampedArray,
  processWidth: number,
  processHeight: number,
  originalWidth: number,
  originalHeight: number
): ImageData => {
  if (processWidth === originalWidth && processHeight === originalHeight) {
    return new ImageData(processedData, processWidth, processHeight);
  }
  const upscaledData = new Uint8ClampedArray(originalWidth * originalHeight * 4);
  for (let y = 0; y < originalHeight; y++) {
    for (let x = 0; x < originalWidth; x++) {
      const srcX = Math.floor(x * processWidth / originalWidth);
      const srcY = Math.floor(y * processHeight / originalHeight);
      const srcIdx = (srcY * processWidth + srcX) * 4;
      const dstIdx = (y * originalWidth + x) * 4;
      upscaledData[dstIdx] = processedData[srcIdx];
      upscaledData[dstIdx + 1] = processedData[srcIdx + 1];
      upscaledData[dstIdx + 2] = processedData[srcIdx + 2];
      upscaledData[dstIdx + 3] = processedData[srcIdx + 3];
    }
  }
  return new ImageData(upscaledData, originalWidth, originalHeight);
};
