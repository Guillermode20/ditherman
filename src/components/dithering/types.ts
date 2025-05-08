export interface DitherProps {
  imageData: ImageData;
  scale: number;
  paletteType: string;
  matrixSize?: number; // Only used for Bayer dithering
}

export type DitherFunction = (props: DitherProps) => ImageData; 