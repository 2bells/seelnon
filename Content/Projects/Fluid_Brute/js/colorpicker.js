var ColorPicker = (function () {
    'use strict';

    var WIDTH = 180;
    var HEIGHT = 210;

    // Dimensions for SV square and Hue slider
    var SQ_LEFT = 10;
    var SQ_RIGHT = 170; // WIDTH - 10
    var SQ_BOTTOM = 40;
    var SQ_TOP = 200; // HEIGHT - 10
    var SQ_SIZE = 160;

    var HUE_LEFT = 10;
    var HUE_RIGHT = 170;
    var HUE_BOTTOM = 12;
    var HUE_TOP = 28;
    var HUE_HEIGHT = 16;

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
            .uniform4f('u_currentHSVA', hsva[0], hsva[1], hsva[2], hsva[3])
            .uniform2f('u_screenResolution', this.canvas.width, this.canvas.height)
            .uniform2f('u_position', this.left, this.bottom)
            .uniform2f('u_dimensions', WIDTH, HEIGHT)
            .uniform1f('u_isMirrored', 0.0)
            .enable(wgl.BLEND)
            .blendFunc(wgl.ONE, wgl.ONE_MINUS_SRC_ALPHA); //premultiplied alpha

        wgl.drawArrays(pickerDrawState, wgl.TRIANGLE_STRIP, 0, 4);
    };

    ColorPicker.prototype.overControl = function (x, y) {
        return this.overHue(x, y) || this.overSaturationLightness(x, y);
    };

    ColorPicker.prototype.overHue = function (x, y) { //x and y are relative to the canvas
        x -= this.left;
        y -= this.bottom;
        return (x >= HUE_LEFT && x <= HUE_RIGHT && y >= HUE_BOTTOM && y <= HUE_TOP);
    };

    ColorPicker.prototype.overSaturationLightness = function (x, y) { //x and y are relative to the canvas
        x -= this.left;
        y -= this.bottom;
        return (x >= SQ_LEFT && x <= SQ_RIGHT && y >= SQ_BOTTOM && y <= SQ_TOP);
    };

    ColorPicker.prototype.overAlpha = function (x, y) { //x and y are relative to the canvas
        return false;
    };

    ColorPicker.prototype.onMouseDown = function (x, y) { //x and y are relative to the canvas
        if (this.overHue(x, y)) { 
            this.huePressed = true;
        } else if (this.overSaturationLightness(x, y)) {
            this.saturationLightnessPressed = true;
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
                var t = (mouseX - HUE_LEFT) / (HUE_RIGHT - HUE_LEFT);
                t = Utilities.clamp(t, 0.0, 1.0);
                hsva[0] = t;

            } else if (this.saturationLightnessPressed) {
                var s = (mouseX - SQ_LEFT) / SQ_SIZE;
                s = Utilities.clamp(s, 0.0, 1.0);

                var v = (mouseY - SQ_BOTTOM) / SQ_SIZE;
                v = Utilities.clamp(v, 0.0, 1.0);

                var isRyb = (this.painter.colorModel === 0); // ColorModel.RYB
                if (isRyb) {
                    hsva[2] = 1.0 - v;
                } else {
                    hsva[2] = v;
                }
                hsva[2] = Utilities.clamp(hsva[2], 0.0, 1.0);
                hsva[1] = s;
            }
        }
    };

    return ColorPicker;

}());
