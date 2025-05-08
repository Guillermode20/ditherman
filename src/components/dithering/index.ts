import type { DitherProps } from './types';
import floydSteinbergDither from './FloydSteinberg';
import bayerOrderedDither from './Bayer';
import atkinsonDither from './Atkinson';
import sierraDither from './Sierra';

export { floydSteinbergDither, bayerOrderedDither, atkinsonDither, sierraDither };
export type { DitherProps }; 