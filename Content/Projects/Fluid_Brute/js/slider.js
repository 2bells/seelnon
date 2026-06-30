var Slider = (function () {
    'use strict';

    var SLIDER_THICKNESS = 2;
    var LEFT_COLOR = 'white';
    var RIGHT_COLOR = '#666666';
    var HANDLE_COLOR = 'white';

    function Slider (element, initialValue, minValue, maxValue, changeCallback) {
        var div = element;

        var height = element.clientHeight || 8;
        var length = element.clientWidth || 96;

        var sliderLeftDiv = document.createElement('div');
        sliderLeftDiv.style.position = 'absolute';
        sliderLeftDiv.style.width = '0px';
        sliderLeftDiv.style.height = '100%';
        sliderLeftDiv.style.backgroundColor = '#000000';
        sliderLeftDiv.style.top = '0px';
        sliderLeftDiv.style.zIndex = 999;
        div.appendChild(sliderLeftDiv);

        var sliderRightDiv = document.createElement('div');
        sliderRightDiv.style.position = 'absolute';
        sliderRightDiv.style.width = '0px';
        sliderRightDiv.style.height = '100%';
        sliderRightDiv.style.backgroundColor = '#f4f4f5';
        sliderRightDiv.style.top = '0px';

        div.appendChild(sliderRightDiv);

        var handleDiv = document.createElement('div');
        handleDiv.style.position = 'absolute';
        handleDiv.style.width = '12px';
        handleDiv.style.height = '24px';
        handleDiv.style.borderRadius = '0px';
        handleDiv.style.border = '2px solid #000000';
        handleDiv.style.cursor = 'ew-resize';
        handleDiv.style.background = '#ffffff';
        handleDiv.style.top = Math.floor((height - 24) / 2) + 'px';
        handleDiv.style.boxShadow = '1px 1px 0px #000000';
        handleDiv.style.zIndex = 1000;
        div.appendChild(handleDiv);

        var value = initialValue; 

        var redraw = function () {
            var currentLength = element.clientWidth || length || 96;
            var fraction = (value - minValue) / (maxValue - minValue);

            sliderLeftDiv.style.width = fraction * currentLength + 'px';
            sliderRightDiv.style.width = (1.0 - fraction) * currentLength + 'px';
            sliderRightDiv.style.left = Math.floor(fraction * currentLength) + 'px';
            handleDiv.style.left = (Math.floor(fraction * currentLength) - 6) + 'px';
        };

        var onChange = function (event) {
            var currentLength = element.clientWidth || length || 96;
            var mouseX = Utilities.getMousePosition(event, div).x;

            value = Utilities.clamp((mouseX / currentLength) * (maxValue - minValue) + minValue, minValue, maxValue);

            changeCallback(value);

            redraw();
        };

        var mousePressed = false;

        div.addEventListener('mousedown', function (event) {
            mousePressed = true;
            onChange(event);
        });

        document.addEventListener('mouseup', function (event) {
            mousePressed = false;
        });

        document.addEventListener('mousemove', function (event) {
            if (mousePressed) {
                onChange(event);
            }
        });

        div.addEventListener('touchstart', function (event) {
            event.preventDefault();

            var firstTouch = event.targetTouches[0];
            onChange(firstTouch);
        });

        div.addEventListener('touchmove', function (event) {
            event.preventDefault();

            var firstTouch = event.targetTouches[0];
            onChange(firstTouch);
        });

        this.setValue = function (newValue) {
            value = newValue;

            redraw();
        };

        this.setMinMax = function (newMin, newMax) {
            minValue = newMin;
            maxValue = newMax;
            redraw();
        };

        this.redraw = function () {
            redraw();
        };

        this.getValue = function () {
            return value;
        };

        redraw();
    }

    return Slider;

}());
