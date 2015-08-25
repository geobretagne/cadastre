Ext.namespace("GEOR.Addons");

GEOR.Addons.cadastre = function (map, options) {
    this.map = map;
    this.options = options;
    this.item = null;
    this.layer = null;
    this.win = null;
    this.form = null;
    this.statusbar = null;
};

GEOR.Addons.cadastre.prototype = (function () {

    /*
     * Private     */

    var _self = null;
    var _map = null;
    var _form = null;
    var _communesCombo = null;
    var _statusbar = null;
    var _freeText = null
    var _config = null;
    var _win = null;
    var _parcelLayer = null;
    var _animationTimer = null;
    var _loop = null;
    var _mask_loader = null;
    var _communes = null;
    var _communesRequestType = null;

    var requestFailure = function (response) {
        alert(response.responseText);
        _mask_loader.hide();
    };

    var getCommunes = function () {
        _mask_loader.show();
        if (_communesRequestType === "file") {
            OpenLayers.Request.GET({
                url: GEOR.config.PATHNAME + '/app/addons/cadastre/communes.json',
                failure: requestFailure,
                success: getCommunesSuccess
            });
        } else {
            var postRequest = '<wfs:GetFeature service="WFS" version="1.0.0"' + ' outputFormat="application/json"' + ' xmlns:topp="http://www.openplans.org/topp"' + ' xmlns:wfs="http://www.opengis.net/wfs"' + ' xmlns:ogc="http://www.opengis.net/ogc"' + ' xmlns:gml="http://www.opengis.net/gml"' + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' + ' xsi:schemaLocation="http://www.opengis.net/wfs' + ' http://schemas.opengis.net/wfs/1.0.0/WFS-basic.xsd">' + ' <wfs:Query typeName="' + _config.communes.typename + '">' + ' <ogc:PropertyName>' + _config.communes.idfield + '</ogc:PropertyName> ' + ' <ogc:PropertyName>' + _config.communes.labelfield + '</ogc:PropertyName>' + ' </wfs:Query>' + ' </wfs:GetFeature>';
            var request = OpenLayers.Request.issue({
                method: 'POST',
                headers: {
                    "Content-Type": "text/xml"
                },
                url: _config.communes.wfsurl,
                data: postRequest,
                failure: requestFailure,
                success: getCommunesSuccess
            });
        }
    };

    var getCommunesSuccess = function (response) {        
        var obj= (new OpenLayers.Format.JSON()).read(response.responseText);
        _communes.loadData(obj.features);
        _mask_loader.hide();
        _statusbar.setStatus({
            text: 'Sélectionnez une commune...',
            iconCls: 'x-status-valid',
            clear: true // auto-clear after a set interval
        });
    };

    var getParcellesSuccess = function (response) {
        var format = new OpenLayers.Format.GML();
        var features = format.read(response.responseText);
        _parcelLayer.addFeatures(features);
        for (var i = 0; i < features.length; i++) {
            var id_region = features[i].attributes.id_region;
            var idparcel = id_region.substring(0, 2) + "0" + id_region.substring(2, 20);
            activeProp(idparcel, features[i].geometry);
        }
        _mask_loader.hide();
    };

    var getParcelle = function (idparc) {
        _statusbar.setStatus({
            text: 'Recherche de la parcelle',
            iconCls: 'x-status-busy',
            clear: false // auto-clear after a set interval
        });
        var postRequest = '<wfs:GetFeature service="WFS" version="1.1.0"' + ' outputFormat="application/json"' + ' xmlns:topp="http://www.openplans.org/topp"' + ' xmlns:wfs="http://www.opengis.net/wfs"' + ' xmlns:ogc="http://www.opengis.net/ogc"' + ' xmlns:gml="http://www.opengis.net/gml"' + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' + ' xsi:schemaLocation="http://www.opengis.net/wfs' + ' http://schemas.opengis.net/wfs/1.1.0/WFS-basic.xsd">' + ' <wfs:Query typeName="' + _config.parcelles.typename + '" srsName="'+_map.getProjection()+'">' + ' <ogc:Filter>' + '<ogc:PropertyIsEqualTo>' + '<ogc:PropertyName>' + _config.parcelles.idfield +'</ogc:PropertyName>' + ' <ogc:Literal>' + idparc + '</ogc:Literal>' + '</ogc:PropertyIsEqualTo>' + ' </ogc:Filter>' + ' </wfs:Query>' + ' </wfs:GetFeature>';
        var request = OpenLayers.Request.issue({
            method: 'POST',
            headers: {
                "Content-Type": "text/xml"
            },
            url: _config.parcelles.wfsurl,
            data: postRequest,
            failure: requestFailure,
            success: getParcelleSuccess
        });
    };

    var startAnimation = function () {
        _loop = 0;
        _animationTimer = window.setInterval(showhide, 0.5 * 1000);
    };

    var showhide = function () {
        _loop += 1;
        if (_loop < 7) {
            _parcelLayer.setVisibility(!_parcelLayer.visibility);
        } else {
            _parcelLayer.removeAllFeatures();
            _parcelLayer.setVisibility(true);
            window.clearInterval(_animationTimer);
            _animationTimer = null;
        }
    };

    var delParcelles = function () {
        _parcelLayer.removeAllFeatures();
    };

    var showParcelle = function () {
        _parcelLayer.setVisibility(true);
    };

    var analyseText = function (text) {
        var nbchar = text.length;
        var section = "";
        var parcelle = "";
        var i = 0;
        for (i = 0; i < nbchar; i++) {
            var charcode = text.substring(i, i + 1).charCodeAt(0);
            if (charcode >= 65 && charcode <= 90) {
                section += String.fromCharCode(charcode).toUpperCase();
            }
            if (charcode >= 48 && charcode <= 57) {
                parcelle += String.fromCharCode(charcode);
            }
        }
        // test validité
        if (section.length >= 1 && parseFloat(parcelle) >= 1) {
            parcelle = parseFloat(parcelle);
            var tmp1 = String("000" + parcelle);
            var formatparcelle = tmp1.substring(tmp1.length - 4, tmp1.length + 1);
            var tmp2 = "0000" + section;
            var formatsection = tmp2.substring(tmp2.length - 5, tmp2.length + 1);            
            var commune = _communesCombo.getValue();
            var id_region = commune + formatsection + formatparcelle;
            getParcelle("FR"+id_region);
        } else {
            alert("la saisie : " + text + " n'est pas valide");
        }
    };

    var getParcelleSuccess = function (response) {
        var obj = (new OpenLayers.Format.JSON()).read(response.responseText);
        var nbparc = obj.features.length;
        if (nbparc > 0) {
            var features = [];
            for (var i = 0; i < nbparc; i++) {
                var id_region = obj.features[i].properties.id_region;
                var geom = OpenLayers.Format.GeoJSON.prototype.parseGeometry(obj.features[i].geometry);
                features.push(new OpenLayers.Feature.Vector(geom));                
            }
            _parcelLayer.addFeatures(features);
            _map.zoomToExtent(_parcelLayer.getDataExtent());
            _map.zoomTo(18);
            if (_config.animation === true) {
                startAnimation();
            } else {
                showParcelle();
            }
            _statusbar.setStatus({
                text: 'Parcelle(s) localisée(s)',
                iconCls: 'x-status-valid',
                clear: true // auto-clear after a set interval
            });
        } else {
            _statusbar.setStatus({
                text: 'Pas de parcelle trouvée',
                iconCls: 'x-status-error',
                clear: true // auto-clear after a set interval
            });
        }
    };

    var createForm = function () {
        _freeText = new Ext.form.TextField({
            //id:'freetext',
            width: 190,
            fieldLabel: "Parcelle",
            disabled: true,
            emptyText: "ex. am 17, 17-am, am17...",
            listeners: {
                specialkey: function (f, e) {
                    if (f.getValue() && e.getKey() == e.ENTER) {
                        analyseText(f.getValue().toUpperCase());
                    }
                }
            }
        });
        _communesCombo = new Ext.form.ComboBox({
            fieldLabel: "Communes",
            //id: 'cbcom',
            width: 190,
            store: _communes,
            valueField: _config.communes.idfield,
            displayField: _config.communes.labelfield,
            editable: true,
            mode: 'local',
            triggerAction: 'all',
            listeners: {
                'select': function () {
                    //getSections();
                    _freeText.setDisabled(false);
                    _freeText.focus('', 50);
                    _freeText.setValue(null);
                    Ext.fly(_freeText.getEl()).frame("ff0000");
                },
                specialkey: function (f, e) {
                    if (e.getKey() == e.ENTER) {
                        _freeText.focus('', 50);
                    }
                }
            }
            //,listWidth: 167
        });
        
        var spacer ={ xtype: 'spacer',  height: 10};
        var cadastreForm = new Ext.FormPanel({
            labelWidth: 80,
            layout: 'form',
            bodyStyle: 'padding: 30px 10px 10px 10px',            
            height: 130,
            items: [_communesCombo,spacer, _freeText]
        });

        _self.form = cadastreForm;
        return cadastreForm;
    };

    var showForm = function () {
        if (_form) {
            _form.destroy();
        }
        if (_win) {
            _win.close();
            _win.destroy();
        }

        _form = createForm();
        _statusbar = new Ext.ux.StatusBar({            
            defaultText: '',
            defaultIconCls: 'x-status-saved',
            items: [{
                text: 'Localisation',
                handler: function () {
                    //getParcelle();
                    analyseText(_freeText.getValue().toUpperCase());
                }
            }, {
                text: 'effacer',
                tooltip: 'effacer les parcelles localisées',
                hidden: _config.animation,
                handler: function () {
                    delParcelles();
                }
            }]
        });
        _self.statusbar = _statusbar;

        _win = new Ext.Window({
            closable: true,
            width: 323,            
            title: "Recherche de parcelles",
            border: false,
            plain: true,
            region: 'center',
            items: [_form],
            bbar: _statusbar
        });
        _win.render(Ext.getBody());
        _win.show();
        _communesCombo.focus('', 50);
        _self.win = _win;
        _mask_loader = new Ext.LoadMask(_self.form.getEl().getAttribute("id"), {
            msg: "Chargement..."
        });
        if (_communes.data.length === 0) {
            getCommunes();
        }
    };

    return {
        /*
         * Public
         */


        init: function (record) {
            _self = this;
            var lang = OpenLayers.Lang.getCode();
            title = record.get("title")[lang];
            _map = this.map;            
            _parcelLayer = new OpenLayers.Layer.Vector("parcel2", {
                displayInLayerSwitcher: false
            });
            this.layer = _parcelLayer;
            _config = _self.options;
            _communesRequestType = _config.communes.requesttype;
            var description = record.get("description")[lang];
            if (_config.proxy) {
                OpenLayers.ProxyHost = _config.proxy;
            }
            _parcelLayer.setZIndex(1000);
            this.map.addLayers([_parcelLayer]);
            _communes = new Ext.data.JsonStore({
                fields: [{
                    name: _config.communes.idfield,
                    mapping: 'properties.' + _config.communes.idfield
                }, {
                    name: _config.communes.labelfield,
                    mapping: 'properties.' + _config.communes.labelfield
                }],
                sortInfo: {
                    field: _config.communes.labelfield,
                    direction: 'ASC'
                }
            });
            var menuitems = new Ext.menu.Item({
                text: title,
                iconCls: 'cadastre2-icon',
                qtip: description,
                listeners: {
                    afterrender: function (thisMenuItem) {
                        Ext.QuickTips.register({
                            target: thisMenuItem.getEl().getAttribute("id"),
                            title: thisMenuItem.initialConfig.text,
                            text: thisMenuItem.initialConfig.qtip
                        });
                    },
                    click: function () {
                        showForm();
                    },
                    scope: this
                }/*,
                menu: new Ext.menu.Menu({
                    items: [{
                        text: _config.subtitle[lang],
                        handler: function () {
                            showForm();
                        }
                    }]
                })*/
            });
            this.item = menuitems;
            return menuitems;
        },
        destroy: function () {
            this.map = null;
            this.options = null;
            this.item = null;
            this.layer.destroy();
            this.form.destroy();
            this.win.destroy();
            this.statusbar.destroy();
        }
    }
})();