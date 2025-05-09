import { clamp } from './dithering/utils';

interface AdjustmentProps {
  imageData: ImageData;
}

/**
 * Apply contrast adjustment to the image
 * @param imageData - The image data to adjust
 * @param contrastValue - 100 = no change, 0 = minimum contrast, 200 = maximum contrast
 */
export function applyContrast(imageData: ImageData, contrastValue: number): ImageData {
  const data = imageData.data;
  const length = data.length;

  // Convert the slider value to a contrast factor
  // 100 = no change (factor = 1)
  // 0 = minimum contrast (factor = 0)
  // 200 = maximum contrast (factor = 2)
  const factor = contrastValue / 100;

  for (let i = 0; i < length; i += 4) {
    // For each RGB component
    for (let j = 0; j < 3; j++) {
      const component = data[i + j];
      // Apply contrast: (component - 128) * factor + 128
      data[i + j] = clamp((component - 128) * factor + 128);
    }
  }
  return imageData;
}

/**
 * Apply highlights adjustment to the image
 * Uses a smooth curve to brighten highlights without harsh transitions
 */
export function applyHighlights(imageData: ImageData, highlightsValue: number): ImageData {
  const data = imageData.data;
  const length = data.length;
  
  // Convert from [-100, 100] range to a multiplier [0.5, 2.0]
  const factor = 1 + (highlightsValue / 100);
  
  for (let i = 0; i < length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Calculate luminance (weighted average)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Smooth curve that affects highlights more than midtones
    // The higher the luminance, the stronger the effect
    const highlightStrength = Math.pow((luminance / 255), 2);
    
    // Apply adjustment
    data[i] = clamp(r + (255 - r) * (factor - 1) * highlightStrength);
    data[i + 1] = clamp(g + (255 - g) * (factor - 1) * highlightStrength);
    data[i + 2] = clamp(b + (255 - b) * (factor - 1) * highlightStrength);
  }
  return imageData;
}

/**
 * Apply midtones adjustment to the image
 * Uses a bell curve to target midtones specifically
 */
export function applyMidtones(imageData: ImageData, midtonesValue: number): ImageData {
  const data = imageData.data;
  const length = data.length;
  
  // Convert from [-100, 100] range to a multiplier [0.5, 2.0]
  const factor = 1 + (midtonesValue / 100);
  
  for (let i = 0; i < length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Calculate luminance (weighted average)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Bell curve centered around midtones (128)
    // Peaks at 128 and falls off towards shadows/highlights
    const midtoneStrength = Math.exp(-Math.pow((luminance - 128) / 64, 2));
    
    // Apply adjustment
    data[i] = clamp(r * (1 + (factor - 1) * midtoneStrength));
    data[i + 1] = clamp(g * (1 + (factor - 1) * midtoneStrength));
    data[i + 2] = clamp(b * (1 + (factor - 1) * midtoneStrength));
  }
  return imageData;
}

/**
 * Apply blur to the image
 */
export function applyBlur(imageData: ImageData, blurRadius: number): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(new Uint8ClampedArray(data), width, height); // Create a copy
  const outputData = output.data;
  const effectiveRadius = Math.min(blurRadius, 5); // Cap radius for performance

  if (effectiveRadius === 0) return imageData; // No blur

  // Simplified box blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let ky = -effectiveRadius; ky <= effectiveRadius; ky++) {
        for (let kx = -effectiveRadius; kx <= effectiveRadius; kx++) {
          const px = x + kx;
          const py = y + ky;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            count++;
          }
        }
      }
      const outIdx = (y * width + x) * 4;
      outputData[outIdx] = Math.round(r / count);
      outputData[outIdx + 1] = Math.round(g / count);
      outputData[outIdx + 2] = Math.round(b / count);
      outputData[outIdx + 3] = data[outIdx + 3]; // Preserve alpha
    }
  }
  return output;
}

/**
 * Apply luminance adjustment to the image
 * @param imageData - The image data to adjust
 * @param luminanceValue - Value from -100 (darker) to 100 (brighter), 0 is no change
 */
export function applyLuminance(imageData: ImageData, luminanceValue: number): ImageData {
  const data = imageData.data;
  const length = data.length;
  const adjustment = Math.round(luminanceValue * 1.28); // Scale -100..100 to -128..128

  for (let i = 0; i < length; i += 4) {
    data[i] = clamp(data[i] + adjustment);     // Red
    data[i + 1] = clamp(data[i + 1] + adjustment); // Green
    data[i + 2] = clamp(data[i + 2] + adjustment); // Blue
  }
  return imageData;
}

/**
 * Invert the colors of the image
 * @param imageData - The image data to invert
 */
export function applyInvert(imageData: ImageData): ImageData {
  const data = imageData.data;
  const length = data.length;

  for (let i = 0; i < length; i += 4) {
    data[i] = 255 - data[i];     // Red
    data[i + 1] = 255 - data[i + 1]; // Green
    data[i + 2] = 255 - data[i + 2]; // Blue
    // Alpha channel (data[i + 3]) remains unchanged
  }
  return imageData;
}
