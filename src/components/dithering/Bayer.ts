import type { DitherProps } from './types';
import { ditherImage } from './core';

/**
 * Bayer ordered dithering algorithm (optimized)
 */
function bayerOrderedDither(props: DitherProps): ImageData {
  return ditherImage(props, 'bayer');
}

export default bayerOrderedDither; 