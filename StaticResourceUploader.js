var __sfdcSessionId;
if (document.cookie.match(/sid=([^;]+)/)) __sfdcSessionId = RegExp.$1;

function css(option) {
	var link = '<' + 'link type="' + (option.type || 'text/css') + '" rel="' + (option.rel || 'stylesheet') + '" href="' + option.href + '" media="' + (option.media || 'screen') + '"';
	if (option.id) link += ' id="' + option.id + '"';
	link += ' />';
	document.write(link);
}
function require(option) {
	var script  = '<' + 'script type="' + (option.type || 'text/javascript') + '" src="' + option.src + '"';
	if (option.id) script += ' id="' + option.id + '"';
	script += '></' + 'script>';
	document.write(script);
}
css({href: 'https://rawgithub.com/htz/Salesforce.com-Static-Resource-Uploader/master/StaticResourceUploader.css'});
css({href: 'https://google-code-prettify.googlecode.com/svn/trunk/src/prettify.css'});
require({src: 'https://rawgithub.com/jquery/jquery-tmpl/master/jquery.tmpl.js'});
require({src: 'https://rawgithub.com/yatt/jquery.base64/master/jquery.base64.js'});
require({src: 'https://rawgithub.com/htz/Salesforce.com-Static-Resource-Uploader/master/lib/jquery.binddrag.js'});
require({src: 'https://rawgithub.com/htz/Salesforce.com-Static-Resource-Uploader/master/lib/jquery.imagesize.js'});
require({src: 'https://rawgithub.com/htz/Salesforce.com-Static-Resource-Uploader/master/lib/zip.min.js'});
require({src: 'https://google-code-prettify.googlecode.com/svn/trunk/src/prettify.js'});
require({src: '/soap/ajax/25.0/connection.js'});

