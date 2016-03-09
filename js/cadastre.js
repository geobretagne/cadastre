Ext.namespace("GEOR.Addons");


GEOR.Addons.geob_cadastre = Ext.extend(GEOR.Addons.Base, {
    item: null,
    layer: null,
    win: null,
    title: null,
    form: null,
    statusbar: null, 
    _communesCombo: null,
    _freeText: null,
    _parcelLayer: null,
    _animationTimer: null,
    _loop: null,
    _mask_loader: null,
    _communes: null,
    _communesRequestType: null, 

    requestFailure: function (response) {
        alert(response.responseText);
        this._mask_loader.hide();
    },

    getCommunes: function () {
        this._mask_loader.show();
        if (this._communesRequestType === "file") {
            OpenLayers.Request.GET({
                url: GEOR.config.PATHNAME + "/ws/addons/geob_cadastre/communes.json",
                failure: this.requestFailure,
                success: this.getCommunesSuccess,
                scope: this
            });
        } else {
            var postRequest = '<wfs:GetFeature service="WFS" version="1.0.0"' + ' outputFormat="application/json"' +
                ' xmlns:topp="http://www.openplans.org/topp"' + ' xmlns:wfs="http://www.opengis.net/wfs"' + 
                ' xmlns:ogc="http://www.opengis.net/ogc"' + ' xmlns:gml="http://www.opengis.net/gml"' +
                ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' + 
                ' xsi:schemaLocation="http://www.opengis.net/wfs' + 
                ' http://schemas.opengis.net/wfs/1.0.0/WFS-basic.xsd">' + 
                ' <wfs:Query typeName="' + this.options.communes.typename + '">' + 
                ' <ogc:PropertyName>' + this.options.communes.idfield + '</ogc:PropertyName> ' + 
                ' <ogc:PropertyName>' + this.options.communes.labelfield + '</ogc:PropertyName>' + 
                ' </wfs:Query>' + ' </wfs:GetFeature>';
            var request = OpenLayers.Request.issue({
                method: 'POST',
                headers: {
                    "Content-Type": "text/xml"
                },
                url: this.options.communes.wfsurl,
                data: postRequest,
                failure: this.requestFailure,
                success: this.getCommunesSuccess,
                scope: this
            });
        }
    },

    getCommunesSuccess: function (response) {        
        var obj= (new OpenLayers.Format.JSON()).read(response.responseText);
        this._communes.loadData(obj.features);
        this._mask_loader.hide();
        this.statusbar.setStatus({
            text: 'Sélectionnez une commune...',
            iconCls: 'x-status-valid',
            clear: true // auto-clear after a set interval
        });
    },
    
    getParcelle: function (idparc) {
        this.statusbar.setStatus({
            text: 'Recherche de la parcelle',
            iconCls: 'x-status-busy',
            clear: false // auto-clear after a set interval
        });
        var postRequest = '<wfs:GetFeature service="WFS" version="1.1.0"' + ' outputFormat="application/json"' +
            ' xmlns:topp="http://www.openplans.org/topp"' + ' xmlns:wfs="http://www.opengis.net/wfs"' + 
            ' xmlns:ogc="http://www.opengis.net/ogc"' + ' xmlns:gml="http://www.opengis.net/gml"' +
            ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' + ' xsi:schemaLocation="http://www.opengis.net/wfs' +
            ' http://schemas.opengis.net/wfs/1.1.0/WFS-basic.xsd">' + 
            ' <wfs:Query typeName="' + this.options.parcelles.typename + '" srsName="'+this.map.getProjection()+'">' +
            ' <ogc:Filter>' + '<ogc:PropertyIsEqualTo>' + '<ogc:PropertyName>' + this.options.parcelles.idfield +'</ogc:PropertyName>' +
            ' <ogc:Literal>' + idparc + '</ogc:Literal>' + '</ogc:PropertyIsEqualTo>' +
            ' </ogc:Filter>' + ' </wfs:Query>' + ' </wfs:GetFeature>';
        var request = OpenLayers.Request.issue({
            method: 'POST',
            headers: {
                "Content-Type": "text/xml"
            },
            url: this.options.parcelles.wfsurl,
            data: postRequest,
            failure: this.requestFailure,
            success: this.getParcelleSuccess,
            scope: this
        });
    },

    startAnimation: function () {
        this._loop = 0;
        this._animationTimer = window.setInterval(this.showhide, 0.5 * 1000);
    },

    showhide: function () {
        this._loop += 1;
        if (this._loop < 7) {
            this._parcelLayer.setVisibility(!this._parcelLayer.visibility);
        } else {
            this._parcelLayer.removeAllFeatures();
            this._parcelLayer.setVisibility(true);
            window.clearInterval(this._animationTimer);
            this._animationTimer = null;
        }
    },

    delParcelles: function () {
        this._parcelLayer.removeAllFeatures();
    },

    showParcelle: function () {
        this._parcelLayer.setVisibility(true);
    },

    analyseText: function (text) {
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
            var commune = this._communesCombo.getValue();
            var id_region = commune + formatsection + formatparcelle;
            this.getParcelle("FR"+id_region);
        } else {
            alert("la saisie : " + text + " n'est pas valide");
        }
    },

    getParcelleSuccess: function (response) {
        var obj = (new OpenLayers.Format.JSON()).read(response.responseText);
        var nbparc = obj.features.length;
        if (nbparc > 0) {
            var features = [];
            for (var i = 0; i < nbparc; i++) {
                var id_region = obj.features[i].properties.id_region;
                var geom = OpenLayers.Format.GeoJSON.prototype.parseGeometry(obj.features[i].geometry);
                features.push(new OpenLayers.Feature.Vector(geom));                
            }
            this._parcelLayer.addFeatures(features);
            this.map.zoomToExtent(this._parcelLayer.getDataExtent());
            this.map.zoomTo(18);
            if (this.options.animation === true) {
                this.startAnimation();
            } else {
                this.showParcelle();
            }
            this.statusbar.setStatus({
                text: 'Parcelle(s) localisée(s)',
                iconCls: 'x-status-valid',
                clear: true // auto-clear after a set interval
            });
        } else {
            this.statusbar.setStatus({
                text: 'Pas de parcelle trouvée',
                iconCls: 'x-status-error',
                clear: true // auto-clear after a set interval
            });
        }
    },

    createForm: function () {
        this._freeText = new Ext.form.TextField({
            //id:'freetext',
            width: 190,
            fieldLabel: "Parcelle",
            disabled: true,
            emptyText: "ex. am 17, 17-am, am17...",
            listeners: {
                specialkey: function (f, e) {
                    if (f.getValue() && e.getKey() == e.ENTER) {
                        this.analyseText(f.getValue().toUpperCase());
                    }
                },
                scope: this
            }            
        });
        this._communesCombo = new Ext.form.ComboBox({
            fieldLabel: "Communes",            
            width: 190,
            store: this._communes,
            valueField: this.options.communes.idfield,
            displayField: this.options.communes.labelfield,
            editable: true,
            mode: 'local',
            triggerAction: 'all',
            listeners: {
                'select': function () {                    
                    this._freeText.setDisabled(false);
                    this._freeText.focus('', 50);
                    this._freeText.setValue(null);
                    Ext.fly(this._freeText.getEl()).frame("ff0000");
                },
                scope: this,
                specialkey: function (f, e) {
                    if (e.getKey() == e.ENTER) {
                        this._freeText.focus('', 50);
                    }
                }
            }
        });
        
        var spacer ={ xtype: 'spacer',  height: 10};
        var cadastreForm = new Ext.FormPanel({
            labelWidth: 80,
            layout: 'form',
            bodyStyle: 'padding: 30px 10px 10px 10px',            
            height: 130,
            items: [this._communesCombo, spacer, this._freeText]
        });

        this.form = cadastreForm;
        return cadastreForm;
    },

    showForm: function () {
        if (this.form) {
            this.form.destroy();
        }
        if (this.win) {
            this.win.close();
            this.win.destroy();
        }

        this.form = this.createForm();
        this.statusbar = new Ext.ux.StatusBar({            
            defaultText: '',
            defaultIconCls: 'x-status-saved',
            items: [{
                text: 'Localisation',
                handler: function () {                    
                    this.analyseText(this._freeText.getValue().toUpperCase());
                },
                scope: this
            }, {
                text: 'effacer',
                tooltip: 'effacer les parcelles localisées',
                hidden: this.options.animation,
                handler: function () {
                    this.delParcelles();
                },
                scope: this
            }]
        });
       
        this.win = new Ext.Window({
            closable: true,
            width: 323,            
            title: "Recherche de parcelles",
            border: false,
            plain: true,
            region: 'center',
            items: [this.form],
            bbar: this.statusbar
        });
        this.win.render(Ext.getBody());
        this.win.show();
        this._communesCombo.focus('', 50);        
        this._mask_loader = new Ext.LoadMask(this.form.getEl().getAttribute("id"), {
            msg: "Chargement..."
        });
        if (this._communes.data.length === 0) {
            this.getCommunes();
        }
    },

    init: function (record) {            
            var lang = OpenLayers.Lang.getCode();
            this.title = record.get("title")[lang];                  
            this._parcelLayer = new OpenLayers.Layer.Vector("parcel2", {
                displayInLayerSwitcher: false
            });
            this.layer = this._parcelLayer;            
            this._communesRequestType = this.options.communes.requesttype;
            var description = record.get("description")[lang];
            if (this.options.proxy) {
                OpenLayers.ProxyHost = this.options.proxy;
            }
            this._parcelLayer.setZIndex(1000);
            this.map.addLayers([this._parcelLayer]);
            this._communes = new Ext.data.JsonStore({
                fields: [{
                    name: this.options.communes.idfield,
                    mapping: 'properties.' + this.options.communes.idfield
                }, {
                    name: this.options.communes.labelfield,
                    mapping: 'properties.' + this.options.communes.labelfield
                }],
                sortInfo: {
                    field: this.options.communes.labelfield,
                    direction: 'ASC'
                }
            });
            var menuitems = new Ext.menu.Item({
                text: this.title,
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
                        this.showForm();
                    },
                    scope: this
                }
            });
            this.item = menuitems;
            return menuitems;
        },
        
        destroy: function () {            
            this.item = null;
            this.layer.destroy();
            this.form.destroy();
            this.win.destroy();
            this.statusbar.destroy();
            GEOR.Addons.Base.prototype.destroy.call(this);
        }    
});