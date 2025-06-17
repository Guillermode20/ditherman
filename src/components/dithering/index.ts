import type { DitherProps } from './types';
import floydSteinbergDither from './FloydSteinberg';
import bayerOrderedDither from './Bayer';
import atkinsonDither from './Atkinson';
import sierraDither from './Sierra';

// Export centralized core for advanced optimizations
export { ditherImage, ERROR_KERNELS, toGrayscale, findClosestPaletteColor } from './core';
export type { ErrorKernelType } from './core';

// Export optimized versions for maximum performance
export { optimizedDitherImage, fastGrayscale, fastPaletteLookup } from './optimized-core';

// Configuration for switching between standard and optimized versions
export const DITHERING_CONFIG = {
  useOptimized: true, // Set to false to use standard algorithms
  enableLookupTables: true,
  maxImageSize: 1920 * 1080, // Auto-optimize for images smaller than this
};

// Adaptive dithering function that chooses the best algorithm based on image size
export const adaptiveDitherImage = async (
  props: DitherProps, 
  algorithm: 'floydSteinberg' | 'atkinson' | 'sierra' | 'bayer'
): Promise<ImageData> => {
  const { imageData } = props;
  const pixelCount = imageData.width * imageData.height;
  
  // Use optimized version for larger images or when explicitly enabled
  if (DITHERING_CONFIG.useOptimized || pixelCount > DITHERING_CONFIG.maxImageSize) {
    const { optimizedDitherImage } = await import('./optimized-core');
    return optimizedDitherImage(props, algorithm);
  } else {
    const { ditherImage } = await import('./core');
    return ditherImage(props, algorithm);
  }
};

export { floydSteinbergDither, bayerOrderedDither, atkinsonDither, sierraDither };
export type { DitherProps }; 