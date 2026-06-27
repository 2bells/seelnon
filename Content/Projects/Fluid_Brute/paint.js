import { PaletteManager } from './paletteManager.js';
import { Eraser } from './tool/eraser.js';
import { ColorPick } from './tool/colorpick.js';
import { Pencil } from './tool/pencil.js';

var Paint = (function () {
    'use strict';

    var InteractionMode = {
        NONE: 0,
        PAINTING: 1,
        RESIZING: 2,
        PANNING: 3,
        ZOOMING: 4,
        PICKING: 5
    };

    var ResizingSide = {
        NONE: 0,
        LEFT: 1,
        RIGHT: 2,
        BOTTOM: 3,
        TOP: 4,
        TOP_LEFT: 5,
        TOP_RIGHT: 6,
        BOTTOM_LEFT: 7,
        BOTTOM_RIGHT: 8
    };

    var ColorModel = {
        RYB: 0,
        RGB: 1
    };


    var QUALITIES = [
        {
            name: 'Low',
            resolutionScale: 1.0
        },
        {
            name: 'Medium',
            resolutionScale: 1.5
        },
        {
            name: 'High',
            resolutionScale: 2.0
        }
    ];

    var INITIAL_QUALITY = 1;


    var INITIAL_PADDING = 100;
    var MIN_PAINTING_WIDTH = 300;
    var MAX_PAINTING_WIDTH = 4096; //this is further constrained by the maximum texture size

    //brush parameters
    var MAX_BRISTLE_COUNT = 100;
    var MIN_BRISTLE_COUNT = 1;
    var MIN_BRUSH_SCALE = 5;
    var MAX_BRUSH_SCALE = 200;
    var BRUSH_HEIGHT = 2.0; //how high the brush is over the canvas - this is scaled with the brushScale
    var Z_THRESHOLD = 0.13333; //this is scaled with the brushScale


    //splatting parameters
    var SPLAT_VELOCITY_SCALE = 0.14;
    var SPLAT_RADIUS = 0.05;

    //for thin brush (fewest bristles)
    var THIN_MIN_ALPHA = 0.002;
    var THIN_MAX_ALPHA = 0.08;

    //for thick brush (most bristles)
    var THICK_MIN_ALPHA = 0.002;
    var THICK_MAX_ALPHA = 0.025;


    //panel is aligned with the top left
    var PANEL_WIDTH = 300;
    var PANEL_HEIGHT = 580;
    var PANEL_BLUR_SAMPLES = 13;
    var PANEL_BLUR_STRIDE = 8;

    var COLOR_PICKER_LEFT = 20;
    var COLOR_PICKER_TOP = 523;

    var RESIZING_RADIUS = 20;
    var RESIZING_FEATHER_SIZE = 8; //in pixels 

    //box shadow parameters
    var BOX_SHADOW_SIGMA = 5.0;
    var BOX_SHADOW_WIDTH = 10.0;
    var PAINTING_SHADOW_ALPHA = 0.8;
    var PANEL_SHADOW_ALPHA = 0.0; // Hide the panel shadow since we have individual modular cards now

    //rendering parameters
    var BACKGROUND_GRAY = 0.08;
    var NORMAL_SCALE = 7.0;
    var ROUGHNESS = 0.075;
    var F0 = 0.05;
    var SPECULAR_SCALE = 0.5;
    var DIFFUSE_SCALE = 0.15;
    var LIGHT_DIRECTION = [0, 1, 1];


    var HISTORY_SIZE = 21; //number of snapshots we store - this should be number of reversible actions + 1


    function pascalRow (n) {
        var line = [1];
        for (var k = 0; k < n; ++k) {
            line.push(line[k] * (n - k) / (k + 1));
        }
        return line;
    }

    //width should be an odd number
    function makeBlurShader (width) {
        var coefficients = pascalRow(width - 1 + 2);

        //take the 1s off the ends
        coefficients.shift();
        coefficients.pop();
        
        var normalizationFactor = 0;
        for (var i = 0; i < coefficients.length; ++i) {
            normalizationFactor += coefficients[i]; 
        }

        var shader = [
            'precision highp float;',

            'uniform sampler2D u_input;',

            'uniform vec2 u_step;',
            'uniform vec2 u_resolution;',

            'void main () {',
                'vec4 total = vec4(0.0);',

                'vec2 coordinates = gl_FragCoord.xy / u_resolution;',
                'vec2 delta = u_step / u_resolution;',
        ].join('\n');

        shader += '\n';

        for (var i = 0; i < width; ++i) {
            var offset = i - (width - 1) / 2;

            shader += 'total += texture2D(u_input, coordinates + delta * ' + offset.toFixed(1) + ') * ' + coefficients[i].toFixed(1) + '; \n';
        }

        shader += 'gl_FragColor = total / ' + normalizationFactor.toFixed(1) + ';\n }';

        return shader;
    }


    function hsvToRyb (h, s, v) {
        h = h % 1;

        var c = v * s,
            hDash = h * 6;

        var x = c * (1 - Math.abs(hDash % 2 - 1));

        var mod = Math.floor(hDash);

        var r = [c, x, 0, 0, x, c][mod],
            g = [x, c, c, x, 0, 0][mod],
            b = [0, 0, x, c, c, x][mod];

        var m = v - c;

        r += m;
        g += m;
        b += m;

        return [r, g, b];
    }

    function trilinearInterpolate(p, v000, v100, v010, v001, v101, v011, v110, v111) {
        var r = v000[0] * (1.0 - p[0]) * (1.0 - p[1]) * (1.0 - p[2]) +
                v100[0] * p[0] * (1.0 - p[1]) * (1.0 - p[2]) +
                v010[0] * (1.0 - p[0]) * p[1] * (1.0 - p[2]) +
                v001[0] * (1.0 - p[0]) * (1.0 - p[1]) * p[2] +
                v101[0] * p[0] * (1.0 - p[1]) * p[2] +
                v011[0] * (1.0 - p[0]) * p[1] * p[2] +
                v110[0] * p[0] * p[1] * (1.0 - p[2]) +
                v111[0] * p[0] * p[1] * p[2];

        var g = v000[1] * (1.0 - p[0]) * (1.0 - p[1]) * (1.0 - p[2]) +
                v100[1] * p[0] * (1.0 - p[1]) * (1.0 - p[2]) +
                v010[1] * (1.0 - p[0]) * p[1] * (1.0 - p[2]) +
                v001[1] * (1.0 - p[0]) * (1.0 - p[1]) * p[2] +
                v101[1] * p[0] * (1.0 - p[1]) * p[2] +
                v011[1] * (1.0 - p[0]) * p[1] * p[2] +
                v110[1] * p[0] * p[1] * (1.0 - p[2]) +
                v111[1] * p[0] * p[1] * p[2];

        var b = v000[2] * (1.0 - p[0]) * (1.0 - p[1]) * (1.0 - p[2]) +
                v100[2] * p[0] * (1.0 - p[1]) * (1.0 - p[2]) +
                v010[2] * (1.0 - p[0]) * p[1] * (1.0 - p[2]) +
                v001[2] * (1.0 - p[0]) * (1.0 - p[1]) * p[2] +
                v101[2] * p[0] * (1.0 - p[1]) * p[2] +
                v011[2] * (1.0 - p[0]) * p[1] * p[2] +
                v110[2] * p[0] * p[1] * (1.0 - p[2]) +
                v111[2] * p[0] * p[1] * p[2];

        return [r, g, b];
    }

    function rybToRgb(ryb) {
        return trilinearInterpolate(ryb, 
            [1.0, 1.0, 1.0], 
            [1.0, 0.0, 0.0], 
            [0.163, 0.373, 0.6], 
            [1.0, 1.0, 0.0], 
            [1.0, 0.5, 0.0], 
            [0.0, 0.66, 0.2],
            [0.5, 0.0, 0.5],
            [0.2, 0.094, 0.0]
        );
    }

    function makeOrthographicMatrix (matrix, left, right, bottom, top, near, far) {
        matrix[0] = 2 / (right - left);
        matrix[1] = 0;
        matrix[2] = 0;
        matrix[3] = 0;
        matrix[4] = 0;
        matrix[5] = 2 / (top - bottom);
        matrix[6] = 0;
        matrix[7] = 0;
        matrix[8] = 0;
        matrix[9] = 0;
        matrix[10] = -2 / (far - near);
        matrix[11] = 0;
        matrix[12] = -(right + left) / (right - left);
        matrix[13] = -(top + bottom) / (top - bottom);
        matrix[14] = -(far + near) / (far - near);
        matrix[15] = 1;

        return matrix;
    }

    function mix (a, b, t) {
        return (1.0 - t) * a + t * b;
    }

    //the texture is always updated to be (paintingWidth x paintingHeight) x resolutionScale
    function Snapshot (texture, paintingWidth, paintingHeight, resolutionScale, paintingLeft, paintingBottom) {
        this.texture = texture;
        this.paintingWidth = paintingWidth;
        this.paintingHeight = paintingHeight;
        this.resolutionScale = resolutionScale;
        this.paintingLeft = paintingLeft;
        this.paintingBottom = paintingBottom;
    }

    Snapshot.prototype.getTextureWidth = function () {
        return Math.ceil(this.paintingWidth * this.resolutionScale);
    };

    Snapshot.prototype.getTextureHeight = function () {
        return Math.ceil(this.paintingHeight * this.resolutionScale);
    };


    function Paint (canvas, wgl) {
        this.canvas = canvas;
        this.wgl = wgl;

        wgl.getExtension('OES_texture_float');
        wgl.getExtension('OES_texture_float_linear');

        WrappedGL.loadTextFiles([
            'shaders/splat.vert', 'shaders/splat.frag',
            'shaders/fullscreen.vert',
            'shaders/advect.frag',
            'shaders/divergence.frag',
            'shaders/jacobi.frag',
            'shaders/subtract.frag',
            'shaders/resize.frag',
            'shaders/diffuse.frag',

            'shaders/project.frag',
            'shaders/distanceconstraint.frag',
            'shaders/planeconstraint.frag',
            'shaders/bendingconstraint.frag',
            'shaders/setbristles.frag',
            'shaders/updatevelocity.frag',

            'shaders/brush.vert', 'shaders/brush.frag',
            'shaders/painting.vert', 'shaders/painting.frag',
            'shaders/picker.vert', 'shaders/picker.frag',
            'shaders/panel.frag',
            'shaders/output.frag',
            'shaders/shadow.frag',
        ], start.bind(this));

        function start(shaderSources) {

            var maxTextureSize = wgl.getParameter(wgl.MAX_TEXTURE_SIZE);
            this.maxPaintingWidth = Math.min(MAX_PAINTING_WIDTH, maxTextureSize / QUALITIES[QUALITIES.length - 1].resolutionScale);


            this.framebuffer = wgl.createFramebuffer();


            this.paintingProgram = wgl.createProgram(
                shaderSources['shaders/painting.vert'], shaderSources['shaders/painting.frag']);

            this.paintingProgramRGB = wgl.createProgram(
                shaderSources['shaders/painting.vert'], '#define RGB \n ' + shaderSources['shaders/painting.frag']);

            this.resizingPaintingProgram = wgl.createProgram(
                shaderSources['shaders/painting.vert'], '#define RESIZING \n ' + shaderSources['shaders/painting.frag']);

            this.resizingPaintingProgramRGB = wgl.createProgram(
                shaderSources['shaders/painting.vert'], '#define RESIZING \n #define RGB \n ' + shaderSources['shaders/painting.frag']);

            this.savePaintingProgram = wgl.createProgram(
                shaderSources['shaders/painting.vert'], '#define SAVE \n ' + shaderSources['shaders/painting.frag']);

            this.savePaintingProgramRGB = wgl.createProgram(
                shaderSources['shaders/painting.vert'], '#define SAVE \n #define RGB \n ' + shaderSources['shaders/painting.frag']);

            this.brushProgram = wgl.createProgram(
                shaderSources['shaders/brush.vert'], shaderSources['shaders/brush.frag'], { 'a_position': 0 });

            this.panelProgram = wgl.createProgram(
                shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/panel.frag'], { 'a_position': 0 });


            this.blurProgram = wgl.createProgram(
                shaderSources['shaders/fullscreen.vert'], makeBlurShader(PANEL_BLUR_SAMPLES), { 'a_position': 0 });

            this.outputProgram = wgl.createProgram(
                shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/output.frag'], { 'a_position': 0 });

            this.shadowProgram = wgl.createProgram(
                shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/shadow.frag'], { 'a_position': 0 });


            this.quadVertexBuffer = wgl.createBuffer();
            wgl.bufferData(this.quadVertexBuffer, wgl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), wgl.STATIC_DRAW);


            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;



            //position of painting on screen, and its dimensions
            //units are pixels
            this.paintingRectangle = new Rectangle(
                INITIAL_PADDING, INITIAL_PADDING,
                Utilities.clamp(canvas.width - INITIAL_PADDING * 2, MIN_PAINTING_WIDTH, this.maxPaintingWidth),
                Utilities.clamp(canvas.height - INITIAL_PADDING * 2, MIN_PAINTING_WIDTH, this.maxPaintingWidth));

            this.logicalWidth = this.paintingRectangle.width;
            this.logicalHeight = this.paintingRectangle.height;
            this.zoomLevel = 1.0;

            //simulation resolution = painting resolution * resolution scale
            this.resolutionScale = QUALITIES[INITIAL_QUALITY].resolutionScale;


            this.simulator = new Simulator(wgl, shaderSources, this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight());


            this.snapshots = [];
            for (var i = 0; i < HISTORY_SIZE; ++i) { //we always keep around HISTORY_SIZE snapshots to avoid reallocating textures
                var texture = wgl.buildTexture(wgl.RGBA, wgl.FLOAT, this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight(), null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);

                wgl.framebufferTexture2D(this.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, texture, 0);
                wgl.clear(wgl.createClearState().bindFramebuffer(this.framebuffer), wgl.COLOR_BUFFER_BIT);

                this.snapshots.push(new Snapshot(texture, this.paintingRectangle.width, this.paintingRectangle.height, this.resolutionScale, this.paintingRectangle.left, this.paintingRectangle.bottom));
            }


            this.snapshotIndex = 0; //while not undoing, the next snapshot index we'd save into; when undoing, our current position in the snapshots - undo to snapshotIndex - 1, redo to snapshotIndex + 1

            this.undoing = false;
            this.maxRedoIndex = 0; //while undoing, the maximum snapshot index that can be applied



            this.brushInitialized = false; //whether the user has moved their mouse at least once and we thus have a valid brush position

            this.brushX = 0;
            this.brushY = 0;

            this.brushScale = 50;

            this.brushColorHSVA = [Math.random(), 1, 1, 0.8];

            this.currentTool = 'paint'; // 'paint', 'eraser', or 'colorpick'
            this.eraserType = 'bristles'; // 'bristles' or 'scraper'
            this.smudgeType = 'smudge'; // 'smudge' or 'blur'
            this.dryType = 'chalk'; // 'chalk' or 'impasto'
            this.eraserTool = new Eraser();
            this.colorPickTool = new ColorPick();
            this.pencilTool = new Pencil();
            this.debouncedSaveTimeout = null;


            this.colorModel = ColorModel.RGB;

            this.needsRedraw = true; //whether we need to redraw the painting


            this.brush = new Brush(wgl, shaderSources, MAX_BRISTLE_COUNT);
            this.brushHeight = BRUSH_HEIGHT;

            // Create custom ink cursor element
            var inkCursor = document.createElement('div');
            inkCursor.id = 'ink-cursor';
            inkCursor.className = 'custom-ink-cursor hidden';
            document.body.appendChild(inkCursor);

            // Create custom blur cursor element
            var blurCursor = document.createElement('div');
            blurCursor.id = 'blur-cursor';
            blurCursor.className = 'custom-blur-cursor hidden';
            document.body.appendChild(blurCursor);



            var updateFluidityLabel = function (f) {
                var lbl = document.getElementById('val-fluidity');
                if (lbl) lbl.textContent = Math.round(f * 100) + '%';
            };
            var updateBristlesLabel = function (b) {
                var lbl = document.getElementById('val-bristles');
                if (lbl) lbl.textContent = b;
            };
            var updateSizeLabel = function (s) {
                var lbl = document.getElementById('val-size');
                if (lbl) lbl.textContent = Math.round(s);
            };

            this.updateSizeLabel = updateSizeLabel;
            this.updateFluidityLabel = updateFluidityLabel;
            this.updateBristlesLabel = updateBristlesLabel;

            this.fluiditySlider = new Slider(document.getElementById('fluidity-slider'), this.simulator.fluidity, 0.1, 1.0, (function (fluidity) {
              this.simulator.fluidity = fluidity;
              updateFluidityLabel(fluidity);
              this.updateCurrentToolSetting('fluidity', fluidity);
            }).bind(this));

            this.bristleCountSlider = new Slider(document.getElementById('bristles-slider'), 1, 0, 1, (function (t) {
                var BRISTLE_SLIDER_POWER = 2.0;
                t = Math.pow(t, BRISTLE_SLIDER_POWER);
                var bristleCount = Math.floor(MIN_BRISTLE_COUNT + t * (MAX_BRISTLE_COUNT - MIN_BRISTLE_COUNT));
                this.brush.setBristleCount(bristleCount);
                updateBristlesLabel(bristleCount);
                this.updateCurrentToolSetting('bristleCount', bristleCount);
            }).bind(this));

            this.brushSizeSlider = new Slider(document.getElementById('size-slider'), this.brushScale, MIN_BRUSH_SCALE, MAX_BRUSH_SCALE, (function(size) {
                this.brushScale = size;
                updateSizeLabel(size);
                this.updateCurrentToolSetting('brushScale', size);
            }).bind(this));

            // Settings window sliders and label functions
            var updateLengthLabel = function (val) {
                var el = document.getElementById('val-length');
                if (el) el.textContent = val.toFixed(1);
            };
            var updateTensionLabel = function (val) {
                var el = document.getElementById('val-tension');
                if (el) el.textContent = Math.round(val * 100) + '%';
            };
            var updateJitterLabel = function (val) {
                var el = document.getElementById('val-jitter');
                if (el) el.textContent = val.toFixed(1);
            };
            var updateScatterLabel = function (val) {
                var el = document.getElementById('val-scatter');
                if (el) el.textContent = val.toFixed(1);
            };

            this.updateLengthLabel = updateLengthLabel;
            this.updateTensionLabel = updateTensionLabel;
            this.updateJitterLabel = updateJitterLabel;
            this.updateScatterLabel = updateScatterLabel;

            this.bristleLengthSlider = new Slider(document.getElementById('length-slider'), 4.5, 0.1, 10.0, (function (length) {
                this.brush.bristleLength = length;
                updateLengthLabel(length);
                this.updateBrushHeight();
                this.updateCurrentToolSetting('bristleLength', length);
                var initScale = this.brushScale * (this.zoomLevel || 1.0);
                this.brush.initialize(this.brushX, this.brushY, this.brushHeight * initScale, initScale);
            }).bind(this));

            this.bristleStiffnessSlider = new Slider(document.getElementById('tension-slider'), 0.3, 0.0, 1.0, (function (stiffness) {
                this.brush.bristleStiffness = stiffness;
                updateTensionLabel(stiffness);
                this.updateCurrentToolSetting('bristleStiffness', stiffness);
            }).bind(this));

            this.bristleJitterSlider = new Slider(document.getElementById('jitter-slider'), 0.5, 0.0, 5.0, (function (jitter) {
                this.brush.bristleJitter = jitter;
                updateJitterLabel(jitter);
                this.updateCurrentToolSetting('bristleJitter', jitter);
            }).bind(this));

            this.bristleScatterSlider = new Slider(document.getElementById('scatter-slider'), 1.0, 0.0, 3.0, (function (scatter) {
                this.brush.bristleScatter = scatter;
                updateScatterLabel(scatter);
                this.updateCurrentToolSetting('bristleScatter', scatter);
            }).bind(this));

            // Populate initial labels
            updateFluidityLabel(this.simulator.fluidity);
            updateBristlesLabel(this.brush.bristleCount);
            updateSizeLabel(this.brushScale);
            updateLengthLabel(this.brush.bristleLength);
            updateTensionLabel(this.brush.bristleStiffness);
            updateJitterLabel(this.brush.bristleJitter);
            updateScatterLabel(this.brush.bristleScatter);


            
            this.qualityButtons = new Buttons(document.getElementById('qualities'),
                QUALITIES.map(function (q) { return q.name })
            , INITIAL_QUALITY, (function (index) {
                this.saveSnapshot();

                this.resolutionScale = QUALITIES[index].resolutionScale;
                this.simulator.changeResolution(this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight());

                this.needsRedraw = true;
            }).bind(this)); 

            this.modelButtons = new Buttons(document.getElementById('models'),
              ['Natural', 'Digital'], 1, (function (index) {
                  if (index === 0) {
                      this.colorModel = ColorModel.RYB;
                  } else if (index === 1) {
                      this.colorModel = ColorModel.RGB;
                  }

                  this.needsRedraw = true;
                  if (this.renderPalette) {
                      this.renderPalette();
                  }
              }).bind(this));


            this.colorPicker = new ColorPicker(this, 'brushColorHSVA', wgl, canvas, shaderSources, COLOR_PICKER_LEFT, 0);

            //this.brushViewer = new BrushViewer(wgl, this.brushProgram, 0, 800, 200, 300);


            this.saveButton = document.getElementById('save-button');
            this.saveButton.addEventListener('click', this.save.bind(this));
            this.saveButton.addEventListener('touchstart', (function (event) {
                event.preventDefault();
                this.save();
            }).bind(this));


            this.clearButton = document.getElementById('clear-button');  
            this.clearButton.addEventListener('click', this.clear.bind(this));
            this.clearButton.addEventListener('touchstart', (function (event) {
                event.preventDefault();

                this.clear();
            }).bind(this));


            this.undoButton = document.getElementById('undo-button');
            this.undoButton.addEventListener('click', this.undo.bind(this));
            this.undoButton.addEventListener('touchstart', (function (event) {
                event.preventDefault();
                this.undo();
            }).bind(this));

            this.redoButton = document.getElementById('redo-button');
            this.redoButton.addEventListener('click', this.redo.bind(this));
            this.redoButton.addEventListener('touchstart', (function (event) {
                event.preventDefault();
                this.redo();
            }).bind(this));

            this.refreshDoButtons();



            this.mainProjectionMatrix = makeOrthographicMatrix(new Float32Array(16), 0.0, this.canvas.width, 0, this.canvas.height, -5000.0, 5000.0);


            var updatePickerPosition = (function () {
                var target = document.getElementById('color-picker-target');
                if (target) {
                    var rect = target.getBoundingClientRect();
                    this.colorPicker.left = rect.left;
                    this.colorPicker.bottom = this.canvas.height - rect.bottom;
                }
            }).bind(this);

            this.onResize = function () {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;

                this.paintingRectangle.left = Utilities.clamp(this.paintingRectangle.left, -this.paintingRectangle.width, this.canvas.width);
                this.paintingRectangle.bottom = Utilities.clamp(this.paintingRectangle.bottom, -this.paintingRectangle.height, this.canvas.height);


                updatePickerPosition();


                //this.brushViewer.bottom = this.canvas.height - 800;


                this.mainProjectionMatrix = makeOrthographicMatrix(new Float32Array(16), 0.0, this.canvas.width, 0, this.canvas.height, -5000.0, 5000.0);

                this.canvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, this.canvas.width, this.canvas.height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
                this.tempCanvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, this.canvas.width, this.canvas.height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
                this.blurredCanvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, this.canvas.width, this.canvas.height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);


                this.needsRedraw = true;
            };
            this.onResize();

            window.addEventListener('resize', this.onResize.bind(this));
            

            this.mouseX = 0;
            this.mouseY = 0;

            this.spaceDown = false;
            this.zDown = false;
            this.altDown = false;


            canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
            canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
            document.addEventListener('mouseup', this.onMouseUp.bind(this));
            canvas.addEventListener('mouseover', this.onMouseOver.bind(this));

            document.addEventListener('wheel', this.onWheel.bind(this));


            document.addEventListener('keydown', (function (event) {
                if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                    return;
                }

                if (event.ctrlKey || event.metaKey) {
                    if (event.keyCode === 90) { // z
                        event.preventDefault();
                        this.undo();
                    } else if (event.keyCode === 89 || event.keyCode === 82) { // y or r
                        event.preventDefault();
                        this.redo();
                    }
                } else {
                    if (event.keyCode === 32) { // space
                        event.preventDefault();
                        this.spaceDown = true;
                    } else if (event.keyCode === 90) { // z
                        this.zDown = true;
                    } else if (event.keyCode === 18) { // alt
                        event.preventDefault();
                        this.altDown = true;
                        this.needsRedraw = true;
                    } else if (event.keyCode === 87) { // w
                        this.brushScale = Utilities.clamp(this.brushScale - 1.5, MIN_BRUSH_SCALE, MAX_BRUSH_SCALE);
                        this.brushSizeSlider.setValue(this.brushScale);
                        if (this.updateSizeLabel) this.updateSizeLabel(this.brushScale);
                    } else if (event.keyCode === 69) { // e
                        this.brushScale = Utilities.clamp(this.brushScale + 1.5, MIN_BRUSH_SCALE, MAX_BRUSH_SCALE);
                        this.brushSizeSlider.setValue(this.brushScale);
                        if (this.updateSizeLabel) this.updateSizeLabel(this.brushScale);
                    } else if (event.keyCode === 82) { // r (legacy/alternative redo shortcut)
                        this.redo();
                    }
                }
            }).bind(this));

            document.addEventListener('keyup', (function (event) {
                if (event.keyCode === 32) {
                    this.spaceDown = false;
                } else if (event.keyCode === 90) {
                    this.zDown = false;
                    if (this.interactionState === InteractionMode.ZOOMING) {
                        this.interactionState = InteractionMode.NONE;
                    }
                } else if (event.keyCode === 18) { // alt
                    this.altDown = false;
                    this.needsRedraw = true;
                }
            }).bind(this));


            canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
            canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
            canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
            canvas.addEventListener('touchcancel', this.onTouchCancel.bind(this));


            //these are used while we're resizing
            this.resizingSide = ResizingSide.NONE; //which side we're currently resizing

            //this is updated during resizing according to the new mouse position
            //when we finish resizing, we then resize the simulator to match
            this.newPaintingRectangle = null;

            
            this.interactionState = InteractionMode.NONE;

            // Simple Hex to HSVA Conversion
            var hexToHSVA = function (hex) {
                hex = hex.replace(/^#/, '');
                var r = parseInt(hex.substring(0, 2), 16);
                var g = parseInt(hex.substring(2, 4), 16);
                var b = parseInt(hex.substring(4, 6), 16);
                
                r /= 255; g /= 255; b /= 255;
                var max = Math.max(r, g, b), min = Math.min(r, g, b);
                var h, s, v = max;
                var d = max - min;
                s = max === 0 ? 0 : d / max;
                if (max === min) {
                    h = 0;
                } else {
                    switch (max) {
                        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                        case g: h = (b - r) / d + 2; break;
                        case b: h = (r - g) / d + 4; break;
                    }
                    h /= 6;
                }
                return [h, s, v, 0.8];
            };

            this.paletteManager = new PaletteManager();

            this.renderPalette = (function () {
                var container = document.getElementById('swatches-grid-container');
                if (!container) return;

                var isRyb = (this.colorModel === ColorModel.RYB);
                var rows = this.paletteManager.generate(isRyb);
                var html = '';
                rows.forEach((row) => {
                    row.forEach((item) => {
                        var span = item.span || 1;
                        var activeClass = item.active ? ' swatch-active' : '';
                        var dataIndex = item.index !== undefined ? ' data-index="' + item.index + '"' : '';
                        html += '<div class="swatch' + activeClass + '" data-color="' + item.color + '"' + dataIndex + ' style="background-color: ' + item.displayColor + '; --span: ' + span + ';" title="' + item.displayColor + '"></div>';
                    });
                });
                container.innerHTML = html;

                // Bind click/touch handlers on the generated swatches!
                var swatches = container.querySelectorAll('.swatch');
                swatches.forEach((function (swatch) {
                    var selectHandler = (function (e) {
                        var hex = swatch.getAttribute('data-color');
                        var indexStr = swatch.getAttribute('data-index');
                        
                        // If it's a main base swatch (Row 1), set it as the active base color!
                        if (indexStr !== null && indexStr !== undefined && indexStr !== '') {
                            var index = parseInt(indexStr);
                            this.paletteManager.activeIndex = index;
                        }

                        var currentAlpha = this.brushColorHSVA[3];
                        var newHSVA = hexToHSVA(hex);
                        newHSVA[3] = currentAlpha; // Keep current alpha value
                        this.brushColorHSVA = newHSVA;
                        this.needsRedraw = true;

                        // Re-render palette to update the active swatch styling
                        this.renderPalette();
                    }).bind(this);

                    swatch.addEventListener('click', selectHandler);
                    swatch.addEventListener('touchstart', (function (e) {
                        e.preventDefault();
                        selectHandler(e);
                    }).bind(this));
                }).bind(this));
            }).bind(this);

            // Initial render of dynamic palette
            this.renderPalette();

            // Palette Reset Button
            var resetBtn = document.getElementById('palette-reset-btn');
            if (resetBtn) {
                var resetHandler = (function (e) {
                    this.paletteManager.baseColors = [
                        '#B91C1C',
                        '#1E40AF',
                        '#84CC16',
                        '#EAB308',
                        '#F97316',
                        '#4338CA'
                    ];
                    this.paletteManager.activeIndex = 0;
                    localStorage.setItem('canvas_palette', JSON.stringify(this.paletteManager.baseColors));

                    var currentAlpha = this.brushColorHSVA[3];
                    var newHSVA = hexToHSVA(this.paletteManager.baseColors[0]);
                    newHSVA[3] = currentAlpha;
                    this.brushColorHSVA = newHSVA;
                    this.needsRedraw = true;
                    this.renderPalette();
                }).bind(this);
                
                resetBtn.addEventListener('click', resetHandler);
                resetBtn.addEventListener('touchstart', (function (e) {
                    e.preventDefault();
                    resetHandler(e);
                }).bind(this));
            }

            // Settings Window Toggle
            var settingsBtn = document.getElementById('settings-toggle-button');
            var settingsWindow = document.getElementById('settings-window');
            var closeSettingsBtn = document.getElementById('close-settings-btn');
            
            if (settingsBtn && settingsWindow) {
                var toggleSettings = function (e) {
                    settingsWindow.classList.toggle('hidden');
                };
                settingsBtn.addEventListener('click', toggleSettings);
                settingsBtn.addEventListener('touchstart', function (e) {
                    e.preventDefault();
                    toggleSettings(e);
                });
            }
            if (closeSettingsBtn && settingsWindow) {
                var hideSettings = function (e) {
                    settingsWindow.classList.add('hidden');
                };
                closeSettingsBtn.addEventListener('click', hideSettings);
                closeSettingsBtn.addEventListener('touchstart', function (e) {
                    e.preventDefault();
                    hideSettings(e);
                });
            }

            // Draggable Color Palette Window
            var paletteWindow = document.getElementById('color-palette-window');
            var paletteHeader = document.querySelector('.palette-header');
            if (paletteWindow && paletteHeader) {
                var isDragging = false;
                var dragStartX = 0, dragStartY = 0;
                var windowStartX = 0, windowStartY = 0;

                var onDragStart = function (clientX, clientY) {
                    isDragging = true;
                    dragStartX = clientX;
                    dragStartY = clientY;
                    windowStartX = paletteWindow.offsetLeft;
                    windowStartY = paletteWindow.offsetTop;
                    paletteWindow.style.cursor = 'move';
                };

                var onDragMove = (function (clientX, clientY) {
                    if (isDragging) {
                        var dx = clientX - dragStartX;
                        var dy = clientY - dragStartY;
                        paletteWindow.style.left = (windowStartX + dx) + 'px';
                        paletteWindow.style.top = (windowStartY + dy) + 'px';
                        paletteWindow.style.right = 'auto';
                        updatePickerPosition();
                        this.needsRedraw = true;
                    }
                }).bind(this);

                var onDragEnd = function () {
                    isDragging = false;
                    paletteWindow.style.cursor = 'default';
                };

                paletteHeader.addEventListener('mousedown', function (e) {
                    onDragStart(e.clientX, e.clientY);
                });

                document.addEventListener('mousemove', function (e) {
                    onDragMove(e.clientX, e.clientY);
                });

                document.addEventListener('mouseup', function () {
                    onDragEnd();
                });

                paletteHeader.addEventListener('touchstart', function (e) {
                    var touch = e.touches[0];
                    onDragStart(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchmove', function (e) {
                    var touch = e.touches[0];
                    onDragMove(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchend', function () {
                    onDragEnd();
                });
            }

            // Draggable Viewport Window
            var viewportWindow = document.getElementById('viewport-window');
            var viewportHeader = document.querySelector('.viewport-header');
            if (viewportWindow && viewportHeader) {
                var isDraggingVP = false;
                var dragStartXVP = 0, dragStartYVP = 0;
                var windowStartXVP = 0, windowStartYVP = 0;

                var onDragStartVP = function (clientX, clientY) {
                    isDraggingVP = true;
                    dragStartXVP = clientX;
                    dragStartYVP = clientY;
                    windowStartXVP = viewportWindow.offsetLeft;
                    windowStartYVP = viewportWindow.offsetTop;
                    viewportHeader.style.cursor = 'move';
                };

                var onDragMoveVP = (function (clientX, clientY) {
                    if (isDraggingVP) {
                        var dx = clientX - dragStartXVP;
                        var dy = clientY - dragStartYVP;
                        viewportWindow.style.left = (windowStartXVP + dx) + 'px';
                        viewportWindow.style.top = (windowStartYVP + dy) + 'px';
                        viewportWindow.style.right = 'auto';
                        viewportWindow.style.bottom = 'auto';
                        this.needsRedraw = true;
                    }
                }).bind(this);

                var onDragEndVP = function () {
                    isDraggingVP = false;
                    viewportHeader.style.cursor = 'default';
                };

                viewportHeader.addEventListener('mousedown', function (e) {
                    onDragStartVP(e.clientX, e.clientY);
                });

                document.addEventListener('mousemove', function (e) {
                    onDragMoveVP(e.clientX, e.clientY);
                });

                document.addEventListener('mouseup', function () {
                    onDragEndVP();
                });

                viewportHeader.addEventListener('touchstart', function (e) {
                    var touch = e.touches[0];
                    onDragStartVP(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchmove', function (e) {
                    var touch = e.touches[0];
                    onDragMoveVP(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchend', function () {
                    onDragEndVP();
                });
            }

            // Viewport buttons wiring
            var zoomOutBtn = document.getElementById('zoom-out-btn');
            var zoomInBtn = document.getElementById('zoom-in-btn');
            var zoomLevelBtn = document.getElementById('zoom-level-btn');
            var zoomFitBtn = document.getElementById('zoom-fit-btn');

            if (zoomOutBtn) {
                var handleZoomOut = (function (e) {
                    if (e) e.preventDefault();
                    var cx = this.canvas.width / 2;
                    var cy = (this.canvas.height - 52) / 2 + 52;
                    this.applyZoom(1.0 / 1.15, cx, cy);
                }).bind(this);
                zoomOutBtn.addEventListener('click', handleZoomOut);
                zoomOutBtn.addEventListener('touchstart', handleZoomOut);
            }

            if (zoomInBtn) {
                var handleZoomIn = (function (e) {
                    if (e) e.preventDefault();
                    var cx = this.canvas.width / 2;
                    var cy = (this.canvas.height - 52) / 2 + 52;
                    this.applyZoom(1.15, cx, cy);
                }).bind(this);
                zoomInBtn.addEventListener('click', handleZoomIn);
                zoomInBtn.addEventListener('touchstart', handleZoomIn);
            }

            if (zoomLevelBtn) {
                var handleZoomLevel = (function (e) {
                    if (e) e.preventDefault();
                    this.zoomTo100();
                }).bind(this);
                zoomLevelBtn.addEventListener('click', handleZoomLevel);
                zoomLevelBtn.addEventListener('touchstart', handleZoomLevel);
            }

            if (zoomFitBtn) {
                var handleZoomFit = (function (e) {
                    if (e) e.preventDefault();
                    this.zoomFit();
                }).bind(this);
                zoomFitBtn.addEventListener('click', handleZoomFit);
                zoomFitBtn.addEventListener('touchstart', handleZoomFit);
            }

            // Draggable Tools Window
            var toolsWindow = document.getElementById('tools-window');
            var toolsHeader = document.querySelector('.tools-header');
            if (toolsWindow && toolsHeader) {
                var isDraggingTL = false;
                var dragStartXTL = 0, dragStartYTL = 0;
                var windowStartXTL = 0, windowStartYTL = 0;

                var onDragStartTL = function (clientX, clientY) {
                    isDraggingTL = true;
                    dragStartXTL = clientX;
                    dragStartYTL = clientY;
                    windowStartXTL = toolsWindow.offsetLeft;
                    windowStartYTL = toolsWindow.offsetTop;
                    toolsHeader.style.cursor = 'move';
                };

                var onDragMoveTL = (function (clientX, clientY) {
                    if (isDraggingTL) {
                        var dx = clientX - dragStartXTL;
                        var dy = clientY - dragStartYTL;
                        toolsWindow.style.left = (windowStartXTL + dx) + 'px';
                        toolsWindow.style.top = (windowStartYTL + dy) + 'px';
                        toolsWindow.style.right = 'auto';
                        toolsWindow.style.bottom = 'auto';
                        this.needsRedraw = true;
                    }
                }).bind(this);

                var onDragEndTL = function () {
                    isDraggingTL = false;
                    toolsHeader.style.cursor = 'default';
                };

                toolsHeader.addEventListener('mousedown', function (e) {
                    onDragStartTL(e.clientX, e.clientY);
                });

                document.addEventListener('mousemove', function (e) {
                    onDragMoveTL(e.clientX, e.clientY);
                });

                document.addEventListener('mouseup', function () {
                    onDragEndTL();
                });

                toolsHeader.addEventListener('touchstart', function (e) {
                    var touch = e.touches[0];
                    onDragStartTL(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchmove', function (e) {
                    var touch = e.touches[0];
                    onDragMoveTL(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchend', function () {
                    onDragEndTL();
                });
            }

            // Tools Switching & Options Wiring
            var toolPaintBtn = document.getElementById('tool-paint-btn');
            var toolInkBtn = document.getElementById('tool-ink-btn');
            var toolDryBtn = document.getElementById('tool-dry-btn');
            var toolEraserBtn = document.getElementById('tool-eraser-btn');
            var toolSmudgeBtn = document.getElementById('tool-smudge-btn');
            var eraserOptionsPanel = document.getElementById('eraser-options-panel');
            var eraserBristlesBtn = document.getElementById('eraser-bristles-btn');
            var eraserScraperBtn = document.getElementById('eraser-scraper-btn');
            var smudgeOptionsPanel = document.getElementById('smudge-options-panel');
            var smudgeSmudgeBtn = document.getElementById('smudge-smudge-btn');
            var smudgeBlurBtn = document.getElementById('smudge-blur-btn');
            var dryOptionsPanel = document.getElementById('dry-options-panel');
            var dryChalkBtn = document.getElementById('dry-chalk-btn');
            var dryImpastoBtn = document.getElementById('dry-impasto-btn');

            var bristlesSliderEl = document.getElementById('bristles-slider');
            var bristlesSliderContainer = bristlesSliderEl ? bristlesSliderEl.parentElement : null;

            var setTool = (function (toolId) {
                var prevTool = this.currentTool;

                if (toolId === 'paint') {
                    this.currentTool = 'paint';
                    if (toolPaintBtn) toolPaintBtn.classList.add('active-tool');
                    if (toolInkBtn) toolInkBtn.classList.remove('active-tool');
                    if (toolDryBtn) toolDryBtn.classList.remove('active-tool');
                    if (toolEraserBtn) toolEraserBtn.classList.remove('active-tool');
                    if (toolSmudgeBtn) toolSmudgeBtn.classList.remove('active-tool');
                    if (eraserOptionsPanel) eraserOptionsPanel.classList.add('hidden');
                    if (smudgeOptionsPanel) smudgeOptionsPanel.classList.add('hidden');
                    if (dryOptionsPanel) dryOptionsPanel.classList.add('hidden');
                    this.eraserTool.onDeactivate(this);
                    this.colorPickTool.onDeactivate(this);
                    this.pencilTool.onDeactivate(this);
                } else if (toolId === 'ink') {
                    this.currentTool = 'ink';
                    if (toolPaintBtn) toolPaintBtn.classList.remove('active-tool');
                    if (toolInkBtn) toolInkBtn.classList.add('active-tool');
                    if (toolDryBtn) toolDryBtn.classList.remove('active-tool');
                    if (toolEraserBtn) toolEraserBtn.classList.remove('active-tool');
                    if (toolSmudgeBtn) toolSmudgeBtn.classList.remove('active-tool');
                    if (eraserOptionsPanel) eraserOptionsPanel.classList.add('hidden');
                    if (smudgeOptionsPanel) smudgeOptionsPanel.classList.add('hidden');
                    if (dryOptionsPanel) dryOptionsPanel.classList.add('hidden');
                    this.eraserTool.onDeactivate(this);
                    this.colorPickTool.onDeactivate(this);
                    this.pencilTool.onDeactivate(this);
                } else if (toolId === 'dry') {
                    this.currentTool = 'dry';
                    if (toolPaintBtn) toolPaintBtn.classList.remove('active-tool');
                    if (toolInkBtn) toolInkBtn.classList.remove('active-tool');
                    if (toolDryBtn) toolDryBtn.classList.add('active-tool');
                    if (toolEraserBtn) toolEraserBtn.classList.remove('active-tool');
                    if (toolSmudgeBtn) toolSmudgeBtn.classList.remove('active-tool');
                    if (eraserOptionsPanel) eraserOptionsPanel.classList.add('hidden');
                    if (smudgeOptionsPanel) smudgeOptionsPanel.classList.add('hidden');
                    if (dryOptionsPanel) dryOptionsPanel.classList.remove('hidden');
                    this.eraserTool.onDeactivate(this);
                    this.colorPickTool.onDeactivate(this);
                    this.pencilTool.onActivate(this);
                } else if (toolId === 'eraser') {
                    this.currentTool = 'eraser';
                    if (toolPaintBtn) toolPaintBtn.classList.remove('active-tool');
                    if (toolInkBtn) toolInkBtn.classList.remove('active-tool');
                    if (toolDryBtn) toolDryBtn.classList.remove('active-tool');
                    if (toolEraserBtn) toolEraserBtn.classList.add('active-tool');
                    if (toolSmudgeBtn) toolSmudgeBtn.classList.remove('active-tool');
                    if (eraserOptionsPanel) eraserOptionsPanel.classList.remove('hidden');
                    if (smudgeOptionsPanel) smudgeOptionsPanel.classList.add('hidden');
                    if (dryOptionsPanel) dryOptionsPanel.classList.add('hidden');
                    this.eraserTool.onActivate(this);
                    this.colorPickTool.onDeactivate(this);
                    this.pencilTool.onDeactivate(this);
                } else if (toolId === 'smudge') {
                    this.currentTool = 'smudge';
                    if (toolPaintBtn) toolPaintBtn.classList.remove('active-tool');
                    if (toolInkBtn) toolInkBtn.classList.remove('active-tool');
                    if (toolDryBtn) toolDryBtn.classList.remove('active-tool');
                    if (toolEraserBtn) toolEraserBtn.classList.remove('active-tool');
                    if (toolSmudgeBtn) toolSmudgeBtn.classList.add('active-tool');
                    if (eraserOptionsPanel) eraserOptionsPanel.classList.add('hidden');
                    if (smudgeOptionsPanel) smudgeOptionsPanel.classList.remove('hidden');
                    if (dryOptionsPanel) dryOptionsPanel.classList.add('hidden');
                    this.eraserTool.onDeactivate(this);
                    this.colorPickTool.onDeactivate(this);
                    this.pencilTool.onDeactivate(this);
                }

                this.applyToolSettings(toolId);
                this.needsRedraw = true;
            }).bind(this);

            if (toolPaintBtn) {
                toolPaintBtn.addEventListener('click', function () { setTool('paint'); });
            }
            if (toolInkBtn) {
                toolInkBtn.addEventListener('click', function () { setTool('ink'); });
            }
            if (toolDryBtn) {
                toolDryBtn.addEventListener('click', function () { setTool('dry'); });
            }
            if (toolEraserBtn) {
                toolEraserBtn.addEventListener('click', function () { setTool('eraser'); });
            }
            if (toolSmudgeBtn) {
                toolSmudgeBtn.addEventListener('click', function () { setTool('smudge'); });
            }

            var setEraserType = (function (type) {
                this.eraserType = type;
                if (type === 'bristles') {
                    if (eraserBristlesBtn) eraserBristlesBtn.classList.add('active-opt');
                    if (eraserScraperBtn) eraserScraperBtn.classList.remove('active-opt');
                } else if (type === 'scraper') {
                    if (eraserBristlesBtn) eraserBristlesBtn.classList.remove('active-opt');
                    if (eraserScraperBtn) eraserScraperBtn.classList.add('active-opt');
                }
                this.applyToolSettings(this.currentTool);
                this.needsRedraw = true;
            }).bind(this);

            if (eraserBristlesBtn) {
                eraserBristlesBtn.addEventListener('click', function () { setEraserType('bristles'); });
            }
            if (eraserScraperBtn) {
                eraserScraperBtn.addEventListener('click', function () { setEraserType('scraper'); });
            }

            var setSmudgeType = (function (type) {
                this.smudgeType = type;
                if (type === 'smudge') {
                    if (smudgeSmudgeBtn) smudgeSmudgeBtn.classList.add('active-opt');
                    if (smudgeBlurBtn) smudgeBlurBtn.classList.remove('active-opt');
                } else if (type === 'blur') {
                    if (smudgeSmudgeBtn) smudgeSmudgeBtn.classList.remove('active-opt');
                    if (smudgeBlurBtn) smudgeBlurBtn.classList.add('active-opt');
                }
                this.applyToolSettings(this.currentTool);
                this.needsRedraw = true;
            }).bind(this);

            if (smudgeSmudgeBtn) {
                smudgeSmudgeBtn.addEventListener('click', function () { setSmudgeType('smudge'); });
            }
            if (smudgeBlurBtn) {
                smudgeBlurBtn.addEventListener('click', function () { setSmudgeType('blur'); });
            }

            var setDryType = (function (type) {
                this.dryType = type;
                if (type === 'chalk') {
                    if (dryChalkBtn) dryChalkBtn.classList.add('active-opt');
                    if (dryImpastoBtn) dryImpastoBtn.classList.remove('active-opt');
                } else if (type === 'impasto') {
                    if (dryChalkBtn) dryChalkBtn.classList.remove('active-opt');
                    if (dryImpastoBtn) dryImpastoBtn.classList.add('active-opt');
                }
                this.applyToolSettings(this.currentTool);
                this.needsRedraw = true;
            }).bind(this);

            if (dryChalkBtn) {
                dryChalkBtn.addEventListener('click', function () { setDryType('chalk'); });
            }
            if (dryImpastoBtn) {
                dryImpastoBtn.addEventListener('click', function () { setDryType('impasto'); });
            }

            // Keyboard Shortcuts
            window.addEventListener('keydown', (function (e) {
                if (e.key === '1') {
                    setTool('paint');
                } else if (e.key === '2') {
                    setTool('ink');
                } else if (e.key === '3') {
                    setTool('dry');
                } else if (e.key === '4') {
                    setTool('smudge');
                } else if (e.key === '5') {
                    setTool('eraser');
                }
            }).bind(this));

            var self = this;
            this.loadFromIndexedDB(function (err, state) {
                if (!err && state) {
                    // Restore dimensions and parameters
                    self.logicalWidth = state.logicalWidth !== undefined ? state.logicalWidth : state.width / state.resolutionScale;
                    self.logicalHeight = state.logicalHeight !== undefined ? state.logicalHeight : state.height / state.resolutionScale;
                    self.zoomLevel = state.zoomLevel !== undefined ? state.zoomLevel : 1.0;
                    self.resolutionScale = state.resolutionScale !== undefined ? state.resolutionScale : self.resolutionScale;
                    self.colorModel = state.colorModel !== undefined ? state.colorModel : self.colorModel;

                    self.paintingRectangle = new Rectangle(
                        state.paintingLeft !== undefined ? state.paintingLeft : self.paintingRectangle.left,
                        state.paintingBottom !== undefined ? state.paintingBottom : self.paintingRectangle.bottom,
                        state.paintingWidth !== undefined ? state.paintingWidth : self.logicalWidth * self.zoomLevel,
                        state.paintingHeight !== undefined ? state.paintingHeight : self.logicalHeight * self.zoomLevel
                    );

                    // Re-clamp resolution scale buttons to index if needed
                    for (var i = 0; i < QUALITIES.length; ++i) {
                        if (QUALITIES[i].resolutionScale === self.resolutionScale) {
                            self.qualityButtons.setIndex(i);
                        }
                    }

                    if (self.colorModel === ColorModel.RYB) {
                        self.modelButtons.setIndex(0);
                    } else {
                        self.modelButtons.setIndex(1);
                    }

                    if (state.pixels) {
                        // Rebuild simulator and snapshots with correct sizes
                        self.simulator.changeResolution(state.width, state.height);
                        self.setPaintTextureData(state.pixels, state.width, state.height);

                        // Update snapshots to match the loaded pixels
                        for (var i = 0; i < self.snapshots.length; ++i) {
                            var snap = self.snapshots[i];
                            if (snap.getTextureWidth() !== state.width || snap.getTextureHeight() !== state.height) {
                                wgl.rebuildTexture(snap.texture, wgl.RGBA, wgl.FLOAT, state.width, state.height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
                            }
                            self.simulator.copyPaintTexture(snap.texture);
                            snap.paintingWidth = self.paintingRectangle.width;
                            snap.paintingHeight = self.paintingRectangle.height;
                            snap.paintingLeft = self.paintingRectangle.left;
                            snap.paintingBottom = self.paintingRectangle.bottom;
                            snap.logicalWidth = self.logicalWidth;
                            snap.logicalHeight = self.logicalHeight;
                            snap.zoomLevel = self.zoomLevel;
                            snap.resolutionScale = self.resolutionScale;
                        }
                    }
                    self.updateZoomUI();
                    self.onResize();
                }

                // Apply current tool settings on startup (this loads from localStorage)
                self.applyToolSettings(self.currentTool);
            });


            var update = (function () {
                this.update();
                requestAnimationFrame(update);
            }).bind(this);
            update();
        }
    }

    Paint.prototype.getPaintingResolutionWidth = function () {
        return Math.ceil(this.logicalWidth * this.resolutionScale);
    };


    Paint.prototype.getPaintingResolutionHeight = function () {
        return Math.ceil(this.logicalHeight * this.resolutionScale);
    };

    Paint.prototype.applyZoom = function (scaleFactor, mX, mY) {
        var rx = (mX - this.paintingRectangle.left) / this.paintingRectangle.width;
        var ry = (mY - this.paintingRectangle.bottom) / this.paintingRectangle.height;

        var MIN_ZOOM_WIDTH = 50;
        var MAX_ZOOM_WIDTH = 20000;
        var newWidth = Utilities.clamp(this.paintingRectangle.width * scaleFactor, MIN_ZOOM_WIDTH, MAX_ZOOM_WIDTH);
        var appliedScale = newWidth / this.paintingRectangle.width;
        var newHeight = this.paintingRectangle.height * appliedScale;

        this.paintingRectangle.left = mX - rx * newWidth;
        this.paintingRectangle.bottom = mY - ry * newHeight;
        this.paintingRectangle.width = newWidth;
        this.paintingRectangle.height = newHeight;

        this.zoomLevel *= appliedScale;
        this.updateZoomUI();

        this.needsRedraw = true;
    };

    Paint.prototype.updateZoomUI = function () {
        var textEl = document.getElementById('zoom-level-btn');
        if (textEl) {
            textEl.textContent = Math.round(this.zoomLevel * 100) + '%';
        }
    };

    Paint.prototype.zoomTo100 = function () {
        this.zoomLevel = 1.0;
        this.paintingRectangle.width = this.logicalWidth;
        this.paintingRectangle.height = this.logicalHeight;
        
        var topBarHeight = 52;
        var availableCenterY = (this.canvas.height - topBarHeight) / 2;
        this.paintingRectangle.left = (this.canvas.width - this.paintingRectangle.width) / 2;
        this.paintingRectangle.bottom = availableCenterY - (this.paintingRectangle.height / 2);
        
        this.updateZoomUI();
        this.needsRedraw = true;
    };

    Paint.prototype.zoomFit = function () {
        var topBarHeight = 52;
        var padding = 60;
        var availableWidth = Math.max(100, this.canvas.width - padding * 2);
        var availableHeight = Math.max(100, this.canvas.height - topBarHeight - padding * 2);
        
        var fitScale = Math.min(availableWidth / this.logicalWidth, availableHeight / this.logicalHeight);
        this.zoomLevel = Utilities.clamp(fitScale, 0.05, 10.0);
        
        this.paintingRectangle.width = this.logicalWidth * this.zoomLevel;
        this.paintingRectangle.height = this.logicalHeight * this.zoomLevel;
        
        var availableCenterY = (this.canvas.height - topBarHeight) / 2;
        this.paintingRectangle.left = (this.canvas.width - this.paintingRectangle.width) / 2;
        this.paintingRectangle.bottom = availableCenterY - (this.paintingRectangle.height / 2);
        
        this.updateZoomUI();
        this.needsRedraw = true;
    };

    Paint.prototype.drawShadow = function (alpha, rectangle) {
        var wgl = this.wgl;

        var shadowDrawState = wgl.createDrawState()
          .uniform2f('u_bottomLeft', rectangle.left, rectangle.bottom)
          .uniform2f('u_topRight', rectangle.getRight(), rectangle.getTop())
          .uniform1f('u_sigma', BOX_SHADOW_SIGMA) 
          .uniform1f('u_alpha', alpha) 
          .enable(wgl.BLEND)
          .blendFunc(wgl.ONE, wgl.ONE_MINUS_SRC_ALPHA)
          .useProgram(this.shadowProgram)
          .vertexAttribPointer(this.quadVertexBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0);

        var rectangles = [
            new Rectangle(rectangle.left - BOX_SHADOW_WIDTH, rectangle.bottom - BOX_SHADOW_WIDTH, rectangle.width + 2 * BOX_SHADOW_WIDTH, BOX_SHADOW_WIDTH), //bottom
            new Rectangle(rectangle.left - BOX_SHADOW_WIDTH, rectangle.getTop(), rectangle.width + 2 * BOX_SHADOW_WIDTH, BOX_SHADOW_WIDTH), //top
            new Rectangle(rectangle.left - BOX_SHADOW_WIDTH, rectangle.bottom, BOX_SHADOW_WIDTH, rectangle.height), //left
            new Rectangle(rectangle.getRight(), rectangle.bottom, BOX_SHADOW_WIDTH, rectangle.height) // right
        ];

        var screenRectangle = new Rectangle(0, 0, this.canvas.width, this.canvas.height);
        for (var i = 0; i < rectangles.length; ++i) {
            var rect = rectangles[i];
            rect.intersectRectangle(screenRectangle);

            if (rect.getArea() > 0) {
                shadowDrawState.viewport(rect.left, rect.bottom, rect.width, rect.height);
                wgl.drawArrays(shadowDrawState, wgl.TRIANGLE_STRIP, 0, 4);
            }
        }

    };

    function cursorForResizingSide (side) {
        if (side === ResizingSide.LEFT || side === ResizingSide.RIGHT) {
            return 'ew-resize';
        } else if (side === ResizingSide.BOTTOM || side === ResizingSide.TOP) {
            return 'ns-resize';
        } else if (side === ResizingSide.TOP_LEFT) {
            return 'nw-resize';
        } else if (side === ResizingSide.TOP_RIGHT) {
            return 'ne-resize';
        } else if (side === ResizingSide.BOTTOM_LEFT) {
            return 'sw-resize';
        } else if (side === ResizingSide.BOTTOM_RIGHT) {
            return 'se-resize';
        }
    }


    Paint.prototype.update = function () {
        var wgl = this.wgl;
        var canvas = this.canvas;
        var simulationFramebuffer = this.simulationFramebuffer;

        var scaledScale = this.brushScale * (this.zoomLevel || 1.0);


        //update brush
        if (this.brushInitialized) {
            this.brush.update(this.brushX, this.brushY, this.brushHeight * scaledScale, scaledScale);
        }


        //splat into paint and velocity textures

        if (this.interactionState === InteractionMode.PAINTING) {
            if (this.debouncedSaveTimeout) {
                clearTimeout(this.debouncedSaveTimeout);
                this.debouncedSaveTimeout = null;
            }
            if (this.currentTool === 'eraser') {
                var splatRadius = SPLAT_RADIUS * scaledScale;
                var alphaT = this.brushColorHSVA[3];
                var bristleT = (this.brush.bristleCount - MIN_BRISTLE_COUNT) / (MAX_BRISTLE_COUNT - MIN_BRISTLE_COUNT);
                var minAlpha = mix(THIN_MIN_ALPHA, THICK_MIN_ALPHA, bristleT);
                var maxAlpha = mix(THIN_MAX_ALPHA, THICK_MAX_ALPHA, bristleT);
                var alpha = mix(minAlpha, maxAlpha, alphaT);
                var splatVelocityScale = SPLAT_VELOCITY_SCALE * alpha * this.resolutionScale;

                this.eraserTool.splat(
                    this,
                    this.simulator,
                    this.brush,
                    Z_THRESHOLD * scaledScale,
                    this.paintingRectangle,
                    splatRadius,
                    splatVelocityScale,
                    this.eraserType
                );
            } else {
                var isInk = (this.currentTool === 'ink');
                var isDry = (this.currentTool === 'dry');
                var isSmudge = (this.currentTool === 'smudge');
                var splatRadius = SPLAT_RADIUS * scaledScale;
                if (isInk) {
                    splatRadius = SPLAT_RADIUS * scaledScale * 0.35;
                } else if (isDry) {
                    if (this.dryType === 'impasto') {
                        splatRadius = SPLAT_RADIUS * scaledScale * 0.95;
                    } else {
                        splatRadius = SPLAT_RADIUS * scaledScale * 0.45;
                    }
                } else if (isSmudge) {
                    if (this.smudgeType === 'blur') {
                        splatRadius = scaledScale * 0.55;
                    } else {
                        splatRadius = SPLAT_RADIUS * scaledScale * 1.30;
                    }
                }

                var splatColor = hsvToRyb(this.brushColorHSVA[0], this.brushColorHSVA[1], this.brushColorHSVA[2]);
                if (this.colorModel === ColorModel.RGB) {
                    var r = splatColor[0];
                    var g = splatColor[1];
                    var b = splatColor[2];
                    splatColor[0] = 1.0 - g;
                    splatColor[1] = 1.0 - r;
                    splatColor[2] = 1.0 - b;
                }

                var alphaT = this.brushColorHSVA[3];

                var alpha;
                if (isInk) {
                    alpha = 0.85 * alphaT;
                } else if (isDry) {
                    if (this.dryType === 'impasto') {
                        alpha = 0.045 * alphaT;
                    } else {
                        alpha = 0.98 * alphaT;
                    }
                } else if (isSmudge) {
                    alpha = 0.0;
                } else {
                    var bristleT = (this.brush.bristleCount - MIN_BRISTLE_COUNT) / (MAX_BRISTLE_COUNT - MIN_BRISTLE_COUNT);
                    var minAlpha = mix(THIN_MIN_ALPHA, THICK_MIN_ALPHA, bristleT);
                    var maxAlpha = mix(THICK_MIN_ALPHA, THICK_MAX_ALPHA, bristleT);
                    alpha = mix(minAlpha, maxAlpha, alphaT);
                }

                splatColor[3] = alpha;

                var splatVelocityScale;
                if (isInk) {
                    var fT = (this.simulator.fluidity - 0.6) / 0.3; // 0 to 1
                    splatVelocityScale = SPLAT_VELOCITY_SCALE * splatColor[3] * this.resolutionScale * (0.05 + 0.95 * fT) * 0.4;
                } else if (isDry) {
                    splatVelocityScale = 0.0;
                } else if (isSmudge) {
                    if (this.smudgeType === 'blur') {
                        splatVelocityScale = 0.0;
                    } else {
                        splatVelocityScale = SPLAT_VELOCITY_SCALE * this.resolutionScale * 1.5;
                    }
                } else {
                    splatVelocityScale = SPLAT_VELOCITY_SCALE * splatColor[3] * this.resolutionScale;
                }

                var threshold = Z_THRESHOLD * scaledScale;
                if (isDry) {
                    threshold = Z_THRESHOLD * scaledScale * 3.5; // very forgiving for dry media to prevent skipping
                } else {
                    threshold = Z_THRESHOLD * scaledScale * 2.0; // more forgiving for other tools
                }

                //splat paint
                this.simulator.splat(this.brush, threshold, this.paintingRectangle, splatColor, splatRadius, splatVelocityScale, false, isDry && (this.dryType !== 'impasto'), isSmudge && this.smudgeType === 'blur');
            }

         }

         var simTool = this.currentTool;
         if (simTool === 'smudge') {
             simTool = (this.smudgeType === 'blur') ? 'blur' : 'smudge';
         }
         var simulationUpdated = this.simulator.simulate(simTool);

        if (simulationUpdated) this.needsRedraw = true;


        //the rectangle we end up drawing the painting into
        var clippedPaintingRectangle = (this.interactionState === InteractionMode.RESIZING ? this.newPaintingRectangle : this.paintingRectangle).clone()
                                           .intersectRectangle(new Rectangle(0, 0, this.canvas.width, this.canvas.height));

        if (this.needsRedraw) {
            //draw painting into texture

            wgl.framebufferTexture2D(this.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, this.canvasTexture, 0);
            var clearState = wgl.createClearState()
                .bindFramebuffer(this.framebuffer)
                .clearColor(BACKGROUND_GRAY, BACKGROUND_GRAY, BACKGROUND_GRAY, 1.0);

            wgl.clear(clearState, wgl.COLOR_BUFFER_BIT | wgl.DEPTH_BUFFER_BIT);


            var paintingProgram;

            if (this.colorModel === ColorModel.RYB) {
                paintingProgram = this.interactionState === InteractionMode.RESIZING ? this.resizingPaintingProgram : this.paintingProgram;
            } else if (this.colorModel === ColorModel.RGB) {
                paintingProgram = this.interactionState === InteractionMode.RESIZING ? this.resizingPaintingProgramRGB : this.paintingProgramRGB;
            }

            var paintingDrawState = wgl.createDrawState()
                .bindFramebuffer(this.framebuffer)
                .vertexAttribPointer(this.quadVertexBuffer, paintingProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
                .useProgram(paintingProgram)
                .uniform1f('u_featherSize', RESIZING_FEATHER_SIZE)

                .uniform1f('u_normalScale', NORMAL_SCALE / this.resolutionScale)
                .uniform1f('u_roughness', ROUGHNESS)
                .uniform1f('u_diffuseScale', DIFFUSE_SCALE)
                .uniform1f('u_specularScale', SPECULAR_SCALE)
                .uniform1f('u_F0', F0)
                .uniform3f('u_lightDirection', LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2])

                .uniform2f('u_paintingPosition', this.paintingRectangle.left, this.paintingRectangle.bottom)
                .uniform2f('u_paintingResolution', this.simulator.resolutionWidth, this.simulator.resolutionHeight)
                .uniform2f('u_paintingSize', this.paintingRectangle.width, this.paintingRectangle.height)
                .uniform2f('u_screenResolution', this.canvas.width, this.canvas.height)
                .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, this.simulator.paintTexture)

                .viewport(clippedPaintingRectangle.left, clippedPaintingRectangle.bottom, clippedPaintingRectangle.width, clippedPaintingRectangle.height);

            wgl.drawArrays(paintingDrawState, wgl.TRIANGLE_STRIP, 0, 4);

        }

        //output painting to screen
        var outputDrawState = wgl.createDrawState()
          .viewport(0, 0, this.canvas.width, this.canvas.height)
          .useProgram(this.outputProgram)
          .uniformTexture('u_input', 0, wgl.TEXTURE_2D, this.canvasTexture)
          .vertexAttribPointer(this.quadVertexBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0);

        wgl.drawArrays(outputDrawState, wgl.TRIANGLE_STRIP, 0, 4);


        this.drawShadow(PAINTING_SHADOW_ALPHA, clippedPaintingRectangle); //draw painting shadow



        //draw brush to screen
        if (this.brushInitialized && !this.altDown && this.currentTool !== 'colorpick' && !(this.currentTool === 'smudge' && this.smudgeType === 'blur') && (this.interactionState === InteractionMode.PAINTING || !this.colorPicker.isInUse() && this.interactionState === InteractionMode.NONE && this.desiredInteractionMode(this.mouseX, this.mouseY) === InteractionMode.PAINTING)) { 
            var brushDrawState = wgl.createDrawState()
                .bindFramebuffer(null)
                .viewport(0, 0, this.canvas.width, this.canvas.height)
                .vertexAttribPointer(this.brush.brushTextureCoordinatesBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0)

                .useProgram(this.brushProgram)
                .bindIndexBuffer(this.brush.brushIndexBuffer)

                .uniform4f('u_color', 0.6, 0.6, 0.6, 1.0)
                .uniformMatrix4fv('u_projectionViewMatrix', false, this.mainProjectionMatrix)
                .enable(wgl.DEPTH_TEST)

                .enable(wgl.BLEND)
                .blendFunc(wgl.DST_COLOR, wgl.ZERO)

                .uniformTexture('u_positionsTexture', 0, wgl.TEXTURE_2D, this.brush.positionsTexture);

            wgl.drawElements(brushDrawState, wgl.LINES, this.brush.indexCount * this.brush.bristleCount / this.brush.maxBristleCount, wgl.UNSIGNED_SHORT, 0);
        }


        //work out what cursor we want
        var desiredCursor = '';

        if (this.altDown || this.currentTool === 'colorpick') {
            desiredCursor = 'copy';
        } else if (this.colorPicker.isInUse()) {
            desiredCursor = 'pointer';
        } else if (this.colorPicker.overControl(this.mouseX, this.mouseY)) {
            desiredCursor = 'pointer';
        } else if (this.interactionState === InteractionMode.NONE) { //if there is no current interaction, we display a cursor based on what interaction would occur on click
            var desiredMode = this.desiredInteractionMode(this.mouseX, this.mouseY);

            if (desiredMode === InteractionMode.PAINTING) {
                desiredCursor = 'none';
            } else if (desiredMode === InteractionMode.RESIZING) {
                desiredCursor = cursorForResizingSide(this.getResizingSide(this.mouseX, this.mouseY));
            } else if (desiredMode === InteractionMode.PANNING) {
                desiredCursor = 'grab';
            } else if (desiredMode === InteractionMode.ZOOMING) {
                desiredCursor = 'zoom-in';
            } else {
                desiredCursor = 'default';
            }
        } else { //if there is an interaction going on, display appropriate cursor
            if (this.interactionState === InteractionMode.PAINTING) {
                desiredCursor = 'none';
            } else if (this.interactionState === InteractionMode.RESIZING) {
                desiredCursor = cursorForResizingSide(this.resizingSide);
            } else if (this.interactionState === InteractionMode.PANNING) {
                desiredCursor = 'grabbing';
            } else if (this.interactionState === InteractionMode.ZOOMING) {
                desiredCursor = 'zoom-in';
            }
        }

        if (this.canvas.style.cursor !== desiredCursor) { //don't thrash the style
            this.canvas.style.cursor = desiredCursor;
        }

        // Update custom inverted ink cursor visibility/position
        var inkCursorElement = document.getElementById('ink-cursor');
        if (inkCursorElement) {
            if (desiredCursor === 'none' && this.currentTool === 'ink') {
                inkCursorElement.classList.remove('hidden');
                inkCursorElement.style.left = this.mouseX + 'px';
                inkCursorElement.style.top = (this.canvas.height - this.mouseY) + 'px';
            } else {
                inkCursorElement.classList.add('hidden');
            }
        }

        // Update custom inverted blur cursor visibility/position
        var blurCursorElement = document.getElementById('blur-cursor');
        if (blurCursorElement) {
            if (desiredCursor === 'none' && this.currentTool === 'smudge' && this.smudgeType === 'blur') {
                blurCursorElement.classList.remove('hidden');
                var size = 2.0 * scaledScale * 0.55;
                blurCursorElement.style.width = size + 'px';
                blurCursorElement.style.height = size + 'px';
                blurCursorElement.style.left = this.mouseX + 'px';
                blurCursorElement.style.top = (this.canvas.height - this.mouseY) + 'px';
            } else {
                blurCursorElement.classList.add('hidden');
            }
        }


        var panelBottom = this.canvas.height - PANEL_HEIGHT;

        if (this.needsRedraw) {
            //blur the canvas for the panel

            var BLUR_FEATHER = ((PANEL_BLUR_SAMPLES - 1) / 2) * PANEL_BLUR_STRIDE;

            var blurDrawState = wgl.createDrawState()
                .useProgram(this.blurProgram)
                .viewport(
                    0,
                    Utilities.clamp(panelBottom - BLUR_FEATHER, 0, this.canvas.height),
                    PANEL_WIDTH + BLUR_FEATHER,
                    PANEL_HEIGHT + BLUR_FEATHER)
                .bindFramebuffer(this.framebuffer)
                .uniform2f('u_resolution', this.canvas.width, this.canvas.height)
                .vertexAttribPointer(this.quadVertexBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0);


            wgl.framebufferTexture2D(this.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, this.tempCanvasTexture, 0);
            blurDrawState.uniformTexture('u_input', 0, wgl.TEXTURE_2D, this.canvasTexture)
                .uniform2f('u_step', PANEL_BLUR_STRIDE, 0);

            wgl.drawArrays(blurDrawState, wgl.TRIANGLE_STRIP, 0, 4);


            wgl.framebufferTexture2D(this.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, this.blurredCanvasTexture, 0);
            blurDrawState.uniformTexture('u_input', 0, wgl.TEXTURE_2D, this.tempCanvasTexture)
                .uniform2f('u_step', 0, PANEL_BLUR_STRIDE);

            wgl.drawArrays(blurDrawState, wgl.TRIANGLE_STRIP, 0, 4);
        }

        
        // old panel drawing bypassed for pure brutalist HTML/CSS interface

        this.needsRedraw = false;

        // Continuous synchronization of WebGL color picker coordinates to the target element slot
        var target = document.getElementById('color-picker-target');
        if (target) {
            var rect = target.getBoundingClientRect();
            this.colorPicker.left = rect.left;
            this.colorPicker.bottom = this.canvas.height - rect.bottom;
        }

        // Continuous update of the active color preview swatch
        var preview = document.getElementById('palette-color-preview');
        if (preview) {
            var rgb = hsvToRyb(this.brushColorHSVA[0], this.brushColorHSVA[1], this.brushColorHSVA[2]);
            var displayRGB = (this.colorModel === ColorModel.RYB) ? rybToRgb(rgb) : rgb;

            var r = Math.floor(displayRGB[0] * 255);
            var g = Math.floor(displayRGB[1] * 255);
            var b = Math.floor(displayRGB[2] * 255);
            var a = this.brushColorHSVA[3];
            preview.style.backgroundColor = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

            // Real-time PaletteManager feedback from WebGL wheel
            if (this.colorPicker.isInUse()) {
                var pigmentR = Math.floor(rgb[0] * 255);
                var pigmentG = Math.floor(rgb[1] * 255);
                var pigmentB = Math.floor(rgb[2] * 255);
                var hex = '#' + ((1 << 24) + (pigmentR << 16) + (pigmentG << 8) + pigmentB).toString(16).slice(1).toUpperCase();
                var currentActiveIndex = this.paletteManager.activeIndex;
                if (this.paletteManager.baseColors[currentActiveIndex] !== hex) {
                    this.paletteManager.setBaseColor(currentActiveIndex, hex);
                    this.renderPalette();
                }
            }
        }

        this.colorPicker.draw(this.colorModel === ColorModel.RGB);


        //this.brushViewer.draw(this.brushX, this.brushY, this.brush);
    };


    Paint.prototype.clear = function () {
        this.simulator.clear();

        this.needsRedraw = true;
        this.saveToIndexedDB();
    };


    Paint.prototype.saveSnapshot = function () {
        var wgl = this.wgl;
        if (this.snapshotIndex === HISTORY_SIZE) { //no more room in the snapshots
            //the last shall be first and the first shall be last...
            var front = this.snapshots.shift();
            this.snapshots.push(front);

            this.snapshotIndex -= 1;
        }

        this.undoing = false;

        var snapshot = this.snapshots[this.snapshotIndex]; //the snapshot to save into

        if (snapshot.getTextureWidth() !== this.simulator.resolutionWidth || snapshot.getTextureHeight() !== this.simulator.resolutionHeight) { //if we need to resize the snapshot's texture
            wgl.rebuildTexture(snapshot.texture, wgl.RGBA, wgl.FLOAT, this.simulator.resolutionWidth, this.simulator.resolutionHeight, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        }

        this.simulator.copyPaintTexture(snapshot.texture);

        snapshot.paintingWidth = this.paintingRectangle.width;
        snapshot.paintingHeight = this.paintingRectangle.height;
        snapshot.paintingLeft = this.paintingRectangle.left;
        snapshot.paintingBottom = this.paintingRectangle.bottom;
        snapshot.logicalWidth = this.logicalWidth;
        snapshot.logicalHeight = this.logicalHeight;
        snapshot.zoomLevel = this.zoomLevel;
        snapshot.resolutionScale = this.resolutionScale;

        this.snapshotIndex += 1;


        this.refreshDoButtons();
    };

    Paint.prototype.applySnapshot = function (snapshot) {
        var snapLogicalWidth = snapshot.logicalWidth !== undefined ? snapshot.logicalWidth : snapshot.paintingWidth;
        var snapLogicalHeight = snapshot.logicalHeight !== undefined ? snapshot.logicalHeight : snapshot.paintingHeight;

        // Only restore canvas physical dimensions if the actual canvas size was resized/changed in the snapshot
        if (this.logicalWidth !== snapLogicalWidth || this.logicalHeight !== snapLogicalHeight) {
            this.logicalWidth = snapLogicalWidth;
            this.logicalHeight = snapLogicalHeight;

            this.paintingRectangle.width = this.logicalWidth * this.zoomLevel;
            this.paintingRectangle.height = this.logicalHeight * this.zoomLevel;
        }

        if (this.resolutionScale !== snapshot.resolutionScale) {
            for (var i = 0; i < QUALITIES.length; ++i) {
                if (QUALITIES[i].resolutionScale === snapshot.resolutionScale) {
                    this.qualityButtons.setIndex(i);
                }
            }

            this.resolutionScale = snapshot.resolutionScale;
        }

        if (this.simulator.width !== this.getPaintingResolutionWidth() || this.simulator.height !== this.getPaintingResolutionHeight()) {
            this.simulator.changeResolution(this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight());
        }

        this.simulator.applyPaintTexture(snapshot.texture);
        this.updateZoomUI();
    };

    Paint.prototype.canUndo = function () {
        return this.snapshotIndex >= 1;
    };

    Paint.prototype.canRedo = function () {
        return this.undoing && this.snapshotIndex <= this.maxRedoIndex - 1;
    };

    Paint.prototype.undo = function () {
        if (!this.undoing) {
            this.saveSnapshot();

            this.undoing = true;

            this.snapshotIndex -= 1;

            this.maxRedoIndex = this.snapshotIndex;
        }

        if (this.canUndo()) {
            this.applySnapshot(this.snapshots[this.snapshotIndex - 1]);

            this.snapshotIndex -= 1;
        }

        this.refreshDoButtons();

        this.needsRedraw = true;
        this.saveToIndexedDB();
    };

    Paint.prototype.redo = function () {
        if (this.canRedo()) {
            this.applySnapshot(this.snapshots[this.snapshotIndex + 1]);

            this.snapshotIndex += 1;

        }

        this.refreshDoButtons();

        this.needsRedraw = true;
        this.saveToIndexedDB();
    };

    Paint.prototype.refreshDoButtons = function () {
        if (this.canUndo()) {
            this.undoButton.className = 'bar-btn do-button-active';
        } else {
            this.undoButton.className = 'bar-btn do-button-inactive';
        }

        if (this.canRedo()) {
            this.redoButton.className = 'bar-btn do-button-active';
        } else {
            this.redoButton.className = 'bar-btn do-button-inactive';
        }
    };

    Paint.prototype.save = function () {
        //we first render the painting to a WebGL texture

        var wgl = this.wgl;

        var saveWidth = Math.floor(this.paintingRectangle.width);
        var saveHeight = Math.floor(this.paintingRectangle.height);

        var saveTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, saveWidth, saveHeight, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.NEAREST, wgl.NEAREST);

        var saveFramebuffer = wgl.createFramebuffer();
        wgl.framebufferTexture2D(saveFramebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, saveTexture, 0);

        var paintingProgram = this.colorModel === ColorModel.RYB ? this.savePaintingProgram : this.savePaintingProgramRGB;

        var saveDrawState = wgl.createDrawState()
            .bindFramebuffer(saveFramebuffer)
            .viewport(0, 0, saveWidth, saveHeight)
            .vertexAttribPointer(this.quadVertexBuffer, paintingProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
            .useProgram(paintingProgram)
            .uniform2f('u_paintingSize', this.paintingRectangle.width, this.paintingRectangle.height)
            .uniform2f('u_paintingResolution', this.simulator.resolutionWidth, this.simulator.resolutionHeight)
            .uniform2f('u_screenResolution', this.paintingRectangle.width, this.paintingRectangle.height)
            .uniform2f('u_paintingPosition', 0, 0)
            .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, this.simulator.paintTexture)

            .uniform1f('u_normalScale', NORMAL_SCALE / this.resolutionScale)
            .uniform1f('u_roughness', ROUGHNESS)
            .uniform1f('u_diffuseScale', DIFFUSE_SCALE)
            .uniform1f('u_specularScale', SPECULAR_SCALE)
            .uniform1f('u_F0', F0)
            .uniform3f('u_lightDirection', LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2]);


        wgl.drawArrays(saveDrawState, wgl.TRIANGLE_STRIP, 0, 4);

        //then we read back this texture

        var savePixels = new Uint8Array(saveWidth * saveHeight * 4);
        wgl.readPixels(wgl.createReadState().bindFramebuffer(saveFramebuffer),
                        0, 0, saveWidth, saveHeight, wgl.RGBA, wgl.UNSIGNED_BYTE, savePixels);


        wgl.deleteTexture(saveTexture);
        wgl.deleteFramebuffer(saveFramebuffer);


        //then we draw the pixels to a 2D canvas and then save from the canvas
        //is there a better way?

        var saveCanvas = document.createElement('canvas');
        saveCanvas.width = saveWidth;
        saveCanvas.height = saveHeight;
        var saveContext = saveCanvas.getContext('2d');

        var imageData = saveContext.createImageData(saveWidth, saveHeight);
        imageData.data.set(savePixels);
        saveContext.putImageData(imageData, 0, 0);

        var link = document.createElement('a');
        link.download = 'painting.png';
        link.href = saveCanvas.toDataURL();
        link.click();
    };

    Paint.prototype.onMouseMove = function (event) {
        if (event.preventDefault) event.preventDefault();

        var position = Utilities.getMousePosition(event, this.canvas);

        var mouseX = position.x;
        var mouseY = this.canvas.height - position.y;

        this.brushX = mouseX;
        this.brushY = mouseY;


        if (!this.brushInitialized) {
            var initScale = this.brushScale * (this.zoomLevel || 1.0);
            this.brush.initialize(this.brushX, this.brushY, this.brushHeight * initScale, initScale);

            this.brushInitialized = true;
        }

        if (this.interactionState === InteractionMode.PICKING) {
            this.colorPickTool.pickColor(this, mouseX, mouseY);
        } else if (this.interactionState === InteractionMode.PANNING) {
            var deltaX = mouseX - this.mouseX;
            var deltaY = mouseY - this.mouseY;

            this.paintingRectangle.left += deltaX;
            this.paintingRectangle.bottom += deltaY;

            this.paintingRectangle.left = Utilities.clamp(this.paintingRectangle.left, -this.paintingRectangle.width, this.canvas.width);
            this.paintingRectangle.bottom = Utilities.clamp(this.paintingRectangle.bottom, -this.paintingRectangle.height, this.canvas.height);

            this.needsRedraw = true;
        } else if (this.interactionState === InteractionMode.ZOOMING) {
            var deltaY = mouseY - this.mouseY;
            var zoomFactor = 1.0 + deltaY * 0.005;

            var mX = this.zoomCenterX;
            var mY = this.zoomCenterY;
            if (mX === undefined || mY === undefined) {
                mX = mouseX;
                mY = mouseY;
            }

            this.applyZoom(zoomFactor, mX, mY);
        } else if (this.interactionState === InteractionMode.RESIZING) {
            var minW = MIN_PAINTING_WIDTH * this.zoomLevel;
            var maxW = this.maxPaintingWidth * this.zoomLevel;

            if (this.resizingSide === ResizingSide.LEFT || this.resizingSide === ResizingSide.TOP_LEFT || this.resizingSide === ResizingSide.BOTTOM_LEFT) {
                this.newPaintingRectangle.left = Utilities.clamp(mouseX,
                    this.paintingRectangle.getRight() - maxW,
                    this.paintingRectangle.getRight() - minW);
                this.newPaintingRectangle.width = this.paintingRectangle.left + this.paintingRectangle.width - this.newPaintingRectangle.left;
            }
            
            if (this.resizingSide === ResizingSide.RIGHT || this.resizingSide === ResizingSide.TOP_RIGHT || this.resizingSide === ResizingSide.BOTTOM_RIGHT) {
                this.newPaintingRectangle.width = Utilities.clamp(mouseX - this.paintingRectangle.left, minW, maxW);
            }
            
            if (this.resizingSide === ResizingSide.BOTTOM || this.resizingSide === ResizingSide.BOTTOM_LEFT || this.resizingSide === ResizingSide.BOTTOM_RIGHT) {
                this.newPaintingRectangle.bottom = Utilities.clamp(mouseY,
                    this.paintingRectangle.getTop() - maxW,
                    this.paintingRectangle.getTop() - minW);

                this.newPaintingRectangle.height = this.paintingRectangle.bottom + this.paintingRectangle.height - this.newPaintingRectangle.bottom;
            }
            
            if (this.resizingSide === ResizingSide.TOP || this.resizingSide === ResizingSide.TOP_LEFT || this.resizingSide === ResizingSide.TOP_RIGHT) {
                this.newPaintingRectangle.height = Utilities.clamp(mouseY - this.paintingRectangle.bottom, minW, maxW);
            }

            this.needsRedraw = true;
        }

        this.colorPicker.onMouseMove(position.x, this.canvas.height - position.y);


        this.mouseX = mouseX;
        this.mouseY = mouseY;
    };


    Paint.prototype.getResizingSide = function (mouseX, mouseY) { //the side we'd be resizing with the current mouse position
        //we can resize if our perpendicular distance to an edge is less than RESIZING_RADIUS


        if (Math.abs(mouseX - this.paintingRectangle.left) <= RESIZING_RADIUS && Math.abs(mouseY - this.paintingRectangle.getTop()) <= RESIZING_RADIUS) { //top left
            return ResizingSide.TOP_LEFT;
        }

        if (Math.abs(mouseX - this.paintingRectangle.getRight()) <= RESIZING_RADIUS && Math.abs(mouseY - this.paintingRectangle.getTop()) <= RESIZING_RADIUS) { //top right
            return ResizingSide.TOP_RIGHT;
        }

        if (Math.abs(mouseX - this.paintingRectangle.left) <= RESIZING_RADIUS && Math.abs(mouseY - this.paintingRectangle.bottom) <= RESIZING_RADIUS) { //bottom left
            return ResizingSide.BOTTOM_LEFT;
        }

        if (Math.abs(mouseX - this.paintingRectangle.getRight()) <= RESIZING_RADIUS && Math.abs(mouseY - this.paintingRectangle.bottom) <= RESIZING_RADIUS) { //bottom right
            return ResizingSide.BOTTOM_RIGHT;
        }


        if (mouseY > this.paintingRectangle.bottom && mouseY <= this.paintingRectangle.getTop()) { //left or right
            if (Math.abs(mouseX - this.paintingRectangle.left) <= RESIZING_RADIUS) { //left
                return ResizingSide.LEFT;
            } else if (Math.abs(mouseX - this.paintingRectangle.getRight()) <= RESIZING_RADIUS) { //right
                return ResizingSide.RIGHT;
            }
        }
        
        if (mouseX > this.paintingRectangle.left && mouseX <= this.paintingRectangle.getRight()) { //bottom or top
            if (Math.abs(mouseY - this.paintingRectangle.bottom) <= RESIZING_RADIUS) { //bottom
                return ResizingSide.BOTTOM;
            } else if (Math.abs(mouseY - this.paintingRectangle.getTop()) <= RESIZING_RADIUS) { //top
                return ResizingSide.TOP;
            }
        }

        return ResizingSide.NONE;
    };

    //what interaction mode would be triggered if we clicked with given mouse position
    Paint.prototype.desiredInteractionMode = function (mouseX, mouseY) { 
        var screenX = mouseX;
        var screenY = this.canvas.height - mouseY;
        
        var isOverUI = false;
        
        // 1. Is over top bar? (height is 52px)
        if (screenY <= 52) {
            isOverUI = true;
        }
        
        // 2. Is over color palette window? (when visible)
        var palette = document.getElementById('color-palette-window');
        if (!isOverUI && palette) {
            var rect = palette.getBoundingClientRect();
            if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
                // Ignore the WebGL picker target slot itself so drawing/picking in it works!
                var target = document.getElementById('color-picker-target');
                if (target) {
                    var tRect = target.getBoundingClientRect();
                    var isOverTarget = (screenX >= tRect.left && screenX <= tRect.right && screenY >= tRect.top && screenY <= tRect.bottom);
                    if (!isOverTarget) {
                        isOverUI = true;
                    }
                } else {
                    isOverUI = true;
                }
            }
        }
        
        // 3. Is over settings window? (when visible)
        var settings = document.getElementById('settings-window');
        if (!isOverUI && settings && !settings.classList.contains('hidden')) {
            var rect = settings.getBoundingClientRect();
            if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
                isOverUI = true;
            }
        }

        // 4. Is over viewport window?
        var viewport = document.getElementById('viewport-window');
        if (!isOverUI && viewport) {
            var rect = viewport.getBoundingClientRect();
            if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
                isOverUI = true;
            }
        }

        if (isOverUI) {
            return InteractionMode.NONE;
        } else if (this.zDown) {
            return InteractionMode.ZOOMING;
        } else if (this.spaceDown || this.mouseX < this.paintingRectangle.left - RESIZING_RADIUS || this.mouseX > this.paintingRectangle.left + this.paintingRectangle.width + RESIZING_RADIUS || this.mouseY < this.paintingRectangle.bottom - RESIZING_RADIUS || this.mouseY > this.paintingRectangle.bottom + this.paintingRectangle.height + RESIZING_RADIUS) {
            return InteractionMode.PANNING;
        } else if (this.getResizingSide(mouseX, mouseY) !== ResizingSide.NONE) {
            return InteractionMode.RESIZING;
        } else {
            return InteractionMode.PAINTING;
        }
    };

    Paint.prototype.onMouseDown = function (event) {
        window.focus();
        if (this.canvas && this.canvas.focus) {
            this.canvas.focus();
        }
        if (event.preventDefault) event.preventDefault();

        var isLeftClick = ('button' in event && event.button === 0);
        var isMiddleClick = ('button' in event && event.button === 1);

        if ('button' in event && !isLeftClick && !isMiddleClick) return;

        var position = Utilities.getMousePosition(event, this.canvas);

        var mouseX = position.x;
        var mouseY = this.canvas.height - position.y;

        this.mouseX = mouseX;
        this.mouseY = mouseY;

        var initScale = this.brushScale * (this.zoomLevel || 1.0);
        if (!this.brushInitialized) {
            this.brush.initialize(mouseX, mouseY, this.brushHeight * initScale, initScale);
            this.brushInitialized = true;
        } else {
            var dx = mouseX - this.brushX;
            var dy = mouseY - this.brushY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > initScale * 3.5) {
                this.brush.initialize(mouseX, mouseY, this.brushHeight * initScale, initScale);
            }
        }

        this.brushX = mouseX;
        this.brushY = mouseY;

        if (isMiddleClick) {
            this.interactionState = InteractionMode.PANNING;
            return;
        }

        if (isLeftClick && (this.altDown || this.currentTool === 'colorpick')) {
            this.interactionState = InteractionMode.PICKING;
            this.colorPickTool.pickColor(this, mouseX, mouseY);
            return;
        }

        this.colorPicker.onMouseDown(mouseX, mouseY);

        if (!this.colorPicker.isInUse()) {

            var mode = this.desiredInteractionMode(mouseX, mouseY);

            if (mode === InteractionMode.PANNING) {
                this.interactionState = InteractionMode.PANNING;
            } else if (mode === InteractionMode.ZOOMING) {
                this.interactionState = InteractionMode.ZOOMING;
                this.zoomCenterX = mouseX;
                this.zoomCenterY = mouseY;
            } else if (mode === InteractionMode.RESIZING) {
                this.saveSnapshot();

                this.interactionState = InteractionMode.RESIZING;

                this.resizingSide = this.getResizingSide(mouseX, mouseY);

                this.newPaintingRectangle = this.paintingRectangle.clone();

            } else if (mode === InteractionMode.PAINTING) {
                this.interactionState = InteractionMode.PAINTING;

                this.saveSnapshot();
            }
        }
    };

    Paint.prototype.onMouseUp = function (event) {
        if (event.preventDefault) event.preventDefault();

        var position = Utilities.getMousePosition(event, this.canvas);

        this.colorPicker.onMouseUp(position.x, this.canvas.height - position.y);

        if (this.interactionState === InteractionMode.RESIZING) { //if we're stopping the resize
            //resize simulator

            var offsetX = 0, offsetY = 0;

            if (this.resizingSide === ResizingSide.LEFT || this.resizingSide === ResizingSide.TOP_LEFT || this.resizingSide === ResizingSide.BOTTOM_LEFT) {
                offsetX = ((this.paintingRectangle.left - this.newPaintingRectangle.left) / this.zoomLevel) * this.resolutionScale;
            }
            
            if (this.resizingSide === ResizingSide.BOTTOM || this.resizingSide === ResizingSide.BOTTOM_LEFT || this.resizingSide === ResizingSide.BOTTOM_RIGHT) {
                offsetY = ((this.paintingRectangle.bottom - this.newPaintingRectangle.bottom) / this.zoomLevel) * this.resolutionScale;
            }

            this.paintingRectangle = this.newPaintingRectangle;
            this.logicalWidth = this.paintingRectangle.width / this.zoomLevel;
            this.logicalHeight = this.paintingRectangle.height / this.zoomLevel;

            this.simulator.resize(this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight(), offsetX, offsetY, RESIZING_FEATHER_SIZE);

            
            this.needsRedraw = true;
        }

        this.interactionState = InteractionMode.NONE;
        this.scheduleDebouncedSave(3000);
    };

    Paint.prototype.onMouseOver = function (event) {
        if (event.preventDefault) event.preventDefault();

        var position = Utilities.getMousePosition(event, this.canvas);

        var mouseX = position.x;
        var mouseY = this.canvas.height - position.y;

        this.brushX = mouseX;
        this.brushY = mouseY;


        if (!this.brushInitialized) {
            var initScale = this.brushScale * (this.zoomLevel || 1.0);
            this.brush.initialize(this.brushX, this.brushY, this.brushHeight * initScale, initScale);
            this.brushInitialized = true;
        }
    };

    Paint.prototype.onWheel = function (event) {
        event.preventDefault();

        var zoomIntensity = 0.08;
        var scaleFactor = event.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);

        var position = Utilities.getMousePosition(event, this.canvas);
        var mX = position.x;
        var mY = this.canvas.height - position.y;

        this.applyZoom(scaleFactor, mX, mY);
    };


    Paint.prototype.onTouchStart = function (event) {
        event.preventDefault();

        if (event.touches.length === 1) { //if this is the first touch

            this.onMouseDown(event.targetTouches[0]);

        } else if (event.touches.length === 2) { //if this is the second touch
            if (this.interactionState === InteractionMode.PAINTING) {
                this.interactionState = InteractionMode.PANNING; //switch to panning if we were already painting
            }
        }
    };

    Paint.prototype.onTouchMove = function (event) {
        event.preventDefault();

        this.onMouseMove(event.targetTouches[0]);
    };

    Paint.prototype.onTouchEnd = function (event) {
        event.preventDefault();

        if (event.touches.length > 0) return; //don't fire if there are still touches remaining

        this.onMouseUp({});
    };

    Paint.prototype.onTouchCancel = function (event) {
        event.preventDefault();

        if (event.touches.length > 0) return; //don't fire if there are still touches remaining

        this.onMouseUp({});
    };

    var DEFAULT_TOOL_SETTINGS = {
        paint: {
            bristleCount: 75,
            bristleLength: 4.5,
            bristleStiffness: 0.3,
            bristleJitter: 0.5,
            bristleScatter: 1.0,
            brushScale: 30,
            fluidity: 0.75
        },
        ink: {
            bristleCount: 1,
            bristleLength: 1.2,
            bristleStiffness: 0.5,
            bristleJitter: 0.0,
            bristleScatter: 1.0,
            brushScale: 12,
            fluidity: 0.85
        },
        dry_chalk: {
            bristleCount: 12,
            bristleLength: 2.0,
            bristleStiffness: 0.8,
            bristleJitter: 1.2,
            bristleScatter: 0.15,
            brushScale: 12,
            fluidity: 0.60
        },
        dry_impasto: {
            bristleCount: 16,
            bristleLength: 2.5,
            bristleStiffness: 0.4,
            bristleJitter: 0.6,
            bristleScatter: 0.30,
            brushScale: 20,
            fluidity: 0.0
        },
        eraser_bristles: {
            bristleCount: 40,
            bristleLength: 4.5,
            bristleStiffness: 0.3,
            bristleJitter: 0.5,
            bristleScatter: 1.0,
            brushScale: 40,
            fluidity: 0.75
        },
        eraser_scraper: {
            bristleCount: 1,
            bristleLength: 4.5,
            bristleStiffness: 0.9,
            bristleJitter: 0.0,
            bristleScatter: 0.1,
            brushScale: 40,
            fluidity: 0.40
        },
        smudge_smudge: {
            bristleCount: 50,
            bristleLength: 3.5,
            bristleStiffness: 0.4,
            bristleJitter: 0.8,
            bristleScatter: 0.5,
            brushScale: 25,
            fluidity: 0.90
        },
        smudge_blur: {
            bristleCount: 1,
            bristleLength: 3.5,
            bristleStiffness: 0.5,
            bristleJitter: 0.0,
            bristleScatter: 0.1,
            brushScale: 45,
            fluidity: 1.0
        }
    };

    Paint.prototype.getCurrentSettingsKey = function (toolId) {
        if (toolId === 'eraser') {
            return 'eraser_' + (this.eraserType || 'bristles');
        }
        if (toolId === 'smudge') {
            return 'smudge_' + (this.smudgeType || 'smudge');
        }
        if (toolId === 'dry') {
            return 'dry_' + (this.dryType || 'chalk');
        }
        return toolId;
    };

    Paint.prototype.getToolSettings = function (toolId) {
        if (!toolId) return null;
        var key = this.getCurrentSettingsKey(toolId);
        var cacheKey = 'tool_settings_' + key;
        try {
            var cached = localStorage.getItem(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            console.error('Error loading settings from localStorage:', e);
        }

        // Return a copy of the default settings
        var defaults = DEFAULT_TOOL_SETTINGS[key] || DEFAULT_TOOL_SETTINGS[toolId];
        if (defaults) {
            return Object.assign({}, defaults);
        }
        return null;
    };

    Paint.prototype.saveToolSettings = function (toolId, settings) {
        if (!toolId || !settings) return;
        var key = this.getCurrentSettingsKey(toolId);
        var cacheKey = 'tool_settings_' + key;
        try {
            localStorage.setItem(cacheKey, JSON.stringify(settings));
        } catch (e) {
            console.error('Error saving settings to localStorage:', e);
        }
    };

    Paint.prototype.updateCurrentToolSetting = function (key, value) {
        if (this.currentTool === 'colorpick') return;
        var settings = this.getToolSettings(this.currentTool);
        if (settings) {
            settings[key] = value;
            this.saveToolSettings(this.currentTool, settings);
        }
    };

    Paint.prototype.applyToolSettings = function (toolId) {
        if (toolId === 'colorpick') return;
        var settings = this.getToolSettings(toolId);
        if (!settings) return;

        // Apply properties to simulator and brush
        this.simulator.fluidity = settings.fluidity;
        this.brush.setBristleCount(settings.bristleCount);
        this.brush.bristleLength = settings.bristleLength;
        this.brush.bristleStiffness = settings.bristleStiffness !== undefined ? settings.bristleStiffness : 0.3;
        this.brush.bristleJitter = settings.bristleJitter;
        this.brush.bristleScatter = settings.bristleScatter !== undefined ? settings.bristleScatter : 1.0;
        this.brushScale = settings.brushScale;

        // Determine brushHeight based on tool type to make sure we make perfect canvas contact
        this.updateBrushHeight();
        var initScale = this.brushScale * (this.zoomLevel || 1.0);
        this.brush.initialize(this.brushX, this.brushY, this.brushHeight * initScale, initScale);

        // Update Top-Bar Slider Values silently (without triggering callbacks)
        if (this.fluiditySlider) {
            if (toolId === 'ink') {
                this.fluiditySlider.setMinMax(0.55, 0.95);
            } else {
                this.fluiditySlider.setMinMax(0.1, 1.0);
            }
            this.fluiditySlider.setValue(settings.fluidity);
        }
        if (this.bristleCountSlider) {
            var BRISTLE_SLIDER_POWER = 2.0;
            var t = (settings.bristleCount - MIN_BRISTLE_COUNT) / (MAX_BRISTLE_COUNT - MIN_BRISTLE_COUNT);
            t = Utilities.clamp(t, 0.0, 1.0);
            var sliderValue = Math.pow(t, 1.0 / BRISTLE_SLIDER_POWER);
            this.bristleCountSlider.setValue(sliderValue);
        }
        if (this.brushSizeSlider) {
            this.brushSizeSlider.setValue(settings.brushScale);
        }

        // Update Settings Window Slider Values
        if (this.bristleLengthSlider) {
            if (toolId === 'ink') {
                this.bristleLengthSlider.setMinMax(0.1, 0.5);
            } else {
                this.bristleLengthSlider.setMinMax(0.1, 10.0);
            }
            this.bristleLengthSlider.setValue(settings.bristleLength);
        }
        if (this.bristleStiffnessSlider) {
            this.bristleStiffnessSlider.setValue(settings.bristleStiffness !== undefined ? settings.bristleStiffness : 0.3);
        }
        if (this.bristleJitterSlider) {
            this.bristleJitterSlider.setValue(settings.bristleJitter);
        }
        if (this.bristleScatterSlider) {
            this.bristleScatterSlider.setValue(settings.bristleScatter !== undefined ? settings.bristleScatter : 1.0);
        }

        // Update Labels
        this.updateFluidityLabel(settings.fluidity);
        this.updateBristlesLabel(settings.bristleCount);
        this.updateSizeLabel(settings.brushScale);
        if (this.updateLengthLabel) this.updateLengthLabel(settings.bristleLength);
        if (this.updateTensionLabel) this.updateTensionLabel(settings.bristleStiffness !== undefined ? settings.bristleStiffness : 0.3);
        if (this.updateJitterLabel) this.updateJitterLabel(settings.bristleJitter);
        if (this.updateScatterLabel) this.updateScatterLabel(settings.bristleScatter !== undefined ? settings.bristleScatter : 1.0);

        // Update Title in Settings Window
        var titleEl = document.getElementById('brush-params-title');
        if (titleEl) {
            titleEl.textContent = 'Brush Parameters (' + toolId.toUpperCase() + ')';
        }
        var titleSubEl = document.getElementById('brush-params-title-sub');
        if (titleSubEl) {
            titleSubEl.textContent = toolId.toUpperCase();
        }

        this.needsRedraw = true;
    };

    Paint.prototype.updateBrushHeight = function () {
        var toolId = this.currentTool;
        var heightFactor = (toolId === 'ink') ? 0.1555 : ((toolId === 'dry') ? 0.2666 : 0.4444);
        this.brushHeight = this.brush.bristleLength * heightFactor;
    };

    Paint.prototype.getPaintTextureData = function () {
        var wgl = this.wgl;
        var width = this.simulator.resolutionWidth;
        var height = this.simulator.resolutionHeight;

        var tempFramebuffer = wgl.createFramebuffer();
        wgl.framebufferTexture2D(tempFramebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, this.simulator.paintTexture, 0);

        var pixels = new Float32Array(width * height * 4);
        wgl.readPixels(
            wgl.createReadState().bindFramebuffer(tempFramebuffer),
            0, 0, width, height, wgl.RGBA, wgl.FLOAT, pixels
        );

        wgl.deleteFramebuffer(tempFramebuffer);
        return pixels;
    };

    Paint.prototype.setPaintTextureData = function (pixels, width, height) {
        var wgl = this.wgl;
        if (this.simulator.resolutionWidth !== width || this.simulator.resolutionHeight !== height) {
            this.simulator.changeResolution(width, height);
        }

        wgl.rebuildTexture(this.simulator.paintTexture, wgl.RGBA, wgl.FLOAT, width, height, pixels, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        wgl.rebuildTexture(this.simulator.paintTextureTemp, wgl.RGBA, wgl.FLOAT, width, height, pixels, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);

        this.simulator.clearTextures([this.simulator.velocityTexture, this.simulator.velocityTextureTemp]);

        this.needsRedraw = true;
    };

    Paint.prototype.scheduleDebouncedSave = function (delayMs) {
        if (delayMs === undefined) delayMs = 3000;
        if (this.debouncedSaveTimeout) {
            clearTimeout(this.debouncedSaveTimeout);
        }
        var self = this;
        this.debouncedSaveTimeout = setTimeout(function () {
            self.saveToIndexedDB();
            self.debouncedSaveTimeout = null;
        }, delayMs);
    };

    Paint.prototype.saveToIndexedDB = function () {
        try {
            var pixels = this.getPaintTextureData();
            var state = {
                pixels: pixels,
                width: this.simulator.resolutionWidth,
                height: this.simulator.resolutionHeight,
                paintingWidth: this.paintingRectangle.width,
                paintingHeight: this.paintingRectangle.height,
                paintingLeft: this.paintingRectangle.left,
                paintingBottom: this.paintingRectangle.bottom,
                logicalWidth: this.logicalWidth,
                logicalHeight: this.logicalHeight,
                zoomLevel: this.zoomLevel,
                resolutionScale: this.resolutionScale,
                colorModel: this.colorModel
            };

            var request = indexedDB.open('FluidPaintDB', 1);
            request.onupgradeneeded = function (event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains('canvas_store')) {
                    db.createObjectStore('canvas_store');
                }
            };
            request.onsuccess = function (event) {
                var db = event.target.result;
                var transaction = db.transaction(['canvas_store'], 'readwrite');
                var store = transaction.objectStore('canvas_store');
                store.put(state, 'current_state');
            };
        } catch (e) {
            console.error('Error saving to IndexedDB:', e);
        }
    };

    Paint.prototype.loadFromIndexedDB = function (callback) {
        try {
            var request = indexedDB.open('FluidPaintDB', 1);
            request.onupgradeneeded = function (event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains('canvas_store')) {
                    db.createObjectStore('canvas_store');
                }
            };
            request.onsuccess = function (event) {
                var db = event.target.result;
                var transaction = db.transaction(['canvas_store'], 'readonly');
                var store = transaction.objectStore('canvas_store');
                var getRequest = store.get('current_state');
                getRequest.onsuccess = function (e) {
                    callback(null, e.target.result);
                };
                getRequest.onerror = function (e) {
                    callback(e.target.error, null);
                };
            };
            request.onerror = function (event) {
                callback(event.target.error, null);
            };
        } catch (e) {
            callback(e, null);
        }
    };

    return Paint;
}());

window.Paint = Paint;
export { Paint };
