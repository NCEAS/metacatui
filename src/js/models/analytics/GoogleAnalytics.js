define(["models/analytics/Analytics"], function (Analytics) {
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
        } catch (e) {
          console.error("Error setting up Google Analytics", e);
        }
      },

      /**
       * @inheritdoc
       */
      getKey: function () {
        return MetacatUI.appModel.get("googleAnalyticsKey");
      },

      /**
       * @inheritdoc
       */
      track: window.gtag,

      /**
       * @inheritdoc
       */
      ready: function () {
        return this.getKey() && typeof this.track === "function";
      },

      /**
       * @inheritdoc
       */
      trackException: function (message, id, fatal) {
        if (!this.ready()) return;
        this.track("event", "exception", {
          description: this.createExceptionDescription(message, id),
          fatal: fatal,
        });
      },

      /**
       * @inheritdoc
       */
      trackEvent: function (category, action, label, value) {
        if (!this.ready()) return;
        // prepare the event parameters
        var params = {
          event_category: category,
          event_label: label,
          value: value,
        };
        // send the event
        this.track("event", action, params);
      },

      /**
       * @inheritdoc
       */
      trackPageView: function (path, title) {
        if (!this.ready()) return;
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
