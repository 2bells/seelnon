export class CropTool {
    constructor() {
        this.isCropping = false;
        this.cropStart = { x: 0, y: 0 };
        this.cropEnd = { x: 0, y: 0 };
    }
    
    startCrop(item, x, y) {
        this.isCropping = true;
        this.cropStart = { x, y };
        this.cropEnd = { x, y };
    }
    
    updateCrop(x, y) {
        if (!this.isCropping) return;
        this.cropEnd = { x, y };
    }
    
    finishCrop(item) {
        if (!this.isCropping) return;
        
        const crop = {
            x: Math.min(this.cropStart.x, this.cropEnd.x),
            y: Math.min(this.cropStart.y, this.cropEnd.y),
            width: Math.abs(this.cropEnd.x - this.cropStart.x),
            height: Math.abs(this.cropEnd.y - this.cropStart.y)
        };
        
        item.crop = crop;
        this.isCropping = false;
    }
    
    cancelCrop() {
        this.isCropping = false;
    }
}

