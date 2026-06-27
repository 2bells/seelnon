var ColorPicker = (function () {
    'use strict';

    var WIDTH = 120;
    var HEIGHT = 120;

    //coordinates are all relative to [left, bottom]

    var ALPHA_SLIDER_X = 0;
    var ALPHA_SLIDER_Y = 0;
    var ALPHA_SLIDER_WIDTH = 0;
    var ALPHA_SLIDER_HEIGHT = 0;

    //center of the hue circle
    var CIRCLE_X = WIDTH / 2;
    var CIRCLE_Y = HEIGHT / 2;

    // Circle is fully inside the square, with a tiny margin
    var OUTER_RADIUS = (WIDTH / 2) - 3;
    // Circle is a thin line (thickness of 4.5px)
    var INNER_RADIUS = OUTER_RADIUS - 4.5;

    //dimensions of the inner saturation brightness square
    // Inscribed in the inner circle to take maximum space possible
    var SQUARE_WIDTH = INNER_RADIUS * Math.sqrt(2);

    //edits a HSVA array
    function ColorPicker (painter, parameterName, wgl, canvas, shaderSources, left, bottom) {
        this.wgl = wgl;
        this.canvas = canvas;

        //painter[parameterName] points to the HSVA array this picker edits
        this.painter = painter;
        this.parameterName = parameterName;

        this.left = left;
        this.bottom = bottom;

        //whether we're currently manipulating the hue or the saturation/lightness
        this.huePressed = false;
        this.saturationLightnessPressed = false;
        this.alphaPressed = false;

        this.pickerProgram = wgl.createProgram(
            shaderSources['shaders/picker.vert'], shaderSources['shaders/picker.frag'], { 'a_position': 0 });

        this.pickerProgramRGB = wgl.createProgram(
            shaderSources['shaders/picker.vert'], '#define RGB \n ' + shaderSources['shaders/picker.frag'], { 'a_position': 0 });

        this.quadVertexBuffer = wgl.createBuffer();
        wgl.bufferData(this.quadVertexBuffer, wgl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), wgl.STATIC_DRAW);
    }

    ColorPicker.prototype.draw = function (rgbModel) {
        var wgl = this.wgl;

        var hsva = this.painter[this.parameterName];

        var pickerDrawState = wgl.createDrawState()
            .bindFramebuffer(null)
            .viewport(0, 0, this.canvas.width, this.canvas.height)
            .vertexAttribPointer(this.quadVertexBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0)
            .useProgram(rgbModel ? this.pickerProgramRGB : this.pickerProgram)
            .uniform2f('u_resolution', WIDTH, HEIGHT)
            .uniform1f('u_innerRadius', INNER_RADIUS)
            .uniform1f('u_outerRadius', OUTER_RADIUS)
            .uniform1f('u_squareWidth', SQUARE_WIDTH)
            .uniform2f('u_circlePosition', CIRCLE_X, CIRCLE_Y)
            .uniform2f('u_alphaSliderPosition', ALPHA_SLIDER_X, ALPHA_SLIDER_Y)
            .uniform2f('u_alphaSliderDimensions', ALPHA_SLIDER_WIDTH, ALPHA_SLIDER_HEIGHT)
            .uniform4f('u_currentHSVA', hsva[0], hsva[1], hsva[2], hsva[3])
            .uniform2f('u_screenResolution', this.canvas.width, this.canvas.height)
            .uniform2f('u_position', this.left, this.bottom)
            .uniform2f('u_dimensions', WIDTH, HEIGHT)
            .enable(wgl.BLEND)
            .blendFunc(wgl.ONE, wgl.ONE_MINUS_SRC_ALPHA); //premultiplied alpha

        wgl.drawArrays(pickerDrawState, wgl.TRIANGLE_STRIP, 0, 4);
    };

    ColorPicker.prototype.overControl = function (x, y) {
        return this.overHue(x, y) || this.overSaturationLightness(x, y) || this.overAlpha(x, y);
    };

    ColorPicker.prototype.overHue = function (x, y) { //x and y are relative to the canvas
        x -= this.left;
        y -= this.bottom;

        var xDist = x - CIRCLE_X;
        var yDist = y - CIRCLE_Y;

        var distance = Math.sqrt(xDist * xDist + yDist * yDist);

        return (distance < OUTER_RADIUS && distance > INNER_RADIUS);
    };

    ColorPicker.prototype.overSaturationLightness = function (x, y) { //x and y are relative to the canvas
        x -= this.left;
        y -= this.bottom;

        var xDist = x - CIRCLE_X;
        var yDist = y - CIRCLE_Y;

        return (Math.abs(xDist) <= SQUARE_WIDTH / 2 && Math.abs(yDist) <= SQUARE_WIDTH / 2);
    };

    ColorPicker.prototype.overAlpha = function (x, y) { //x and y are relative to the canvas
        return false;
    };

    ColorPicker.prototype.onMouseDown = function (x, y) { //x and y are relative to the canvas
        if (this.overHue(x, y)) { 
            this.huePressed = true;
        } else if (this.overSaturationLightness(x, y)) {
            this.saturationLightnessPressed = true;
        } else if (this.overAlpha(x, y)) {
            this.alphaPressed = true;
        }

        this.onMouseMove(x, y);
    };

    ColorPicker.prototype.isInUse = function () {
        return this.huePressed || this.saturationLightnessPressed || this.alphaPressed;
    };

    ColorPicker.prototype.onMouseUp = function (x, y) {
        this.huePressed = false;
        this.saturationLightnessPressed = false;
        this.alphaPressed = false;
    };

    ColorPicker.prototype.onMouseMove = function (mouseX, mouseY) {
        //make relative to the picker
        mouseX -= this.left;
        mouseY -= this.bottom;

        if (this.huePressed || this.saturationLightnessPressed || this.alphaPressed) {
            var hsva = this.painter[this.parameterName];

            if (this.huePressed) {
                var angle = Math.atan2(mouseY - CIRCLE_Y, mouseX - CIRCLE_X);
                if (angle < 0) angle += 2.0 * Math.PI; //[-PI, PI] -> [0, 2 * PI]

                //hue
                hsva[0] = angle / (2.0 * Math.PI);

            } else if (this.saturationLightnessPressed) {
                //saturation
                hsva[1] = (mouseX - (CIRCLE_X - SQUARE_WIDTH / 2)) / SQUARE_WIDTH;
                hsva[1] = Utilities.clamp(hsva[1], 0.0, 1.0);

                //brightness
                var relativeY = (mouseY - (CIRCLE_Y - SQUARE_WIDTH / 2)) / SQUARE_WIDTH;
                var isRyb = (this.painter.colorModel === 0); // ColorModel.RYB
                if (isRyb) {
                    hsva[2] = 1.0 - relativeY;
                } else {
                    hsva[2] = relativeY;
                }
                hsva[2] = Utilities.clamp(hsva[2], 0.0, 1.0);
            } else if (this.alphaPressed) {
                //alpha
                hsva[3] = Utilities.clamp((mouseY - ALPHA_SLIDER_Y) / ALPHA_SLIDER_HEIGHT, 0, 1);
            }
        }
    };

    return ColorPicker;

}());
