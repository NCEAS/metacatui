/* global define */
define(
  ['jquery', 'underscore', 'backbone'],
  function($, _, Backbone) {
    "use strict";

    /**
     * @class QueryField
     * @classdesc A QueryField is one of the fields supported by the the DataONE
     * Solr index, as provided by the DataONE API
     * CNRead.getQueryEngineDescription() function. For more information, see:
     * https://indexer-documentation.readthedocs.io/en/latest/generated/solr_schema.html
     * https://dataone-architecture-documentation.readthedocs.io/en/latest/design/SearchMetadata.html
     * @name QueryField
     * @extends Backbone.Model
     */
    var QueryField = Backbone.Model.extend({
      /** @lends QueryField */

      /**
       * Overrides the default Backbone.Model.defaults() function to
       * specify default attributes for the query fields model
       * 
       * @return {Object}
       */
      defaults: function() {
        return {
          name: null,
          type: null,
          searchable: null,
          returnable: null,
          sortable: null,
          multivalued: null
        };
      },
      
      /**      
       * isType - Checks if this field is a certian type
       *        
       * @param  {string} type the solr field type
       * @return {boolean}     returns true of the field exactly matches
       */       
      isType: function(type){
        try {
          return this.get('type') === type
        } catch (e) {
          console.log("Failed to check if query field is a type, error message: " + e);
        }
      },

      /**    
       * Overwrites the Backbone save function because query fields are read only
       *      
       * @return {boolean}  always returns false
       */
      save: function() {
        return false;
      }

    });

    return QueryField;
  });
