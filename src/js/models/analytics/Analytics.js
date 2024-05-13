/* global define */
define(["backbone"], function (Backbone) {
  /**
   * @class Analytics
   * @classdesc A model that connects with an analytics service to record user
   * interactions with the app. This is a generic model that is meant to be
   * extended for a specific analytics service.
   * @classcategory Models/Analytics
   * @extends Backbone.Model
   * @constructs
   * @since 2.25.0
   */
  var Analytics = Backbone.Model.extend(
    /** @lends Analytics.prototype */
    {
      /**
       * The name of this Model
       * @name Analytics#type
       * @type {string}
       * @readonly
       */
      type: "Analytics",

      /**
       * Default attributes for this model
       * @type {object}
       * @returns {object}
       */
      defaults: function () {
        return {};
      },

      /**
       * Creates a new Analytics model
       */
      initialize: function (attributes, options) {
        this.setupAnalytics();
      },

      /**
       * Set up the analytics service.
       */
      setupAnalytics: function () {
        return;
      },

      /**
       * Get the key for the analytics service. This is the ID that is used to
       * initialize the analytics service.
       * @returns {string} The key for the analytics service
       */
      getKey: function () {
        return "";
      },

      /**
       * Get the version number of the MetacatUI app.
       * @returns {string} The version number of the MetacatUI app
       */
      getVersion: function () {
        return MetacatUI.metacatUIVersion || "unknown";
      },

      /**
       * The main function for sending analytics events to the service.
       * @type {function}
       */
      track: null,

      /**
       * Check if analytics service is enabled and ready to use.
       * @returns {boolean} True if the service is enabled in the app and the
       * track method is available.
       */
      ready: function () {
        return false;
      },

      /**
       * Given a message and an optional ID, create a description of an
       * exception event that can be sent to an analytics service.
       * @param {string} message - A description of the exception
       * @param {string} id - The ID for the associated package or object
       * @returns {string} A description of the exception event
       */
      createExceptionDescription: function (message, id) {
        const version = this.getVersion();
        const sep = ` | `;
        const desc = `${message}`;
        if (id) desc += `${sep}Id: ${id}`;
        desc += `${sep}v. ${version}`;
        return desc;
      },

      /**
       * Send the details of an exception event to an analytics service. This
       * will automatically include the MetacatUI version number in the event
       * details. The function will do nothing if an analytics service is not
       * enabled.
       * @param {string} message - A description of the exception
       * @param {string} id - The ID for the associated package or object
       * @param {boolean} fatal - Whether the exception was fatal
       */
      trackException: function (message, id, fatal) {
        return;
      },

      /**
       * Send the details of an event to an analytics service. The function will
       * do nothing if an analytics service is not enabled.
       * @param {string} category - The category of the event
       * @param {string} action - The action of the event
       * @param {string} label - The label of the event
       * @param {string} value - The value of the event
       */
      trackEvent: function (category, action, label, value) {
        return;
      },

      /**
       * Send the details of a page view to an analytics service. The function
       * will do nothing if an analytics service is not enabled.
       * @param {string} path - The path of the page
       * @param {string} title - The title of the page
       */
      trackPageView: function (path, title) {
        return;
      },
    },
  );

  return Analytics;
});
