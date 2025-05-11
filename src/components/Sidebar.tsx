import React from "react";
import type { State } from "../App";

type SidebarProps = {
    state: State;
    imageLoaded: boolean;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleChange: (key: keyof State) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    handleDitheringAlgorithmChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    handleReset: (key: keyof State, defaultValue: State[keyof State]) => void;
    handleGlobalReset: () => void;
    handleDownloadPng: () => void;
    handleDownloadJpg: () => void;
    dispatch: React.Dispatch<any>;
};

const Sidebar: React.FC<SidebarProps> = ({
    state,
    imageLoaded,
    handleImageUpload,
    handleChange,
    handleDitheringAlgorithmChange,
    handleReset,
    handleGlobalReset,
    handleDownloadPng,
    handleDownloadJpg,
    dispatch,
}) => (
    <aside className="sidebar">
        <pre className="ascii-header" style={{ whiteSpace: "pre" }}>
            {`
██████╗ ██╗████████╗██╗  ██╗███████╗██████╗ ███╗   ███╗ █████╗ ███╗   ██╗
██╔══██╗██║╚══██╔══╝██║  ██║██╔════╝██╔══██╗████╗ ████║██╔══██╗████╗  ██║
██║  ██║██║   ██║   ███████║█████╗  ██████╔╝██╔████╔██║███████║██╔██╗ ██║
██║  ██║██║   ██║   ██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══██║██║╚██╗██║
██████╔╝██║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║
╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
      `}
        </pre>
        <div className="image-upload-container">
            <input type="file" id="imageUpload" accept="image/png, image/jpeg" onChange={handleImageUpload} />
            <label htmlFor="imageUpload">Choose an Image</label>
        </div>

        <div className="controls">
            <h2>Output Options</h2>
            <label htmlFor="palette">Palette:</label>
            <select id="palette" value={state.palette} onChange={handleChange("palette")}>
                <option value="bw">Black & White</option>
                <option value="grayscale">Grayscale (8 levels)</option>
            </select>

            <div className="buttons-group">
                <button id="downloadPng" onClick={handleDownloadPng} disabled={!imageLoaded}>Download PNG</button>
                <button id="downloadJpg" onClick={handleDownloadJpg} disabled={!imageLoaded}>Download JPG</button>
            </div>
        </div>

        <div className="controls">
            <h2>Dithering Method</h2>
            <div className="control-row">
                <label htmlFor="ditheringAlgorithm">Algorithm:</label>
                <select id="ditheringAlgorithm" value={state.ditheringAlgorithm} onChange={handleDitheringAlgorithmChange}>
                    <option value="floyd-steinberg">Floyd-Steinberg</option>
                    <option value="bayer">Bayer (Ordered)</option>
                    <option value="atkinson">Atkinson</option>
                    <option value="sierra">Sierra</option>
                </select>
                <button className="reset-btn" onClick={() => handleReset("ditheringAlgorithm", "floyd-steinberg")}>Reset</button>
            </div>

            {state.ditheringAlgorithm === "bayer" && (
                <div className="control-row">
                    <label htmlFor="bayerMatrixSize">Matrix Size:</label>
                    <select id="bayerMatrixSize" value={state.bayerMatrixSize} onChange={handleChange("bayerMatrixSize")}>
                        <option value="2">2x2</option>
                        <option value="4">4x4</option>
                        <option value="8">8x8</option>
                    </select>
                    <output id="bayerMatrixSizeValue" style={{ minWidth: "20px", textAlign: "right", marginLeft: "5px" }}>{state.bayerMatrixSize}</output>
                    <button className="reset-btn" onClick={() => handleReset("bayerMatrixSize", 4)}>Reset</button>
                </div>
            )}
        </div>

        <div className="controls">
            <h2>Dither Scale</h2>
            <div className="control-row">
                <label htmlFor="ditherScale">Scale:</label>
                <input type="range" id="ditherScale" min="1" max="10" value={state.ditherScale} onChange={handleChange("ditherScale")} />
                <output id="ditherScaleValue">{state.ditherScale}</output>
                <button className="reset-btn" onClick={() => handleReset("ditherScale", 1)}>Reset</button>
            </div>
        </div>

        <div className="controls">
            <h2>Image Adjustments</h2>
            <div className="control-row">
                <label htmlFor="contrastSlider">Contrast:</label>
                <input type="range" id="contrastSlider" min="0" max="200" value={state.contrast} onChange={handleChange("contrast")} />
                <output id="contrastSliderValue">{state.contrast}</output>
                <button className="reset-btn" onClick={() => handleReset("contrast", 100)}>Reset</button>
            </div>
            <div className="control-row">
                <label htmlFor="highlightsSlider">Highlights:</label>
                <input type="range" id="highlightsSlider" min="-100" max="100" value={state.highlights} onChange={handleChange("highlights")} />
                <output id="highlightsSliderValue">{state.highlights}</output>
                <button className="reset-btn" onClick={() => handleReset("highlights", 0)}>Reset</button>
            </div>
            <div className="control-row">
                <label htmlFor="midtonesSlider">Midtones:</label>
                <input type="range" id="midtonesSlider" min="-100" max="100" value={state.midtones} onChange={handleChange("midtones")} />
                <output id="midtonesSliderValue">{state.midtones}</output>
                <button className="reset-btn" onClick={() => handleReset("midtones", 0)}>Reset</button>
            </div>
            <div className="control-row">
                <label htmlFor="blurSlider">Blur:</label>
                <input type="range" id="blurSlider" min="0" max="10" value={state.blur} onChange={handleChange("blur")} />
                <output id="blurSliderValue">{state.blur}</output>
                <button className="reset-btn" onClick={() => handleReset("blur", 0)}>Reset</button>
            </div>
            <div className="control-row">
                <label htmlFor="luminanceSlider">Luminance:</label>
                <input type="range" id="luminanceSlider" min="-100" max="100" value={state.luminance} onChange={handleChange("luminance")} />
                <output id="luminanceSliderValue">{state.luminance}</output>
                <button className="reset-btn" onClick={() => handleReset("luminance", 0)}>Reset</button>
            </div>
            <div className="control-row">
                <label htmlFor="invertColors">Invert:</label>
                <button
                    id="invertColors"
                    className={`invert-btn${state.invertColors ? " active" : ""}`}
                    type="button"
                    onClick={() =>
                        dispatch({
                            type: "SET",
                            key: "invertColors",
                            value: !state.invertColors,
                        })
                    }
                    aria-pressed={state.invertColors}
                >
                    {state.invertColors ? "Inverted" : "Invert Colors"}
                </button>
                <button className="reset-btn" onClick={() => handleReset("invertColors", false)}>Reset</button>
            </div>
        </div>

        <button id="globalReset" className="reset-btn global-reset-btn" onClick={handleGlobalReset}>Reset All Settings</button>
    </aside>
);

export default Sidebar;
