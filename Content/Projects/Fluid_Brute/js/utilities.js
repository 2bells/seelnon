var Utilities = (function () {
    'use strict';

    return {
        swap: function (object, a, b) {
            var temp = object[a];
            object[a] = object[b];
            object[b] = temp;
        },

        clamp: function (x, min, max) {
            return Math.max(min, Math.min(max, x));
        },

        getMousePosition: function (event, element) {
            var boundingRect;
            var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (element && element._cachedRect && (now - element._cachedRectTime < 100)) {
                boundingRect = element._cachedRect;
            } else {
                var r = element ? element.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
                boundingRect = {
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    height: r.height
                };
                if (element) {
                    element._cachedRect = boundingRect;
                    element._cachedRectTime = now;
                }
            }
            var x = event.clientX - boundingRect.left;
            var y = event.clientY - boundingRect.top;
            if (element && element.classList && element.classList.contains('mirrored')) {
                x = boundingRect.width - x;
            }
            return {
                x: x,
                y: y
            };
        }
    };
}());
