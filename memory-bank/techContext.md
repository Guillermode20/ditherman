# Tech Context: DitherMan

## Technologies Used

- **React** (v19.x): UI framework for building the interactive interface.
- **TypeScript**: Provides static typing for safer, more maintainable code.
- **Vite**: Fast development server and build tool.
- **Web Workers**: Offload heavy image processing to a separate thread for UI responsiveness.

## Development Setup

- **Install dependencies:**  
  `npm install`
- **Start development server:**  
  `npm run dev`
- **Build for production:**  
  `npm run build`
- **Lint code:**  
  `npm run lint`
- **Preview production build:**  
  `npm run preview`

## Technical Constraints

- All processing is client-side; no backend.
- Must support modern browsers with ES modules and Web Worker support.
- Image processing must not block the UI.

## Dependencies

- **Production:**  
  - react
  - react-dom

- **Development:**  
  - @vitejs/plugin-react
  - typescript
  - eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh
  - @types/react, @types/react-dom
  - globals
  - typescript-eslint

## Tool Usage Patterns

- Use Vite for fast reloads and builds.
- Use TypeScript for type safety.
- Use ESLint for code quality.
- Use Web Workers for non-blocking image processing.
