# System Patterns: DitherMan

## System Architecture

- **Single-Page Application (SPA)** built with React and TypeScript.
- **Component Structure:**
  - `App.tsx`: Main application component, manages state, UI, and user interactions.
  - `ImageAdjustments.ts`: Contains image adjustment logic (contrast, highlights, midtones, blur, luminance, invert).
  - `dithering/`: Contains separate modules for each dithering algorithm (Floyd-Steinberg, Bayer, Atkinson, Sierra).
- **Web Worker (`imageWorker.ts`):**
  - Offloads image processing and dithering to a separate thread.
  - Receives image data and adjustment parameters, applies transformations, and returns processed image data.
- **UI Flow:**
  1. User uploads an image.
  2. User adjusts settings (palette, algorithm, scale, contrast, etc.).
  3. App sends image and settings to the Web Worker.
  4. Worker processes and returns dithered image.
  5. User can download the result.

## Key Technical Decisions

- Use of Web Worker to keep UI responsive during heavy image processing.
- Modular dithering algorithms for extensibility.
- Debounced state updates for efficient processing.
- Real-time preview using canvas elements.

## Design Patterns

- **Separation of Concerns:** UI, image adjustments, and dithering logic are modularized.
- **Unidirectional Data Flow:** React state flows from controls to processing logic to output.
- **Performance Optimization:** Debouncing and worker offloading prevent unnecessary re-renders and UI blocking.

## Component Relationships

- `App.tsx` orchestrates all controls, state, and communication with the worker.
- Image adjustment and dithering modules are imported and used by the worker.
- The worker communicates results back to the main thread for display.

## Critical Implementation Paths

- Image upload → state update → worker processing → canvas update → download.
- All adjustments and dithering options are reflected in real-time.
