define([jquery, underscore, backbone],
    function($, _, Backbone) {

        /*
         * EMLEntity represents an abstract data entity, corresponding
         * with the EML EntityGroup and other elements common to all
         * entity types, including otherEntity, dataTable, spatialVector,
         * spatialRaster, and storedProcedure
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-entity.xsd
        */
        var EMLEntity = Backbone.Model.extend({

            /* Attributes of any entity */
            defaults: {

                /* Attributes from EML */
                alternateIdentifier: null,
                entityName: null, // required
                entityDescription: null,
                physical: [] // Zero to many EMLPhysical objects
                coverage: [] // Zero to many EML{Geo|Taxon|Temporal}Coverage objects
                methods: null, // Zero or one EMLMethod object
                additionalInfo: [], // Zero to many EMLText objects
                attributeList: [], // Zero to many EMLAttribute objects
                constraint: [], // Zero to many EMLConstraint objects
                references: null, // A reference to another EMLEntity by id (needs work)

                /* Attributes not from EML */
                parentModel: null,
                objectXML: null, // The serialized XML of this EML entity
                objectDOM: null  // The DOM of this EML entity
            },

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: {
                "alternateidentifier": "alternateIdentifier",
                "entityname": "entityName",
                "entitydescription": "entityDescription",
                "additionalinfo": "additionalInfo",
                "attributelist": "attributeList"
            },

            /* Initialize an EMLEntity object */
            initialize: function(attributes) {
                if ( attributes && attributes.objectDOM) {
                    this.set(this.parse(attributes.objectDOM));
                }
            }
        });

        return EMLEntity;
    }
);
