(function () {
	window.CAD = window.CAD || {};
    var viewer = {
		init: function(map) {
			viewer._map = map;
			viewer._fileProgress = document.getElementById('fileProgress');

			viewer._resCont = document.getElementById('resCont');
			L.DomUtil.addClass(viewer._resCont, 'hidden');

			viewer._exportCont = document.getElementById('exportCont');
			L.DomUtil.addClass(viewer._exportCont, 'hidden');

			viewer._kptInfo = document.getElementById('kptInfo');
			
			viewer._groups = {};

		},

		getGroup: function(type) {
			var template = 'test',
				getLines = function(ph) {
					return Object.keys(ph).map(function(key) {
						var item = typeof(ph[key]) === 'object' ? getLines(ph[key]) : ph[key];
						return '<div><b>' + key + '</b>: ' + item + '</div>';
					}).join('\n');
				},
				group = viewer._groups[type];

			if (group) {
				group.clearLayers();
			} else {
				viewer._groups[type] = group = L.featureGroup()
					.bindPopup(template)
					.on('popupopen', function(ev) {
						var layer = ev.layer,
							props = layer.feature.properties,
							popup = ev.popup,
							out = '';

						popup.setContent(getLines(props));
					});
			}
			return group;
		},

		showItem: function(arr, flag) {
			var countGeo = 0;
			if (arr.length) {
				var type = arr[0].options.type,
					group = viewer.getGroup(type);
				if (flag) {
					var fitbounds, countGeo = 0;
					arr.forEach(function(node) {
						var it = node.feature;
						if (it.geometry) {
							var feature = L.GeoJSON.asFeature(it.geometry),
								geoJson = L.geoJson(feature, node.options),
								bounds = geoJson.getBounds();

							feature.properties = it.properties || {};
							group.addLayer(geoJson);
							countGeo++;
							if (!fitbounds) { fitbounds = bounds; }
							else { fitbounds.extend(bounds); }
						}
					});
					if (fitbounds) {
						viewer._map.fitBounds(fitbounds, {maxZoom: 7});
						if (group) {
							viewer._map.addLayer(group);
						}
					}
				} else if (group) {
					group.clearLayers();
					viewer._map.removeLayer(group);
				}
			}
			return countGeo;
		},

		parseFile: function(reader) {
			viewer._kptObj = window.CAD.Utils.kptToJson(reader.result);
			reader = null;
			var node = viewer._kptObj.node,
				infoItem = L.DomUtil.create('div', '', viewer._kptInfo),
				infoChkbox = L.DomUtil.create('input', '', infoItem),
				infoSpan = L.DomUtil.create('span', '', infoItem),
				cont = L.DomUtil.create('div', '', viewer._kptInfo);

			infoSpan.innerHTML = node.id || '';
			infoChkbox.type = 'checkbox';
			infoChkbox._cadType = '';
			infoChkbox.onchange = function(ev) {
				var countGeo = viewer.showItem([node], ev.target.checked);
				if (countGeo) {
				}
			};
			Object.keys(node.childs).forEach(function(key) {
			// for(var key in node.childs) {
				var infoItem = L.DomUtil.create('div', key, cont),
					infoChkbox = L.DomUtil.create('input', '', infoItem),
					infoSpan = L.DomUtil.create('span', '', infoItem),
					cont1 = L.DomUtil.create('div', '', cont),
					infoGeomSpan = L.DomUtil.create('span', '', infoItem),
					count = 0,
					it = node.childs[key];

				count = it[Object.keys(it)];
// console.log('parseFile', key, count);
				var countInfo = (CAD.Dic.rootItems[key] || key) + '(<b>' + count.length + '</b>)';
				infoSpan.innerHTML = countInfo;
				infoChkbox.type = 'checkbox';
				infoChkbox._cadType = key;
				infoChkbox.onchange = function(ev) {
					var arr = node.getChilNodes(ev.target._cadType);
					var countGeo = viewer.showItem(arr, ev.target.checked);
					if (countGeo) {
						infoSpan.innerHTML = countInfo + '(геометрий: <b>' + countGeo + '</b>)';
					}
				};
			});
			L.DomUtil.removeClass(viewer._exportCont, 'hidden');
		},

		selectFile: function(el) {
			viewer._groups = {};
			viewer._kptInfo.innerHTML = '';
			L.DomUtil.addClass(viewer._exportCont, 'hidden');

			var reader = new FileReader();
			reader.onload = viewer.parseFile.bind(this, reader);
			reader.onprogress = function(data) {
				if (data.lengthComputable) {                                            
					L.DomUtil.removeClass(viewer._resCont, 'hidden');
					var cnt = data.loaded / data.total;
					viewer._fileProgress.innerHTML = 'загружено: <b>' + data.loaded + '</b> байт' + (cnt === 1 ? '' : '(' + parseInt(cnt * 100, 10) + '%)');
				}
			};
			if (el.files.length) {
				reader.readAsText(el.files[0]);
			}
		}
	}
	window.viewer = viewer;
return;
    var infoPanel = document.getElementById('infoPanel'),
		mapCont = L.DomUtil.create('div', 'mapCont', infoPanel),
		infoCont = L.DomUtil.create('div', 'info', infoPanel),
		fileInput = L.DomUtil.create('input', '', infoCont),
		fileProgress = L.DomUtil.create('div', 'fileProgress', infoCont),
		kptInfo = L.DomUtil.create('div', 'kptInfo', infoCont),
		kptObj, curObjectArr = [],
        template = 'test',
        getLines = function(ph) {
            return Object.keys(ph).map(function(key) {
                var item = typeof(ph[key]) === 'object' ? getLines(ph[key]) : ph[key];
                return '<div><b>' + key + '</b>: ' + item + '</div>';
            }).join('\n');
        },
        featureGroup = L.featureGroup()
            .bindPopup(template)
            .on('popupopen', function(ev) {
                var layer = ev.layer,
                    props = layer.feature.properties,
                    popup = ev.popup,
                    out = '';

                popup.setContent(getLines(props));
            }),
		shownode = function(node, options) {
			if (!node._div) {
				node._div = L.DomUtil.create('div', '', node._parentDiv);
				var span1 = L.DomUtil.create('span', '', node._div),
					cont = L.DomUtil.create('div', '', node._div),
					addChilds =	function(tnode, tcont) {
						for (var key in tnode.childs) {
							(function() {
								var info = L.DomUtil.create('div', '', tcont),
									span = L.DomUtil.create('span', '', info),
									tKey = key;
								span.innerHTML = key;
								span.onclick = function() {
									var arr = tnode.getChilNodes(tKey);
									arr.forEach(function(it) {
										it._parentDiv = info;
										shownode(it);
									}.bind(this));
								}.bind(this);
							})();
						}
					};
				span1.innerHTML = node.id;
				span1.onclick = function() {
					if (cont.childNodes.length) {
						cont.innerHTML = '';
					} else {
						// addChilds(node, cont);
						// node._parentDiv = cont;
						for (var key in node.childs) {
							var arr = node.getChilNodes(key);
							arr.forEach(function(it) {
								it._parentDiv = cont;
								shownode(it);
							}.bind(this));
							var tt = 1;
							//var rootNode = kptObj.getTreeNode();
							// var arr = node.getChilNodes(tKey);
							// shownode(it);
							// (function() {
								// var info = L.DomUtil.create('div', '', tcont),
									// span = L.DomUtil.create('span', '', info),
									// tKey = key;
								// span.innerHTML = key;
								// span.onclick = function() {
									// var arr = tnode.getChilNodes(tKey);
									// arr.forEach(function(it) {
										// it._parentDiv = info;
										// shownode(it);
									// }.bind(this));
								// }.bind(this);
							// })();
						}
					}
				}.bind(this);
				// for (var key in node.childs) {
					// (function() {
						// var info = L.DomUtil.create('div', '', cont),
							// span = L.DomUtil.create('span', '', info),
							// tKey = key;
						// span.innerHTML = key;
						// span.onclick = function() {
							// addChilds(tKey, info);
							// var arr = node.getChilNodes(tKey);
							// arr.forEach(function(it) {
								// it._parentDiv = info;
								// shownode(it);
							// }.bind(this));
						// }.bind(this);
					// })();
				// }
			}
		};

    var showItem = function(arr, flag) {
// console.log('showItem', arr, flag);
//return;
		if (flag) {
			var fitbounds, countGeo = 0;
			arr.forEach(function(node) {
				var it = node.feature;
				if (it.geometry) {
                    var feature = L.GeoJSON.asFeature(it.geometry),
                        geoJson = L.geoJson(feature, node.options),
                        bounds = geoJson.getBounds();

                    feature.properties = it.properties || {};
                    featureGroup.addLayer(geoJson);
                    curObjectArr.push(geoJson);
					countGeo++;
                    if (!fitbounds) { fitbounds = bounds; }
                    else { fitbounds.extend(bounds); }
                }
			});
			if (fitbounds) {
				map.fitBounds(fitbounds, {maxZoom: 7});
				map.addLayer(featureGroup);
			}
		} else {
			featureGroup.clearLayers();
			// if (curObjectArr.length) {
				// curObjectArr.forEach(function(it) {
					// featureGroup.removeLayer(it);
				// });
				// curObjectArr = [];
			// }
            map.removeLayer(featureGroup);
		}
		return countGeo;
//console.log('ddd', type, flag, arr);
	};
    fileInput.type = 'file';
    fileInput.onchange = function(ev) {
// console.log('ddd', ev.target);
		var file = ev.srcElement.value;
		var reader = new FileReader();

		reader.onload = function(e) {
			kptObj = window.CAD.Utils.kptToJson(reader.result);
			reader = null;
			var node = kptObj.node,
				infoItem = L.DomUtil.create('div', '', kptInfo),
				infoChkbox = L.DomUtil.create('input', '', infoItem),
				infoSpan = L.DomUtil.create('span', '', infoItem),
				cont = L.DomUtil.create('div', '', kptInfo);

			infoSpan.innerHTML = node.id || '';
			infoChkbox.type = 'checkbox';
			infoChkbox._cadType = '';
			infoChkbox.onchange = function(ev) {
				var countGeo = showItem([node], ev.target.checked);
				if (countGeo) {
				}
			};
			Object.keys(node.childs).forEach(function(key) {
			// for(var key in node.childs) {
				var infoItem = L.DomUtil.create('div', key, cont),
					infoChkbox = L.DomUtil.create('input', '', infoItem),
					infoSpan = L.DomUtil.create('span', '', infoItem),
					cont1 = L.DomUtil.create('div', '', cont),
					infoGeomSpan = L.DomUtil.create('span', '', infoItem),
					count = 0,
					it = node.childs[key];

				count = it[Object.keys(it)];
				var countInfo = (CAD.Dic.rootItems[key] || key) + '(<b>' + count.length + '</b>)';
				infoSpan.innerHTML = countInfo;
				infoChkbox.type = 'checkbox';
				infoChkbox._cadType = key;
				infoChkbox.onchange = function(ev) {
					var arr = node.getChilNodes(ev.target._cadType);
					var countGeo = showItem(arr, ev.target.checked);
					if (countGeo) {
						infoSpan.innerHTML = countInfo + '(геометрий: <b>' + countGeo + '</b>)';
					}
				};
			});
		};
		reader.onprogress = function(data) {
			if (data.lengthComputable) {                                            
				var cnt = data.loaded / data.total;
				fileProgress.innerHTML = 'загружено: <b>' + data.loaded + '</b> байт' + (cnt === 1 ? '' : '(' + parseInt(cnt * 100, 10) + '%)');
			}
		};
		if (ev.target.files.length) {
			reader.readAsText(ev.target.files[0]);
		}
	};
return;

	// document.writeln(str);
    function getParam() {
        var out = {},
            t = document.URL.toString(),
            arr = t.substring(t.lastIndexOf('?') + 1).split(/\&/);
        arr.map(function (it) {
            var p = it.split(/\=/); 
            out[p[0]] = p[1];
        });
        return out;
    }

    // var container = document.getElementById('cadastreCalcWidget');
    var osm = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        maxZoom: 23,
        maxNativeZoom: 18,
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
    });
    var param = getParam(),
        bl = param.bl || 'osm',
        cadNum = param.CAD_NUM || param.cad || param.cadNum,
        x = param.x || 36.62858426570892,
        y = param.y || 55.481092412215894,
        z = param.z || 18;

    var map = new L.Map(mapCont, {
        layers: [osm],
        center: [y, x],
        zoom: z
    });
    var attr = {};
    var STR_PAD_LEFT = 1;
    var STR_PAD_RIGHT = 2;
    var STR_PAD_BOTH = 3;

    function strpad(str, len, pad, dir) {
        if (typeof (len) == "undefined") { var len = 0; }
        if (typeof (pad) == "undefined") { var pad = ' '; }
        if (typeof (dir) == "undefined") { var dir = STR_PAD_RIGHT; }
        if (len + 1 >= str.length) {
            switch (dir) {
                case STR_PAD_LEFT:
                    str = Array(len + 1 - str.length).join(pad) + str;
                    break;
                case STR_PAD_BOTH:
                    var right = Math.ceil((padlen = len - str.length) / 2);
                    var left = padlen - right;
                    str = Array(left + 1).join(pad) + str + Array(right + 1).join(pad);
                    break;
                default:
                    str = str + Array(len + 1 - str.length).join(pad);
                    break;
            }
        }
        return str;
    };
    function formatDate(d, m, y) {
        return strpad(d.toString(), 2, '0', 1) + '.' + strpad(m.toString(), 2, '0', 1) + '.' + strpad(y.toString(), 4, '0', 1);
    }

    function numberFormat(_number, _cfg) {
        if (!_number) { return ''; }

        function obj_merge(obj_first, obj_second) {
            var obj_return = {};
            for (var key in obj_first) {
                if (typeof obj_second[key] !== 'undefined') obj_return[key] = obj_second[key];
                else obj_return[key] = obj_first[key];
            }
            return obj_return;
        };

        function thousands_sep(_num, _sep) {
            if (_num.length <= 3) return _num;
            var _count = _num.length;
            var _num_parser = '';
            var _count_digits = 0;
            for (var _p = (_count - 1) ; _p >= 0; _p--) {
                var _num_digit = _num.substr(_p, 1);
                if (_count_digits % 3 == 0 && _count_digits != 0 && !isNaN(parseFloat(_num_digit))) _num_parser = _sep + _num_parser;
                _num_parser = _num_digit + _num_parser;
                _count_digits++;
            }
            return _num_parser;
        };

        if (typeof _number !== 'number') {
            _number = parseFloat(_number);
            if (isNaN(_number)) return CALCULATING;
        }

        var _cfg_default = { before: '', after: '', decimals: 2, dec_point: '.', thousands_sep: ',' };
        if (_cfg && typeof _cfg === 'object') {
            _cfg = obj_merge(_cfg_default, _cfg);
        }
        else _cfg = _cfg_default;
        _number = _number.toFixed(_cfg.decimals);
        if (_number.indexOf('.') != -1) {
            var _number_arr = _number.split('.');
            var _number = thousands_sep(_number_arr[0], _cfg.thousands_sep) + _cfg.dec_point + _number_arr[1];
        }
        else var _number = thousands_sep(_number, _cfg.thousands_sep);

        return _cfg.before + _number + _cfg.after;
    };
