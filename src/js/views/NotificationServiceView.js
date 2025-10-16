define(["backbone", "dataoneNotifications"], (
  Backbone,
  DataONENotifications,
) => {
  "use strict";

  /**
   * @class NotificationServiceView
   * @classdesc An interface for interacting with the DataONE Notification
   * Service.
   * @classcategory Views
   * @augments Backbone.View
   * @since 0.0.0
   */
  const NotificationServiceView = Backbone.View.extend(
    /** @lends NotificationServiceView.prototype */ {
      events: {},

      /**
       * @param {object} [options] View options.
       * @param {string} [options.prefixUrl] Override for the Notification
       * Service URL.
       * @param {string[]} [options.resourceTypes] Override for available
       * resource types.
       */
      initialize(options) {
        this.options = options || {};
        /**
         * Cached instance of the NotificationClient.
         * @type {DataONENotifications.NotificationClient|null}
         */
        this.client = null;

        this.stopListening(MetacatUI.appModel);
        this.listenTo(
          MetacatUI.appModel,
          "change:notificationServiceUrl change:notificationServiceResourceTypes",
          this.resetClient,
        );
        this.listenTo(
          MetacatUI.appUserModel,
          "change:loggedIn",
          this.onAuthChange,
        );
      },

      /**
       * Render the Notification Service interface.
       * @returns {NotificationServiceView} The view instance.
       */
      render() {
        const view = this;
        const featureEnabled = !!MetacatUI.appModel.get(
          "enableNotificationService",
        );

        if (!featureEnabled) {
          this.showError(
            "The Notification Service feature is not available on this repository.",
          );
          return this;
        }

        const client = this.ensureClient().catch((error) => {
          view.showError(error.message || "Failed to configure the client.");
        });
        if (!client) {
          // ...
        }

        return this;
      },

      /**
       * Ensure a NotificationClient instance is available.
       * @returns {Promise<object>} Resolves with the NotificationClient
       * instance.
       */
      async ensureClient() {
        if (this.client) {
          return this.client;
        }

        if (!DataONENotifications || !DataONENotifications.NotificationClient) {
          throw new Error("The dataone-notifications bundle failed to load.");
        }

        if (!MetacatUI.appUserModel.get("loggedIn")) {
          throw new Error("Sign in to request notifications.");
        }

        const prefixUrl = this.getPrefixUrl();
        if (!prefixUrl) {
          throw new Error(
            "A Notification Service URL must be configured before sending requests.",
          );
        }

        const resourceTypes = this.getResourceTypes();
        if (!resourceTypes.length) {
          throw new Error(
            "No Notification Service resource types are configured.",
          );
        }

        const view = this;
        this.client = new DataONENotifications.NotificationClient({
          prefixUrl,
          resourceTypes,
          getToken: () => MetacatUI.appUserModel.getTokenPromise(),
          validatePID: (pid) => view.validatePid(pid),
        });

        return this.client;
      },

      /**
       * Display an error message in the view.
       * @param {string} message The error message to display.
       */
      showError(message) {
        this.$el.html(
          `<div class="alert alert-danger" role="alert">${message}</div>`,
        );
      },

      /**
       * Validate the provided PID. TODO: We could ensure that the PID exists in
       * the repository and is the correct resource type.
       * @param {string} pid The PID to validate.
       * @returns {boolean} True if the PID is valid.
       */
      validatePid(pid) {
        return typeof pid === "string" && pid.trim().length > 0;
      },

      /**
       * Handle subscription creation requests.
       * @param {SubmitEvent} event The submit event.
       */
      async submitSubscribe(event) {
        event.preventDefault();
        const pid = "pid"; // TODO: Get the PID
        const resourceType = "datasetChanges"; // Fixed resource type for now
        await this.client.subscribe(pid, resourceType);
      },

      /**
       * Handle unsubscribe requests.
       * @param {SubmitEvent} event The submit event.
       */
      async submitUnsubscribe(event) {
        event.preventDefault();
        const pid = "pid"; // TODO: Get the PID
        const resourceType = "datasetChanges"; // Fixed resource type for now
        await this.client.unsubscribe(pid, resourceType);
      },

      /**
       * Handle subscription listing requests.
       * @param {SubmitEvent} event The submit event.
       */
      async submitList(event) {
        event.preventDefault();
        const resourceType = "datasetChanges"; // Fixed resource type for now
        await this.client.getSubscriptions(resourceType);
      },

      /**
       * Reset the cached client when configuration changes.
       */
      resetClient() {
        this.client = null;
      },

      /**
       * Handle authentication changes.
       */
      onAuthChange() {
        const loggedIn = !!MetacatUI.appUserModel.get("loggedIn");
        if (!loggedIn) {
          this.showLoginPrompt();
        } else {
          this.resetClient();
          this.render();
        }
      },

      showLoginPrompt() {
        this.$el.html(
          `<div class="alert alert-info" role="alert">Sign in to manage your notifications.</div>`,
        );
      },

      /**
       * Retrieve the Notification Service base URL.
       * @returns {string|null} The URL or null if not configured.
       */
      getPrefixUrl() {
        const override = this.options.prefixUrl;
        const configured = MetacatUI.appModel.get("notificationServiceUrl");
        return override || configured || null;
      },

      /**
       * Retrieve configured resource types.
       * @returns {string[]} The resource types.
       */
      getResourceTypes() {
        const override = this.options.resourceTypes;
        const configured = MetacatUI.appModel.get(
          "notificationServiceResourceTypes",
        );
        const types = override || configured || [];
        return Array.isArray(types) ? types.slice() : [];
      },

      /**
       * Cleanup listeners when the view is removed.
       * @returns {NotificationServiceView} The view instance.
       */
      onClose() {
        this.stopListening();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return NotificationServiceView;
});
