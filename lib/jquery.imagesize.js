(function ($) {
	$.fn.extend({
		bindDrag: function(options) {
			this.each(function () {
				var is_drag = false;
				var self = $(this);
				var identifier;
				var touch_status = {
					start:  {x: 0, y: 0},
					before: {x: 0, y: 0},
					point:  {x: 0, y: 0},
					diff:   {x: 0, y: 0},
				};
				function getToucheEvent(e, identifier) {
					var touches = event.touches || event.changedTouches || [e];
					var touche;
					if (!identifier) {
						touche = $(touches).filter(function () {return this.target == self[0];});
					} else {
						touche = $(touches).filter(function () {return this.identifier == identifier;});
					}
					if (touche.length > 0) return touche[0];
					return touches[0];
				}
				self.bind('touchstart mousedown', function(e) {
					e.preventDefault();
					is_drag = true;
					var touche = getToucheEvent(e);
					identifier = touche.identifier;
					touch_status.start  = {x: touche.pageX, y: touche.pageY};
					touch_status.before = {x: 0, y: 0};
					touch_status.point  = touch_status.start;
					touch_status.diff   = {x: 0, y: 0};
					if (options.start) options.start.call(self, touch_status);
				});
				$(document).bind('touchmove mousemove', function(e) {
					e.preventDefault();
					if (!is_drag) return;
					var touche = getToucheEvent(e, identifier);
					touch_status.before = touch_status.point;
					touch_status.point  = {x: touche.pageX, y: touche.pageY};
					touch_status.diff.x = touch_status.point.x - touch_status.before.x;
					touch_status.diff.y = touch_status.point.y - touch_status.before.y;
					if (options.move) options.move.call(self, touch_status);
				}).bind('touchend mouseup mouseleave', function(e) {
					e.preventDefault();
					if (!is_drag) return;
					is_drag = false;
					if (options.end) options.end.call(self, touch_status);
				});
			});
		}
	});
})(jQuery);

// How to use
/*
(function ($) {
	$(function () {
		$('.dragtarget').bindDrag({
			start: function (event) {
				// drag start event
			},
			move: function (event) {
				// drag move event
			},
			end: function (event) {
				// drag end event
			}
		});
	});
})(jQuery);
*/
