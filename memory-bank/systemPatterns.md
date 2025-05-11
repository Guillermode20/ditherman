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
- **Refinements (Completed):**
    - `App.tsx` now uses a fully typed `useReducer` for all adjustment and dithering settings, replacing multiple `useState` hooks.
    - All state-changing handlers and reset logic use `keyof State` for type safety.
    - The invert button uses a dedicated toggle handler.
    - DOM interactions are React-idiomatic (controlled components, `useRef` for canvases).
    - `App.tsx` has been decomposed into `Sidebar` and `CanvasDisplay` components for improved modularity and maintainability.
    - All state and handlers are passed as props to these components.
    - Worker instantiation in `App.tsx` has been simplified (directly created in useEffect).
    - Debug `console.log` removed from `src/imageWorker.ts`.
    - useCallback usage reviewed and unnecessary wrappers removed from handlers that only call dispatch or use stable refs.
    - Error handling implemented in the worker (`src/imageWorker.ts` now posts error messages to the main thread).

## Design Patterns

- **Separation of Concerns:** UI, image adjustments, and dithering logic are modularized. This is further enhanced by decomposing `App.tsx` and consolidating state logic.
- **Unidirectional Data Flow:** React state flows from controls to processing logic to output. This pattern is maintained and clarified with `useReducer`.
- **Performance Optimization:** Debouncing and worker offloading prevent unnecessary re-renders and UI blocking.
- **State Management:** Uses a single, typed `useReducer` in `App.tsx` for all related state.
- **Component-Based Architecture:** Core React pattern. Planned to be strengthened by breaking down the large `App.tsx` component.

## Component Relationships

- `App.tsx` (currently) orchestrates all controls, state, and communication with the worker.
- **Planned:** `App.tsx` will likely become more of a container component, delegating UI rendering and some event handling to smaller child components.
- Image adjustment and dithering modules are imported and used by the worker.
- The worker communicates results back to the main thread for display.

## Critical Implementation Paths

- Image upload → state update → worker processing → canvas update → download.
- All adjustments and dithering options are reflected in real-time.
