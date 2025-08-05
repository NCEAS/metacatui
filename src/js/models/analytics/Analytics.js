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
       * The name of methods that will be wrapped to ensure they are called
       * after the analytics service is ready.
       * @type {Array<string>}
       * @since 0.0.0
       */
      trackMethods: ["trackEvent", "trackPageView", "trackException"],

      /**
       * Creates a new Analytics model
       */
      initialize: function (attributes, options) {
        this.setupAnalytics();

        // Wrap all of the track methods in a whenReady() promise to ensure that
        // the analytics service is ready before sending events. This ensures
        // that any events sent before the service is ready will be retried once
        // the service is ready.
        this.trackMethods?.forEach((methodName) => {
          const originalMethod = this[methodName];
          if (typeof originalMethod !== "function") return;
          this[methodName] = function (...args) {
            this.whenReady()
              .then(() => originalMethod.apply(this, args))
              .catch((error) => {
                console.error(
                  `Error tracking Analytics event (${methodName})`,
                  error,
                );
              });
          };
        });
      },

      /**
       * Set up the analytics service. Any overwritten versions of this function
       * should make sure to set the track method on the model, and also call
       * this.trigger("ready") when the service is ready to use, and
       * this.trigger("setupError", error) if there is an error during setup.
       */
      setupAnalytics: function () {
        this.trigger("setupError", new Error("setupAnalytics not implemented"));
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
       * Wait for the analytics service to be ready before sending events.
       * Depends on the setupAnalytics triggering a "ready" event as well as a
       * "setupError" event if there is an error during setup.
       * @returns {Promise} A promise that resolves when the analytics service
       * is ready to use.
       * @since 0.0.0
       */
      whenReady: function () {
        return new Promise((resolve, reject) => {
          if (this.ready()) {
            resolve();
          } else {
            const eventTracker = new Backbone.Model();
            eventTracker.listenTo(this, "ready", () => {
              eventTracker.stopListening();
              resolve();
            });
            eventTracker.listenTo(this, "setupError", (error) => {
              eventTracker.stopListening();
              reject(error);
            });
          }
        });
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
       * Track a custom event.
       * @param {string} eventName - The name of the event to track
       * @param {Object} [params] - The parameters to send with the event.
       * @since 0.0.0
       */
      trackCustomEvent(eventName, params) {
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
