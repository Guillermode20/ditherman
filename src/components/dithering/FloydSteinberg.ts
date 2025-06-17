import type { DitherProps } from './types';
import { ditherImage } from './core';

/**
 * Floyd-Steinberg dithering algorithm (optimized)
 */
function floydSteinbergDither(props: DitherProps): ImageData {
  return ditherImage(props, 'floydSteinberg');
}

export default floydSteinbergDither; 