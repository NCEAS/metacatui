/* global define */
define(["jquery",
        "underscore",
        "backbone"],
  function($, _, Backbone) {
    /**
     * @classdesc A Quota Model represents a single instance of a Quota object from the
     * DataONE Bookkeeper data model. Quotas are limits set
     * for a particular Product, such as the number of portals allowed, disk space
     * allowed, etc. Quotas have a soft and hard limit per unit to help with communicating limit warnings.
     * See https://github.com/DataONEorg/bookkeeper for documentation on the
     * DataONE Bookkeeper service and data model.
     *
     * @class Quota
     * @name Quota
     * @constructor
    */
    var Quota = Backbone.Model.extend(
      /** @lends Quota.prototype */ {

      /**
      * The name of this type of model
      * @type {string}
      */
      type: "Quota",

      /**
      * Default attributes for Quota models
      * @name Quota#defaults
      * @type {Object}
      * @property {string} id  The unique id of this Quota, from Bookkeeper
      * @property {string} name  The name of this Quota type
      * @property {string[]} nameOptions The controlled list of `name` values that can be set on a Quota model
      * @property {string} object  The name of this type of Bookkeeper object, which will always be "quota"
      * @property {number} softLimit  The soft quota limit, which may be surpassed under certain conditions
      * @property {number} hardLimit  The hard quota limit, which cannot be surpassed
      * @property {string} unit  The unit of each Usage of this Quota (e.g. bytes, portals)
      * @property {string[]} unitOptions The controlled list of `unit` values that can be set on a Quota model
      * @property {string} customerId  The id of the Customer associated with this Quota
      * @property {string} subject  The user or group subject associated with this Quota
      */
      defaults: function(){
        return {
          id: "",
          name: "",
          nameOptions: ["portals", "storage"],
          object: "quota",
          softLimit: 0,
          hardLimit: 0,
          unit: "",
          unitOptions: ["portals", "bytes"],
          customerId: "",
          subject: ""
        }
      }

    });

  return Quota;
});
