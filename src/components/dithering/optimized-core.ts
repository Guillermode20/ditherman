// Advanced optimized dithering core for realtime performance
import type { DitherProps } from './types';
import { ERROR_KERNELS, type ErrorKernelType } from './core';
import { 
  clamp, 
  BAYER_MATRICES, 
  createDitherPalette, 
  scaleImageData, 
  upscaleImageData 
} from './utils';

// Precomputed lookup tables for performance
const GRAYSCALE_LUT = new Uint8Array(256 * 256 * 256); // 16MB lookup table
const PALETTE_LUT_BW = new Uint8Array(256);
const PALETTE_LUT_GRAY = new Uint8Array(256);

// Initialize lookup tables on module load
let lutInitialized = false;

const initializeLookupTables = () => {
  if (lutInitialized) return;
  
  // Initialize grayscale conversion LUT for common color combinations
  // This is too large for full RGB space, so we'll optimize differently
  
  // Initialize palette lookup tables
  for (let i = 0; i < 256; i++) {
    PALETTE_LUT_BW[i] = i < 128 ? 0 : 255;
    
    // For 8-level grayscale
    const levels = 8;
    const step = 255 / (levels - 1);
    const index = Math.min(levels - 1, Math.round(i / step));
    PALETTE_LUT_GRAY[i] = Math.round(index * step);
  }
  
  lutInitialized = true;
};

// Ultra-fast grayscale conversion using bit shifting
export const fastGrayscale = (r: number, g: number, b: number): number => {
  // Using integer arithmetic: (r*77 + g*151 + b*28) >> 8
  // These are approximations of 0.299, 0.587, 0.114 * 256
  return (r * 77 + g * 151 + b * 28) >> 8;
};

// Fast palette lookup using precomputed tables
export const fastPaletteLookup = (gray: number, paletteType: string): number => {
  return paletteType === 'bw' ? PALETTE_LUT_BW[gray] : PALETTE_LUT_GRAY[gray];
};

// Optimized error diffusion with reduced bounds checking
export const optimizedErrorDiffusion = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  paletteType: string,
  kernel: typeof ERROR_KERNELS[ErrorKernelType]
): void => {
  initializeLookupTables();
  
  const dataLength = data.length;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      const oldGray = fastGrayscale(data[idx], data[idx + 1], data[idx + 2]);
      const newGray = fastPaletteLookup(oldGray, paletteType);
      
      // Set new pixel value
      data[idx] = newGray;
      data[idx + 1] = newGray;
      data[idx + 2] = newGray;
      
      // Calculate error once
      const error = oldGray - newGray;
      if (error === 0) continue; // Skip if no error
      
      // Unrolled error distribution for common kernels
      if (kernel === ERROR_KERNELS.floydSteinberg) {
        // Floyd-Steinberg specific optimization
        const e7_16 = (error * 7) >> 4; // error * 7/16
        const e3_16 = (error * 3) >> 4; // error * 3/16
        const e5_16 = (error * 5) >> 4; // error * 5/16
        const e1_16 = error - e7_16 - e3_16 - e5_16; // remainder
        
        // Right pixel
        if (x + 1 < width) {
          const nIdx = idx + 4;
          data[nIdx] = clamp(data[nIdx] + e7_16);
          data[nIdx + 1] = clamp(data[nIdx + 1] + e7_16);
          data[nIdx + 2] = clamp(data[nIdx + 2] + e7_16);
        }
        
        if (y + 1 < height) {
          const nextRowBase = (y + 1) * width;
          
          // Bottom-left pixel
          if (x > 0) {
            const nIdx = (nextRowBase + x - 1) * 4;
            data[nIdx] = clamp(data[nIdx] + e3_16);
            data[nIdx + 1] = clamp(data[nIdx + 1] + e3_16);
            data[nIdx + 2] = clamp(data[nIdx + 2] + e3_16);
          }
          
          // Bottom pixel
          const nIdx = (nextRowBase + x) * 4;
          data[nIdx] = clamp(data[nIdx] + e5_16);
          data[nIdx + 1] = clamp(data[nIdx + 1] + e5_16);
          data[nIdx + 2] = clamp(data[nIdx + 2] + e5_16);
          
          // Bottom-right pixel
          if (x + 1 < width) {
            const nIdx2 = (nextRowBase + x + 1) * 4;
            data[nIdx2] = clamp(data[nIdx2] + e1_16);
            data[nIdx2 + 1] = clamp(data[nIdx2 + 1] + e1_16);
            data[nIdx2 + 2] = clamp(data[nIdx2 + 2] + e1_16);
          }
        }
      } else {
        // Generic kernel processing for other algorithms
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
  }
};

// Optimized Bayer dithering with lookup tables
export const optimizedBayerDithering = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  paletteType: string,
  matrixSize: number
): void => {
  initializeLookupTables();
  
  const bayerMatrix = BAYER_MATRICES[matrixSize];
  const mSize = bayerMatrix.length;
  const bayerFactor = 1 / (mSize * mSize);
  
  // Precompute threshold matrix
  const thresholdMatrix = new Float32Array(mSize * mSize);
  for (let i = 0; i < mSize; i++) {
    for (let j = 0; j < mSize; j++) {
      thresholdMatrix[i * mSize + j] = bayerMatrix[i][j] * bayerFactor;
    }
  }
  
  for (let y = 0; y < height; y++) {
    const matrixY = y % mSize;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = fastGrayscale(data[idx], data[idx + 1], data[idx + 2]);
      
      const matrixX = x % mSize;
      const threshold = thresholdMatrix[matrixY * mSize + matrixX];
      
      let newPixel: number;
      if (paletteType === 'bw') {
        newPixel = (gray / 255) > threshold ? 255 : 0;
      } else {
        const levels = 8;
        const qStep = 255 / (levels - 1);
        
        let levelIndex = Math.floor(gray / qStep);
        const fractionalPart = (gray % qStep) / qStep;
        
        if (fractionalPart > threshold) {
          levelIndex = Math.min(levelIndex + 1, levels - 1);
        }
        newPixel = PALETTE_LUT_GRAY[Math.round(levelIndex * qStep)];
      }
      
      data[idx] = newPixel;
      data[idx + 1] = newPixel;
      data[idx + 2] = newPixel;
    }
  }
};

// Ultra-optimized dithering function with minimal allocations
export const optimizedDitherImage = (
  props: DitherProps, 
  algorithm: 'floydSteinberg' | 'atkinson' | 'sierra' | 'bayer'
): ImageData => {
  const { imageData, scale, paletteType, matrixSize = 4 } = props;
  const { width, height } = imageData;
  const { processData, processWidth, processHeight } = scaleImageData(imageData, scale);
  
  if (algorithm === 'bayer') {
    optimizedBayerDithering(processData, processWidth, processHeight, paletteType, matrixSize);
  } else {
    optimizedErrorDiffusion(processData, processWidth, processHeight, paletteType, ERROR_KERNELS[algorithm]);
  }
  
  if (scale > 1) {
    return upscaleImageData(processData, processWidth, processHeight, width, height);
  }
  
  return new ImageData(processData, processWidth, processHeight);
}; 