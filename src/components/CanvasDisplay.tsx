import React from "react";

type CanvasDisplayProps = {
    originalCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    ditheredCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    imageLoaded: boolean;
};

const CanvasDisplay: React.FC<CanvasDisplayProps> = ({
    originalCanvasRef,
    ditheredCanvasRef,
    imageLoaded,
}) => (
    <main className="main-content">
        <div className="canvas-container">
            <canvas ref={originalCanvasRef} style={{ display: "none" }}></canvas>
            <canvas ref={ditheredCanvasRef}></canvas>
            {!imageLoaded && <div className="placeholder-text"></div>}
        </div>
    </main>
);

export default CanvasDisplay;
