import type { DitherProps } from './types';
import { ditherImage } from './core';

/**
 * Atkinson dithering algorithm (optimized)
 */
function atkinsonDither(props: DitherProps): ImageData {
  return ditherImage(props, 'atkinson');
}

export default atkinsonDither; 