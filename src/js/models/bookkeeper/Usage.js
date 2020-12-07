/* global define */
define(["jquery",
        "underscore",
        "backbone"],
  function($, _, Backbone) {
    /**
     * @classdesc A Usage Model represents a single instance of a Usage object from the
     * DataONE Bookkeeper data model. A Usage tracks which objects use a portion of a Quota.
     * A Quota can be associated with multiple Usages.
     * See https://github.com/DataONEorg/bookkeeper for documentation on the
     * DataONE Bookkeeper service and data model.
     * @classcategory Models/Bookkeeper
     * @class Usage
     * @name Usage
     * @since 2.14.0
     * @constructor
    */
    var Usage = Backbone.Model.extend(
      /** @lends Usage.prototype */ {

      /**
      * The name of this type of model
      * @type {string}
      */
      type: "Usage",

      /**
      * Default attributes for Usage models
      * @name Usage#defaults
      * @type {Object}
      * @property {string} id   The unique id of this Usage, from Bookkeeper
      * @property {string} object  The name of this type of Bookkeeper object, which will always be "usage"
      * @property {number} quotaId  The id of the Quota object that this Usage is associated with, from Bookkeeper. This is a match to {@link Quota#defaults#id}
      * @property {string} instanceId  The id of the {@link DataONEObject} that makes up this Usage
      * @property {number} quantity  The quantity of the {@link Quota} that this Usage uses, expressed as {@link Quota#defaults#unit}
      * @property {string} status  The status of this Usage
      * @property {string[]} statusOptions  The controlled list of `status` values that can be set on a Usage model
      * @property {string} nodeId The Member Node ID that the object is from
      * @property {DataONEObject} DataONEObject A reference to the DataONEObject that has the id/seriesId of this Usage instanceId
      * @property {SolrResult} SolrResult A reference to the SolrResult that has the id/seriesId of this Usage instanceId
      */
      defaults: function(){
        return {
          id: null,
          object: "usage",
          quotaId: null,
          instanceId: "",
          quantity: 0,
          status: "",
          statusOptions: ["active", "inactive"],
          nodeId: "",
          DataONEObject: null,
          SolrResult: null
        }
      }

  });

  return Usage;
});
