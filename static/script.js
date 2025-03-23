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

function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Please upload an image file');
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

    try {
        const response = await fetch('http://localhost:3000/dither', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error processing image');
        }

        const blob = await response.blob();
        preview.src = URL.createObjectURL(blob);
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    } finally {
        preview.classList.remove('loading');
    }
}

// Remove loading state when image loads
preview.addEventListener('load', () => {
    preview.classList.remove('loading');
});

// Reset individual control
function resetControl(id, isFloat = false) {
    const input = document.getElementById(id);
    const valueDisplay = document.getElementById(id + 'Value');
    const sliderInput = sliderInputs.find(item => item.input.id === id);
    const defaultValue = sliderInput.defaultValue;
    const numInput = input.parentElement.querySelector('input[type="number"]');
    input.value = defaultValue;
    valueDisplay.textContent = isFloat ? parseFloat(defaultValue).toFixed(1) : defaultValue;
    if (numInput) {
        numInput.value = defaultValue;
    }
    updateImage();
}

// Reset all controls
function applyDefaultSettings() {
    // Reset algorithm
    algorithmSelect.value = 'floyd-steinberg';

    // Reset invert
    invertInput.checked = false;

    resetControl('scale', true);
    resetControl('contrast');
    resetControl('midtones');
    resetControl('highlights');
    resetControl('luminanceThreshold');
    resetControl('blur', true);

    // Update the image with reset values
    updateImage();
}

document.getElementById('resetAll').addEventListener('click', applyDefaultSettings);

window.addEventListener('load', applyDefaultSettings);
