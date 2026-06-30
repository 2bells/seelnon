import { PaletteManager } from './paletteManager.js';
import { ImgHandler } from './imgHandler.js';
import { Eraser } from './tool/eraser.js';
import { ColorPick } from './tool/colorpick.js';
import { Pencil } from './tool/pencil.js';
import { SelectionTool } from './tool/selection.js';
import { Snapshot, saveSnapshot, applySnapshot, canUndo, canRedo, undo, redo, refreshDoButtons } from './historyManager.js';
import { DEFAULT_TOOL_SETTINGS, getCurrentSettingsKey, getToolSettings, saveToolSettings, updateCurrentToolSetting, applyToolSettings, scheduleDebouncedSave, saveToIndexedDB, loadFromIndexedDB, getProjectsList, saveProjectsList, deleteProjectFromIndexedDB, calculateOverallStorageUsage, calculateProjectStorageUsage } from './settingsManager.js';

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


    function Paint (canvas, wgl) {
        this.canvas = canvas;
        this.wgl = wgl;
        this.activeProjectId = localStorage.getItem('fluidpaint_active_project') || 'default';
        this.projectsList = [];
        this.normalScale = NORMAL_SCALE;
        this.roughness = ROUGHNESS;
        this.specularScale = SPECULAR_SCALE;
        this.lightAngle = 45;

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
            'shaders/liquify.frag',
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

            this.liquifyProgram = wgl.createProgram(
                shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/liquify.frag'], { 'a_position': 0 });


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
            this.paintType = 'bristles'; // 'bristles' or 'oil'
            this.eraserType = 'bristles'; // 'bristles' or 'scraper'
            this.smudgeType = 'smudge'; // 'smudge' or 'blur'
            this.dryType = 'chalk'; // 'chalk' or 'pencil'
            this.liquifyType = 'push'; // 'push', 'twirl_cw', 'twirl_ccw', 'pinch', 'bloat'
            this.eraserTool = new Eraser();
            this.colorPickTool = new ColorPick();
            this.pencilTool = new Pencil();
            this.selectionTool = new SelectionTool(this);
            this.debouncedSaveTimeout = null;


            this.colorModel = ColorModel.RGB;

            this.needsRedraw = true; //whether we need to redraw the painting

            this.lastInteractionTime = performance.now();
            this._cachedUIRects = null;
            this._cachedUIRectsTime = 0;

            this.resizeModeActive = false; //canvas resizing operational only when active

            this.isMirrored = false;

            var savedAutosaveEnabled = localStorage.getItem('autosave_enabled');
            this.autosaveEnabled = savedAutosaveEnabled !== 'false';
            var savedAutosaveDelay = localStorage.getItem('autosave_delay');
            this.autosaveDelay = savedAutosaveDelay !== null ? parseInt(savedAutosaveDelay, 10) : 3;


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

            // Create custom impasto cursor element
            var impastoCursor = document.createElement('div');
            impastoCursor.id = 'impasto-cursor';
            impastoCursor.className = 'custom-impasto-cursor hidden';
            document.body.appendChild(impastoCursor);

            // Create custom liquify cursor element
            var liquifyCursor = document.createElement('div');
            liquifyCursor.id = 'liquify-cursor';
            liquifyCursor.className = 'custom-liquify-cursor hidden';
            document.body.appendChild(liquifyCursor);



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

            var updateOpacityLabel = function (o) {
                var lbl = document.getElementById('val-opacity');
                if (lbl) lbl.textContent = Math.round(o * 100) + '%';
            };

            this.updateSizeLabel = updateSizeLabel;
            this.updateFluidityLabel = updateFluidityLabel;
            this.updateBristlesLabel = updateBristlesLabel;
            this.updateOpacityLabel = updateOpacityLabel;

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

            this.opacitySlider = new Slider(document.getElementById('opacity-slider'), this.brushColorHSVA[3], 0.0, 1.0, (function(opacity) {
                this.brushColorHSVA[3] = opacity;
                updateOpacityLabel(opacity);
                this.updateCurrentToolSetting('opacity', opacity);
            }).bind(this));

            var updateLiquifyFalloffLabel = function (f) {
                var lbl = document.getElementById('val-liquify-falloff');
                if (lbl) lbl.textContent = f.toFixed(1);
            };
            var updateLiquifyIntensityLabel = function (i) {
                var lbl = document.getElementById('val-liquify-intensity');
                if (lbl) lbl.textContent = Math.round(i * 100) + '%';
            };

            this.updateLiquifyFalloffLabel = updateLiquifyFalloffLabel;
            this.updateLiquifyIntensityLabel = updateLiquifyIntensityLabel;

            this.liquifyFalloffSlider = new Slider(document.getElementById('liquify-falloff-slider'), 2.0, 0.1, 5.0, (function (falloff) {
                this.updateCurrentToolSetting('liquifyFalloff', falloff);
                updateLiquifyFalloffLabel(falloff);
            }).bind(this));

            this.liquifyIntensitySlider = new Slider(document.getElementById('liquify-intensity-slider'), 0.7, 0.0, 2.0, (function (intensity) {
                this.updateCurrentToolSetting('liquifyIntensity', intensity);
                updateLiquifyIntensityLabel(intensity);
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
            var updateHeightLabel = function (val) {
                var el = document.getElementById('val-height');
                if (el) el.textContent = val.toFixed(1);
            };

            this.updateLengthLabel = updateLengthLabel;
            this.updateTensionLabel = updateTensionLabel;
            this.updateJitterLabel = updateJitterLabel;
            this.updateScatterLabel = updateScatterLabel;
            this.updateHeightLabel = updateHeightLabel;

            this.bristleLengthSlider = new Slider(document.getElementById('length-slider'), 4.5, 0.1, 10.0, (function (length) {
                this.brush.bristleLength = length;
                updateLengthLabel(length);
                this.updateBrushHeight();
                this.updateCurrentToolSetting('bristleLength', length);
                var initScale = this.brushScale * (this.zoomLevel || 1.0);
                if (!this.brushInitialized) {
                    this.brush.initialize(this.brushX, this.brushY, this.brushHeight * initScale, initScale);
                    this.brushInitialized = true;
                }
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

            this.paintHeight = 1.0;
            this.paintHeightSlider = new Slider(document.getElementById('height-slider'), 1.0, 0.05, 3.0, (function (height) {
                this.paintHeight = height;
                updateHeightLabel(height);
                this.updateCurrentToolSetting('paintHeight', height);
            }).bind(this));

            // Populate initial labels
            updateFluidityLabel(this.simulator.fluidity);
            updateBristlesLabel(this.brush.bristleCount);
            updateSizeLabel(this.brushScale);
            updateLengthLabel(this.brush.bristleLength);
            updateTensionLabel(this.brush.bristleStiffness);
            updateJitterLabel(this.brush.bristleJitter);
            updateScatterLabel(this.brush.bristleScatter);
            updateHeightLabel(this.paintHeight);


            
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


            var pickerCanvas = document.getElementById('color-picker-canvas');
            var pickerWgl = WrappedGL.create(pickerCanvas);
            this.pickerWgl = pickerWgl;
            this.pickerCanvas = pickerCanvas;
            this.colorPicker = new ColorPicker(this, 'brushColorHSVA', pickerWgl, pickerCanvas, shaderSources, 0, 0);

            //this.brushViewer = new BrushViewer(wgl, this.brushProgram, 0, 800, 200, 300);


            this.saveButton = document.getElementById('save-button');
            this.saveButton.addEventListener('click', this.save.bind(this));
            this.saveButton.addEventListener('touchstart', (function (event) {
                event.preventDefault();
                this.save();
            }).bind(this));


            this.clearButton = document.getElementById('clear-button');  
            var isClearSure = false;
            var clearResetTimeout = null;
            var self = this;

            var resetClearButton = function () {
                isClearSure = false;
                if (self.clearButton) {
                    self.clearButton.textContent = 'CLEAR';
                    self.clearButton.style.backgroundColor = '';
                    self.clearButton.style.color = '';
                    self.clearButton.style.borderColor = '';
                }
                if (clearResetTimeout) {
                    clearTimeout(clearResetTimeout);
                    clearResetTimeout = null;
                }
            };

            var handleClearClick = function (event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                if (!isClearSure) {
                    isClearSure = true;
                    if (self.clearButton) {
                        self.clearButton.textContent = 'SURE?';
                        self.clearButton.style.backgroundColor = '#ffff00';
                        self.clearButton.style.color = '#000000';
                        self.clearButton.style.borderColor = '#000000';
                    }
                    clearResetTimeout = setTimeout(resetClearButton, 3000);
                } else {
                    self.clear();
                    resetClearButton();
                }
            };

            if (this.clearButton) {
                this.clearButton.addEventListener('click', handleClearClick);
                this.clearButton.addEventListener('touchstart', handleClearClick);
            }


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

            this.resizeToggleButton = document.getElementById('resize-toggle-button');
            if (this.resizeToggleButton) {
                this.resizeToggleButton.addEventListener('click', (function () {
                    this.resizeModeActive = !this.resizeModeActive;
                    if (this.resizeModeActive) {
                        this.resizeToggleButton.classList.add('active');
                    } else {
                        this.resizeToggleButton.classList.remove('active');
                    }
                }).bind(this));
                this.resizeToggleButton.addEventListener('touchstart', (function (event) {
                    event.preventDefault();
                    this.resizeModeActive = !this.resizeModeActive;
                    if (this.resizeModeActive) {
                        this.resizeToggleButton.classList.add('active');
                    } else {
                        this.resizeToggleButton.classList.remove('active');
                    }
                }).bind(this));
            }

            this.refreshDoButtons();



            this.mainProjectionMatrix = makeOrthographicMatrix(new Float32Array(16), 0.0, this.canvas.width, 0, this.canvas.height, -5000.0, 5000.0);


            this.updatePickerPosition = function () {};

            this.isPickingColorWheel = false;
            var pickerCanvasElement = document.getElementById('color-picker-canvas');
            if (pickerCanvasElement) {
                var self = this;
                var onPickerEvent = function (event, type) {
                    event.stopPropagation();
                    if (event.preventDefault) event.preventDefault();

                    var rect = pickerCanvasElement.getBoundingClientRect();
                    var ev = event;
                    if (event.touches && event.touches.length > 0) {
                        ev = event.touches[0];
                    } else if (event.changedTouches && event.changedTouches.length > 0) {
                        ev = event.changedTouches[0];
                    }

                    var pos = Utilities.getMousePosition(ev, pickerCanvasElement);
                    var mouseX = Utilities.clamp(pos.x, 0, rect.width);
                    var mouseY = Utilities.clamp(pos.y, 0, rect.height);

                    // Scale from CSS screen pixels (rect.width x rect.height)
                    // to the logical color picker coordinate space (180 x 210)
                    var pickerScreenX = (mouseX / rect.width) * 180;
                    var pickerScreenY = (1.0 - (mouseY / rect.height)) * 210;

                    if (type === 'mousedown' || type === 'touchstart') {
                        self.isPickingColorWheel = true;
                        self.colorPicker.onMouseDown(pickerScreenX, pickerScreenY);
                    } else if (type === 'mousemove' || type === 'touchmove') {
                        self.colorPicker.onMouseMove(pickerScreenX, pickerScreenY);
                    } else if (type === 'mouseup' || type === 'touchend') {
                        self.isPickingColorWheel = false;
                        self.colorPicker.onMouseUp(pickerScreenX, pickerScreenY);
                        if (self.imgHandler) {
                            self.imgHandler.restoreImageOpacities();
                        }
                    }
                    self.needsRedraw = true;
                };

                pickerCanvasElement.addEventListener('mousedown', function (e) {
                    if (e.button !== 0) return;
                    onPickerEvent(e, 'mousedown');
                    var onWindowMouseMove = function (moveEvent) {
                        onPickerEvent(moveEvent, 'mousemove');
                    };
                    var onWindowMouseUp = function (upEvent) {
                        onPickerEvent(upEvent, 'mouseup');
                        window.removeEventListener('mousemove', onWindowMouseMove);
                        window.removeEventListener('mouseup', onWindowMouseUp);
                    };
                    window.addEventListener('mousemove', onWindowMouseMove);
                    window.addEventListener('mouseup', onWindowMouseUp);
                });

                pickerCanvasElement.addEventListener('touchstart', function (e) {
                    onPickerEvent(e, 'touchstart');
                    var onWindowTouchMove = function (moveEvent) {
                        onPickerEvent(moveEvent, 'touchmove');
                    };
                    var onWindowTouchEnd = function (endEvent) {
                        onPickerEvent(endEvent, 'touchend');
                        window.removeEventListener('touchmove', onWindowTouchMove);
                        window.removeEventListener('touchend', onWindowTouchEnd);
                    };
                    window.addEventListener('touchmove', onWindowTouchMove);
                    window.addEventListener('touchend', onWindowTouchEnd);
                });
            }

            this.onResize = function () {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;

                this.paintingRectangle.left = Utilities.clamp(this.paintingRectangle.left, -this.paintingRectangle.width, this.canvas.width);
                this.paintingRectangle.bottom = Utilities.clamp(this.paintingRectangle.bottom, -this.paintingRectangle.height, this.canvas.height);


                this.updatePickerPosition();


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
                    } else if (event.keyCode === 67) { // c
                        if (this.currentTool === 'select' && this.selectionTool) {
                            this.selectionTool.copy();
                        }
                    } else if (event.keyCode === 86) { // v
                        if (this.selectionTool) {
                            this.selectionTool.paste();
                        }
                    }
                } else {
                    if (event.keyCode === 46 || event.keyCode === 8) { // Delete or Backspace
                        if (this.currentTool === 'select' && this.selectionTool && this.selectionTool.isTransformMode) {
                            event.preventDefault();
                            this.selectionTool.cancelTransform(); // Discards the active transform pixels, leaving the cleared area empty
                            return;
                        }
                    }
                    if (event.keyCode === 13) { // Enter
                        if (this.currentTool === 'select' && this.selectionTool && this.selectionTool.isTransformMode) {
                            event.preventDefault();
                            this.selectionTool.commitTransform();
                            return;
                        }
                    }
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
                        this.updateCurrentToolSetting('brushScale', this.brushScale);
                    } else if (event.keyCode === 69) { // e
                        this.brushScale = Utilities.clamp(this.brushScale + 1.5, MIN_BRUSH_SCALE, MAX_BRUSH_SCALE);
                        this.brushSizeSlider.setValue(this.brushScale);
                        if (this.updateSizeLabel) this.updateSizeLabel(this.brushScale);
                        this.updateCurrentToolSetting('brushScale', this.brushScale);
                    } else if (event.keyCode === 82) { // r (legacy/alternative redo shortcut)
                        this.redo();
                    } else if (event.keyCode === 66) { // b
                        this.toggleMirror();
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
            this.imgHandler = new ImgHandler(this);

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

            // Draggable Settings Window
            var settingsHeader = settingsWindow ? settingsWindow.querySelector('.settings-header') : null;
            if (settingsWindow && settingsHeader) {
                var isDraggingSettings = false;
                var dragStartXST = 0, dragStartYST = 0;
                var windowStartXST = 0, windowStartYST = 0;

                var onDragStartST = function (clientX, clientY) {
                    isDraggingSettings = true;
                    dragStartXST = clientX;
                    dragStartYST = clientY;
                    windowStartXST = settingsWindow.offsetLeft;
                    windowStartYST = settingsWindow.offsetTop;
                };

                var onDragMoveST = (function (clientX, clientY) {
                    if (isDraggingSettings) {
                        var dx = clientX - dragStartXST;
                        var dy = clientY - dragStartYST;
                        settingsWindow.style.left = (windowStartXST + dx) + 'px';
                        settingsWindow.style.top = (windowStartYST + dy) + 'px';
                        settingsWindow.style.right = 'auto';
                        this.needsRedraw = true;
                    }
                }).bind(this);

                var onDragEndST = function () {
                    isDraggingSettings = false;
                };

                settingsHeader.addEventListener('mousedown', function (e) {
                    if (e.target !== closeSettingsBtn) {
                        onDragStartST(e.clientX, e.clientY);
                    }
                });

                document.addEventListener('mousemove', function (e) {
                    onDragMoveST(e.clientX, e.clientY);
                });

                document.addEventListener('mouseup', function () {
                    onDragEndST();
                });

                settingsHeader.addEventListener('touchstart', function (e) {
                    if (e.target !== closeSettingsBtn) {
                        var touch = e.touches[0];
                        onDragStartST(touch.clientX, touch.clientY);
                    }
                });

                document.addEventListener('touchmove', function (e) {
                    var touch = e.touches[0];
                    onDragMoveST(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchend', function () {
                    onDragEndST();
                });
            }

            // Brutalist Settings Tabs Toggle
            var tabPreferencesBtn = document.getElementById('tab-preferences-btn');
            var tabProjectsBtn = document.getElementById('tab-projects-btn');
            var tabDataBtn = document.getElementById('tab-data-btn');
            var tabInfoBtn = document.getElementById('tab-info-btn');
            var tabPreferencesContent = document.getElementById('tab-preferences-content');
            var tabProjectsContent = document.getElementById('tab-projects-content');
            var tabDataContent = document.getElementById('tab-data-content');
            var tabInfoContent = document.getElementById('tab-info-content');

            if (tabPreferencesBtn && tabProjectsBtn && tabDataBtn && tabInfoBtn && tabPreferencesContent && tabProjectsContent && tabDataContent && tabInfoContent) {
                var self = this;
                tabPreferencesBtn.addEventListener('click', function () {
                    tabPreferencesBtn.classList.add('active-tab');
                    tabProjectsBtn.classList.remove('active-tab');
                    tabDataBtn.classList.remove('active-tab');
                    tabInfoBtn.classList.remove('active-tab');
                    tabPreferencesContent.classList.remove('hidden');
                    tabProjectsContent.classList.add('hidden');
                    tabDataContent.classList.add('hidden');
                    tabInfoContent.classList.add('hidden');
                });
                tabProjectsBtn.addEventListener('click', function () {
                    tabProjectsBtn.classList.add('active-tab');
                    tabPreferencesBtn.classList.remove('active-tab');
                    tabDataBtn.classList.remove('active-tab');
                    tabInfoBtn.classList.remove('active-tab');
                    tabProjectsContent.classList.remove('hidden');
                    tabPreferencesContent.classList.add('hidden');
                    tabDataContent.classList.add('hidden');
                    tabInfoContent.classList.add('hidden');
                    self.refreshProjectsListUI();
                });
                tabDataBtn.addEventListener('click', function () {
                    tabDataBtn.classList.add('active-tab');
                    tabPreferencesBtn.classList.remove('active-tab');
                    tabProjectsBtn.classList.remove('active-tab');
                    tabInfoBtn.classList.remove('active-tab');
                    tabDataContent.classList.remove('hidden');
                    tabPreferencesContent.classList.add('hidden');
                    tabProjectsContent.classList.add('hidden');
                    tabInfoContent.classList.add('hidden');

                    if (self.autosaveDelaySlider) {
                        self.autosaveDelaySlider.redraw();
                    }

                    var sizeEl = document.getElementById('db-storage-size');
                    if (sizeEl) {
                        sizeEl.textContent = 'Calculating...';
                        calculateOverallStorageUsage(function (err, bytes) {
                            if (err) {
                                sizeEl.textContent = 'Error';
                                console.error(err);
                            } else {
                                if (!bytes || bytes === 0) {
                                    sizeEl.textContent = '0 Bytes';
                                } else {
                                    var k = 1024;
                                    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                    var i = Math.floor(Math.log(bytes) / Math.log(k));
                                    sizeEl.textContent = parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                }
                            }
                        });
                    }
                });
                tabInfoBtn.addEventListener('click', function () {
                    tabInfoBtn.classList.add('active-tab');
                    tabPreferencesBtn.classList.remove('active-tab');
                    tabProjectsBtn.classList.remove('active-tab');
                    tabDataBtn.classList.remove('active-tab');
                    tabInfoContent.classList.remove('hidden');
                    tabPreferencesContent.classList.add('hidden');
                    tabProjectsContent.classList.add('hidden');
                    tabDataContent.classList.add('hidden');
                });
            }

            // Global Sliders (Normal scale, roughness, specular, light angle)
            var globalNormalInput = document.getElementById('global-normal-scale');
            var globalNormalVal = document.getElementById('val-global-normal-scale');
            if (globalNormalInput && globalNormalVal) {
                var self = this;
                globalNormalInput.value = this.normalScale;
                globalNormalVal.textContent = this.normalScale.toFixed(1);
                globalNormalInput.addEventListener('input', function (e) {
                    self.normalScale = parseFloat(e.target.value);
                    globalNormalVal.textContent = self.normalScale.toFixed(1);
                    self.needsRedraw = true;
                    self.scheduleDebouncedSave();
                });
            }

            var globalRoughnessInput = document.getElementById('global-roughness');
            var globalRoughnessVal = document.getElementById('val-global-roughness');
            if (globalRoughnessInput && globalRoughnessVal) {
                var self = this;
                globalRoughnessInput.value = this.roughness;
                globalRoughnessVal.textContent = this.roughness.toFixed(2);
                globalRoughnessInput.addEventListener('input', function (e) {
                    self.roughness = parseFloat(e.target.value);
                    globalRoughnessVal.textContent = self.roughness.toFixed(2);
                    self.needsRedraw = true;
                    self.scheduleDebouncedSave();
                });
            }

            var globalSpecularInput = document.getElementById('global-specular');
            var globalSpecularVal = document.getElementById('val-global-specular');
            if (globalSpecularInput && globalSpecularVal) {
                var self = this;
                globalSpecularInput.value = this.specularScale;
                globalSpecularVal.textContent = this.specularScale.toFixed(2);
                globalSpecularInput.addEventListener('input', function (e) {
                    self.specularScale = parseFloat(e.target.value);
                    globalSpecularVal.textContent = self.specularScale.toFixed(2);
                    self.needsRedraw = true;
                    self.scheduleDebouncedSave();
                });
            }

            var globalAngleInput = document.getElementById('global-light-angle');
            var globalAngleVal = document.getElementById('val-global-light-angle');
            if (globalAngleInput && globalAngleVal) {
                var self = this;
                globalAngleInput.value = this.lightAngle;
                globalAngleVal.textContent = this.lightAngle + '°';
                globalAngleInput.addEventListener('input', function (e) {
                    self.lightAngle = parseFloat(e.target.value);
                    globalAngleVal.textContent = self.lightAngle + '°';
                    self.needsRedraw = true;
                    self.scheduleDebouncedSave();
                });
            }

            // Projects Management inputs and buttons
            var createProjBtn = document.getElementById('create-project-btn');
            var newProjNameInput = document.getElementById('new-project-name');
            if (createProjBtn && newProjNameInput) {
                var self = this;
                createProjBtn.addEventListener('click', function () {
                    var name = newProjNameInput.value;
                    if (name && name.trim()) {
                        self.createNewProject(name);
                    }
                });
                newProjNameInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') {
                        var name = newProjNameInput.value;
                        if (name && name.trim()) {
                            self.createNewProject(name);
                        }
                    }
                });
            }

            // Autosave Settings Bindings
            var autosaveCheckbox = document.getElementById('autosave-enabled-checkbox');
            var autosaveDelaySliderEl = document.getElementById('autosave-delay-slider');
            var autosaveDelayVal = document.getElementById('autosave-delay-val');

            if (autosaveCheckbox) {
                autosaveCheckbox.checked = this.autosaveEnabled;
                autosaveCheckbox.addEventListener('change', (function (e) {
                    this.autosaveEnabled = e.target.checked;
                    localStorage.setItem('autosave_enabled', this.autosaveEnabled);
                }).bind(this));
            }

            if (autosaveDelaySliderEl && autosaveDelayVal) {
                autosaveDelayVal.textContent = this.autosaveDelay + 's';
                this.autosaveDelaySlider = new Slider(autosaveDelaySliderEl, this.autosaveDelay, 1, 15, (function (val) {
                    this.autosaveDelay = Math.round(val);
                    autosaveDelayVal.textContent = this.autosaveDelay + 's';
                    localStorage.setItem('autosave_delay', this.autosaveDelay);
                }).bind(this));
            }

            // Stored Canvas Cleared
            var clearAutosaveBtn = document.getElementById('clear-autosave-btn');
            if (clearAutosaveBtn) {
                clearAutosaveBtn.addEventListener('click', (function () {
                    if (confirm('Are you sure you want to delete the autosaved canvas? This will not clear your current painting, but the next time you reload, it will start empty.')) {
                        try {
                            var request = indexedDB.open('FluidPaintDB', 1);
                            request.onsuccess = function (event) {
                                var db = event.target.result;
                                var transaction = db.transaction(['canvas_store'], 'readwrite');
                                var store = transaction.objectStore('canvas_store');
                                var deleteReq = store.delete('current_state');
                                deleteReq.onsuccess = function () {
                                    alert('Autosaved canvas cleared!');
                                };
                            };
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }).bind(this));
            }

            // Backup & Restore
            var backupDataBtn = document.getElementById('backup-data-btn');
            if (backupDataBtn) {
                backupDataBtn.addEventListener('click', (function () {
                    try {
                        var pixels = this.getPaintTextureData();
                        var backupObj = {
                            pixels: Array.from(pixels),
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
                            colorModel: this.colorModel,
                            version: 1,
                            timestamp: Date.now()
                        };
                        var blob = new Blob([JSON.stringify(backupObj)], { type: 'application/json' });
                        var url = URL.createObjectURL(blob);
                        var link = document.createElement('a');
                        link.download = 'fluid_paint_backup_' + new Date().toISOString().slice(0, 10) + '.json';
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                    } catch (err) {
                        console.error('Backup failed:', err);
                        alert('Backup failed: ' + err.message);
                    }
                }).bind(this));
            }

            var restoreDataBtn = document.getElementById('restore-data-btn');
            var importBackupFile = document.getElementById('import-backup-file');
            if (restoreDataBtn && importBackupFile) {
                restoreDataBtn.addEventListener('click', function () {
                    importBackupFile.click();
                });
                importBackupFile.addEventListener('change', (function (e) {
                    var file = e.target.files[0];
                    if (!file) return;
                    var reader = new FileReader();
                    reader.onload = (function (evt) {
                        try {
                            var backupObj = JSON.parse(evt.target.result);
                            if (!backupObj.pixels || !backupObj.width || !backupObj.height) {
                                throw new Error('Invalid backup file format.');
                            }
                            if (confirm('Are you sure you want to restore this backup? This will overwrite your current canvas.')) {
                                var FloatPixels = new Float32Array(backupObj.pixels);
                                this.setPaintTextureData(FloatPixels, backupObj.width, backupObj.height);
                                
                                this.paintingRectangle.width = backupObj.paintingWidth;
                                this.paintingRectangle.height = backupObj.paintingHeight;
                                this.paintingRectangle.left = backupObj.paintingLeft;
                                this.paintingRectangle.bottom = backupObj.paintingBottom;
                                this.logicalWidth = backupObj.logicalWidth;
                                this.logicalHeight = backupObj.logicalHeight;
                                this.zoomLevel = backupObj.zoomLevel;
                                this.resolutionScale = backupObj.resolutionScale;
                                this.colorModel = backupObj.colorModel;
                                
                                this.saveToIndexedDB();
                                this.needsRedraw = true;
                                if (this.renderPalette) this.renderPalette();
                                alert('Backup restored successfully!');
                            }
                        } catch (err) {
                            console.error('Restore failed:', err);
                            alert('Restore failed: ' + err.message);
                        }
                    }).bind(this);
                    reader.readAsText(file);
                }).bind(this));
            }

            // Save & Export Window Setup
            var exportWindow = document.getElementById('export-window');
            var closeExportBtn = document.getElementById('close-export-btn');
            
            // Default parameters
            this.exportScale = 1;
            this.exportFormat = 'png';
            this.exportJpegQuality = 0.9;
            this.exportNormalScale = 7.0;
            this.exportRoughness = 0.075;
            this.exportSpecular = 0.5;
            this.exportLightAngle = 45;

            if (closeExportBtn && exportWindow) {
                var hideExport = function (e) {
                    exportWindow.classList.add('hidden');
                };
                closeExportBtn.addEventListener('click', hideExport);
                closeExportBtn.addEventListener('touchstart', function (e) {
                    e.preventDefault();
                    hideExport(e);
                });
            }

            // Draggable Export Window
            var exportHeader = exportWindow ? exportWindow.querySelector('.settings-header') : null;
            if (exportWindow && exportHeader) {
                var isDraggingExport = false;
                var dragStartXE = 0, dragStartYE = 0;
                var windowStartXE = 0, windowStartYE = 0;

                var onDragStartE = function (clientX, clientY) {
                    isDraggingExport = true;
                    dragStartXE = clientX;
                    dragStartYE = clientY;
                    windowStartXE = exportWindow.offsetLeft;
                    windowStartYE = exportWindow.offsetTop;
                    exportWindow.style.cursor = 'move';
                };

                var onDragMoveE = (function (clientX, clientY) {
                    if (isDraggingExport) {
                        var dx = clientX - dragStartXE;
                        var dy = clientY - dragStartYE;
                        exportWindow.style.left = (windowStartXE + dx) + 'px';
                        exportWindow.style.top = (windowStartYE + dy) + 'px';
                        exportWindow.style.right = 'auto';
                        this.needsRedraw = true;
                    }
                }).bind(this);

                var onDragEndE = function () {
                    isDraggingExport = false;
                    exportWindow.style.cursor = 'default';
                };

                exportHeader.addEventListener('mousedown', function (e) {
                    onDragStartE(e.clientX, e.clientY);
                });

                document.addEventListener('mousemove', function (e) {
                    onDragMoveE(e.clientX, e.clientY);
                });

                document.addEventListener('mouseup', function () {
                    onDragEndE();
                });

                exportHeader.addEventListener('touchstart', function (e) {
                    var touch = e.touches[0];
                    onDragStartE(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchmove', function (e) {
                    var touch = e.touches[0];
                    onDragMoveE(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchend', function () {
                    onDragEndE();
                });
            }

            // Format buttons toggle
            var btnPng = document.getElementById('export-format-png');
            var btnJpg = document.getElementById('export-format-jpg');
            var jpgGroup = document.getElementById('jpg-quality-group');

            if (btnPng && btnJpg && jpgGroup) {
                var self = this;
                btnPng.addEventListener('click', function () {
                    self.exportFormat = 'png';
                    btnPng.classList.add('active');
                    btnJpg.classList.remove('active');
                    jpgGroup.classList.add('hidden');
                });
                btnJpg.addEventListener('click', function () {
                    self.exportFormat = 'jpg';
                    btnJpg.classList.add('active');
                    btnPng.classList.remove('active');
                    jpgGroup.classList.remove('hidden');
                });
            }

            // JPEG Quality range slider
            var qualityInput = document.getElementById('export-jpeg-quality');
            var qualityVal = document.getElementById('export-jpeg-quality-val');
            if (qualityInput && qualityVal) {
                var self = this;
                qualityInput.addEventListener('input', function (e) {
                    self.exportJpegQuality = parseFloat(e.target.value);
                    qualityVal.textContent = Math.round(self.exportJpegQuality * 100) + '%';
                });
            }

            // Scale buttons toggles
            var scales = [1, 2, 4, 8];
            var self = this;
            scales.forEach(function (scale) {
                var btn = document.getElementById('export-scale-' + scale);
                if (btn) {
                    btn.addEventListener('click', function () {
                        self.exportScale = scale;
                        scales.forEach(function (s) {
                            var b = document.getElementById('export-scale-' + s);
                            if (b) {
                                if (s === scale) b.classList.add('active');
                                else b.classList.remove('active');
                            }
                        });
                        self.updateExportResolutionInfo();
                    });
                }
            });

            // Normal Scale slider
            var normalInput = document.getElementById('export-normal-scale');
            var normalVal = document.getElementById('val-export-normal-scale');
            if (normalInput && normalVal) {
                var self = this;
                normalInput.addEventListener('input', function (e) {
                    self.exportNormalScale = parseFloat(e.target.value);
                    normalVal.textContent = self.exportNormalScale.toFixed(1);
                });
            }

            // Roughness slider
            var roughnessInput = document.getElementById('export-roughness');
            var roughnessVal = document.getElementById('val-export-roughness');
            if (roughnessInput && roughnessVal) {
                var self = this;
                roughnessInput.addEventListener('input', function (e) {
                    self.exportRoughness = parseFloat(e.target.value);
                    roughnessVal.textContent = self.exportRoughness.toFixed(2);
                });
            }

            // Specular slider
            var specularInput = document.getElementById('export-specular');
            var specularVal = document.getElementById('val-export-specular');
            if (specularInput && specularVal) {
                var self = this;
                specularInput.addEventListener('input', function (e) {
                    self.exportSpecular = parseFloat(e.target.value);
                    specularVal.textContent = self.exportSpecular.toFixed(2);
                });
            }

            // Light angle slider
            var angleInput = document.getElementById('export-light-angle');
            var angleVal = document.getElementById('val-export-light-angle');
            if (angleInput && angleVal) {
                var self = this;
                angleInput.addEventListener('input', function (e) {
                    self.exportLightAngle = parseFloat(e.target.value);
                    angleVal.textContent = self.exportLightAngle + '°';
                });
            }

            // Confirm Button Action
            var confirmBtn = document.getElementById('confirm-export-btn');
            if (confirmBtn) {
                var self = this;
                confirmBtn.addEventListener('click', function () {
                    self.performExport();
                    if (exportWindow) {
                        exportWindow.classList.add('hidden');
                    }
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
                        this.updatePickerPosition();
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

            var mirrorFlipBtn = document.getElementById('mirror-flip-btn');
            if (mirrorFlipBtn) {
                var handleMirrorFlip = (function (e) {
                    if (e) e.preventDefault();
                    this.toggleMirror();
                }).bind(this);
                mirrorFlipBtn.addEventListener('click', handleMirrorFlip);
                mirrorFlipBtn.addEventListener('touchstart', handleMirrorFlip);
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

            // Draggable Reference Image Window
            var refWindow = document.getElementById('ref-image-window');
            var refHeader = document.querySelector('.ref-image-header');
            if (refWindow && refHeader) {
                var isDraggingRF = false;
                var dragStartXRF = 0, dragStartYRF = 0;
                var windowStartXRF = 0, windowStartYRF = 0;

                var onDragStartRF = function (clientX, clientY) {
                    isDraggingRF = true;
                    dragStartXRF = clientX;
                    dragStartYRF = clientY;
                    windowStartXRF = refWindow.offsetLeft;
                    windowStartYRF = refWindow.offsetTop;
                    refHeader.style.cursor = 'move';
                };

                var onDragMoveRF = (function (clientX, clientY) {
                    if (isDraggingRF) {
                        var dx = clientX - dragStartXRF;
                        var dy = clientY - dragStartYRF;
                        refWindow.style.left = (windowStartXRF + dx) + 'px';
                        refWindow.style.top = (windowStartYRF + dy) + 'px';
                        refWindow.style.right = 'auto';
                        refWindow.style.bottom = 'auto';
                        this.needsRedraw = true;
                    }
                }).bind(this);

                var onDragEndRF = function () {
                    isDraggingRF = false;
                    refHeader.style.cursor = 'default';
                };

                refHeader.addEventListener('mousedown', function (e) {
                    onDragStartRF(e.clientX, e.clientY);
                });

                document.addEventListener('mousemove', function (e) {
                    onDragMoveRF(e.clientX, e.clientY);
                });

                document.addEventListener('mouseup', function () {
                    onDragEndRF();
                });

                refHeader.addEventListener('touchstart', function (e) {
                    var touch = e.touches[0];
                    onDragStartRF(touch.clientX, touch.clientY);
                });

                document.addEventListener('touchmove', function (e) {
                    if (e.touches.length > 0) {
                        var touch = e.touches[0];
                        onDragMoveRF(touch.clientX, touch.clientY);
                    }
                });

                document.addEventListener('touchend', function () {
                    onDragEndRF();
                });
            }

            // Tools Switching & Options Wiring
            var toolPaintBtn = document.getElementById('tool-paint-btn');
            var toolInkBtn = document.getElementById('tool-ink-btn');
            var toolDryBtn = document.getElementById('tool-dry-btn');
            var toolEraserBtn = document.getElementById('tool-eraser-btn');
            var toolSmudgeBtn = document.getElementById('tool-smudge-btn');
            var toolLiquifyBtn = document.getElementById('tool-liquify-btn');
            var toolSelectBtn = document.getElementById('tool-select-btn');
            
            var paintOptionsPanel = document.getElementById('paint-options-panel');
            var paintBristlesBtn = document.getElementById('paint-bristles-btn');
            var paintOilBtn = document.getElementById('paint-oil-btn');

            var eraserOptionsPanel = document.getElementById('eraser-options-panel');
            var eraserBristlesBtn = document.getElementById('eraser-bristles-btn');
            var eraserScraperBtn = document.getElementById('eraser-scraper-btn');
            
            var smudgeOptionsPanel = document.getElementById('smudge-options-panel');
            var smudgeSmudgeBtn = document.getElementById('smudge-smudge-btn');
            var smudgeBlurBtn = document.getElementById('smudge-blur-btn');
            
            var dryOptionsPanel = document.getElementById('dry-options-panel');
            var dryChalkBtn = document.getElementById('dry-chalk-btn');
            var dryPencilBtn = document.getElementById('dry-pencil-btn');

            var liquifyOptionsPanel = document.getElementById('liquify-options-panel');
            var liquifyPushBtn = document.getElementById('liquify-push-btn');
            var liquifyTwirlcwBtn = document.getElementById('liquify-twirlcw-btn');
            var liquifyTwirlccwBtn = document.getElementById('liquify-twirlccw-btn');
            var liquifyPinchBtn = document.getElementById('liquify-pinch-btn');
            var liquifyBloatBtn = document.getElementById('liquify-bloat-btn');

            var selectOptionsPanel = document.getElementById('select-options-panel');
            var selectRectBtn = document.getElementById('select-rect-btn');
            var selectFreehandBtn = document.getElementById('select-freehand-btn');

            var bristlesSliderEl = document.getElementById('bristles-slider');
            var bristlesSliderContainer = bristlesSliderEl ? bristlesSliderEl.parentElement : null;

            var setTool = (function (toolId) {
                var prevTool = this.currentTool;

                if (prevTool === toolId) {
                    if (toolId === 'dry') {
                        var nextType = (this.dryType === 'chalk') ? 'pencil' : 'chalk';
                        setDryType(nextType);
                        return;
                    } else if (toolId === 'paint') {
                        var nextType = (this.paintType === 'bristles') ? 'oil' : 'bristles';
                        setPaintType(nextType);
                        return;
                    } else if (toolId === 'smudge') {
                        var nextType = (this.smudgeType === 'smudge') ? 'blur' : 'smudge';
                        setSmudgeType(nextType);
                        return;
                    } else if (toolId === 'eraser') {
                        var nextType = (this.eraserType === 'bristles') ? 'scraper' : 'bristles';
                        setEraserType(nextType);
                        return;
                    } else if (toolId === 'liquify') {
                        var types = ['push', 'twirl_cw', 'twirl_ccw', 'pinch', 'bloat'];
                        var idx = types.indexOf(this.liquifyType);
                        var nextIdx = (idx + 1) % types.length;
                        setLiquifyType(types[nextIdx]);
                        return;
                    } else if (toolId === 'select') {
                        if (this.selectionTool) {
                            this.selectionTool.toggleTransformMode();
                        }
                        return;
                    }
                }

                if (prevTool === 'select' && toolId !== 'select') {
                    if (this.selectionTool) {
                        this.selectionTool.onDeactivate(this);
                    }
                }

                // Hide all options panels first
                if (paintOptionsPanel) paintOptionsPanel.classList.add('hidden');
                if (eraserOptionsPanel) eraserOptionsPanel.classList.add('hidden');
                if (smudgeOptionsPanel) smudgeOptionsPanel.classList.add('hidden');
                if (dryOptionsPanel) dryOptionsPanel.classList.add('hidden');
                if (liquifyOptionsPanel) liquifyOptionsPanel.classList.add('hidden');
                if (selectOptionsPanel) selectOptionsPanel.classList.add('hidden');

                if (toolId === 'paint') {
                    this.currentTool = 'paint';
                    if (toolPaintBtn) toolPaintBtn.classList.add('active-tool');
                    if (toolInkBtn) toolInkBtn.classList.remove('active-tool');
                    if (toolDryBtn) toolDryBtn.classList.remove('active-tool');
                    if (toolEraserBtn) toolEraserBtn.classList.remove('active-tool');
                    if (toolSmudgeBtn) toolSmudgeBtn.classList.remove('active-tool');
                    if (toolLiquifyBtn) toolLiquifyBtn.classList.remove('active-tool');
                    
                    if (paintOptionsPanel) paintOptionsPanel.classList.remove('hidden');

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
                    if (toolLiquifyBtn) toolLiquifyBtn.classList.remove('active-tool');

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
                    if (toolLiquifyBtn) toolLiquifyBtn.classList.remove('active-tool');
                    
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
                    if (toolLiquifyBtn) toolLiquifyBtn.classList.remove('active-tool');
                    
                    if (eraserOptionsPanel) eraserOptionsPanel.classList.remove('hidden');

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
                    if (toolLiquifyBtn) toolLiquifyBtn.classList.remove('active-tool');
                    
                    if (smudgeOptionsPanel) smudgeOptionsPanel.classList.remove('hidden');

                    this.eraserTool.onDeactivate(this);
                    this.colorPickTool.onDeactivate(this);
                    this.pencilTool.onDeactivate(this);
                } else if (toolId === 'liquify') {
                    this.currentTool = 'liquify';
                    if (toolPaintBtn) toolPaintBtn.classList.remove('active-tool');
                    if (toolInkBtn) toolInkBtn.classList.remove('active-tool');
                    if (toolDryBtn) toolDryBtn.classList.remove('active-tool');
                    if (toolEraserBtn) toolEraserBtn.classList.remove('active-tool');
                    if (toolSmudgeBtn) toolSmudgeBtn.classList.remove('active-tool');
                    if (toolLiquifyBtn) toolLiquifyBtn.classList.add('active-tool');
                    
                    if (liquifyOptionsPanel) liquifyOptionsPanel.classList.remove('hidden');

                    this.eraserTool.onDeactivate(this);
                    this.colorPickTool.onDeactivate(this);
                    this.pencilTool.onDeactivate(this);
                } else if (toolId === 'select') {
                    this.currentTool = 'select';
                    if (toolPaintBtn) toolPaintBtn.classList.remove('active-tool');
                    if (toolInkBtn) toolInkBtn.classList.remove('active-tool');
                    if (toolDryBtn) toolDryBtn.classList.remove('active-tool');
                    if (toolEraserBtn) toolEraserBtn.classList.remove('active-tool');
                    if (toolSmudgeBtn) toolSmudgeBtn.classList.remove('active-tool');
                    if (toolLiquifyBtn) toolLiquifyBtn.classList.remove('active-tool');
                    if (toolSelectBtn) toolSelectBtn.classList.add('active-tool');
                    
                    if (selectOptionsPanel) selectOptionsPanel.classList.remove('hidden');

                    this.eraserTool.onDeactivate(this);
                    this.colorPickTool.onDeactivate(this);
                    this.pencilTool.onDeactivate(this);
                    this.selectionTool.onActivate(this);
                }

                if (toolSelectBtn && toolId !== 'select') {
                    toolSelectBtn.classList.remove('active-tool');
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
            if (toolLiquifyBtn) {
                toolLiquifyBtn.addEventListener('click', function () { setTool('liquify'); });
            }
            if (toolSelectBtn) {
                toolSelectBtn.addEventListener('click', function () { setTool('select'); });
            }

            var setPaintType = (function (type) {
                this.paintType = type;
                if (type === 'bristles') {
                    if (paintBristlesBtn) paintBristlesBtn.classList.add('active-opt');
                    if (paintOilBtn) paintOilBtn.classList.remove('active-opt');
                } else if (type === 'oil') {
                    if (paintBristlesBtn) paintBristlesBtn.classList.remove('active-opt');
                    if (paintOilBtn) paintOilBtn.classList.add('active-opt');
                }
                this.applyToolSettings(this.currentTool);
                this.needsRedraw = true;
            }).bind(this);

            if (paintBristlesBtn) {
                paintBristlesBtn.addEventListener('click', function () { setPaintType('bristles'); });
            }
            if (paintOilBtn) {
                paintOilBtn.addEventListener('click', function () { setPaintType('oil'); });
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
                    if (dryPencilBtn) dryPencilBtn.classList.remove('active-opt');
                } else if (type === 'pencil') {
                    if (dryChalkBtn) dryChalkBtn.classList.remove('active-opt');
                    if (dryPencilBtn) dryPencilBtn.classList.add('active-opt');
                }
                this.applyToolSettings(this.currentTool);
                this.needsRedraw = true;
            }).bind(this);

            if (dryChalkBtn) {
                dryChalkBtn.addEventListener('click', function () { setDryType('chalk'); });
            }
            if (dryPencilBtn) {
                dryPencilBtn.addEventListener('click', function () { setDryType('pencil'); });
            }

            var setLiquifyType = (function (type) {
                this.liquifyType = type;
                var btns = [
                    { id: 'push', el: liquifyPushBtn },
                    { id: 'twirl_cw', el: liquifyTwirlcwBtn },
                    { id: 'twirl_ccw', el: liquifyTwirlccwBtn },
                    { id: 'pinch', el: liquifyPinchBtn },
                    { id: 'bloat', el: liquifyBloatBtn }
                ];
                btns.forEach(function (b) {
                    if (b.el) {
                        if (b.id === type) {
                            b.el.classList.add('active-opt');
                        } else {
                            b.el.classList.remove('active-opt');
                        }
                    }
                });
                this.applyToolSettings(this.currentTool);
                this.needsRedraw = true;
            }).bind(this);

            if (liquifyPushBtn) {
                liquifyPushBtn.addEventListener('click', function () { setLiquifyType('push'); });
            }
            if (liquifyTwirlcwBtn) {
                liquifyTwirlcwBtn.addEventListener('click', function () { setLiquifyType('twirl_cw'); });
            }
            if (liquifyTwirlccwBtn) {
                liquifyTwirlccwBtn.addEventListener('click', function () { setLiquifyType('twirl_ccw'); });
            }
            if (liquifyPinchBtn) {
                liquifyPinchBtn.addEventListener('click', function () { setLiquifyType('pinch'); });
            }
            if (liquifyBloatBtn) {
                liquifyBloatBtn.addEventListener('click', function () { setLiquifyType('bloat'); });
            }

            var setSelectType = (function (type) {
                if (this.selectionTool) {
                    this.selectionTool.selectMode = type;
                }
                if (type === 'rect') {
                    if (selectRectBtn) selectRectBtn.classList.add('active-opt');
                    if (selectFreehandBtn) selectFreehandBtn.classList.remove('active-opt');
                } else if (type === 'lasso') {
                    if (selectRectBtn) selectRectBtn.classList.remove('active-opt');
                    if (selectFreehandBtn) selectFreehandBtn.classList.add('active-opt');
                }
                this.needsRedraw = true;
            }).bind(this);

            if (selectRectBtn) {
                selectRectBtn.addEventListener('click', function () { setSelectType('rect'); });
            }
            if (selectFreehandBtn) {
                selectFreehandBtn.addEventListener('click', function () { setSelectType('lasso'); });
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
                } else if (e.key === '6') {
                    setTool('liquify');
                } else if (e.key === '7') {
                    setTool('select');
                } else if (e.key === 't' || e.key === 'T') {
                    if (this.currentTool === 'select') {
                        this.selectionTool.toggleTransformMode();
                    }
                } else if (e.key === 'Enter') {
                    if (this.currentTool === 'select' && this.selectionTool.isTransformMode) {
                        e.preventDefault();
                        this.selectionTool.commitTransform();
                    }
                }
            }).bind(this));

            var self = this;
            this.loadFromIndexedDB(function (err, state) {
                if (!err && state) {
                    self.applyState(state);
                }

                // Apply current tool settings on startup (this loads from localStorage) and ensure the active sub-panel is shown
                var initialTool = self.currentTool || 'paint';
                self.currentTool = null;
                setTool(initialTool);

                // Initial projects list rendering
                self.refreshProjectsListUI();
            });


            var lastFrameTime = performance.now();
            var frameCount = 0;
            var lastFpsUpdateTime = lastFrameTime;
            var accumulatedFrameTimes = 0;
            var accumulatedFrames = 0;

            var update = (function () {
                var now = performance.now();
                lastFrameTime = now;

                var startExec = performance.now();
                var wasRedrawn = this.needsRedraw;
                this.update();
                var endExec = performance.now();

                frameCount++;
                if (wasRedrawn) {
                    accumulatedFrameTimes += (endExec - startExec);
                    accumulatedFrames++;
                }

                if (now - lastFpsUpdateTime >= 500) {
                    var fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
                    var avgMs = accumulatedFrames > 0 ? (accumulatedFrameTimes / accumulatedFrames).toFixed(1) : "0.0";
                    
                    var fpsElem = document.getElementById('stats-fps');
                    var msElem = document.getElementById('stats-ms');
                    var statusElem = document.getElementById('stats-status');

                    if (fpsElem) {
                        fpsElem.textContent = 'FPS: ' + (wasRedrawn || this.needsRedraw || accumulatedFrames > 0 ? fps : '0');
                    }
                    if (msElem) {
                        msElem.textContent = avgMs + ' ms';
                    }
                    if (statusElem) {
                        if (wasRedrawn || this.needsRedraw || accumulatedFrames > 0) {
                            statusElem.textContent = 'ACTIVE';
                            statusElem.classList.add('active');
                        } else {
                            statusElem.textContent = 'PAUSED';
                            statusElem.classList.remove('active');
                        }
                    }

                    frameCount = 0;
                    accumulatedFrameTimes = 0;
                    accumulatedFrames = 0;
                    lastFpsUpdateTime = now;
                }

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
        var now = performance.now();
        if (this.interactionState !== InteractionMode.NONE || (this.colorPicker && this.colorPicker.isInUse())) {
            this.lastInteractionTime = now;
        }
        var isInteractingOrStabilizing = (now - this.lastInteractionTime < 5000);

        if (!this.needsRedraw && !isInteractingOrStabilizing) {
            return;
        }

        if (isInteractingOrStabilizing) {
            this.needsRedraw = true;
        }

        if (this.updatePickerPosition) {
            this.updatePickerPosition();
        }

        if (this.imgHandler) {
            this.imgHandler.updateAllTransforms();
        }

        if (this.selectionTool) {
            this.selectionTool.update();
        }

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
            if (this.currentTool === 'liquify') {
                if (this.prevBrushX === undefined || this.prevBrushX === null) {
                    this.prevBrushX = this.brushX;
                }
                if (this.prevBrushY === undefined || this.prevBrushY === null) {
                    this.prevBrushY = this.brushY;
                }

                var brushTx = ((this.brushX - this.paintingRectangle.left) / this.paintingRectangle.width) * this.simulator.resolutionWidth;
                var brushTy = ((this.brushY - this.paintingRectangle.bottom) / this.paintingRectangle.height) * this.simulator.resolutionHeight;
                
                var prevBrushTx = ((this.prevBrushX - this.paintingRectangle.left) / this.paintingRectangle.width) * this.simulator.resolutionWidth;
                var prevBrushTy = ((this.prevBrushY - this.paintingRectangle.bottom) / this.paintingRectangle.height) * this.simulator.resolutionHeight;

                var radiusTex = (this.brushHeight * scaledScale * 0.8 / this.paintingRectangle.width) * this.simulator.resolutionWidth;

                // Clamp push distance to maintain continuous, organic, and ultra-smooth fluid deformation
                var dx = brushTx - prevBrushTx;
                var dy = brushTy - prevBrushTy;
                var len = Math.sqrt(dx * dx + dy * dy);
                var maxStep = radiusTex * 0.4;
                if (len > maxStep && maxStep > 0) {
                    brushTx = prevBrushTx + (dx / len) * maxStep;
                    brushTy = prevBrushTy + (dy / len) * maxStep;
                }

                var modeInt = 0;
                if (this.liquifyType === 'push') modeInt = 0;
                else if (this.liquifyType === 'twirl_cw') modeInt = 1;
                else if (this.liquifyType === 'twirl_ccw') modeInt = 2;
                else if (this.liquifyType === 'pinch') modeInt = 3;
                else if (this.liquifyType === 'bloat') modeInt = 4;

                wgl.framebufferTexture2D(this.simulator.simulationFramebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, this.simulator.paintTextureTemp, 0);

                var liquifyDrawState = wgl.createDrawState()
                    .bindFramebuffer(this.simulator.simulationFramebuffer)
                    .viewport(0, 0, this.simulator.resolutionWidth, this.simulator.resolutionHeight)
                    .useProgram(this.liquifyProgram)
                    .vertexAttribPointer(this.quadVertexBuffer, this.liquifyProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
                    .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, this.simulator.paintTexture)
                    .uniform2f('u_resolution', this.simulator.resolutionWidth, this.simulator.resolutionHeight)
                    .uniform2f('u_brushPos', brushTx, brushTy)
                    .uniform2f('u_prevBrushPos', prevBrushTx, prevBrushTy)
                    .uniform1f('u_radius', radiusTex)
                    .uniform1f('u_strength', 0.7)
                    .uniform1i('u_mode', modeInt);

                wgl.drawArrays(liquifyDrawState, wgl.TRIANGLE_STRIP, 0, 4);

                Utilities.swap(this.simulator, 'paintTexture', 'paintTextureTemp');
                
                this.prevBrushX = this.brushX;
                this.prevBrushY = this.brushY;
                this.needsRedraw = true;

            } else if (this.currentTool === 'eraser') {
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
                    if (this.dryType === 'pencil') {
                        splatRadius = SPLAT_RADIUS * scaledScale * 0.15;
                    } else {
                        splatRadius = SPLAT_RADIUS * scaledScale * 0.45;
                    }
                } else if (this.currentTool === 'paint') {
                    if (this.paintType === 'oil') {
                        splatRadius = SPLAT_RADIUS * scaledScale * 1.45;
                    }
                } else if (isSmudge) {
                    if (this.smudgeType === 'blur') {
                        splatRadius = scaledScale * 0.55;
                    } else {
                        splatRadius = SPLAT_RADIUS * scaledScale * 0.20;
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
                    if (this.dryType === 'pencil') {
                        alpha = 0.90 * alphaT;
                    } else {
                        alpha = 0.98 * alphaT;
                    }
                } else if (isSmudge) {
                    alpha = 0.0;
                } else { // 'paint'
                    if (this.paintType === 'oil') {
                        alpha = 0.25 * alphaT;
                    } else {
                        var bristleT = (this.brush.bristleCount - MIN_BRISTLE_COUNT) / (MAX_BRISTLE_COUNT - MIN_BRISTLE_COUNT);
                        var minAlpha = mix(THIN_MIN_ALPHA, THICK_MIN_ALPHA, bristleT);
                        var maxAlpha = mix(THICK_MIN_ALPHA, THICK_MAX_ALPHA, bristleT);
                        alpha = mix(minAlpha, maxAlpha, alphaT);
                    }
                }

                splatColor[3] = alpha * (this.paintHeight !== undefined ? this.paintHeight : 1.0);

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

                var isUnified = (isSmudge && this.smudgeType === 'blur');
                var isRect = false;
                var isRectRotate90 = false;

                //splat paint
                this.simulator.splat(this.brush, threshold, this.paintingRectangle, splatColor, splatRadius, splatVelocityScale, false, isDry, isUnified, isRect, isRectRotate90);
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

            var angleDegrees = this.lightAngle !== undefined ? this.lightAngle : 45;
            var rad = angleDegrees * Math.PI / 180;
            var lx = Math.cos(rad);
            var ly = Math.sin(rad);
            var lz = 1.0;
            var len = Math.sqrt(lx * lx + ly * ly + lz * lz);
            var lightDir = [lx / len, ly / len, lz / len];

            var normalScale = this.normalScale !== undefined ? this.normalScale : NORMAL_SCALE;
            var roughness = this.roughness !== undefined ? this.roughness : ROUGHNESS;
            var specularScale = this.specularScale !== undefined ? this.specularScale : SPECULAR_SCALE;

            var paintingDrawState = wgl.createDrawState()
                .bindFramebuffer(this.framebuffer)
                .vertexAttribPointer(this.quadVertexBuffer, paintingProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
                .useProgram(paintingProgram)
                .uniform1f('u_featherSize', RESIZING_FEATHER_SIZE)

                .uniform1f('u_normalScale', normalScale / this.resolutionScale)
                .uniform1f('u_roughness', roughness)
                .uniform1f('u_diffuseScale', DIFFUSE_SCALE)
                .uniform1f('u_specularScale', specularScale)
                .uniform1f('u_F0', F0)
                .uniform3f('u_lightDirection', lightDir[0], lightDir[1], lightDir[2])

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
        if (this.brushInitialized && !this.altDown && this.currentTool !== 'select' && this.currentTool !== 'colorpick' && this.currentTool !== 'liquify' && !(this.currentTool === 'smudge' && this.smudgeType === 'blur') && (this.interactionState === InteractionMode.PAINTING || !this.colorPicker.isInUse() && this.interactionState === InteractionMode.NONE && this.desiredInteractionMode(this.mouseX, this.mouseY) === InteractionMode.PAINTING)) { 
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

        if (this.currentTool === 'select') {
            desiredCursor = 'crosshair';
        } else if (this.altDown || this.currentTool === 'colorpick') {
            desiredCursor = 'copy';
        } else if (this.colorPicker.isInUse()) {
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
        var cursorLeft = this.isMirrored ? (this.canvas.width - this.mouseX) : this.mouseX;
        var inkCursorElement = document.getElementById('ink-cursor');
        if (inkCursorElement) {
            if (desiredCursor === 'none' && this.currentTool === 'ink') {
                inkCursorElement.classList.remove('hidden');
                inkCursorElement.style.left = cursorLeft + 'px';
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
                blurCursorElement.style.left = cursorLeft + 'px';
                blurCursorElement.style.top = (this.canvas.height - this.mouseY) + 'px';
            } else {
                blurCursorElement.classList.add('hidden');
            }
        }

        // Update custom inverted impasto cursor visibility/position
        var impastoCursorElement = document.getElementById('impasto-cursor');
        if (impastoCursorElement) {
            impastoCursorElement.classList.add('hidden');
        }

        // Update custom inverted liquify cursor visibility/position
        var liquifyCursorElement = document.getElementById('liquify-cursor');
        if (liquifyCursorElement) {
            if (desiredCursor === 'none' && this.currentTool === 'liquify') {
                liquifyCursorElement.classList.remove('hidden');
                var size = 2.0 * this.brushHeight * scaledScale * 0.8;
                liquifyCursorElement.style.width = size + 'px';
                liquifyCursorElement.style.height = size + 'px';
                liquifyCursorElement.style.left = cursorLeft + 'px';
                liquifyCursorElement.style.top = (this.canvas.height - this.mouseY) + 'px';
            } else {
                liquifyCursorElement.classList.add('hidden');
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
        saveSnapshot(this, HISTORY_SIZE);
    };

    Paint.prototype.applySnapshot = function (snapshot) {
        applySnapshot(this, snapshot, QUALITIES);
    };

    Paint.prototype.canUndo = function () {
        return canUndo(this);
    };

    Paint.prototype.canRedo = function () {
        return canRedo(this);
    };

    Paint.prototype.undo = function () {
        undo(this, HISTORY_SIZE, QUALITIES);
    };

    Paint.prototype.redo = function () {
        redo(this, QUALITIES);
    };

    Paint.prototype.refreshDoButtons = function () {
        refreshDoButtons(this);
    };

    Paint.prototype.save = function () {
        var exportWindow = document.getElementById('export-window');
        if (exportWindow) {
            exportWindow.classList.toggle('hidden');
            if (!exportWindow.classList.contains('hidden')) {
                this.updateExportResolutionInfo();
            }
        }
    };

    Paint.prototype.updateExportResolutionInfo = function () {
        var infoEl = document.getElementById('export-resolution-info');
        if (infoEl) {
            var scale = this.exportScale || 1;
            var w = Math.floor(this.paintingRectangle.width * scale);
            var h = Math.floor(this.paintingRectangle.height * scale);
            infoEl.textContent = 'Size: ' + w + ' x ' + h + ' px';
        }
    };

    Paint.prototype.performExport = function () {
        var wgl = this.wgl;

        var scale = this.exportScale || 1;
        var saveWidth = Math.floor(this.paintingRectangle.width * scale);
        var saveHeight = Math.floor(this.paintingRectangle.height * scale);

        var saveTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, saveWidth, saveHeight, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.NEAREST, wgl.NEAREST);

        var saveFramebuffer = wgl.createFramebuffer();
        wgl.framebufferTexture2D(saveFramebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, saveTexture, 0);

        var paintingProgram = this.colorModel === ColorModel.RYB ? this.savePaintingProgram : this.savePaintingProgramRGB;

        var angleDegrees = this.lightAngle !== undefined ? this.lightAngle : 45;
        var rad = angleDegrees * Math.PI / 180;
        var lx = Math.cos(rad);
        var ly = Math.sin(rad);
        var lz = 1.0;
        var len = Math.sqrt(lx * lx + ly * ly + lz * lz);
        var lightDirection = [lx / len, ly / len, lz / len];

        var normalScale = this.normalScale !== undefined ? this.normalScale : NORMAL_SCALE;
        var roughness = this.roughness !== undefined ? this.roughness : ROUGHNESS;
        var specularScale = this.specularScale !== undefined ? this.specularScale : SPECULAR_SCALE;

        var saveDrawState = wgl.createDrawState()
            .bindFramebuffer(saveFramebuffer)
            .viewport(0, 0, saveWidth, saveHeight)
            .vertexAttribPointer(this.quadVertexBuffer, paintingProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
            .useProgram(paintingProgram)
            .uniform2f('u_paintingSize', this.paintingRectangle.width, this.paintingRectangle.height)
            .uniform2f('u_paintingResolution', this.simulator.resolutionWidth, this.simulator.resolutionHeight)
            .uniform2f('u_screenResolution', this.paintingRectangle.width * scale, this.paintingRectangle.height * scale)
            .uniform2f('u_paintingPosition', 0, 0)
            .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, this.simulator.paintTexture)
            .uniform1f('u_mirror', 0.0)

            .uniform1f('u_normalScale', normalScale / this.resolutionScale)
            .uniform1f('u_roughness', roughness)
            .uniform1f('u_diffuseScale', DIFFUSE_SCALE)
            .uniform1f('u_specularScale', specularScale)
            .uniform1f('u_F0', F0)
            .uniform3f('u_lightDirection', lightDirection[0], lightDirection[1], lightDirection[2]);

        wgl.drawArrays(saveDrawState, wgl.TRIANGLE_STRIP, 0, 4);

        var savePixels = new Uint8Array(saveWidth * saveHeight * 4);
        wgl.readPixels(wgl.createReadState().bindFramebuffer(saveFramebuffer),
                        0, 0, saveWidth, saveHeight, wgl.RGBA, wgl.UNSIGNED_BYTE, savePixels);

        wgl.deleteTexture(saveTexture);
        wgl.deleteFramebuffer(saveFramebuffer);

        var saveCanvas = document.createElement('canvas');
        saveCanvas.width = saveWidth;
        saveCanvas.height = saveHeight;
        var saveContext = saveCanvas.getContext('2d');

        var imageData = saveContext.createImageData(saveWidth, saveHeight);
        imageData.data.set(savePixels);
        saveContext.putImageData(imageData, 0, 0);

        var filenameInput = document.getElementById('export-filename');
        var filename = (filenameInput && filenameInput.value.trim()) ? filenameInput.value.trim() : 'painting';
        var ext = this.exportFormat === 'jpg' ? 'jpg' : 'png';
        var mime = this.exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';

        var link = document.createElement('a');
        link.download = filename + '.' + ext;
        if (this.exportFormat === 'jpg') {
            link.href = saveCanvas.toDataURL(mime, this.exportJpegQuality);
        } else {
            link.href = saveCanvas.toDataURL(mime);
        }
        link.click();
    };

    Paint.prototype.toggleMirror = function () {
        if (this.currentTool === 'select' && this.selectionTool && this.selectionTool.isTransformMode) {
            this.selectionTool.transformState.scaleX = -this.selectionTool.transformState.scaleX;
            this.selectionTool.updateDOMTransformBox();
            this.needsRedraw = true;
            return;
        }
        this.isMirrored = !this.isMirrored;
        if (this.canvas) {
            this.canvas.classList.toggle('mirrored', this.isMirrored);
        }
        this.needsRedraw = true;
    };

    Paint.prototype.onMouseMove = function (event) {
        this.recordInteraction();
        if (event.preventDefault) event.preventDefault();

        var position = Utilities.getMousePosition(event, this.canvas);

        var mouseX = position.x;
        var mouseY = this.canvas.height - position.y;

        this.brushX = mouseX;
        this.brushY = mouseY;

        this.needsRedraw = true;

        if (this.currentTool === 'select' && this.interactionState !== InteractionMode.PANNING && this.interactionState !== InteractionMode.ZOOMING) {
            this.selectionTool.handleMouseMove(mouseX, mouseY);
            return;
        }

        if (!this.brushInitialized) {
            var initScale = this.brushScale * (this.zoomLevel || 1.0);
            this.brush.initialize(this.brushX, this.brushY, this.brushHeight * initScale, initScale);

            this.brushInitialized = true;
        }

        if (this.interactionState === InteractionMode.PICKING) {
            var nowTime = Date.now();
            if (!this.lastPickTime || nowTime - this.lastPickTime > 30) {
                this.lastPickTime = nowTime;
                if (this.imgHandler) {
                    var clientX = event.clientX;
                    var clientY = event.clientY;
                    if (clientX !== undefined && clientY !== undefined) {
                        if (this.imgHandler.trySampleColor(clientX, clientY)) {
                            return;
                        }
                    }
                }
                this.colorPickTool.pickColor(this, mouseX, mouseY);
            }
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

    Paint.prototype.recordInteraction = function () {
        this.lastInteractionTime = performance.now();
        this.needsRedraw = true;
    };

    Paint.prototype.clearUIRectsCache = function () {
        this._cachedUIRects = null;
        this._cachedUIRectsTime = 0;
    };

    Paint.prototype.getUIBoundingRect = function (id) {
        if (!this._cachedUIRects) {
            this._cachedUIRects = {};
            this._cachedUIRectsTime = 0;
        }
        var now = performance.now();
        if (now - this._cachedUIRectsTime > 150 || !this._cachedUIRects[id]) {
            var elem = document.getElementById(id);
            if (elem) {
                var r = elem.getBoundingClientRect();
                this._cachedUIRects[id] = {
                    left: r.left,
                    right: r.right,
                    top: r.top,
                    bottom: r.bottom,
                    width: r.width,
                    height: r.height
                };
            } else {
                this._cachedUIRects[id] = null;
            }
            if (id === 'color-palette-window' || Object.keys(this._cachedUIRects).length >= 4) {
                this._cachedUIRectsTime = now;
            }
        }
        return this._cachedUIRects[id];
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
        var paletteRect = this.getUIBoundingRect('color-palette-window');
        if (!isOverUI && paletteRect) {
            if (screenX >= paletteRect.left && screenX <= paletteRect.right && screenY >= paletteRect.top && screenY <= paletteRect.bottom) {
                // Ignore the WebGL picker target slot itself so drawing/picking in it works!
                var tRect = this.getUIBoundingRect('color-picker-target');
                if (tRect) {
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
            var rect = this.getUIBoundingRect('settings-window');
            if (rect && screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
                isOverUI = true;
            }
        }

        // 4. Is over viewport window?
        var viewportRect = this.getUIBoundingRect('viewport-window');
        if (!isOverUI && viewportRect) {
            if (screenX >= viewportRect.left && screenX <= viewportRect.right && screenY >= viewportRect.top && screenY <= viewportRect.bottom) {
                isOverUI = true;
            }
        }

        var limitLeft = this.resizeModeActive ? (this.paintingRectangle.left - RESIZING_RADIUS) : this.paintingRectangle.left;
        var limitRight = this.resizeModeActive ? (this.paintingRectangle.left + this.paintingRectangle.width + RESIZING_RADIUS) : (this.paintingRectangle.left + this.paintingRectangle.width);
        var limitBottom = this.resizeModeActive ? (this.paintingRectangle.bottom - RESIZING_RADIUS) : this.paintingRectangle.bottom;
        var limitTop = this.resizeModeActive ? (this.paintingRectangle.bottom + this.paintingRectangle.height + RESIZING_RADIUS) : (this.paintingRectangle.bottom + this.paintingRectangle.height);

        var isOutsideCanvas = this.mouseX < limitLeft || this.mouseX > limitRight || this.mouseY < limitBottom || this.mouseY > limitTop;

        if (isOverUI) {
            return InteractionMode.NONE;
        } else if (this.zDown) {
            return InteractionMode.ZOOMING;
        } else if (this.spaceDown) {
            return InteractionMode.PANNING;
        } else if (isOutsideCanvas) {
            return InteractionMode.NONE;
        } else if (this.resizeModeActive && this.getResizingSide(mouseX, mouseY) !== ResizingSide.NONE) {
            return InteractionMode.RESIZING;
        } else {
            return InteractionMode.PAINTING;
        }
    };

    Paint.prototype.onMouseDown = function (event) {
        this.recordInteraction();
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

        if (isMiddleClick) {
            this.interactionState = InteractionMode.PANNING;
            return;
        }

        if (this.currentTool === 'select' && !this.spaceDown) {
            this.selectionTool.handleMouseDown(mouseX, mouseY);
            return;
        }

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

        this.needsRedraw = true;

        if (isMiddleClick) {
            this.interactionState = InteractionMode.PANNING;
            return;
        }

        if (isLeftClick && (this.altDown || this.currentTool === 'colorpick')) {
            this.interactionState = InteractionMode.PICKING;
            if (this.imgHandler) {
                var clientX = event.clientX;
                var clientY = event.clientY;
                if (clientX !== undefined && clientY !== undefined) {
                    if (this.imgHandler.trySampleColor(clientX, clientY)) {
                        return;
                    }
                }
            }
            this.colorPickTool.pickColor(this, mouseX, mouseY);
            return;
        }

        var isOverTarget = false;
        var tRect = this.getUIBoundingRect('color-picker-target');
        if (tRect) {
            isOverTarget = (event.clientX >= tRect.left && event.clientX <= tRect.right &&
                            event.clientY >= tRect.top && event.clientY <= tRect.bottom);
        }
        if (isOverTarget) {
            return;
        }

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
    };

    Paint.prototype.onMouseUp = function (event) {
        this.recordInteraction();
        if (event.preventDefault) event.preventDefault();

        if (this.currentTool === 'select' && this.interactionState !== InteractionMode.PANNING && this.interactionState !== InteractionMode.ZOOMING) {
            this.selectionTool.handleMouseUp();
            return;
        }

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
        this.prevBrushX = null;
        this.prevBrushY = null;
        this.needsRedraw = true;
        this.scheduleDebouncedSave(3000);
    };

    Paint.prototype.onMouseOver = function (event) {
        if (event.preventDefault) event.preventDefault();

        var position = Utilities.getMousePosition(event, this.canvas);

        var mouseX = position.x;
        var mouseY = this.canvas.height - position.y;

        this.brushX = mouseX;
        this.brushY = mouseY;

        this.needsRedraw = true;

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

    Paint.prototype.getCurrentSettingsKey = function (toolId) {
        return getCurrentSettingsKey(this, toolId);
    };

    Paint.prototype.getToolSettings = function (toolId) {
        return getToolSettings(this, toolId);
    };

    Paint.prototype.saveToolSettings = function (toolId, settings) {
        saveToolSettings(this, toolId, settings);
    };

    Paint.prototype.updateCurrentToolSetting = function (key, value) {
        updateCurrentToolSetting(this, key, value);
    };

    Paint.prototype.applyToolSettings = function (toolId) {
        applyToolSettings(this, toolId, MIN_BRUSH_SCALE, MAX_BRUSH_SCALE, MIN_BRISTLE_COUNT, MAX_BRISTLE_COUNT, Utilities);
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
        scheduleDebouncedSave(this, delayMs);
    };

    Paint.prototype.saveToIndexedDB = function () {
        saveToIndexedDB(this);
    };

    Paint.prototype.loadFromIndexedDB = function (callback) {
        loadFromIndexedDB(this, callback);
    };

    Paint.prototype.applyState = function (state) {
        var self = this;
        var wgl = this.wgl;

        self.logicalWidth = state.logicalWidth !== undefined ? state.logicalWidth : state.width / state.resolutionScale;
        self.logicalHeight = state.logicalHeight !== undefined ? state.logicalHeight : state.height / state.resolutionScale;
        self.zoomLevel = state.zoomLevel !== undefined ? state.zoomLevel : 1.0;
        self.resolutionScale = state.resolutionScale !== undefined ? state.resolutionScale : self.resolutionScale;
        self.colorModel = state.colorModel !== undefined ? state.colorModel : self.colorModel;

        if (state.normalScale !== undefined) {
            self.normalScale = state.normalScale;
            var input = document.getElementById('global-normal-scale');
            var val = document.getElementById('val-global-normal-scale');
            if (input && val) {
                input.value = self.normalScale;
                val.textContent = self.normalScale.toFixed(1);
            }
        }
        if (state.roughness !== undefined) {
            self.roughness = state.roughness;
            var input = document.getElementById('global-roughness');
            var val = document.getElementById('val-global-roughness');
            if (input && val) {
                input.value = self.roughness;
                val.textContent = self.roughness.toFixed(2);
            }
        }
        if (state.specularScale !== undefined) {
            self.specularScale = state.specularScale;
            var input = document.getElementById('global-specular');
            var val = document.getElementById('val-global-specular');
            if (input && val) {
                input.value = self.specularScale;
                val.textContent = self.specularScale.toFixed(2);
            }
        }
        if (state.lightAngle !== undefined) {
            self.lightAngle = state.lightAngle;
            var input = document.getElementById('global-light-angle');
            var val = document.getElementById('val-global-light-angle');
            if (input && val) {
                input.value = self.lightAngle;
                val.textContent = self.lightAngle + '°';
            }
        }

        self.paintingRectangle = new Rectangle(
            state.paintingLeft !== undefined ? state.paintingLeft : self.paintingRectangle.left,
            state.paintingBottom !== undefined ? state.paintingBottom : self.paintingRectangle.bottom,
            state.paintingWidth !== undefined ? state.paintingWidth : self.logicalWidth * self.zoomLevel,
            state.paintingHeight !== undefined ? state.paintingHeight : self.logicalHeight * self.zoomLevel
        );

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
            self.simulator.changeResolution(state.width, state.height);
            self.setPaintTextureData(state.pixels, state.width, state.height);

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
        self.needsRedraw = true;
    };

    Paint.prototype.refreshProjectsListUI = function () {
        var self = this;
        getProjectsList(function (err, list) {
            if (err) {
                console.error(err);
                return;
            }
            self.projectsList = list;
            var container = document.getElementById('projects-list-container');
            if (!container) return;
            container.innerHTML = '';

            list.sort(function (a, b) {
                return (b.lastSaved || 0) - (a.lastSaved || 0);
            });

            list.forEach(function (proj) {
                var row = document.createElement('div');
                row.className = 'project-row';
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.padding = '6px';
                row.style.border = '2px solid #000';
                row.style.background = (proj.id === self.activeProjectId) ? '#e6f3ff' : '#fff';
                row.style.fontFamily = "'JetBrains Mono', monospace";
                row.style.fontSize = '11px';

                var nameSpan = document.createElement('span');
                nameSpan.textContent = proj.name;
                nameSpan.style.fontWeight = 'bold';
                nameSpan.style.flex = '1';
                nameSpan.style.overflow = 'hidden';
                nameSpan.style.textOverflow = 'ellipsis';
                nameSpan.style.whiteSpace = 'nowrap';
                nameSpan.style.marginRight = '8px';

                var dateSpan = document.createElement('span');
                dateSpan.style.fontSize = '9px';
                dateSpan.style.color = '#555';
                dateSpan.style.marginRight = '8px';
                var date = new Date(proj.lastSaved || Date.now());
                dateSpan.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                var sizeSpan = document.createElement('span');
                sizeSpan.style.fontSize = '9px';
                sizeSpan.style.color = '#666';
                sizeSpan.style.marginRight = '8px';
                sizeSpan.style.fontStyle = 'italic';
                sizeSpan.textContent = '...';

                calculateProjectStorageUsage(proj.id, function (err, bytes) {
                    if (err || bytes === null || bytes === undefined) {
                        sizeSpan.textContent = '0 B';
                    } else {
                        if (bytes === 0) {
                            sizeSpan.textContent = '0 B';
                        } else {
                            var k = 1024;
                            var sizes = ['B', 'KB', 'MB', 'GB'];
                            var i = Math.floor(Math.log(bytes) / Math.log(k));
                            sizeSpan.textContent = parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                        }
                    }
                });

                var btnGroup = document.createElement('div');
                btnGroup.style.display = 'flex';
                btnGroup.style.gap = '4px';

                if (proj.id !== self.activeProjectId) {
                    var loadBtn = document.createElement('button');
                    loadBtn.className = 'button';
                    loadBtn.style.padding = '2px 6px';
                    loadBtn.style.fontSize = '9px';
                    loadBtn.style.fontWeight = 'bold';
                    loadBtn.textContent = 'LOAD';
                    loadBtn.onclick = function (e) {
                        e.stopPropagation();
                        self.switchProject(proj.id);
                    };
                    btnGroup.appendChild(loadBtn);

                    var deleteBtn = document.createElement('button');
                    deleteBtn.className = 'button';
                    deleteBtn.style.padding = '2px 6px';
                    deleteBtn.style.fontSize = '9px';
                    deleteBtn.style.fontWeight = 'bold';
                    deleteBtn.style.backgroundColor = '#ffcccc';
                    deleteBtn.textContent = 'DEL';
                    deleteBtn.onclick = function (e) {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete project "' + proj.name + '"?')) {
                            self.deleteProject(proj.id);
                        }
                    };
                    btnGroup.appendChild(deleteBtn);
                } else {
                    var activeBadge = document.createElement('span');
                    activeBadge.style.fontWeight = 'bold';
                    activeBadge.style.color = '#00aa00';
                    activeBadge.style.fontSize = '9px';
                    activeBadge.textContent = 'ACTIVE';
                    btnGroup.appendChild(activeBadge);
                }

                row.appendChild(nameSpan);
                row.appendChild(dateSpan);
                row.appendChild(sizeSpan);
                row.appendChild(btnGroup);
                container.appendChild(row);
            });
        });
    };

    Paint.prototype.switchProject = function (projectId) {
        var self = this;
        self.saveToIndexedDB();
        
        self.activeProjectId = projectId;
        localStorage.setItem('fluidpaint_active_project', projectId);

        if (self.imgHandler) {
            self.imgHandler.images.forEach(function (img) {
                img.destroy();
            });
            self.imgHandler.images = [];
            self.imgHandler.selectedImage = null;
            var listItems = document.getElementById('ref-images-items');
            if (listItems) listItems.innerHTML = '';
            var clearBtn = document.getElementById('ref-clear-btn');
            if (clearBtn) clearBtn.style.display = 'none';
            var listHeader = document.getElementById('ref-images-list');
            if (listHeader) listHeader.style.display = 'none';
        }

        self.loadFromIndexedDB(function (err, state) {
            if (!err && state) {
                self.applyState(state);
            } else {
                self.simulator.clear();
                self.onResize();
                self.needsRedraw = true;
            }
            
            if (self.imgHandler) {
                self.imgHandler.loadImagesFromProject(projectId);
            }

            self.refreshProjectsListUI();
        });
    };

    Paint.prototype.deleteProject = function (projectId) {
        var self = this;
        deleteProjectFromIndexedDB(projectId, function (err) {
            if (err) {
                console.error(err);
                return;
            }
            getProjectsList(function (e, list) {
                if (!e && list) {
                    var filtered = list.filter(function (p) { return p.id !== projectId; });
                    saveProjectsList(filtered, function () {
                        self.refreshProjectsListUI();
                    });
                }
            });
        });
    };

    Paint.prototype.createNewProject = function (name) {
        var self = this;
        if (!name || !name.trim()) return;
        name = name.trim();

        getProjectsList(function (err, list) {
            if (err) {
                console.error(err);
                return;
            }
            var newId = 'proj_' + Date.now();
            var newProj = {
                id: newId,
                name: name,
                lastSaved: Date.now()
            };
            list.push(newProj);
            saveProjectsList(list, function (e) {
                if (!e) {
                    var input = document.getElementById('new-project-name');
                    if (input) input.value = '';
                    self.switchProject(newId);
                }
            });
        });
    };

    return Paint;
}());

window.Paint = Paint;
export { Paint };
