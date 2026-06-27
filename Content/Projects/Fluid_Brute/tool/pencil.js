export class Pencil {
    constructor() {
        this.id = 'dry';
        this.name = 'Pencil';
        this.icon = '✏️';
    }

    onActivate(paint) {
        if (paint.canvas) {
            paint.canvas.style.cursor = 'crosshair';
        }
    }

    onDeactivate(paint) {
        if (paint.canvas) {
            paint.canvas.style.cursor = '';
        }
    }
}