return;
    var form = document.getElementById('b_calc'),
        infoBlock = document.getElementById('infoBlock'),
        infoError = document.getElementById('infoError'),
        resultString = document.getElementById('resultString'),
        infoReestr = document.getElementById('infoReestr'),
        result = document.getElementById('result');
    form.calcButton.onclick = function () {
        var prc = Number(form.prc.value.replace(/ /g, '')),
            cost = Number(form.CAD_COST.value.replace(/ /g, ''));

        result.innerHTML = numberFormat(cost * prc / 100, { decimals: 2, thousands_sep: " " });
        resultString.style.display = 'block';
        
    };
    form.search.onclick = function () {
        cadastreLayer.info.cadastreSearch(form.CAD_NUM.value);
    };
    form.CAD_NUM.onfocus = function () {
        infoError.style.display = 'none';
    };
    if (cadNum) { form.CAD_NUM.value = cadNum; }
    var cadastreLayer = new L.Cadastre(null, {
        attribution: '&copy; <a href="http://russian-face.ru/">Widgets</a>',
        infoMode: true,
        onClick: function (ev) {
            infoBlock.style.display = 'block';
            infoError.style.display = 'none';
            var data = ev.feature;
            if (!data || !data.attrs || !data.attrs.cad_cost) {
                infoBlock.style.display = 'none';
                infoError.style.display = 'block';
                return;
            }
            resultString.style.display = 'block';
            result.innerHTML = '0';
            infoReestr.style.display = 'block';
            attr = data.attrs;

            form.CAD_NUM.value = attr.id;
            document.getElementById('AREA_VALUE').innerHTML = numberFormat(attr.area_value, { decimals: 0, thousands_sep: " " });
            form.CAD_COST.value = numberFormat(attr.cad_cost, { decimals: 2, thousands_sep: " " });
            document.getElementById('OBJECT_ADDRESS').innerHTML = attr.address || '';

            var sDate = 'не определена';
            var dt = attr.pubdate; if (typeof(dt) === 'string') { dt = dt.replace(/ /g, ''); }
            if (!dt) { dt = attr.adate; if (typeof(dt) === 'string') { dt = dt.replace(/ /g, ''); } }
            if (dt) {
                var attrDate = new Date(dt);
                sDate = formatDate(attrDate.getDate(), attrDate.getMonth() + 1, attrDate.getFullYear());
            }
            document.getElementById('ACTUAL_DATE').innerHTML = sDate;
            if (attr.rights_reg) {
                var FORM_RIGHTS = {
                    '100': 'частная',
                    '200': 'публичная',
                    '300': '«частная и публичная»'
                };
                document.getElementById('FORM_RIGHTS').innerHTML = FORM_RIGHTS[attr.fp] || 'не определена';
            }
            document.getElementById('UTIL_BY_DOC').innerHTML = attr.util_by_doc || '';
        },
        imageOverlayOptions: {opacity: 0.2}
    }).addTo(map);
    var google = new L.Google();
    L.control.layers({
        OSM: osm,
        Google: google
    }, {
        Кадастр: cadastreLayer
    }, {collapsed: !L.Browser.mobile, autoZIndex: false}).addTo(map);

    map.addLayer(bl === 'osm' ? osm : google);

    map.addControl(new L.Control.gmxIcon({
        id: 'getWidget',
        text: 'Виджет',
        title: 'Получить код для вставки на свой сайт'
     }).on('click', function () {
        var url = 'http://russian-face.ru/cadastre/addWidgetCalc.js',
            c = map.getCenter(),
            z = map.getZoom(),
            bl = map.hasLayer(osm) ? 'osm' : 'google';
        url += '?z=' + z;
        url += '&x=' + c.lng;
        url += '&y=' + c.lat;
        url += '&bl=' + bl;
        if (form.CAD_NUM.value) { url += '&cad=' + form.CAD_NUM.value; }

        var str = '<div id="cadastreCalcWidget" style="width: 1080px; height: 800px;">' +
            '<script src="' + url + '"></script>' +
            '</div>';
        window.prompt('Скопируйте текст для вставки на свой сайт:', str);
     }));

    map.addControl(new L.Control.gmxIcon({
        id: 'getLink',
        text: 'Ссылка',
        title: 'Получить ссылку'
     }).on('click', function () {
        var url = 'http://russian-face.ru/cadastre/cadastreCalc.html',
            c = map.getCenter(),
            z = map.getZoom(),
            bl = map.hasLayer(osm) ? 'osm' : 'google';
        url += '?z=' + z;
        url += '&x=' + c.lng;
        url += '&y=' + c.lat;
        url += '&bl=' + bl;
        if (form.CAD_NUM.value) { url += '&cad=' + form.CAD_NUM.value; }

        window.prompt('Скопируйте текст для вставки на свой сайт:', url);
     }));
})();
