# Project Brief: DitherMan

DitherMan is a simple web application for image dithering, allowing users to upload images, apply various dithering algorithms and image adjustments, and download the processed result. The application is designed for ease of use, providing real-time feedback and a range of customization options.

## Core Requirements and Goals

- Enable users to upload images (PNG, JPG).
- Provide multiple dithering algorithms: Floyd-Steinberg, Bayer (Ordered), Atkinson, Sierra.
- Allow palette selection: Black & White, Grayscale (8 levels).
- Offer image adjustments: dither scale, contrast, highlights, midtones, blur, luminance, and color inversion.
- Support real-time preview and adjustments.
- Allow users to download the dithered image as PNG or JPG.
- Ensure fast, responsive performance (using a Web Worker for processing).
- Simple, intuitive user interface.

## Project Scope

- Single-page web application.
- No backend; all processing is client-side.
- Modern React + TypeScript stack, built with Vite.
- Modular, maintainable codebase.
