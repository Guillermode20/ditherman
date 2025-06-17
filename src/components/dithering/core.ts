// Centralized dithering core with optimized operations
import type { DitherProps } from './types';
import { 
  clamp, 
  BAYER_MATRICES, 
  createDitherPalette, 
  scaleImageData, 
  upscaleImageData 
} from './utils';

// Error diffusion kernel definitions
export const ERROR_KERNELS = {
  floydSteinberg: [
    { dx: 1, dy: 0, weight: 7/16 },
    { dx: -1, dy: 1, weight: 3/16 },
    { dx: 0, dy: 1, weight: 5/16 },
    { dx: 1, dy: 1, weight: 1/16 }
  ],
  atkinson: [
    { dx: 1, dy: 0, weight: 1/8 },
    { dx: 2, dy: 0, weight: 1/8 },
    { dx: -1, dy: 1, weight: 1/8 },
    { dx: 0, dy: 1, weight: 1/8 },
    { dx: 1, dy: 1, weight: 1/8 },
    { dx: 0, dy: 2, weight: 1/8 }
  ],
  sierra: [
    { dx: 1, dy: 0, weight: 5/32 },
    { dx: 2, dy: 0, weight: 3/32 },
    { dx: -2, dy: 1, weight: 2/32 },
    { dx: -1, dy: 1, weight: 4/32 },
    { dx: 0, dy: 1, weight: 5/32 },
    { dx: 1, dy: 1, weight: 4/32 },
    { dx: 2, dy: 1, weight: 2/32 },
    { dx: -1, dy: 2, weight: 2/32 },
    { dx: 0, dy: 2, weight: 3/32 },
    { dx: 1, dy: 2, weight: 2/32 }
  ]
} as const;

export type ErrorKernelType = keyof typeof ERROR_KERNELS;

// Optimized grayscale conversion with precomputed coefficients
const GRAY_COEFFICIENTS = [76, 150, 29]; // [0.299*256, 0.587*256, 0.114*256] for fixed-point math
export const toGrayscale = (r: number, g: number, b: number): number => {
  return (r * GRAY_COEFFICIENTS[0] + g * GRAY_COEFFICIENTS[1] + b * GRAY_COEFFICIENTS[2]) >> 8;
};

// Optimized palette color finding
export const findClosestPaletteColor = (gray: number, palette: number[], paletteType: string): number => {
  if (paletteType === 'bw') {
    return gray < 128 ? 0 : 255;
  }
  
  // For grayscale palette, use optimized lookup
  const levels = palette.length;
  const step = 255 / (levels - 1);
  const index = Math.min(levels - 1, Math.round(gray / step));
  return palette[index];
};

// Core error diffusion function
export const applyErrorDiffusion = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: number[],
  paletteType: string,
  kernel: typeof ERROR_KERNELS[ErrorKernelType]
): void => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const oldR = data[idx];
      const oldG = data[idx + 1];
      const oldB = data[idx + 2];
      
      const oldGray = toGrayscale(oldR, oldG, oldB);
      const newGray = findClosestPaletteColor(oldGray, palette, paletteType);
      
      // Set new pixel value
      data[idx] = newGray;
      data[idx + 1] = newGray;
      data[idx + 2] = newGray;
      
      // Calculate and distribute error
      const error = oldGray - newGray;
      
      for (const { dx, dy, weight } of kernel) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 4;
          const errorAmount = error * weight;
          
          data[nIdx] = clamp(data[nIdx] + errorAmount);
          data[nIdx + 1] = clamp(data[nIdx + 1] + errorAmount);
          data[nIdx + 2] = clamp(data[nIdx + 2] + errorAmount);
        }
      }
    }
  }
};

// Core Bayer dithering function
export const applyBayerDithering = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: number[],
  paletteType: string,
  matrixSize: number
): void => {
  const bayerMatrix = BAYER_MATRICES[matrixSize];
  const mSize = bayerMatrix.length;
  const bayerFactor = 1 / (mSize * mSize);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      const gray = toGrayscale(r, g, b);
      const threshold = bayerMatrix[y % mSize][x % mSize] * bayerFactor;
      
      let newPixel: number;
      if (paletteType === 'bw') {
        newPixel = (gray / 255) > threshold ? 255 : 0;
      } else {
        const numLevels = palette.length;
        const qStep = 255 / (numLevels - 1);
        
        let levelIndex = Math.floor(gray / qStep);
        const fractionalPart = (gray % qStep) / qStep;
        
        if (fractionalPart > threshold) {
          levelIndex = Math.min(levelIndex + 1, numLevels - 1);
        }
        newPixel = palette[levelIndex];
      }
      
      data[idx] = newPixel;
      data[idx + 1] = newPixel;
      data[idx + 2] = newPixel;
    }
  }
};

// Centralized dithering function
export const ditherImage = (
  props: DitherProps, 
  algorithm: 'floydSteinberg' | 'atkinson' | 'sierra' | 'bayer'
): ImageData => {
  const { imageData, scale, paletteType, matrixSize = 4 } = props;
  const { width, height } = imageData;
  const { processData, processWidth, processHeight } = scaleImageData(imageData, scale);
  
  const palette = createDitherPalette(paletteType);
  
  if (algorithm === 'bayer') {
    applyBayerDithering(processData, processWidth, processHeight, palette, paletteType, matrixSize);
  } else {
    applyErrorDiffusion(processData, processWidth, processHeight, palette, paletteType, ERROR_KERNELS[algorithm]);
  }
  
  if (scale > 1) {
    return upscaleImageData(processData, processWidth, processHeight, width, height);
  }
  
  return new ImageData(processData, processWidth, processHeight);
}; 