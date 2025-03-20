document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const processing = document.getElementById('processing');
    const results = document.getElementById('results');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const imagesGrid = document.getElementById('images-grid');
    const downloadAllBtn = document.getElementById('download-all');
    const processMoreBtn = document.getElementById('process-more');

    let processedImages = [];

    // Setup event listeners
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('border-blue-500');
    });
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-blue-500');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-blue-500');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    async function handleFiles(files) {
        if (files.length === 0) return;

        uploadZone.classList.add('hidden');
        processing.classList.remove('hidden');
        results.classList.add('hidden');
        imagesGrid.innerHTML = '';
        processedImages = [];

        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        
        for (let i = 0; i < imageFiles.length; i++) {
            const progress = ((i + 1) / imageFiles.length) * 100;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;

            const processedImage = await processImage(imageFiles[i]);
            if (processedImage) {
                processedImages.push(processedImage);
                const card = createImageCard(processedImage, i);
                imagesGrid.appendChild(card);
            }
        }

        processing.classList.add('hidden');
        results.classList.remove('hidden');
    }

    async function processImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Get image data for analysis
                    const imageData = getImageData(img);
                    const bounds = findContentBounds(imageData);

                    // Apply the crop
                    canvas.width = bounds.width;
                    canvas.height = bounds.height;
                    ctx.drawImage(img, 
                        bounds.left, bounds.top, bounds.width, bounds.height,
                        0, 0, bounds.width, bounds.height
                    );

                    resolve({
                        original: e.target.result,
                        processed: canvas.toDataURL('image/jpeg', 0.95),
                        filename: file.name
                    });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function getImageData(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    function findContentBounds(imageData) {
        const { width, height, data } = imageData;
        let minY = height, maxY = 0, minX = width, maxX = 0;
        
        // Enhanced thresholds for aggressive cropping
        const brightnessThreshold = 45; // Higher threshold for dark areas
        const colorVariationThreshold = 35; // Higher threshold for UI elements
        const grayScaleThreshold = 15; // Threshold for detecting gray areas
        
        function isContentPixel(r, g, b) {
            const brightness = (r + g + b) / 3;
            const colorVariation = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
            const isGrayish = Math.abs(r - g) < grayScaleThreshold && 
                            Math.abs(g - b) < grayScaleThreshold && 
                            Math.abs(r - b) < grayScaleThreshold;

            // Detect if pixel is part of UI elements (often gray or semi-transparent)
            const isUIElement = isGrayish && brightness < 200 && brightness > 50;
            
            // Return true only for pixels that are likely part of the main content
            return brightness > brightnessThreshold && 
                   colorVariation > colorVariationThreshold && 
                   !isUIElement;
        }

        // Scan the image with smaller step size for more accuracy
        const scanStep = 1;

        // First pass: find rough content boundaries
        for (let y = 0; y < height; y += scanStep) {
            for (let x = 0; x < width; x += scanStep) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                if (isContentPixel(r, g, b)) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        // Add minimal padding
        const padding = 5;
        
        // Ensure we have valid bounds
        if (maxX - minX < 100 || maxY - minY < 100) {
            return {
                left: 0,
                top: 0,
                width: width,
                height: height
            };
        }

        // Return the cropped bounds with minimal padding
        return {
            left: Math.max(0, minX - padding),
            top: Math.max(0, minY - padding),
            width: Math.min(width - minX, maxX - minX + padding * 2),
            height: Math.min(height - minY, maxY - minY + padding * 2)
        };
    }

    function createImageCard(imageData, index) {
        const div = document.createElement('div');
        div.className = 'image-card';
        div.innerHTML = `
            <img src="${imageData.processed}" alt="Processed image ${index + 1}">
            <button class="download-btn" data-index="${index}">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
            </button>
        `;

        div.querySelector('.download-btn').addEventListener('click', () => {
            downloadImage(imageData.processed, imageData.filename);
        });

        return div;
    }

    function downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `processed_${filename}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    downloadAllBtn.addEventListener('click', () => {
        processedImages.forEach(image => {
            downloadImage(image.processed, image.filename);
        });
    });

    processMoreBtn.addEventListener('click', () => {
        uploadZone.classList.remove('hidden');
        results.classList.add('hidden');
        fileInput.value = '';
    });
});
