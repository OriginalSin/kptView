(function () {
	window.CAD = window.CAD || {};
    var viewer = {
		init: function(map) {
			viewer._map = map;
			viewer._fileProgress = document.getElementById('fileProgress');

			viewer._resCont = document.getElementById('resCont');
			L.DomUtil.addClass(viewer._resCont, 'hidden');

			viewer._exportCont = document.getElementById('exportCont');
            var exportIcon = null;
			if (navigator.msSaveBlob) { // IE 10+
				exportIcon = L.DomUtil.create('button', 'button', viewer._exportCont);
			} else {
				exportIcon = L.DomUtil.create('a', 'button', viewer._exportCont);
				exportIcon.setAttribute('target', '_blank');
				exportIcon.setAttribute('href', '');
            }
			exportIcon.innerHTML = 'Экспорт в FeatureCollection';
			exportIcon.addEventListener('click', function () {
                var obj = viewer.getBlob();
                if (navigator.msSaveOrOpenBlob) { // IE 10+
                    navigator.msSaveOrOpenBlob(obj.blob, obj.file);
				} else {
                    exportIcon.setAttribute('download', obj.file);
                    exportIcon.setAttribute('href', window.URL.createObjectURL(obj.blob));
                }
            }, false);
			L.DomUtil.addClass(viewer._exportCont, 'hidden');

			viewer._kptInfo = document.getElementById('kptInfo');
			viewer._groups = {};

			viewer._osm = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
				zIndex: -1,
				maxZoom: 21,
				maxNativeZoom: 18,
				attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
			}).addTo(map);
			viewer._rosreestr = L.tileLayer.wms('http://pkk5.rosreestr.ru/arcgis/rest/services/Cadastre/Cadastre/MapServer/export',
				{
					zIndex: 1,
					maxZoom: 21,
					layers: 'show:37,36,25,26,27,28,29,30,31,23,24',
					dpi: 96,
					format: 'PNG32',
					bboxSR: 102100,
					imageSR: 102100,
					size: '1024,1024',
					tileSize: 1024,
					transparent: true,
					f: 'image'
				}
			);
			L.control.layers({
				'Пусто': L.layerGroup(),
				OSM: viewer._osm
			}, {
				'Росреестр': viewer._rosreestr
		   }, {collapsed: false, autoZIndex: false}).addTo(map);
			
		},

		getBlob: function() {
			var fc = null;
			Object.keys(viewer._groups).forEach(function(key) {
                viewer._groups[key].eachLayer(function (layer) {
                    var geojson = layer.toGeoJSON();
                    if (fc) { Array.prototype.push.apply(fc.features, geojson.features); }
                    else { fc = geojson; }
                });
            });
            return {
                file: 'data_' + Date.now() + '.geojson',
                blob: new Blob([JSON.stringify(fc, null, '\t')], { type: 'text/json;charset=utf-8;' })
            };
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
						// viewer._map.fitBounds(fitbounds, {maxZoom: 7});
						if (group) {
							viewer._map.addLayer(group);
						}
					}
				} else if (group) {
					group.clearLayers();
					viewer._map.removeLayer(group);
				}
			}
			return {
				count: countGeo,
				fitbounds: fitbounds
			};
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
				viewer.showItem([node], ev.target.checked);
			};
			Object.keys(node.childs).forEach(function(key) {
				var infoItem = L.DomUtil.create('div', key, cont),
					infoChkbox = L.DomUtil.create('input', '', infoItem),
					infoSpan = L.DomUtil.create('span', '', infoItem),
					cont1 = L.DomUtil.create('div', '', cont),
					infoGeomSpan = L.DomUtil.create('span', '', infoItem),
					it = node.childs[key],
					arr = it[Object.keys(it)];

				if (!arr.splice) { arr = [arr]; }
                // console.log('parseFile', key, count);
				var title = CAD.Dic && CAD.Dic.rootItems[key],
                    countInfo = (title || key) + '(<b>' + arr.length + '</b>)';
				infoSpan.innerHTML = countInfo;
				infoChkbox.type = 'checkbox';
				infoChkbox._cadType = key;
				infoChkbox.onchange = function(ev) {
					var arr = node.getChilNodes(ev.target._cadType),
						stat = viewer.showItem(arr, ev.target.checked);
					it.fitbounds = stat.fitbounds;
					infoSpan.innerHTML = countInfo + '(геометрий: <b>' + stat.count + '</b>)';
					L.DomUtil.addClass(infoSpan, 'pointer');
				};
				L.DomEvent.on(infoSpan, 'dblclick', function() {
					if (it.fitbounds) {
						viewer._map.fitBounds(it.fitbounds);
					}
				}, this);
				
			});
			L.DomUtil.removeClass(viewer._exportCont, 'hidden');
		},

		selectFile: function(el) {
			viewer._groups = {};
			viewer._kptInfo.innerHTML = '';
			L.DomUtil.addClass(viewer._exportCont, 'hidden');

			var reader = new FileReader(),
				file = el.files[0];

			reader.onload = function() {
				viewer._fileProgress.innerHTML = 'загружено: <b>' + file.size + '</b> байт';
				Object.keys(viewer._groups).forEach(function(type) {
					var group = viewer._groups[type];
					group.clearLayers();
					viewer._map.removeLayer(group);
				});
				viewer._groups = {};
				viewer.parseFile(reader);
			};
			reader.onprogress = function(data) {
				if (data.lengthComputable) {                                            
					L.DomUtil.removeClass(viewer._resCont, 'hidden');
					var cnt = data.loaded / data.total;
					viewer._fileProgress.innerHTML = 'загружено: <b>' + data.loaded + '</b> байт' + (cnt === 1 ? '' : '(' + parseInt(cnt * 100, 10) + '%)');
				}
			};
			if (el.files.length) {
				reader.readAsText(file);
			}
		}
	}
	window.viewer = viewer;
})();
