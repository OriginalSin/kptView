(function () {
	'use strict';

var DEFAULTS = {
	projections:{
		// Томская область
		'МСК 70, зона 4': '+proj=tmerc +lat_0=0 +lon_0=83.73333333333 +k=1 +x_0=4250000 +y_0=-5912900.566 +ellps=krass +towgs84=23.57,-140.95,-79.8,0,0.35,0.79,-0.22 +units=m +no_defs',
		'МСК 70, зона 2': '+proj=tmerc +lat_0=0 +lon_0=77.73333333333 +k=1 +x_0=2250000 +y_0=-5912900.566 +ellps=krass +towgs84=23.57,-140.95,-79.8,0,0.35,0.79,-0.22 +units=m +no_defs',
		'МСК 70, зона 3': '+proj=tmerc +lat_0=0 +lon_0=80.73333333333 +k=1 +x_0=3250000 +y_0=-5912900.566 +ellps=krass +towgs84=23.57,-140.95,-79.8,0,0.35,0.79,-0.22 +units=m +no_defs'
	},
    itemKeys: ['Quartal', 'Bounds', 'OMSPoints', 'ObjectsRealty', 'Parcels', 'Zones'],
    childKeys: ['OMSPoints', 'ObjectsRealty', 'Parcels', 'Zones'],
    skipKeys: {EntitySpatial: true, CoordSystems: true, SpatialData: true}//, Area: true
};
DEFAULTS.projections['СК кадастрового округа'] = DEFAULTS.projections['МСК 70, зона 4'];
DEFAULTS.childKeys.forEach(function(key) {
	DEFAULTS.skipKeys[key] = true;
});

var cadUtils = {
	_parseProps: function(it, prevKey) {
		var props = {};
        for (var key in it) {
            var pt = it[key],
                clearKey = key.replace(/ns\d:/, ''),
                type = typeof(pt);

            if (DEFAULTS.skipKeys[key]) {
                //console.log('Skip key:', key);
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

	_getRing: function(arr, entSys) {
		var fromPr = DEFAULTS.projections[this.coordSystems[entSys]];
		if (!arr.splice) {
			arr = [arr];
		}
		return arr.map(function(it) {
			var p = it['ns3:Ordinate']['@attributes'];
			var coord = proj4(fromPr, 'WGS84', [Number(p.Y), Number(p.X)]);
			return coord;
		}.bind(this));
	},

	_getCoords: function(data) {
		var entSys = data['@attributes'].EntSys,
			arr = data['ns3:SpatialElement'];

		return (arr.splice ? arr : [arr]).map(function(it) {
			return this._getRing(it['ns3:SpelementUnit'], entSys);
		}.bind(this));
	},

	getChildren: function(it) {
		var out = {};
		DEFAULTS.childKeys.forEach(function(key) {
            if (it[key]) {
				out[key] = it[key];
			}
		});
		return out;
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
		entitySpatial = it.SpatialData ? it.SpatialData.EntitySpatial : it.EntitySpatial;

		if (entitySpatial) {
			pt.geometry = {
			   type: 'Polygon',
			   coordinates: this._getCoords(entitySpatial)
			};
		}
		return pt;
	},
	coordSystems: null,
	getCoordSystems: function(data, flag) {
		var out = flag ? null : this.coordSystems;
		if (!out && data) {
			var arr = data.CoordSystems['ns3:CoordSystem'],
				out = {};

			(arr.splice ? arr : [arr]).forEach(function(it) {
				var ph = it['@attributes'];
				out[ph.CsId] = ph.Name;
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
		var data = this.xmlToJson(this.parseXML(xmlStr)),
			cadastralBlock = data.KPT.CadastralBlocks.CadastralBlock,
			arr = cadastralBlock.CoordSystems['ns3:CoordSystem'],
			coordSystems = {};

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
	
	this.feature = CAD.Utils.getFeature(data);
	this.id = this.feature.properties.CadastralNumber || 'none';
}
KptNode.prototype = {
	getChilNodes: function(key) {
		var out = this._childNodes[key];
		if (!out) {
			var data = this.childs[key];
			if (key === 'ObjectsRealty') { data = data.ObjectRealty; }
			else if (key === 'OMSPoints') { data = data.OMSPoint; }
			else if (key === 'Parcels') { data = data.Parcel; }
			else if (key === 'Zones') { data = data.Zone; }
			if (data.splice) {
				out = this._childNodes[key] = data.map(function(it) {
					return new KptNode(it, {type:key});
				}.bind(this));
			}
		}
		return out;
	}
};

	cadUtils.kptNode = function(data, options) {
		return new KptNode(data, options);
	};
	window.CAD = window.CAD || {};
	window.CAD.Utils = cadUtils;

})();
