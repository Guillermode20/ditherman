const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const algorithmSelect = document.getElementById('algorithm');
const scaleInput = document.getElementById('scale');
const scaleValue = document.getElementById('scaleValue');
const invertInput = document.getElementById('invert');
const contrastInput = document.getElementById('contrast');
const contrastValue = document.getElementById('contrastValue');
const midtonesInput = document.getElementById('midtones');
const midtonesValue = document.getElementById('midtonesValue');
const highlightsInput = document.getElementById('highlights');
const highlightsValue = document.getElementById('highlightsValue');
const luminanceThresholdInput = document.getElementById('luminanceThreshold');
const luminanceThresholdValue = document.getElementById('luminanceThresholdValue');
const blurInput = document.getElementById('blur');
const blurValue = document.getElementById('blurValue');
const preview = document.getElementById('preview');
let currentFile = null;

// Handle drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
});

// Handle click to upload
dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
});

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Update slider value and number input
function updateSlider(id, value) {
    const input = document.getElementById(id);
    const display = document.getElementById(id + 'Value');
    const numInput = input.parentElement.querySelector('input[type="number"]');

    input.value = value;
    if (id === 'scale' || id === 'blur') {
        display.textContent = parseFloat(value).toFixed(1);
    } else {
        display.textContent = value;
    }
    if (numInput) {
        numInput.value = value;
    }
    updateImage();
}

// Debounced update image function
const debouncedUpdateImage = debounce(() => {
    if (currentFile) {
        processImage(currentFile);
    }
}, 300);

// Handle parameter changes
algorithmSelect.addEventListener('change', () => updateImage());

const sliderInputs = [
    { input: scaleInput, isFloat: true, defaultValue: 1 },
    { input: contrastInput, isFloat: false, defaultValue: 50 },
    { input: midtonesInput, isFloat: false, defaultValue: 50 },
    { input: highlightsInput, isFloat: false, defaultValue: 50 },
    { input: luminanceThresholdInput, isFloat: false, defaultValue: 50 },
    { input: blurInput, isFloat: true, defaultValue: 0 }
];

sliderInputs.forEach(({ input, isFloat }) => {
    // Add double-click to reset
    input.addEventListener('dblclick', () => {
        resetControl(input.id, isFloat);
    });

    // Handle input events
    input.addEventListener('input', (e) => {
        let value = e.target.value;
        if (value < 0) value = 0;
        if (value > 100) value = 100;
        const display = document.getElementById(input.id + 'Value');
        const numInput = input.parentElement.querySelector('input[type="number"]');

        display.textContent = isFloat ? parseFloat(value).toFixed(1) : value;
        if (numInput) {
            numInput.value = value;
        }
        document.documentElement.style.setProperty('--dot-scale', value);
        debouncedUpdateImage();
    });
});

function updateImage() {
    if (currentFile) {
        processImage(currentFile);
    }
}

function validateImageFile(file) {
    // Check if the file is an image
    if (!file || !file.type.startsWith('image/')) {
        return { valid: false, message: 'Please upload an image file.' };
    }
    
    // Check if the image is a supported format (JPEG or PNG)
    const supportedTypes = ['image/jpeg', 'image/png'];
    if (!supportedTypes.includes(file.type)) {
        return { 
            valid: false, 
            message: `Unsupported image format: ${file.type}. Please upload a JPEG or PNG file.`
        };
    }
    
    return { valid: true };
}

function handleFile(file) {
    // Update the UI to show the original filename
    dropZone.textContent = file ? `File: ${file.name}` : 'Drop image here or click to upload';
    
    // Validate the file
    const validation = validateImageFile(file);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    currentFile = file;
    processImage(file);
}

async function processImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('algorithm', algorithmSelect.value);
    formData.append('scale', scaleInput.value);
    formData.append('invert', invertInput.checked ? '1' : '0');
    formData.append('contrast', contrastInput.value);
    formData.append('midtones', midtonesInput.value);
    formData.append('highlights', highlightsInput.value);
    formData.append('luminanceThreshold', luminanceThresholdInput.value);
    formData.append('blur', blurInput.value);

    // Show loading state
    preview.classList.add('loading');
    
    // Show file type in UI for debugging
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.textContent = `Processing ${file.name} (${file.type})`;
    document.querySelector('.main-content h3').textContent = 'Preview - Processing...';

    try {
        const response = await fetch('http://localhost:3000/dither', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorMessage = 'Error processing image';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // If the response is not valid JSON, use default error message
            }
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        preview.src = URL.createObjectURL(blob);
        document.querySelector('.main-content h3').textContent = 'Preview';
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
        document.querySelector('.main-content h3').textContent = 'Preview - Error';
    } finally {
        preview.classList.remove('loading');
    }
}

// Remove loading state when image loads
preview.addEventListener('load', () => {
    preview.classList.remove('loading');
});

// Reset individual control
function resetControl(id, isFloat = false, defaultValue = null) {
    const input = document.getElementById(id);
    const valueDisplay = document.getElementById(id + 'Value');
    let value = defaultValue;
    
    if (value === null) {
        const sliderInput = sliderInputs.find(item => item.input.id === id);
        if (sliderInput) {
            value = sliderInput.defaultValue;
        } else {
            // Fallback default values if not in the list
            value = isFloat ? 0.0 : 0;
        }
    }
    
    const numInput = input.parentElement.querySelector('input[type="number"]');
    input.value = value;
    valueDisplay.textContent = isFloat ? parseFloat(value).toFixed(1) : value;
    if (numInput) {
        numInput.value = value;
    }
    updateImage();
}

// Reset all controls
function applyDefaultSettings() {
    // Reset algorithm
    algorithmSelect.value = 'floyd-steinberg';

    // Reset invert
    invertInput.checked = false;

    resetControl('scale', true, 1);
    resetControl('contrast', false, 50);
    resetControl('midtones', false, 50);
    resetControl('highlights', false, 50);
    resetControl('luminanceThreshold', false, 0);
    resetControl('blur', true, 0);

    // Reset drop zone text
    dropZone.textContent = 'Drop image here or click to upload';
    
    // Update the image with reset values if a file is already loaded
    updateImage();
}

document.getElementById('resetAll').addEventListener('click', applyDefaultSettings);

window.addEventListener('load', applyDefaultSettings);
