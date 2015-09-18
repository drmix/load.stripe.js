/*!
 * load.stripe.js - ajax animation tool
 * https://github.com/drmix/load.stripe.js
 *
 * Copyright 2015 Danil Valgushev
 * Released under the MIT license
 */



(function(window, $) {

    var optionsDefault = {
        gaussWeight: 0.6,
        gaussWidth: 0.05,
        gaussStop: 2/3,
        gaussTimeMove: 500,
        gaussTimeVanish: 200,

        rectRandom: 1,
        rectWidth: 80,
        rectInterval: 800,
        rectTimeMove: 1500,
        rectSlowdown: 5,
        rectEnable: 1,

        backgroundColor: "#1751af",
        rectColor: "#FFFFFF"
    };

    var attrToOptions = {
        "lsj-gauss-weight": ["gaussWeight", "num"],
        "lsj-gauss-width": ["gaussWidth", "num"],
        "lsj-gauss-stop": ["gaussStop", "num"],
        "lsj-gauss-time-move": ["gaussTimeMove", "num"],
        "lsj-gauss-time-vanish": ["gaussTimeVanish", "num"],
        "lsj-rect-random": ["rectRandom", "num"],
        "lsj-rect-width": ["rectWidth", "num"],
        "lsj-rect-interval": ["rectInterval", "num"],
        "lsj-rect-time-move": ["rectTimeMove", "num"],
        "lsj-rect-slowdown": ["rectSlowdown", "num"],
        "lsj-rect-enable": ["rectEnable", "num"],
        "lsj-background-color": ["backgroundColor", "str"],
        "lsj-rect-color": ["rectColor", "str"]
    };


    var S_OFF = 0,
        S_ACTIVE = 1,
        S_VANISH = 2;


    var requestFrame = window.requestAnimationFrame ||
                       window.webkitRequestAnimationFrame ||
                       window.mozRequestAnimationFrame ||
                       window.oRequestAnimationFrame ||
                       window.msRequestAnimationFrame ||
                       function(callback) {
                           setTimeout(function() { callback(new Date().getTime()); }, 1000/60 );
                       };


    var cache_canvas = null,
        cache_ctx = null;

    var compileColor = function(color) {
        if (cache_ctx === null) {
            cache_canvas = document.createElement('canvas');
            cache_canvas.width = 1;
            cache_canvas.height = 1;
            cache_ctx = cache_canvas.getContext('2d');
        }

        cache_ctx.fillStyle = color;
        cache_ctx.clearRect(0, 0, 1, 1);
        cache_ctx.fillRect(0, 0, 1, 1);

        var data = cache_ctx.getImageData(0, 0, 1, 1);
        return data
    }


    var Animator = function(ctx, options) {
        this.options = $.extend({}, optionsDefault, options || {});

        this.ctx = ctx;
        this.height = ctx.canvas.height;
        this.width = ctx.canvas.width;

        this.reset();
    };

    Animator.prototype.reset = function() {
        var o = this.options;

        this.state = S_OFF;
        this.timeStart = null;
        this.rectSeed = o.rectRandom ? Math.round(o.rectInterval * Math.random()) : 0;

        this.dtLast = 0;
        this.peakLast = 0;

        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    };

    Animator.prototype.calcStripe = function(dt) {
        var o = this.options;

        var stripe = new Array(this.width);

        var peak = (this.state == S_ACTIVE)
                   ? (1 - Math.exp(-Math.abs(dt) / o.gaussTimeMove)) * o.gaussStop * this.width
                   : this.peakLast + ((1 + o.gaussWidth) * this.width - this.peakLast) * (dt - this.dtLast) / o.gaussTimeVanish;

        if (this.state == S_ACTIVE) {
            this.peakLast = peak;
        }

        for (var i = 0; i < this.width; i++) {
            var x = i + 1;
            var dx = x - peak;

            var value = (1 - o.gaussWeight) + o.gaussWeight * Math.exp(-(dx * dx) / (2 * this.width * this.width * o.gaussWidth * o.gaussWidth));
            stripe[i] = value;
        }
        return stripe;
    };

    Animator.prototype.drawBackground = function(stripe) {
        var o = this.options,
            ctx = this.ctx,
            width = this.width,
            height = this.height,
            len = stripe.length;

        var data = this._getCachedImageData(o.backgroundColor),
            pos = 0;

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < len; x++) {
                var alpha = Math.floor(stripe[x] * 255);
                data.data[pos + 3] = alpha;
                pos += 4;
            }
        }

        ctx.putImageData(data, 0, 0);
    };


    Animator.prototype._getCachedImageData = function(color) {
        if (this._cache_image_data && this._cache_image_data[0] === color) {
            return this._cache_image_data[1];
        }

        var width = this.width,
            height = this.height,
            data = this.ctx.createImageData(width, height),
            sample = compileColor(color),
            pos = 0;

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                for (var i = 0; i < 4; i++) {
                    data.data[pos + i] = sample[i];
                }
                pos += 4;
            }
        }

        this._cache_image_data = [color, data]

        return data
    }

    Animator.prototype.drawRectangles = function(dt, stripe) {
        if (!this.options.rectEnable) {
            return;
        }

        var o = this.options,
            ctx = this.ctx,
            width = stripe.length,
            height = ctx.canvas.height,
            rects = [];

        // rectangles move non-linearly
        var transform_map = [];
        var transform_sum = 0;
        for (var i = 0; i < width; i++) {
            transform_map[i] = i + o.rectSlowdown * transform_sum;
            transform_sum += stripe[i]
        }

        var widthTransformed = width + transform_sum * o.rectSlowdown,
            speed = widthTransformed / o.rectTimeMove;

        for (var i = ((dt + this.rectSeed) % o.rectInterval) * speed - (o.rectWidth / 2); i < (widthTransformed + o.rectWidth); i += o.rectInterval * speed) {
            rects.push(Math.round(i));
        }

        if (rects.length < 1) {
            return;
        }

        ctx.fillStyle = o.rectColor;

        var last = 0;
        for (var i = 0, rlen = rects.length; i + 1 < width && last < rlen; i++) {
            var x1 = transform_map[i],
                x2 = transform_map[i + 1],
                x = rects[last];

            while (x < x1 && last + 1 < rlen) {
                last++;
                x = rects[last];
            }

            if (x1 <= x && x < x2) {
                var xReal = i + ((x - x1) / (x2 - x1));
                var widthReal = o.rectWidth / (1 + o.rectSlowdown * (x2 - x1));
                ctx.fillRect(xReal - (widthReal / 2), 0, widthReal, height);

                while (rects[last] < x2 && last < rects.length) {
                    last++;
                }
            }
        }
    };

    Animator.prototype.draw = function(dt) {
        var ctx = this.ctx,
            height = ctx.canvas.height,
            width = ctx.canvas.width;

        var stripe = this.calcStripe(dt);

        this.drawBackground(stripe);
        this.drawRectangles(dt, stripe);
    };

    Animator.prototype.start = function() {
        if (this.state == S_ACTIVE) {
            return;
        }
        this.reset();
        this.state = S_ACTIVE;

        var o = this.options,
            self = this;


        var handler = function(time) {
            if (typeof time === "undefined" || self._handler !== handler) {
                return;
            }

            if (self.timeStart === null || time < self.timeStart) {
                self.timeStart = time;
            }
            var dt = time - self.timeStart;

            if (self.state == S_OFF || (self.state == S_VANISH && dt > (self.dtLast + o.gaussTimeVanish))) {
                self.reset();
                return;
            }
            if (self.state == S_ACTIVE) {
                self.dtLast = dt;
            }

            self.draw(dt);

            requestFrame(handler);
        }
        self._handler = handler;

        requestFrame(handler);
    };

    Animator.prototype.stop = function() {
        if (this.state == S_ACTIVE) {
            this.state = S_VANISH;
        }
    };

    Animator.prototype.updateOptions = function(options) {
        this.options = $.extend(this.options, options);
    };



    var animations = [];

    var parseAttributes = function(element) {
        var options = {},
            $element = $(element);

        $.each(attrToOptions, function(field, descr) {
            var val = $element.attr(field);
            if (typeof val === "undefined") {
                return;
            }

            if (descr[1] == "num") {
                val = parseFloat(val);
            }

            options[descr[0]] = val;
        });

        return options;
    }

    var getAnimator = function(element) {
        var animator = null;
        for (var i = 0; i < animations.length; i++) {
            if (animations[i][0] === element) {
                animator = animations[i][1];
                break;
            }
        }
        if (animator === null && element && element.getContext) {
            var ctx = element.getContext('2d');
            if (ctx) {
                var options = parseAttributes(element);
                animator = new Animator(ctx, options);
                animations.push([element, animator]);
            }
        }
        return animator;
    }

    var removeAnimator = function(element) {
        var index = -1;
        for (var i = 0; i < animations.length; i++) {
            if (animations[i][0] === element) {
                index = i;
                break;
            }
        }
        if (index > -1) {
            animations.splice(index, 1);
        }
    }

    if (typeof $ !== "undefined" && $.fn) {
        $.fn.loadStripeJs = function(data) {
            this.filter("canvas").each(function(i, v) {
                var animator = getAnimator(v);
                if (animator === null) {
                    return;
                }

                if ("start" == data) {
                    animator.start();
                } else if ("reset" == data) {
                    animator.reset();
                } else if ("remove" == data) {
                    animator.reset();
                    removeAnimator(v);
                } else if ("stop" == data) {
                    animator.stop();
                }

                if (typeof data !== "string") {
                    animator.updateOptions(data);
                }
            });
            return this;
        };
    }

})(window, jQuery);


