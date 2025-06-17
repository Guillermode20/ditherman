import type { DitherProps } from './types';
import { ditherImage } from './core';

/**
 * Sierra dithering algorithm (optimized)
 */
function sierraDither(props: DitherProps): ImageData {
  return ditherImage(props, 'sierra');
}

export default sierraDither; 