(function () {
	'use strict';

var version = 'Версия от: 04.08.‎2016';
var cadUtils = {
	_parseProps: function(it, prevKey) {
		var props = {};
        for (var key in it) {
            var pt = it[key],
                clearKey = key.replace(/ns\d:/, ''),
                type = typeof(pt);

            if (window.CAD.DEFAULTS.skipKeys[key]) {
                //console.log('Skip key:', key);
            } else if (key === 'Entity_Spatial') {
                props[prevKey] = key;
            } else if (key === '@attributes') {
                CAD.Utils.extend(props, pt);
            } else if (type === 'string') {
                props[prevKey] = pt;
            } else if (pt['#text']) {
                props[clearKey] = pt['#text'];
            } else if (type === 'object') {
                props[clearKey] = this._parseProps(pt, key);
            } else {
                console.log('Skiped: ', key);
            }
        }
        return props;
	},

	_getPoint: function(it, fromPr) {
		var ordinate = it['ns3:Ordinate'] || it.Ordinate,
			r = it['ns3:R'] || {},
			p = ordinate['@attributes'],
			coord = [Number(p.Y), Number(p.X)];
		if (fromPr) { coord = proj4(fromPr, 'WGS84', coord); }
		if (r['#text']) { coord.push(Number(r['#text'])); }

		return coord;
	},

	_getRing: function(arr, fromPr) {
		return arr.map(function(it) {
			var ordinate = it['ns3:Ordinate'] || it.Ordinate,
				p = ordinate['@attributes'],
				coord = [Number(p.Y), Number(p.X)];
			if (fromPr) { coord = proj4(fromPr, 'WGS84', coord); }
			return coord;
		}.bind(this));
	},

	_getGeometry: function(arr, fromPr) {
        var type = 'Polygon',
            multi = '',
            coords = [],
			isArr = arr.splice ? true : false;
        coords = (isArr ? arr : [arr]).map(function(it) {
            var arr1 = it['ns3:SpelementUnit'] || it.Spelement_Unit;
            if (!arr1.splice) {
				if (arr1['@attributes']) {
					var typeUnit = arr1['@attributes'].TypeUnit;
					if (typeUnit === 'Окружность') {
						type = 'Point';
						return this._getPoint(arr1, fromPr);
					}
				}
				arr1 = [arr1];
			}
            var ring = this._getRing(arr1, fromPr);
			// console.log('ddd', arr1.length, arr1)	// todo: LineString, MultiPolygon
            return ring;
        }.bind(this));
        if (isArr) {
            // multi = 'Multi';
            // coords = [coords];
        } else if (type === 'Point') {
            coords = coords[0];
        }
        return {
            type: multi + type,
            coordinates: coords
        };
	},

	getChildren: function(it) {
		var out = {};
		window.CAD.DEFAULTS.childKeys.forEach(function(key) {
            if (it[key]) {
				out[key] = it[key];
			}
		});
		return out;
	},

	findProjections: function(str) {
        for (var key in window.CAD.DEFAULTS.projections) {
            if (key.indexOf(str) === 0) {
                return window.CAD.DEFAULTS.projections[key];
            }
        }
		return null;
	},

	getProjections: function(prKey, cnum) {
		var fromPr = window.CAD.DEFAULTS.projections[prKey];
		if (!fromPr) {
			var str = 'МСК ';
			if (prKey.indexOf('МСК - ') === 0) {
				str = prKey.replace('МСК - ', str);
			} else if (prKey.indexOf('МСК-') === 0) {
				str = prKey.replace('МСК-', str);
			} else {
				str += cnum.split(':')[0];
			}
            fromPr = this.findProjections(str);
		}
		return fromPr;
	},

	getFeature: function (it, options) {
		if (it.Building) {
			it = it.Building;
		} else if (it.Construction) {
			it = it.Construction;
		}
		var pt = {
			properties: this._parseProps(it)
		},
		entitySpatial = it.SpatialData ? it.SpatialData.EntitySpatial || it.SpatialData.Entity_Spatial :
                        it.EntitySpatial || it.Entity_Spatial,
        fromPr, prKey;

		if (entitySpatial) {
            var attr = entitySpatial['@attributes'],
				spatial = entitySpatial['ns3:SpatialElement'] || entitySpatial.Spatial_Element,
				entSys = attr.EntSys || attr.Ent_Sys;
            prKey = this.coordSystems[entSys];
            fromPr = options && options.projection ? options.projection : this.getProjections(prKey, pt.properties.CadastralNumber);

            if (fromPr) {
                pt.geometry = this._getGeometry(spatial, options && options.flagMSK ? '' : fromPr);
                if(pt.geometry.type === 'Point' && pt.geometry.coordinates.length === 3) {
                   pt.properties.Radius = pt.geometry.coordinates[2];
                }
            } else {
                console.log('Skip projection:', prKey);
            }
		} else if (it.OrdX && it.OrdY && it.PKlass) {
            var coord = [Number(it.OrdY["#text"]), Number(it.OrdX["#text"])],
                txt = it.PKlass["#text"] || '';
            prKey = txt.substr(txt.indexOf('МСК'));
            fromPr = this.getProjections(prKey);

            if (fromPr) { coord = proj4(fromPr, 'WGS84', coord); }
            pt.geometry = {
                type: 'Point',
                coordinates: coord
            };
		} else {
			// console.log('Skip not EntitySpatial:', it);
        }
		pt.projection = fromPr;
		return pt;
	},
	coordSystems: null,
	getCoordSystems: function(data, flag) {
		var out = flag ? null : this.coordSystems;
		if (!out && data) {
			var arr = data.CoordSystems ? data.CoordSystems['ns3:CoordSystem'] : null,
				out = {};
			if (data.Coord_System) {
				arr = [data.Coord_System];
			}

			(arr.splice ? arr : [arr]).forEach(function(it) {
				var ph = it['@attributes'];
				out[ph.CsId || ph.Cs_Id] = ph.Name;
			}.bind(this));
			this.coordSystems = out;
		}
		return out;
	},
	extend: function (dest) { // (Object[, Object, ...]) ->
		var sources = Array.prototype.slice.call(arguments, 1),
		    i, j, len, src;

		for (j = 0, len = sources.length; j < len; j++) {
			src = sources[j] || {};
			for (i in src) {
				if (src.hasOwnProperty(i)) {
					dest[i] = src[i];
				}
			}
		}
		return dest;
	},
	parseXML: function (val) {
		var xmlDoc = null;
		if (document.implementation && document.implementation.createDocument) {
			xmlDoc = new DOMParser().parseFromString(val, 'text/xml');
		} else if (window.ActiveXObject) {
			xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
			xmlDoc.loadXML(val);
		}
		else {
			console.log('Your browser can\'t handle this script');
		}
		return xmlDoc;
	},
	xmlToJson: function (xml) {
		var obj = {};
		if (xml.nodeType == 1) { 				// element
			
			if (xml.attributes.length > 0) {	// do attributes
			obj['@attributes'] = {};
				for (var j = 0; j < xml.attributes.length; j++) {
					var attribute = xml.attributes.item(j);
					obj['@attributes'][attribute.nodeName] = attribute.nodeValue;
				}
			}
		} else if (xml.nodeType == 3) { 		// text
			obj = xml.nodeValue;
		}

		if (xml.hasChildNodes()) {				// do children
			for(var i = 0, len = xml.childNodes.length; i < len; i++) {
				var item = xml.childNodes.item(i),
					nodeName = item.nodeName;
				if (typeof(obj[nodeName]) === 'undefined') {
					obj[nodeName] = cadUtils.xmlToJson(item);
				} else {
					if (typeof(obj[nodeName].push) === 'undefined') {
						var old = obj[nodeName];
						obj[nodeName] = [];
						obj[nodeName].push(old);
					}
					obj[nodeName].push(cadUtils.xmlToJson(item));
				}
			}
		}
		return obj;
	},

	kptToJson: function (xmlStr) {
		var data = this.xmlToJson(this.parseXML(xmlStr));
		var cadastralBlock = data.KPT ? data.KPT.CadastralBlocks.CadastralBlock :
				data.Region_Cadastr ? data.Region_Cadastr.Package.Cadastral_Blocks.Cadastral_Block : null;

		var arr = cadastralBlock.CoordSystems ? cadastralBlock.CoordSystems['ns3:CoordSystem'] : null,
			coordSystems = {};
		if (cadastralBlock.Coord_System) {
			arr = [cadastralBlock.Coord_System];
		}

		(arr.splice ? arr : [arr]).forEach(function(it) {
			var ph = it['@attributes'];
			coordSystems[ph.CsId] = ph.Name;
		}.bind(this));
		return {
			node: cadUtils.kptNode(cadastralBlock, {type:'root'}),
			data: data,
			coordSystems: coordSystems
		};
	}
};

var KptNode = function (data, options) {
	this.options = options || {};
	this.childs = CAD.Utils.getChildren(data);
	this._childNodes = {};
	this._coordSystems = CAD.Utils.getCoordSystems(data, this.options.type === 'root');
	
	this.feature = CAD.Utils.getFeature(data, {projection: this.options.projection});
	this.featureMsk = CAD.Utils.getFeature(data, {flagMSK: true});
	this.id = this.feature.properties.CadastralNumber || 'none';
}
KptNode.prototype = {
	getChilNodes: function(key, project) {
		var out = this._childNodes[key];
		if (!out || project) {
			var data = this.childs[key];
			if (key === 'ObjectsRealty') { data = data.ObjectRealty; }
			else if (key === 'OMSPoints') { data = data.OMSPoint; }
			else if (key === 'Parcels') { data = data.Parcel; }
			else if (key === 'Zones') { data = data.Zone; }
			if (!data.splice) { data = [data]; }
            out = this._childNodes[key] = data.map(function(it) {
                return new KptNode(it, {type:key, projection: project});
            }.bind(this));
		}
		return out;
	}
};

	cadUtils.kptNode = function(data, options) {
		return new KptNode(data, options);
	};
	window.CAD = window.CAD || {};
	window.CAD.Utils = cadUtils;
	window.CAD.version = version;
})();
