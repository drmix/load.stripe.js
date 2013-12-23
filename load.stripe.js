/*!
 * load.stripe.js - ajax animation tool
 * https://github.com/drmix/load.stripe.js
 *
 * Copyright 2013 Danil Valgushev
 * Released under the MIT license
 *
 * Date: 2013-12-23
 */



var StripeLoader = function(ctx, options) {
    var self = this;

    var _default_options = {
        gauss_weight: 0.6,
        gauss_width: 0.05,
        gauss_stop: 2/3,
        gauss_move_time: 500,
        gauss_vanish_time: 200,

        rect_random: 1,
        rect_width: 15,
        rect_interval: 800,
        rect_period: 700,
        rect_alpha: 1,
        rect_slowdown_weight: 5,

        color: [18, 61, 132]
    };


    options = jQuery.extend(_default_options, options);


    var gauss_weight = options['gauss_weight'];
    var gauss_width = options['gauss_width'];
    var gauss_stop = options['gauss_stop'];
    var gauss_move_time = options['gauss_move_time'];
    var gauss_vanish_time = options['gauss_vanish_time'];

    var rect_random = options['rect_random'];
    var rect_width = options['rect_width'];
    var rect_interval = options['rect_interval'];
    var rect_period = options['rect_period'];
    var rect_alpha = options['rect_alpha'];
    var rect_slowdown_weight = options['rect_slowdown_weight'];

    var color = options['color'];



    var _gauss_vanish_pos = 0;
    var _gauss_vanish_begin_time;

    /*
     * Generate moving gaussian stripe
     */
    var getStripe = function(width, time, vanish) {
        var stripe = [];
        var stop_point = vanish
                         ? _gauss_vanish_pos + ((1 + gauss_width) * width - _gauss_vanish_pos) * (time - _gauss_vanish_begin_time) / gauss_vanish_time
                         : Math.round((1 - Math.exp(-time / gauss_move_time)) * gauss_stop * width);

        if (!vanish) {
            _gauss_vanish_begin_time = time;
            _gauss_vanish_pos = stop_point;
        }

        for (var i = 0; i < width; i++) {
            var x = i + 1;
            var dx = x - stop_point;

            var gauss_w = dx > 0 ? 1 : gauss_weight;
            var gauss_w = gauss_weight;
            var value = (1 - gauss_w) + gauss_w * Math.exp(-(dx * dx) / (2 * width * width * gauss_width * gauss_width))
            stripe.push(value);
        }
        return stripe;
    }




    var _rect_rnd_start = 0

    /*
     * Draw awesome moving rectangles
     */
    var placeRectsOnStripe = function(ctx, stripe, time) {
        var width = stripe.length;
        var rect_speed = width / rect_period;
        var rect_poses = [];

        time = time + _rect_rnd_start;

        for (var i = (time % rect_interval) * rect_speed - (rect_width/2); i < (1 + rect_slowdown_weight) * (width + rect_width); i += rect_interval * rect_speed) {
            rect_poses.push(Math.round(i));
        }

        if (rect_poses.length < 1) {
            return;
        }

        // for more awesomeness rects move not linearly
        var _transform_map = [];
        var _transform_sum = 0;
        for (var i = 0; i < width; i++) {
            _transform_map[i] = i + rect_slowdown_weight * _transform_sum;
            _transform_sum += stripe[i]
        }

        var width = ctx.canvas.width,
            height = ctx.canvas.height,
            half = Math.floor(rect_width / 2);

        ctx.fillStyle = 'rgba(255, 255, 255, ' + (+rect_alpha) + ')';

        var _last = 0;
        for (var i = 0; i + 1 < width && _last < rect_poses.length; i++) {
            var x1 = _transform_map[i],
                x2 = _transform_map[i + 1],
                rect_x = rect_poses[_last];

            if (x1 <= rect_x && rect_x < x2) {
                var rect_transform_x = i + ((rect_x - x1) / (x2 - x1));
                var rect_transform_width = rect_width / (1 + rect_slowdown_weight * stripe[i]);
                ctx.fillRect(rect_transform_x - (rect_transform_width / 2), 0, rect_transform_width, height);

                while (rect_poses[_last] < x2 && _last < rect_poses.length) {
                    _last++;
                }
            }
        }
    }



    /*
     * Draw Stripe on the canvas
     */
    var generateImageData = function(ctx, width, height, stripe, color) {
        var data = ctx.createImageData(width, height);
        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                for (var c = 0; c < 4; c++) {
                    var intensity = (c < 3) ? color[c] : Math.floor(stripe[x] * 255);
                    data.data[y * 4 * width + x * 4 + c] = intensity;
                }
            }
        }

        return data;
    }




    var _image_data_cache = null, _stripe_cache = null;

    /*
     * Draw whole picture
     */
    var draw = function (ctx, time, vanish) {
        var height = ctx.canvas.height,
            width = ctx.canvas.width;

        var data, stripe;
        if (!vanish && time > gauss_move_time * 2 && _image_data_cache && _stripe_cache) {
            data = _image_data_hash;
            stripe = _stripe_cache;
        } else {
            var stripe = getStripe(width, time, vanish);
            var data = generateImageData(ctx, width, height, stripe, color);
            _stripe_cache = stripe;
            _image_data_hash = data;
        }
        ctx.putImageData(data, 0, 0);

        placeRectsOnStripe(ctx, stripe, time);
    }





    var _animator = null;
    var _vanish = false;

    this.Reset = function() {
        if (_animator) {
            clearInterval(_animator);
        }
        _vanish = false;
        _gauss_vanish_pos = 0;
        _gauss_vanish_begin_time = 0;
        _rect_rnd_start = 0;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    this.Start = function() {
        self.Reset();

        var start_time = new Date().getTime();
        _rect_rnd_start = (rect_random) ? Math.round(rect_interval * Math.random()) : 0

        _animator = setInterval(function() {
            var current_time = new Date().getTime();
            var time = current_time - start_time;

            draw(ctx, time, _vanish);

            if (_vanish && (time - _gauss_vanish_begin_time) > gauss_vanish_time) {
                self.Reset();
            }
        }, 10);
    }

    this.End = function() {
        _vanish = true;
    }


    this.Reset();
};

