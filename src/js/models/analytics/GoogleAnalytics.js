define(["models/analytics/Analytics"], function (Analytics) {
  // Analytics will fail to load if the user has certain blockers installed.
  // Avoid loading the model in that case.
  if (typeof Analytics === "undefined") {
    console.warn("GoogleAnalytics model not loaded.");
    return null;
  }

  /**
   * @class GoogleAnalytics
   * @classdesc A model that connects with an analytics service to record user
   * interactions with the app
   * @classcategory Models/Analytics
   * @extends Backbone.Model
   * @constructs
   * @extends Analytics
   * @since 2.25.0
   */
  var GoogleAnalytics = Analytics.extend(
    /** @lends GoogleAnalytics.prototype */
    {
      /**
       * The name of this Model
       * @name GoogleAnalytics#type
       * @type {string}
       * @readonly
       */
      type: "GoogleAnalytics",

      /** @inheritdoc */
      trackMethods: [...Analytics.prototype.trackMethods, "trackCustomEvent"],

      /**
       * @inheritdoc
       */
      setupAnalytics: function () {
        try {
          // If analytics is already set up, do nothing
          if (this.ready()) return;

          const tagId = this.getKey();

          // If there is no tag ID, do nothing
          if (!tagId) return;

          // Create a script element and set its src to the GA4 library
          const script = document.createElement("script");
          script.async = true;
          script.src = "https://www.googletagmanager.com/gtag/js?id=" + tagId;

          // Append the script element to the head of document
          document.head.appendChild(script);

          // Create global gtag() function
          window.dataLayer = window.dataLayer || [];
          window.gtag = function () {
            dataLayer.push(arguments);
          };

          // Initialize GA4 with tag ID
          window.gtag("js", new Date());
          window.gtag("config", tagId);
          this.track = window.gtag;
          this.trigger("ready");
        } catch (e) {
          console.error("Error setting up Google Analytics", e);
          this.trigger("setupError", e);
        }
      },

      /** @inheritdoc */
      getKey: function () {
        return MetacatUI.appModel.get("googleAnalyticsKey");
      },

      /**
       * The main function for sending analytics events to the service.
       * window.gtag may not exist when the model is created, but it will be set
       * when the setupAnalytics() method is completed.
       * @type {function}
       */
      track: window.gtag,

      /** @inheritdoc */
      ready: function () {
        return this.getKey() && typeof this.track === "function";
      },

      /** @inheritdoc */
      trackException: function (message, id, fatal) {
        this.track("event", "exception", {
          description: this.createExceptionDescription(message, id),
          fatal: fatal,
        });
      },

      /** @inheritdoc */
      trackEvent: function (category, action, label, value, customParams) {
        const params = customParams || {
          event_category: category,
          event_label: label,
          value: value,
        };
        this.track("event", action, params);
      },

      /**
       * Track a custom event with the Google Analytics service. This is
       * designed for use with GA4
       * @param {string} eventName - The name of the event to track
       * @param {Object} [params] - The parameters to send with the event.
       * @since 0.0.0
       */
      trackCustomEvent: function (eventName, params) {
        if (!eventName) return;
        this.track("event", eventName, params);
      },

      /**
       * @inheritdoc
       */
      trackPageView: function (path, title) {
        if (!path) path = (window.location.pathname || "/").replace("#", "");
        if (!title) title = document.title;
        this.track("config", this.getKey(), {
          page_path: path,
          page_title: title,
        });
      },
    },
  );

  return GoogleAnalytics;
});