(function ($) {
	var is_cache_controll = true;
	var page_info = {
		max_records: 0,
		records: [],
		page_size: 0,
		max_page: 0,
		page_number: 0,
	};

	$.escapeHTML = function(val) {
		if (!val) return '';
		return $('<div/>').text(val).html();
	};
	$.commaStyle = function(val) {
		val = '' + val;
		while (val != (val = val.replace(/^(-?\d+)(\d{3})/, "$1,$2"))) {}
		return val;
	};

	function toId(sid) {
		if (sid.match(/(?:sr_)?(.{15}).{3}/)) return RegExp.$1;
		return sid;
	}
	function toSrId(id) {
		return 'sr_' + id;
	}

	/* Save file */
	function saveFile(option) {
		var form_id = 'thePage:theTemplate:theForm';
		var pbs_id = form_id + ':thePageBlock:thePageBlockSection';
		var fd = new FormData();
		fd.append(form_id, form_id);
		fd.append(form_id + ':thePageBlock:theButtons:save', 'Save');
		fd.append(pbs_id + ':developerName', option.name);
		fd.append(pbs_id + ':thePageBlockSectionItem:description', option.description);
		fd.append(pbs_id + ':j_id25:j_id29:inputFile:file', option.file);
		fd.append(pbs_id + ':j_id35:cacheControl', option.cache); /* private:0 or public:1 */
		fd.append('com.salesforce.visualforce.ViewState', option.viewState.viewState);
		fd.append('com.salesforce.visualforce.ViewStateMAC', option.viewState.viewStateMAC);
		fd.append('com.salesforce.visualforce.ViewStateCSRF', option.viewState.viewStateCSRF);
		$.ajax({
			type: 'POST',
			url: '/apexpages/setup/editStaticResource.apexp' + (option.id ? '?id=' + option.id : ''),
			data: fd,
			processData: false,
			contentType: false,
			success: function (data, status, xhr) {
				if (data.indexOf('</body>') == -1) {
					if (option.success) option.success();
				} else {
					option.failed($(data).find('.errorMsg'));
				}
			},
			error: function (res, status, error) {
				alert('Save error!');
			}
		});
	}

	/* Refresh list class */
	function refreshListClass(selector) {
		$(selector + ' tbody tr').removeClass('even odd last first');
		$(selector + ' tbody tr:even').addClass('even');
		$(selector + ' tbody tr:odd').addClass('odd');
		$(selector + ' tbody tr.dataRow:first').addClass('first');
		$(selector + ' tbody tr.dataRow:last').addClass('last');
		$(selector + ' tbody tr.dataRow')
			.bind('blur mouseout', function () {$(this).removeClass('highlight');})
			.bind('focus mouseover', function () {$(this).addClass('highlight');});
	}

	/* Get view state */
	function getViewState(option) {
		$.ajax({
			type: 'GET',
			url: option.url,
			success: function (data, status, xhr) {
				data = data.replace(/[\r\n]/, ' ');
				getInputValue = function (name) {
					var reg = new RegExp('<input [^>]*?name="' + name.replace('.', '\\.') + '" [^>]*?value="([^"]*)"[^>]*?>', 'i');
					if (m = data.match(reg)) return m[1];
					return null;
				};
				var view_state = {
					viewState: getInputValue('com.salesforce.visualforce.ViewState'),
					viewStateMAC: getInputValue('com.salesforce.visualforce.ViewStateMAC'),
					viewStateCSRF: getInputValue('com.salesforce.visualforce.ViewStateCSRF')
				};
				if (view_state.viewState && view_state.viewStateMAC && view_state.viewStateCSRF) {
					option.success(view_state);
				} else {
					alert('Application error!');
				}
			},
			error: function (res, status, error) {
				alert('Application error!');
			}
		});
	}

	/* Get Static Resource */
	function getStaticResources(option) {
		var base_soql = 'Select ' +
			'Id, SystemModstamp, NamespacePrefix, Name, LastModifiedDate, LastModifiedById, ' +
			'Description, CreatedDate, CreatedById, ContentType, CacheControl, BodyLength';
		if (!is_cache_controll) base_soql = base_soql.replace(/CacheControl, /, '');

		var soql_options = ['From StaticResource'];
		if (option) {
			if (option.where) {
				var soql_where = [];
				if (option.where.name) soql_where.push("Name like '%" + soqlStringEscape(option.where.name) + "%'");
				if (option.where.type) {
					if (option.where.type == 'other') soql_where.push("(not (ContentType like '%css%' Or ContentType like '%javascript%' Or ContentType like '%image%' Or ContentType like '%text%' Or ContentType like '%zip%'))");
					else soql_where.push("ContentType like '%" + soqlStringEscape(option.where.type) + "%'");
				}
				if (option.where.prefix && option.where.prefix.length > 0) soql_where.push("NamespacePrefix = '" + soqlStringEscape(option.where.prefix) + "'");
				if (option.where.cache) soql_where.push("CacheControl = '" + soqlStringEscape(option.where.cache) + "'");
				if (soql_where.length > 0) soql_options.push('Where ' + soql_where.join(' And '));
			}
			if (option.order) {
				soql_options.push('Order by ' + option.order.by + ' ' + option.order.asc);
			}
		}
		var soql = base_soql + ' ' + soql_options.join(' ');
		console.log('SOQL:' + soql);

		sforce.connection.query(
			soql,
			{
				onSuccess: function (res, source) {
					with (page_info) {
						page_info.max_records = parseInt(res.size);
						var records = res.records;
						if (!$.isArray(records)) records = [records];
						page_info.records = records;
						page_info.page_size = option.limit;
						page_info.max_page = Math.floor((page_info.max_records - 1) / page_info.page_size);
						page_info.page_number = 1;
						var offset = page_info.page_size * (page_info.page_number - 1);
						option.success(page_info.records.slice(offset, offset + page_info.page_size));
					}
				},
				onFailure: function () {
					if (is_cache_controll) {
						is_cache_controll = false;
						getStaticResources(option);
					}
				}
			}
		);
	}

	/* Change Page */
	function changePage(option) {
		with (page_info) {
			if (option.limit) page_info.page_size = option.limit;
			page_info.max_page = Math.floor((page_info.max_records - 1) / page_info.page_size);
			if (option.page) page_info.page_number = option.page;
			var offset = page_info.page_size * (page_info.page_number - 1);
			option.success(page_info.records.slice(offset, offset + page_info.page_size));
		}
	}

	/* Get Static Resource */
	function getStaticResourceBody(option) {
		$.ajax({
			type: 'GET',
			url: option.url,
			dataType: 'text',
			success: function (data) {
				option.success(data);
			},
			error: function (req, status, error) {
				alert('Application error!');
			}
		});
	}

	/* Get Static Resource Prefix */
	function getStaticResourceNamespacePrefix() {
		var soql = 'Select NamespacePrefix From StaticResource Group By NamespacePrefix Order By NamespacePrefix';
		var res = sforce.connection.query(soql);
		if (res.size == 1) return [''];
		return $(res.records).map(function () {
			return this.NamespacePrefix ? this.NamespacePrefix : '';
		});
	}

	/* SOQL string value escape */
	function soqlStringEscape(str) {
		return str.replace(/([\%\_\'])/g, "\\$1");
	}

	function loadImageSize(expr, callback) {
		$(expr).bind('load', function () {
			$(this).imageSize(function (w, h) {
				var size = '<br />(' + w + ', ' + h + ')', width = 40, height = 40;
				if (w >= h) height = Math.floor(h * 40 / w);
				else width = Math.floor(w * 40 / h);
				$(this).css({
					width: width,
					height: height
				});
				$(this).parent().siblings('.size').append(size);
				if (callback) callback.call(this, w, h, width, height);
			});
		});
	}

	$(function () {
		/* Remove Home Page Component title */
		$('#StaticResourceUploader').parent().siblings('div:first').remove();

		/* Tab */
		$(document).ready(function () {
			/* tab click event */
			$('#uploadtab li').click(function () {
				$('#StaticResourceUploader .bPageBlock').hide();
				$('#StaticResourceUploader .bPageBlock#' + $(this).attr('id')).show();
				$('#uploadtab li.active').removeClass('active');
				$(this).addClass('active');
			});
		});

		/* Orverlay */
		$('body').append('<div class="overlay" style="display: none;"></div>');
		$('.overlay').click(closePreview);
		$('.overlayDialog #followingDialogX')
			.live('click', closePreview)
			.live('mouseover', function () {this.className = 'dialogCloseOn';})
			.live('mouseout', function () {this.className = 'dialogClose';});
		function closePreview() {
			$('#previewWindow').remove();
			$('.overlay').hide();
		}

		/* New Static Resource tab */
		$(document).ready(function () {
			var file_map = {};
			var file_id_sequence = 0;
			var view_state = {};

			/* save file by id */
			function saveFileById(id) {
				if (!id) return;
				saveFile({
					file: file_map[id], 
					name: $('#newtab #' + id + ' .developerName').val(), 
					description: $('#newtab #' + id + ' .description').val(), 
					cache: $('#newtab #' + id + ' .cacheControl').val(),
					viewState: view_state,
					success: function () {
						cancelById(id);
					},
					failed: function (errors) {
						$('#newtab #' + id + ' .error .errorMsg').remove();
						$('#newtab #' + id + ' .error').append(errors);
					}
				});
			}

			/* cancel by id */
			function cancelById(id) {
				$('#' + id).remove();
				delete file_map[id];
				var count = 0;
				for (var i in file_map) { count++; }
				if (count == 0) $('#newtab #uploadlistbox').hide();
				else refreshListClass('#newtab #uploadlist');
			}

			/* add table row */
			function addRow(id, file, image) {
				file_map[id] = file;
				/* append table row */
				$('#newtab #uploadlist tbody').append($('#staticresource_new').tmpl({
					id: id,
					file: file,
					image: image
				}));
				refreshListClass('#newtab #uploadlist');
				$('#newtab #uploadlistbox').show();
				loadImageSize('#img_' + id);
			}

			/* get static resource page data (run only /home/home.jsp) */
			if (document.URL.match(/https\:\/\/(?:[^\/]+)\.salesforce\.com\/home\/home\.jsp(?:[\?#].*)?/)) {
				getViewState({
					url: '/081/e',
					success: function (data) {
						view_state = data;
						$('#StaticResourceUploader').show();
					}
				});
			}

			/* drag event */
			$('#newtab #droparea')
			.bind('drop', function (e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).removeClass('dragenter');
				/* Upload each file */
				var files = e.originalEvent.dataTransfer.files;
				$(files).each(function () {
					var file = this;
					var id = 'uploadfile_' + file_id_sequence++;

					if (file.type.match(/image\/.*/)) {
						var reader = new FileReader();
						reader.onload = function(e) {
							addRow(id, file, e.target.result);
						};
						reader.readAsDataURL(file);
					} else {
						addRow(id, file);
					}
				});
			})
			.bind('dragenter dragover', function (e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).addClass('dragenter');
			})
			.bind('dragleave', function (e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).removeClass('dragenter');
			});

			/* button click event */
			$('#newtab #dosaveall').click(function () {
				for (var id in file_map) {
					saveFileById(id);
				}
			});
			$('#newtab #cancelall').click(function () {
				for (var id in file_map) {
					cancelById(id);
				}
			});
			$('#newtab #uploadlist .dosave').live('click', function () {
				saveFileById($(this).parent().parent().attr('id'));
			});
			$('#newtab #uploadlist .cancel').live('click', function () {
				cancelById($(this).parent().parent().attr('id'));
			});
		});

		/* Edit Static Resource tab */
		$(document).ready(function () {
			var replace_file = {};
			var static_resources = {};

			/* add table row */
			function addRow(id) {
				var object = static_resources[id];
				if (!object) return;
				/* append table row */
				$('#edittab #staticresourcelist tbody').append($('#staticresourcelist_view').tmpl({
					id: id,
					object: object,
					_: new Date().getTime()
				}));
				loadImageSize('#img_' + object.Id);
				refreshListClass('#edittab #staticresourcelist');
			}

			/* replace view row */
			function viewRow(id) {
				var object = static_resources[id];
				if (!object) return;
				$('#edittab #staticresourcelist #' + id).replaceWith($('#staticresourcelist_view').tmpl({
					id: id,
					object: object,
					_: new Date().getTime()
				}));
				loadImageSize('#img_' + object.Id);
			}

			/* replace edit row html */
			function replaceEditRowHtml(object, file, image) {
				var id = toSrId(object.Id);
				var name = $('#edittab #staticresourcelist #' + id + ' .developerName').val() || object.Name;
				var description = $('#edittab #staticresourcelist #' + id + ' .description').val() || object.Description;
				var cache = $('#edittab #staticresourcelist #' + id + ' .cacheControl').val() || object.ContentType;

				$('#edittab #staticresourcelist #' + id).replaceWith($('#staticresourcelist_edit').tmpl({
					id: id,
					name: name,
					description: description,
					object: object,
					file: file,
					image: image,
					_: new Date().getTime()
				}));
				loadImageSize('#img_' + object.Id);
			}

			/* replace edit row */
			function editRow(id, file) {
				var object = static_resources[id];
				if (!object) return;
				if (file) {
					replace_file[id] = file;
					if (file.type.match('image/.*')) {
						var reader = new FileReader();
						reader.onload = function(e) {
							replaceEditRowHtml(object, file, e.target.result);
						};
						reader.readAsDataURL(file);
					} else {
						replaceEditRowHtml(object, file);
					}
				} else {
					replaceEditRowHtml(object);
				}
			}

			/* delete row */
			function deleteRow(id) {
				$.ajax({
					type: 'GET',
					url: '/setup/own/deleteredirect.jsp?setupid=StaticResources&delID=' + toId(id),
					success: function (data, status, xhr) {
						if (data.match(/\/_ui\/common\/delete\/CSRFDeleteError\?[^\']*/)) {
							var url = RegExp.lastMatch;
							if (url) {
								$.ajax({
									type: 'GET',
									url: url,
									success: function (data, status, xhr) {
										var url = $(data).find('#CSRFDelError .messageText > a').attr('href');
										if (url) {
											$.get(url);
											$('#edittab #staticresourcelist #' + id).remove();
											delete static_resources[id];
										}
										else alert('Delete error!');
									},
									error: function (res, status, error) {
										alert('Application error!');
									}
								});
							} else {
								alert('Delete error!');
							}
						} else {
							alert('Delete error!');
						}
					},
					error: function (res, status, error) {
						alert('Application error!');
					}
				});
			}

			/* delete selected */
			function deleteSelected() {
				if (!confirm('Are you sure?')) return;
				var sr = $('#edittab #staticresourcelist input.select:checked');
				$('#edittab #staticresourcelist #selectall').removeAttr('checked');
				$('#edittab #filter #deleteselected').attr('disabled', 'disabled');
				sr.each(function () {
					var id = $(this).parent().parent().attr('id');
					deleteRow(id);
				});
			}

			/* preview row */
			function previewRow(id, linenumber) {
				var object = static_resources[id];
				if (object.ContentType.match(/image/)) {
					showPreview(object.Name, $('#preview_image').tmpl({
						url: '/resource/1311880464000/' + object.Name,
						_: new Date().getTime()
					}).html());
				} else {
					getStaticResourceBody({
						url: '/resource/1311880464000/' + object.Name,
						success: function(body) {
							showPreview(object.Name, $('#preview_text').tmpl({
								linenumber: linenumber,
								text: $.escapeHTML(body)
							}).html());
						}
					});
				}
			}

			/* preview unzip file */
			function previewUnzip(url, linenumber) {
				var fname = url.split('/').pop();
				if (fname.match(/\.(?:bmp|jpg|jpeg|png|gif)$/)) {
					showPreview(fname, $('#preview_image').tmpl({
						url: url,
						_: new Date().getTime()
					}).html());
				} else {
					getStaticResourceBody({
						url: url,
						success: function(body) {
							showPreview(fname, $('#preview_text').tmpl({
								linenumber: linenumber,
								text: $.escapeHTML(body)
							}).html());
						}
					});
				}
			}

			/* unzip row */
			function unzipRow(id) {
				var object = static_resources[id];
				var base_url = '/resource/1311880464000/' + object.Name;

				Zip.inflate_file(base_url + '?_=' + new Date().getTime(), function (zip) {
					$('#' + id).after($('#unzip').tmpl({
						id: id,
						files: splitDirectory(zip.files),
						base_url: base_url
					}));
					loadImageSize('#' + id + '.unzipRow .image img');
					$(document).ready(function () {
						var row = $('#' + id + '.unzipRow');
						row.find('ul.ziptree > li:last-child').addClass('last');
						row.find('.unzipActionLinks .expandall').click(function () {
							row.find('ul.ziptree.root').find('ul.ziptree').show();
						});
						row.find('.unzipActionLinks .collaseall').click(function () {
							row.find('ul.ziptree.root').find('ul.ziptree').hide();
						});
						row.find('.dirtoggle').click(function () {
							$(this).parent().parent().nextAll('ul.ziptree:first').toggle();
						});
						row.find('ul.ziptree li')
							.bind('blur mouseout', function () {$(this).removeClass('highlight');})
							.bind('focus mouseover', function () {
								if ($(this).find('li.highlight').length == 0) {
										$(this).addClass('highlight');
										$(this).parents('li.highlight').removeClass('highlight');
								}
							});
						resizeUnzipTree(row);
					});
				});
			}

			function resizeUnzipTree(target) {
				var tdwidth = $('#edittab #staticresourcelist tbody tr:first-child td').map(function () {
					var w = {
						width: $(this).width() + parseInt($(this).css('padding-left')) + parseInt($(this).css('padding-right')),
						css: {
							width: $(this).width(),
							padding: $(this).css('padding'),
							padding_left: parseInt($(this).css('padding-left')),
							padding_right: parseInt($(this).css('padding-right'))
						}
					};
					return w;
				});
				if (tdwidth.length == 0) return;
				target.find('.name').each(function () {
					$(this).css({
						width: tdwidth[2].width + tdwidth[3].width + tdwidth[4].width + tdwidth[5].width
							- tdwidth[2].css.padding_left - tdwidth[2].css.padding_right
							- ($(this).parents('ul.ziptree').length - 1) * 16
					});
				});
				target.find('.image').css({
					width: tdwidth[6].css.width,
					'padding-left': tdwidth[6].css.padding_left,
					'padding-right': tdwidth[6].css.padding_right
				});
				target.find('.size').css({
					width: tdwidth[7].css.width,
					'padding-left': tdwidth[7].css.padding_left,
					'padding-right': tdwidth[7].css.padding_right
				});
			}

			function splitDirectory(files) {
				var root = {};
				$.each(files, function (name, file) {
					var path = name.split(/\//);
					var fname = path.pop();
					var current = root;
					$(path).each(function () {
						if (!current[this]) current[this] = {'$dir': true};
						current = current[this];
					});
					current[fname] = file;
				});
				return root;
			}

			/* show preview */
			function showPreview(title, html) {
				closePreview();
				$('.overlay').show();
				$('body').append($('#preview_window').tmpl({
					title: title,
					top: window.pageYOffset + 100,
					left: 250,
					html: html
				}));
				$(document).ready(function() {
					var win = $('#previewWindow');
					prettyPrint();
					win.find('input#linenumber').change(function () {
						var pre = $('#previewWindow .middle pre');
						if (this.checked) pre.find('ol').attr('style', '').find('li').attr('style', '');
						else pre.find('ol').css({'padding-left': 0}).find('li').css({'list-style-type': 'none', 'margin-left': 0});
					});
					$('#previewWindow .topRight').bindDrag({
						move: function (e) {
							$(this).parent().css({
								'left': '+=' + e.diff.x,
								'top':  '+=' + e.diff.y
							});
						}
					});
					$('#previewWindow .resize').bindDrag({
						move: function (e) {
							var win = $(this).parent();
							win.css({
								'width':  '+=' + e.diff.x,
								'height': '+=' + e.diff.y
							});
							var w = Math.max(100, win.width()), h = Math.min(win.height());
							$(this).siblings('.middle').find('pre').css({
								width: w - 10,
								height: h - 61,
								'max-width': 1000000,
								'max-height': 1000000
							});
						}
					});
					$('#previewWindow .bottomRight').bindDrag({
						move: function (e) {
							var win = $(this).parent();
							win.css({
								'height': '+=' + e.diff.y
							});
							var h = Math.min(win.height());
							$(this).siblings('.middle').find('pre').css({
								height: h - 61,
								'max-height': 1000000
							});
						}
					});
				});
			}

			/* update row */
			function updateRow(id) {
				var name = $('#edittab #staticresourcelist #' + id + ' .developerName').val();
				var description = $('#edittab #staticresourcelist #' + id + ' .description').val();
				var cache = $('#edittab #staticresourcelist #' + id + ' .cacheControl').val();
				var object = static_resources[id];
				var file = replace_file[id];
				if (!object) return;
				getViewState({
					url: '/' + toId(id) + '/e',
					success: function (data) {
						saveFile({
							id: toId(id),
							file: file,
							name: name,
							description: description,
							cache: cache,
							viewState: data,
							success: function () {
								object.Name = name;
								object.Description = description;
								object.CacheControl = (cache == '0' ? 'Private' : 'Public');
								if (file) {
									object.ContentType = file.type;
									object.BodyLength = file.size;
								}
								viewRow(toSrId(object.Id));
							},
							failed: function (errors) {
								$('#edittab #staticresourcelist #' + toSrId(object.Id) + ' .error .errorMsg').remove();
								$('#edittab #staticresourcelist #' + toSrId(object.Id) + ' .error').append(errors);
							}
						});
					}
				});
			}

			function refreshSuccessCallback(records) {
				static_resources = {};
				$('#edittab #staticresourcelist tbody tr').remove();
				$('#edittab #staticresourcelist #selectall').removeAttr('checked');
				$('#edittab #filter #deleteselected').attr('disabled', 'disabled');
				$(records).each(function () {
					$('#edittab #staticresourcelist #page').val(page_info.page_number);
					$('#edittab #staticresourcelist #maxpage').text(page_info.max_page);
					static_resources[toSrId(this.Id)] = this;
					addRow(toSrId(this.Id));
				});
			}

			/* refresh table */
			function refreshStaticResourceTable(e) {
				var option = {where: {}, order: {}};
				if ($('#edittab #filter #name').val().length > 0)
					option.where.name = $('#edittab #filter #name').val();
				if ($('#edittab #filter #prefix').val() && $('#edittab #filter #prefix').val().length > 0)
					option.where.prefix = $('#edittab #filter #prefix').val();
				if ($('#edittab #filter #type').val() && $('#edittab #filter #type').val().length > 0)
					option.where.type = $('#edittab #filter #type').val();
				if ($('#edittab #filter #cache').val().length > 0)
					option.where.cache = $('#edittab #filter #cache').val();
				option.order.by = $('#edittab #filter #order').val();
				option.order.asc = $('#edittab #filter #asc').val();
				option.limit = parseInt($('#edittab #staticresourcelist #limit').val() || 50);
				$('#edittab #staticresourcelist #page').val(1);
				option.offset = 0;
				option.success = refreshSuccessCallback;
				getStaticResources(option);
			}

			/* add event */
			$('#edittab #filter input').bind('keyup', refreshStaticResourceTable);
			$('#edittab #filter select').bind('change', refreshStaticResourceTable);
			$('#edittab #filter #refresh').click(refreshStaticResourceTable);
			$('#edittab #filter #deleteselected').click(deleteSelected);
			$('#edittab #staticresourcelist .edit').live('click', function () {
				editRow($(this).parent().parent().attr('id'));
			});
			$('#edittab #staticresourcelist .delete').live('click', function () {
				if (confirm('Are you sure?')) deleteRow($(this).parent().parent().attr('id'));
			});
			$('#edittab #staticresourcelist .preview').live('click', function () {
				previewRow($(this).parent().parent().attr('id'), true);
			});
			$('#edittab #staticresourcelist .unzip').live('click', function () {
				var id = $(this).parent().parent().attr('id');
				$(this).hide();
				unzipRow(id, true);
			});
			$('#edittab #staticresourcelist .unzippreview').live('click', function () {
				var url = $(this).parent().siblings('.filename').attr('href');
				previewUnzip(url, true);
			});
			$('#edittab #staticresourcelist .closeunzip').live('click', function () {
				var id = $(this).parent().parent().attr('id');
				$(this).parent().parent().remove();
				$('#edittab #staticresourcelist #' + id + ' .unzip').show();
			});
			$('#edittab #staticresourcelist .update').live('click', function () {
				updateRow($(this).parent().parent().attr('id'));
			});
			$('#edittab #staticresourcelist .cancel').live('click', function () {
				viewRow($(this).parent().parent().attr('id'));
			});
			$('#edittab #staticresourcelist #selectall').bind('change', function () {
				var sr = $('#edittab #staticresourcelist tbody tr');
				if (sr.length > 0) {
					if (this.checked) {
						sr.addClass('selected');
						sr.find('input.select').attr('checked','checked');
						$('#edittab #filter #deleteselected').removeAttr('disabled', 'disabled');
					} else {
						sr.removeClass('selected');
						sr.find('input.select').removeAttr('checked');
						$('#edittab #filter #deleteselected').attr('disabled', 'disabled');
					}
				}
			});
			$('#edittab #staticresourcelist input.select').live('change', function () {
				var tr = $(this).parent().parent();
				if (this.checked) {
					tr.addClass('selected');
					$('#edittab #filter #deleteselected').removeAttr('disabled', 'disabled');
				} else {
					tr.removeClass('selected');
					if ($('#edittab #staticresourcelist input.select:checked').length == 0)
						$('#edittab #filter #deleteselected').attr('disabled', 'disabled');
				}
			});
			$('#edittab #staticresourcelist .order')
			.append('<img class="x-grid3-sort-icon" src="data:image/gif;base64,R0lGODlhAQABAID/AMDAwAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==">')
			.click(function () {
				var id = $(this).attr('id');
				var old = $('#edittab #filter #order').val();
				var asc = $('#edittab #filter #asc');
				if (id == old) {
					if (asc.val() == 'ASC') {
						asc.val('DESC');
						$(this).removeClass('sortAsc').addClass('sortDesc');
					} else {
						asc.val('ASC');
						$(this).removeClass('sortDesc').addClass('sortAsc');
					}
				} else {
					asc.val('ASC');
					$('#edittab #filter #order').val(id);
					$('#edittab #staticresourcelist .order').removeClass('sortAsc').removeClass('sortDesc');
					$(this).removeClass('sortDesc').addClass('sortAsc');
				}
				refreshStaticResourceTable();
			}).bind('mouseover', function () {
				$(this).addClass('over');
			}).bind('mouseleave', function () {
				$(this).removeClass('over');
			});
			$(window).bind('resize', function () {
				resizeUnzipTree($('.unzipRow'));
			});
			/* drag event */
			$('#edittab #staticresourcelist .dataRow')
			.live('drop', function (e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).removeClass('dragenter');
				/* upload file */
				var files = e.originalEvent.dataTransfer.files;
				if (files.length == 1) {
					var id = $(this).attr('id');
					editRow(id, files[0]);
				} else {
					alert('Please drag one file.');
				}
			})
			.live('dragenter dragover', function (e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).addClass('dragenter');
			})
			.live('dragleave', function (e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).removeClass('dragenter');
			});
			// paging
			$('#edittab #staticresourcelist .prevNext a#firstbutton').bind('click', function () {
				if (page_info.page_number == 1) return;
				var option = {
					page: 1,
					success: refreshSuccessCallback,
				};
				changePage(option);
			});
			$('#edittab #staticresourcelist .prevNext a#prevbutton').bind('click', function () {
				if (page_info.page_number == 1) return;
				var option = {
					page: Math.max(page_info.page_number - 1, 1),
					success: refreshSuccessCallback,
				};
				changePage(option);
			});
			$('#edittab #staticresourcelist .prevNext a#nextbutton').bind('click', function () {
				if (page_info.page_number == page_info.max_page) return;
				var option = {
					page: Math.min(page_info.page_number + 1, page_info.max_page),
					success: refreshSuccessCallback,
				};
				changePage(option);
			});
			$('#edittab #staticresourcelist .prevNext a#lastbutton').bind('click', function () {
				if (page_info.page_number == page_info.max_page) return;
				var option = {
					page: page_info.max_page,
					limit: parseInt($('#edittab #staticresourcelist #limit').val()),
					success: refreshSuccessCallback,
				};
				changePage(option);
			});
			$('#edittab #staticresourcelist #limit').bind('change', function () {
				var option = {
					page: 1,
					limit: parseInt($('#edittab #staticresourcelist #limit').val()),
					success: refreshSuccessCallback,
				};
				changePage(option);
			});
			$('#edittab #staticresourcelist #page').bind('change', function () {
				var page = $('#edittab #staticresourcelist #page').val();
				if (page < 1 || page > page_info.max_page) {
					$('#edittab #staticresourcelist #page').val(page_info.page_number);
					return;
				}
				var option = {
					page: parseInt($('#edittab #staticresourcelist #page').val()),
					success: refreshSuccessCallback,
				};
				changePage(option);
			});

			/* initialize */
			refreshStaticResourceTable();
			/* refresh table filter */
			var prefix = getStaticResourceNamespacePrefix();
			$('#edittab #filter #prefix option').remove();
			$(prefix).each(function () {
				$('#edittab #filter #prefix').append('<option value="' + this + '">' + this + '</option>');
			});
		});
	});
})(jQuery.noConflict());
