export class TextTool {
    constructor() {
        this.defaultStyle = {
            fontSize: 16,
            color: '#ffffff',
            fontFamily: 'Inter'
        };
    }
    
    createText(content, x, y, style = {}) {
        return {
            content,
            x,
            y,
            width: content.length * 8, // Approximate
            height: 20,
            ...this.defaultStyle,
            ...style
        };
    }
    
    updateText(textItem, content) {
        textItem.content = content;
        textItem.width = content.length * 8;
    }
}

