/* global define */
define(["jquery",
        "underscore",
        "backbone"],
  function($, _, Backbone) {
    /**
     * @classdesc A Subscription Model represents a single instance of a Subscription object from the
     * DataONE Bookkeeper data model.
     * Subscriptions represent a Product that has been ordered by a Customer
     * and is paid for on a recurring basis or is in a free trial period.
     * See https://github.com/DataONEorg/bookkeeper for documentation on the
     * DataONE Bookkeeper service and data model.
     * @classcategory Models/Bookkeeper
     * @class Subscription
     * @name Subscription
     * @since 2.14.0
     * @constructor
    */
    var Subscription = Backbone.Model.extend(
      /** @lends Subscription.prototype */ {

      /**
      * The name of this type of model
      * @type {string}
      */
      type: "Subscription",

      /**
      * Default attributes for Subscription models
      * @name Subscription#defaults
      * @type {Object}
      * @property {string} id  The unique identifier of this Subscription, from Bookkeeper
      * @property {string} object The name of this type of Bookkeeper object, which will always be "subscription"
      * @property {number} canceledAt  The timestamp of the date that this Subscription was canceled
      * @property {string} collectionMethod  The method of payment collection for this Subscription, which is a string from a controlled vocabulary from Bookkeeper
      * @property {number} created  The timestamp of the date that this Subscription was created
      * @property {number} customerId  The identifier of the Customer that is associated with this Subscription
      * @property {Object} metadata  Arbitrary metadata about this Subscription. These values should be parsed and set on this model (TODO)
      * @property {number} productId  The identifier of a Product in this Subscription
      * @property {number} quantity  The number of Subscriptions
      * @property {number} startDate  The timestamp of the date that this Subscription was started
      * @property {string} status  The status of this Subscription, which is taken from a controlled vocabulary set on this model (statusOptions)
      * @property {string[]} statusOptions  The controlled vocabulary from which the `status` value can be from
      * @property {number} trialEnd  The timestamp of the date that this free trial Subscription ends
      * @property {number} trialStart  The timestamp of the date that this free trial Subscription starts
      */
      defaults: function(){
        return {
          id: null,
          object: "subscription",
          canceledAt: null,
          collectionMethod: "send_invoice",
          created: null,
          customerId: null,
          metadata: {},
          productId: null,
          quantity: 0,
          startDate: null,
          status: null,
          statusOptions: ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete_expired", "incomplete"],
          trialEnd: null,
          trialStart: null
        }
      },

      /**
      *
      * Returns true if this Subscription is in a free trial period.
      * @returns {boolean}
      */
      isTrialing: function(){
        return this.get("status") == "trialing";
      }

  });

  return Subscription;
});
