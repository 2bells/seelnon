export class FileManager {
    async importImages(files) {
        const imagePromises = files.map(file => this.loadImage(file));
        return Promise.all(imagePromises);
    }
    
    loadImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Create thumbnail for inventory
                const maxSize = 150; // Smaller for inventory
                let { width, height } = img;
                
                if (width > height) {
                    height = (maxSize / width) * height;
                    width = maxSize;
                } else {
                    width = (maxSize / height) * width;
                    height = maxSize;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve({
                    element: img,
                    thumbnail: canvas.toDataURL(),
                    width: img.width, // Store original width
                    height: img.height, // Store original height
                    file: file.name
                });
                
                URL.revokeObjectURL(url);
            };
            
            img.src = url;
        });
    }
    
    serialize(imageBoard, layerManager) {
        const items = imageBoard.getAllItems();
        
        // Convert images to data URLs for saving
        const serializedItems = items.map(item => {
            if (item.type === 'image') {
                // To preserve the full original image data (regardless of current display size or crop),
                // we draw the *entire original element* to a temporary canvas.
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = item.originalWidth;
                canvas.height = item.originalHeight;
                // Draw the original, full-resolution image onto the canvas
                ctx.drawImage(item.element, 0, 0, item.originalWidth, item.originalHeight);
                
                return {
                    ...item,
                    dataUrl: canvas.toDataURL(), // This now stores the full original image
                    element: null // Remove DOM reference
                };
            }
            return item;
        });
        
        return {
            images: serializedItems,
            layers: layerManager.layers,
            panX: imageBoard.panX,
            panY: imageBoard.panY,
            zoom: imageBoard.zoom // Save zoom level
        };
    }
    
    saveBoard(data) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-board-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    async loadBoard(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = JSON.parse(e.target.result);
                
                // Restore images from data URLs
                const imagePromises = data.images.map(item => {
                    if (item.type === 'image') {
                        return new Promise((resolveImage) => {
                            const img = new Image();
                            img.onload = () => {
                                item.element = img;
                                // item.originalWidth and item.originalHeight should correctly reflect
                                // the dimensions of the *full image* as stored in the dataUrl,
                                // which is now consistent after the serialize fix.
                                resolveImage(item);
                            };
                            img.src = item.dataUrl; // This dataUrl now always holds the full image
                        });
                    }
                    return Promise.resolve(item);
                });
                
                Promise.all(imagePromises).then(() => {
                    resolve(data);
                });
            };
            reader.readAsText(file);
        });
    }
}