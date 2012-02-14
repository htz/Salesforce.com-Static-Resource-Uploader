(function ($) {
	$.fn.extend({
		imageSize: function(callback) {
			this.each(function () {
				var w = this.width, h = this.height;
				/* for Firefox, Safari, Chrome */
				if (typeof this.naturalWidth !== 'undefined') {
					w = this.naturalWidth;
					h = this.naturalHeight;
				/* for IE */
				} else if (typeof this.runtimeStyle !== 'undefined') {
					var run = this.runtimeStyle;
					var mem = {w: run.width, h: run.height}; /* keep runtimeStyle */
					run.width  = 'auto';
					run.height = 'auto';
					w = this.width;
					h = this.height;
					run.width  = mem.w;
					run.height = mem.h;
				/* for Opera */
				} else {
					var mem = {w: this.width, h: this.height}; /* keep original style */
					this.removeAttribute('width');
					this.removeAttribute('height');
					w = this.width;
					h = this.height;
					this.width  = mem.w;
					this.height = mem.h;
				}
				callback.call(this, w, h);
			});
		}
	});
})(jQuery);
