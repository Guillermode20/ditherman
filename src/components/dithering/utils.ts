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

// Helper function to process image scaling
export const scaleImageData = (
  imageData: ImageData,
  scale: number
): { processData: Uint8ClampedArray, processWidth: number, processHeight: number } => {
  const { data, width, height } = imageData;
  const scaledWidth = Math.floor(width / scale);
  const scaledHeight = Math.floor(height / scale);

  if (scale > 1) {
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = scaledWidth;
    scaledCanvas.height = scaledHeight;
    const ctx = scaledCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { 
        processData: new Uint8ClampedArray(data), 
        processWidth: width, 
        processHeight: height 
      };
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) {
      return { 
        processData: new Uint8ClampedArray(data), 
        processWidth: width, 
        processHeight: height 
      };
    }
    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, scaledWidth, scaledHeight);

    const scaledImageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);
    return {
      processData: new Uint8ClampedArray(scaledImageData.data),
      processWidth: scaledWidth,
      processHeight: scaledHeight
    };
  } else {
    return {
      processData: new Uint8ClampedArray(data),
      processWidth: width,
      processHeight: height
    };
  }
};

// Helper function to upscale processed image back to original size
export const upscaleImageData = (
  processedData: Uint8ClampedArray,
  processWidth: number,
  processHeight: number,
  originalWidth: number,
  originalHeight: number
): ImageData => {
  const processedImageData = new ImageData(processedData, processWidth, processHeight);
  
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = originalWidth;
  finalCanvas.height = originalHeight;
  const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!finalCtx) {
    return processedImageData;
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = processWidth;
  tempCanvas.height = processHeight;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) {
    return processedImageData;
  }
  
  tempCtx.putImageData(processedImageData, 0, 0);

  finalCtx.imageSmoothingEnabled = false; // Use nearest-neighbor for upscaling
  finalCtx.drawImage(tempCanvas, 0, 0, processWidth, processHeight, 0, 0, originalWidth, originalHeight);
  
  return finalCtx.getImageData(0, 0, originalWidth, originalHeight);
}; 