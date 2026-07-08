define(["backbone", "dataoneNotifications"], (
  Backbone,
  DataONENotifications,
) => {
  "use strict";

  const ERROR_CODES = {
    CLIENT_UNAVAILABLE: "CLIENT_UNAVAILABLE",
    FEATURE_DISABLED: "FEATURE_DISABLED",
    MISSING_EMAIL: "MISSING_EMAIL",
    PID_REQUIRED: "PID_REQUIRED",
    RESOURCE_TYPES_UNSUPPORTED: "RESOURCE_TYPES_UNSUPPORTED",
    SERVICE_URL_REQUIRED: "SERVICE_URL_REQUIRED",
    SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
    STILL_LOADING: "STILL_LOADING",
  };

  const GET_USER_MODEL = () => {
    if (MetacatUI.appUserModel) {
      return MetacatUI.appUserModel;
    }
    throw new Error("User model is not available.");
  };

  const GET_APP_MODEL = () => {
    if (MetacatUI.appModel) {
      return MetacatUI.appModel;
    }
    throw new Error("App model is not available.");
  };

  /**
   * @class ObjectNotification
   * @classdesc Model for loading and saving notification subscriptions for a
   * single DataONE object identifier.
   * @classcategory Models
   * @augments Backbone.Model
   * @since 2.37.0
   */
  const ObjectNotification = Backbone.Model.extend(
    /** @lends ObjectNotification.prototype */ {
      /**
       * Default model attributes.
       * @returns {object} Model defaults.
       */
      defaults() {
        return {
          apiVersion: undefined,
          client: null,
          loadedSubscriptions: false,
          loadingSubscriptions: false,
          metadataModel: null,
          pid: null,
          prefixUrl: null,
          resourceTypeOptions: [],
          resourceTypes: null,
          savedResourceTypes: [],
          savingSubscriptions: false,
          title: null,
        };
      },

      /**
       * @param {object} [_attrs] Initial model attributes.
       * @param {object} [options] Model options.
       * @param {Backbone.Model} [options.appModel] App model override.
       * @param {Backbone.Model} [options.userModel] User model override.
       * @param {Function} [options.NotificationClient] NotificationClient
       * constructor override.
       */
      initialize(_attrs = {}, options = {}) {
        this.appModel = options.appModel || null;
        this.userModel = options.userModel || null;
        this.NotificationClient = options.NotificationClient || null;
        this.loadRequestId = 0;
        this.saveRequestId = 0;

        this.refreshResourceTypes();

        this.stopListening();
        this.listenTo(
          this.getAppModel(),
          "change:notificationServiceUrl change:notificationServiceApiVersion change:notificationServiceResourceTypes change:enableNotificationService",
          this.resetClient,
        );
        this.listenTo(
          this.getUserModel(),
          "change:loggedIn change:email",
          this.resetClient,
        );
      },

      /**
       * Fetch the current subscriptions for this PID.
       * @returns {Promise<string[]>} Saved resource type names.
       */
      async loadSubscriptions() {
        const setupError = this.getSetupError();
        if (setupError) {
          this.set({
            loadedSubscriptions: false,
            loadingSubscriptions: false,
          });
          throw new Error(setupError);
        }

        const requestId = this.loadRequestId + 1;
        this.loadRequestId = requestId;
        this.set({
          loadedSubscriptions: false,
          loadingSubscriptions: true,
        });

        try {
          const client = await this.ensureClient();
          const resourceTypes = await client.getResourceTypesByPid({
            pid: this.get("pid"),
          });

          if (requestId !== this.loadRequestId) {
            return this.get("savedResourceTypes").slice();
          }

          const savedResourceTypes = this.setSavedResourceTypes(
            resourceTypes || [],
          );
          this.set({ loadedSubscriptions: true });
          this.trigger("subscriptions:loaded", {
            pid: this.get("pid"),
            resourceTypes: savedResourceTypes.slice(),
          });
          return savedResourceTypes;
        } finally {
          if (requestId === this.loadRequestId) {
            this.set({ loadingSubscriptions: false });
          }
        }
      },

      /**
       * Save selected resource types by subscribing and unsubscribing as needed.
       * @param {string[]} selectedResourceTypes Selected resource type names.
       * @returns {Promise<{changed: boolean, resourceTypes: string[], stale?: boolean}>}
       * Save result.
       */
      async saveSubscriptions(selectedResourceTypes) {
        const setupError = this.getSetupError();
        if (setupError) {
          throw new Error(setupError);
        }

        if (!this.get("loadedSubscriptions")) {
          throw new Error(ERROR_CODES.STILL_LOADING);
        }

        const selected = this.filterSupportedResourceTypes(
          selectedResourceTypes || [],
        );
        const changes = this.getSubscriptionChanges(selected);

        if (!changes.toSubscribe.length && !changes.toUnsubscribe.length) {
          return {
            changed: false,
            resourceTypes: this.get("savedResourceTypes").slice(),
          };
        }

        const requestId = this.saveRequestId + 1;
        this.saveRequestId = requestId;
        const staleResult = () => ({
          changed: false,
          resourceTypes: this.get("savedResourceTypes").slice(),
          stale: true,
        });
        this.set({ savingSubscriptions: true });

        try {
          const client = await this.ensureClient();
          const subscribeRequests = changes.toSubscribe.map((resourceType) =>
            client.subscribe({ pid: this.get("pid"), resourceType }),
          );
          const unsubscribeRequests = changes.toUnsubscribe.map(
            (resourceType) =>
              client.unsubscribe({ pid: this.get("pid"), resourceType }),
          );

          await Promise.all([...subscribeRequests, ...unsubscribeRequests]);

          if (requestId !== this.saveRequestId) {
            return staleResult();
          }

          const savedResourceTypes = this.setSavedResourceTypes(selected);
          const payload = {
            pid: this.get("pid"),
            resourceTypes: savedResourceTypes.slice(),
          };
          this.trigger("subscriptions:saved", payload);
          return {
            changed: true,
            resourceTypes: savedResourceTypes,
          };
        } catch (error) {
          if (requestId !== this.saveRequestId) {
            return staleResult();
          }
          throw error;
        } finally {
          if (requestId === this.saveRequestId) {
            this.set({ savingSubscriptions: false });
          }
        }
      },

      /**
       * Ensure a NotificationClient instance is available.
       * @returns {Promise<object>} NotificationClient instance.
       */
      async ensureClient() {
        if (this.get("client")) {
          return this.get("client");
        }

        const NotificationClient =
          this.NotificationClient || DataONENotifications?.NotificationClient;

        if (!NotificationClient) {
          throw new Error(ERROR_CODES.CLIENT_UNAVAILABLE);
        }

        const setupError = this.getSetupError();
        if (setupError) {
          throw new Error(setupError);
        }

        const viewModel = this;
        const client = new NotificationClient({
          prefixUrl: this.getPrefixUrl(),
          apiVersion: this.getApiVersion(),
          resourceTypes: this.getResourceTypeNames(),
          getToken: () => viewModel.getUserModel().getTokenPromise(),
          validatePID: (pid) => viewModel.validatePid(pid),
        });

        this.set({ client });
        return client;
      },

      /** Reset the cached NotificationClient and loaded state */
      resetClient() {
        this.loadRequestId += 1;
        this.saveRequestId += 1;
        this.set({
          client: null,
          loadedSubscriptions: false,
          loadingSubscriptions: false,
          savedResourceTypes: [],
          savingSubscriptions: false,
        });
        this.refreshResourceTypes();
        this.trigger("notifications:reset");
      },

      /**
       * Return a setup error code that blocks loading or saving.
       * @returns {string|null} Error code or null.
       */
      getSetupError() {
        const appModel = this.getAppModel();
        const featureEnabled = !!appModel.get("enableNotificationService");
        if (!featureEnabled) {
          return ERROR_CODES.FEATURE_DISABLED;
        }

        if (!this.getUserModel().get("loggedIn")) {
          return ERROR_CODES.SIGN_IN_REQUIRED;
        }

        if (!this.getEmailAddress()) {
          return ERROR_CODES.MISSING_EMAIL;
        }

        if (!this.validatePid(this.get("pid"))) {
          return ERROR_CODES.PID_REQUIRED;
        }

        if (!this.getPrefixUrl()) {
          return ERROR_CODES.SERVICE_URL_REQUIRED;
        }

        if (!this.getResourceTypes().length) {
          return ERROR_CODES.RESOURCE_TYPES_UNSUPPORTED;
        }

        return null;
      },

      /**
       * Retrieve and store configured resource types.
       * @returns {Array.<{type: string, label: string, description: string}>}
       * Resource type display options.
       */
      refreshResourceTypes() {
        const resourceTypeOptions = this.getResourceTypes();
        this.set({ resourceTypeOptions });
        return resourceTypeOptions;
      },

      /**
       * Retrieve configured resource types.
       * @returns {Array.<{type: string, label: string, description: string}>}
       * Resource type display options.
       */
      getResourceTypes() {
        const override = this.get("resourceTypes");
        const configured = this.getAppModel().get(
          "notificationServiceResourceTypes",
        );
        const types = override || configured || [];

        return Array.isArray(types) ? types.slice() : [];
      },

      /**
       * Get configured resource type names.
       * @returns {string[]} Resource type names.
       */
      getResourceTypeNames() {
        return this.getResourceTypes().map((option) => option.type);
      },

      /**
       * Filter resource type names to supported values in configured order.
       * @param {string[]} resourceTypes Resource type names.
       * @returns {string[]} Supported resource type names.
       */
      filterSupportedResourceTypes(resourceTypes) {
        const subscribedTypeKeys = new Set(
          Array.isArray(resourceTypes) ? resourceTypes : [],
        );

        return this.getResourceTypes()
          .filter((option) => subscribedTypeKeys.has(option.type))
          .map((option) => option.type);
      },

      /**
       * Set the last saved subscription state.
       * @param {string[]} resourceTypes Resource type names returned by the
       * service.
       * @returns {string[]} Supported saved resource type names.
       */
      setSavedResourceTypes(resourceTypes) {
        const savedResourceTypes =
          this.filterSupportedResourceTypes(resourceTypes);
        this.set({ savedResourceTypes });
        return savedResourceTypes;
      },

      /**
       * Diff selected types against the last saved types.
       * @param {string[]} selectedResourceTypes Current selected resource
       * types.
       * @returns {{toSubscribe: string[], toUnsubscribe: string[]}} Resource
       * type changes.
       */
      getSubscriptionChanges(selectedResourceTypes) {
        const selected = this.filterSupportedResourceTypes(
          selectedResourceTypes || [],
        );
        const selectedKeys = new Set(selected);
        const savedResourceTypes = this.get("savedResourceTypes") || [];
        const savedKeys = new Set(savedResourceTypes);

        return {
          toSubscribe: selected.filter((type) => !savedKeys.has(type)),
          toUnsubscribe: savedResourceTypes.filter(
            (type) => !selectedKeys.has(type),
          ),
        };
      },

      /**
       * Retrieve the Notification Service base URL.
       * @returns {string|null} URL or null.
       */
      getPrefixUrl() {
        return (
          this.get("prefixUrl") ||
          this.getAppModel().get("notificationServiceUrl") ||
          null
        );
      },

      /**
       * Retrieve the Notification Service API version.
       * @returns {string|false|undefined} Configured API version.
       */
      getApiVersion() {
        if (this.get("apiVersion") !== undefined) {
          return this.get("apiVersion");
        }
        return this.getAppModel().get("notificationServiceApiVersion");
      },

      /**
       * Get a dataset title from attributes, model, or PID.
       * @returns {string} Dataset title.
       */
      getDatasetTitle() {
        if (this.get("title")) return this.asString(this.get("title"));

        const metadataModel = this.get("metadataModel");
        if (metadataModel && typeof metadataModel.get === "function") {
          const title =
            metadataModel.get("title") ||
            metadataModel.get("name") ||
            metadataModel.get("id");
          const text = this.asString(Array.isArray(title) ? title[0] : title);
          if (text) return text;
        }

        return this.asString(this.get("pid"));
      },

      /**
       * Get the email address the notification service will use.
       * @returns {string} Email address.
       */
      getEmailAddress() {
        return this.asString(this.getUserModel().get("email"));
      },

      /**
       * Get the user's account settings URL.
       * @returns {string} Account settings URL.
       */
      getAccountSettingsUrl() {
        const username = this.asString(this.getUserModel().get("username"));
        const profilePath = username ? `profile/${username}` : "my-profile";

        return `${MetacatUI.root}/${profilePath}/s=settings/s=account`;
      },

      /**
       * Validate that a PID has been provided.
       * @param {string} pid PID to validate.
       * @returns {boolean} True when the PID is non-empty.
       */
      validatePid(pid) {
        return typeof pid === "string" && pid.trim().length > 0;
      },

      /**
       * Convert any value to a string.
       * @param {*} value Value to convert.
       * @returns {string} String value.
       */
      asString(value) {
        if (value === null || value === undefined) return "";
        return String(value).trim();
      },

      /**
       * Get the configured AppModel.
       * @returns {Backbone.Model} App model.
       */
      getAppModel() {
        return this.appModel || GET_APP_MODEL();
      },

      /**
       * Get the configured user model.
       * @returns {Backbone.Model} User model.
       */
      getUserModel() {
        return this.userModel || GET_USER_MODEL();
      },
    },
  );

  ObjectNotification.ERROR_CODES = ERROR_CODES;

  return ObjectNotification;
});
