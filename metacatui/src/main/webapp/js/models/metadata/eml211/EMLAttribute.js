define(["jquery", "underscore", "backbone"],
    function($, _, Backbone) {

        /*
         * EMLAttribute represents a data attribute within an entity, such as
         * a column variable in a data table, or a feature attribute in a shapefile.
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-entity.xsd
         */
        var EMLAttribute = Backbone.Model.extend({

            /* Attributes of an EML attribute object */
            defaults: {

                /* Attributes from EML */
                xmlID: null, // The XML id of the attribute
                attributeName: null,
                attributeLabel: [], // Zero or more human readable labels
                attributeDefinition: null,
                storageType: [], // Zero or more storage types
                typeSystem: [], // Zero or more system types for storage type
                measurementScale: null, // An EMLMeasurementScale objectDOM (nominal, ordinal, interval, ratio, datetime)
                missingValueCode: [], // Zero or more {code: value, definition: value} objects
                accuracy: null, // An EMLAccuracy object
                coverage: null, // an EMLCoverage object
                methods: [], // Zero or more EMLMethods objects
                references: null, // A reference to another EMLAttribute by id (needs work)

                /* Attributes not from EML */
                parentModel: null, // The parent model this attribute belongs to
                objectXML: null, // The serialized XML of this EML attribute
                objectDOM: null  // The DOM of this EML attribute
            },

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: {
                "attributename": "attributeName",
                "attributelabel": "attributeLabel",
                "attributedefinition": "attributeDefinition",
                "storagetype": "storageType",
                "typesystem": "typeSystem",
                "measurementscale": "measurementScale",
                "missingvaluecode": "missingValueCode"
            },

            /* Initialize an EMLAttribute object */
            initialize: function(attributes) {
                if ( attributes && attributes.objectDOM) {
                    this.set(this.parse(attributes.objectDOM));
                }

                this.on(
                    "change:attributeName " +
                    "change:attributeLabel " +
                    "change:attributeDefinition " +
                    "change:storageType " +
                    "change:measurementScale " +
                    "change:missingValueCode " +
                    "change:accuracy " +
                    "change:coverage " +
                    "change:methods " +
                    "change:references",
                    this.trickleUpChange);
            },

            /*
             * Parse the incoming entity's common XML elements
             */
            parse: function(objectDOM) {
                var modelJSON  = {}; // the attributes to return
                var $objectDOM;

                // Use the cached object if we have it
                if ( !objectDOM ) {
                    if ( this.get("objectDOM") ) {
                        objectDOM = this.get("objectDOM");

                    } else {
                        return {};
                    }
                }

                $objectDOM = $(objectDOM);

                // Add the XML id
                modelJSON.xmlID = $objectDOM.attr("id");

                // Add the attributeName
                modelJSON.attributeName = $objectDOM.children("attributename").text();

                // Add the attributeLabel
                modelJSON.attributeLabel = [];
                var attributeLabels = $objectDOM.children("attributelabel");
                _.each(attributeLabels, function(attributeLabel) {
                    modelJSON.attributeLabel.push(attributeLabel.textContent);
                });

                // Add the attributeDEfinition
                modelJSON.attributeDefinition = $objectDOM.children("attributeDefinition").text();

                // Add the storageType
                modelJSON.storageType = [];
                modelJSON.typeSystem = [];
                var storageTypes = $objectDOM.children("storageType");
                _.each(storageTypes, function(storageType) {
                    modelJSON.storageType.push(storageType.textContent);
                    var type = $(storageType).attr("typesystem");
                    modelJSON.typeSystem.push(type || null);
                });

                return modelJSON;
            },

            /* Let the top level package know of attribute changes from this object */
            trickleUpChange: function(){
                MetacatUI.rootDataPackage.packageModel.set("changed", true);
            },

        });

        return EMLAttribute;
    }
);
