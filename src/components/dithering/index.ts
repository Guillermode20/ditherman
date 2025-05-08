import type { DitherProps } from './types';
import floydSteinbergDither from './FloydSteinberg';
import bayerOrderedDither from './Bayer';

export { floydSteinbergDither, bayerOrderedDither };
export type { DitherProps }; 