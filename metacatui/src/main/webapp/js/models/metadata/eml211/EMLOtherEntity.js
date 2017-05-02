define(["jquery", "underscore", "backbone", "models/metadata/eml211/EMLEntity"],
    function($, _, Backbone, EMLEntity) {

        /*
         * EMLOtherEntity represents a generic data entity, corresponding
         * with the EML otherEntity module.
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-entity.xsd
         */
        var EMLOtherEntity = EMLEntity.extend({

            /* Attributes of any entity */
            defaults: _.extend({

                /* Attributes from EML */
                entityType: null // The type of the entity

                /* Attributes not from EML */

            }, EMLEntity.prototype.defaults),

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: _.extend({
                "entitytype": "entityType"

            }, EMLEntity.prototype.nodeNameMap),

            /* Initialize an EMLOtherEntity object */
            initialize: function(attributes) {

                // if options.parse = true, Backbone will call parse()

                // Call super() first
                this.constructor.__super__.initialize.apply(this, [attributes]);

                // EMLOtherEntity-specific work

                // Register change events
                this.on( "change:entityType", EMLEntity.trickleUpChange);
            },

            /*
             * Parse the incoming other entity's XML elements
             */
            parse: function(attributes, options) {


                // Call super() first
                this.constructor.__super__.parse.apply(this, [attributes, options]);

                // EMLOtherEntity-specific work
                var objectDOM  = attributes.objectDOM; // The otherEntity XML fragment
                var $objectDOM; // The JQuery object of the XML fragment

                // Use the cached object if we have it
                if ( !objectDOM ) {
                    if ( this.get("objectDOM") ) {
                        objectDOM = this.get("objectDOM");

                    } else {
                        return {};
                    }
                }

                $objectDOM = $(objectDOM);

                // Add the entityType
                attributes.entityType = $objectDOM.children("entitytype").text();

                return attributes;
            }

        });

        return EMLOtherEntity;
    }
);
