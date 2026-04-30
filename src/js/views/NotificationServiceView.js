define([
  "jquery",
  "backbone",
  "dataoneNotifications",
  "common/Utilities",
  `text!${MetacatUI.root}/css/notification-service-view.css`,
], (
  $,
  Backbone,
  DataONENotifications,
  Utilities,
  NotificationServiceViewCSS,
) => {
  "use strict";

  const BASE_CLASS = "notification-service-view";
  const CSS_ID = "notificationServiceView";

  const CLASS_NAMES = {
    modalDialog: `${BASE_CLASS}__dialog`,
    modalContent: `${BASE_CLASS}__content`,
    modalHeader: `${BASE_CLASS}__header`,
    modalTitle: `${BASE_CLASS}__title`,
    modalBody: `${BASE_CLASS}__body`,
    status: `${BASE_CLASS}__status`,
    statusInfo: `${BASE_CLASS}__status--info`,
    statusError: `${BASE_CLASS}__status--error`,
    form: `${BASE_CLASS}__form`,
    typeRow: `${BASE_CLASS}__type-row`,
    typeRowDisabled: `${BASE_CLASS}__type-row--disabled`,
    typeCheckbox: `${BASE_CLASS}__type-checkbox`,
    typeContent: `${BASE_CLASS}__type-content`,
    typeLabel: `${BASE_CLASS}__type-label`,
    typeDescription: `${BASE_CLASS}__type-description`,
    modalFooter: `${BASE_CLASS}__footer`,
    footerActions: `${BASE_CLASS}__footer-actions`,
    footerMessage: `${BASE_CLASS}__footer-message`,
    closeButton: `${BASE_CLASS}__close-button`,
    cancelButton: `${BASE_CLASS}__cancel-button`,
    saveButton: `${BASE_CLASS}__save-button`,
  };

  const IDS = {
    MODAL: "notificationModal",
    TITLE: "notificationModalLabel",
  };

  const MESSAGES = {
    SIGN_IN: "Sign in to manage notifications.",
    MISSING_EMAIL: "An email address is required to manage notifications.",
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
   * @class NotificationServiceView
   * @classdesc An interface for interacting with the DataONE Notification
   * Service.
   * @classcategory Views
   * @augments Backbone.View
   * @since 0.0.0
   */
  const NotificationServiceView = Backbone.View.extend(
    /** @lends NotificationServiceView.prototype */ {
      /**
       * Classes to add to the modal.
       * @type {string}
       */
      className: `modal fade hide ${BASE_CLASS}`,

      /**
       * Cached instance of the NotificationClient.
       * @type {DataONENotifications.NotificationClient|null}
       */
      client: null,

      /**
       * Configured resource type display options.
       * @type {Array.<{type: string, label: string, description: string}>}
       */
      resourceTypeOptions: [],

      /**
       * Last subscription state fetched from or saved to the service.
       * @type {string[]}
       */
      savedResourceTypes: [],

      /**
       * Checkbox elements keyed by resource type.
       * @type {Object<string, HTMLInputElement>}
       */
      checkboxes: {},

      /**
       * DOM attributes for the modal root element.
       * @returns {object} Modal attributes.
       */
      attributes() {
        return {
          id: `${IDS.MODAL}-${this.cid}`,
          tabindex: "-1",
          role: "dialog",
          "aria-labelledby": `${IDS.TITLE}-${this.cid}`,
          "aria-hidden": "true",
        };
      },

      /**
       * Render the modal shell.
       * @param {object} options Template options.
       * @param {string} options.title Modal title.
       * @returns {string} Modal HTML.
       */
      template({ title }) {
        const titleId = `${IDS.TITLE}-${this.cid}`;
        return `
          <div class="modal-dialog ${CLASS_NAMES.modalDialog}" role="document">
            <div class="modal-content ${CLASS_NAMES.modalContent}">
              <div class="modal-header ${CLASS_NAMES.modalHeader}">
                <button type="button" class="close ${CLASS_NAMES.closeButton}" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
                <h5 class="modal-title ${CLASS_NAMES.modalTitle}" id="${titleId}">${Utilities.encodeHTML(title)}</h5>
              </div>
              <div class="modal-body ${CLASS_NAMES.modalBody}">
                <div class="${CLASS_NAMES.status}" role="status" aria-live="polite"></div>
                <form class="${CLASS_NAMES.form}"></form>
              </div>
              <div class="modal-footer ${CLASS_NAMES.modalFooter}">
                <div class="${CLASS_NAMES.footerMessage}"></div>
                <div class="${CLASS_NAMES.footerActions}">
                  <button type="button" class="btn btn-secondary ${CLASS_NAMES.cancelButton}">Cancel</button>
                  <button type="button" class="btn btn-primary ${CLASS_NAMES.saveButton}">Save</button>
                </div>
              </div>
            </div>
          </div>
        `;
      },

      /**
       * The events this view listens for.
       * @returns {object} Backbone events hash.
       */
      events() {
        const events = {};
        events[`click .${CLASS_NAMES.saveButton}`] = "saveChanges";
        events[`click .${CLASS_NAMES.cancelButton}`] = "cancelChanges";
        events[`click .${CLASS_NAMES.closeButton}`] = "cancelChanges";
        return events;
      },

      /**
       * @param {object} [options] View options.
       * @param {string} [options.prefixUrl] Override for the Notification
       * Service URL.
       * @param {string|false} [options.apiVersion] Override for the API
       * version.
       * @param {object[]} [options.resourceTypes] Override for available
       * resource types.
       * @param {string} [options.pid] PID to subscribe or unsubscribe from.
       * @param {string} [options.title] Dataset title to display in the modal.
       * @param {Backbone.Model} [options.metadataModel] Metadata model used to
       * get a dataset title.
       * @param {HTMLElement} [options.buttonEl] Button that opens the modal.
       */
      initialize(options) {
        this.options = options || {};
        this.pid = this.options.pid;
        this.metadataModel = this.options.metadataModel || null;

        this.loadingSubscriptions = false;
        this.savingSubscriptions = false;
        this.loadedSubscriptions = false;
        this.modalInitialized = false;
        this.rendered = false;
        this.loadRequestId = 0;

        MetacatUI.appModel.addCSS(NotificationServiceViewCSS, CSS_ID);

        this.stopListening(GET_APP_MODEL());
        this.listenTo(
          GET_APP_MODEL(),
          "change:notificationServiceUrl change:notificationServiceApiVersion change:notificationServiceResourceTypes change:enableNotificationService",
          this.resetClient,
        );
        this.stopListening(GET_USER_MODEL());
        this.listenTo(
          GET_USER_MODEL(),
          "change:loggedIn change:email",
          this.onAuthChange,
        );
      },

      /**
       * Render the Notification Service modal.
       * @returns {NotificationServiceView} The view instance.
       */
      render() {
        this.resourceTypeOptions = this.getResourceTypes();
        this.el.innerHTML = this.template({
          title: this.getModalTitle(),
        });

        this.statusEl = this.el.querySelector(`.${CLASS_NAMES.status}`);
        this.form = this.el.querySelector(`.${CLASS_NAMES.form}`);
        this.footerMessageEl = this.el.querySelector(
          `.${CLASS_NAMES.footerMessage}`,
        );
        this.saveButton = this.el.querySelector(`.${CLASS_NAMES.saveButton}`);
        this.cancelButton = this.el.querySelector(
          `.${CLASS_NAMES.cancelButton}`,
        );

        this.renderNotificationTypes();
        this.updateEmailMessage();

        const setupError = this.getSetupError();
        if (setupError) {
          this.showError(setupError);
        } else {
          this.removeError();
        }

        this.setCheckboxes(this.savedResourceTypes);
        this.updateControlState();
        this.initializeModal();
        this.rendered = true;

        return this;
      },

      /**
       * Make the modal visible and fetch the user's current subscriptions.
       * @returns {NotificationServiceView} The view instance.
       */
      show() {
        this.render();
        this.$el.modal("show");
        this.loadSubscriptions();
        return this;
      },

      /**
       * Initialize Bootstrap modal behavior and modal lifecycle events.
       */
      initializeModal() {
        if (!this.modalInitialized) {
          this.$el.on(
            "hidden.notificationService",
            this.handleHidden.bind(this),
          );
          this.$el.modal({ show: false });
          this.modalInitialized = true;
        }
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

        if (!GET_USER_MODEL().get("loggedIn")) {
          throw new Error("Sign in to manage notifications.");
        }

        if (!this.getEmailAddress()) {
          throw new Error(MESSAGES.MISSING_EMAIL);
        }

        const prefixUrl = this.getPrefixUrl();
        if (!prefixUrl) {
          throw new Error(
            "A Notification Service URL must be configured before sending requests.",
          );
        }

        const resourceTypeOptions = this.getResourceTypes();
        const resourceTypes = resourceTypeOptions.map((option) => option.type);

        if (!resourceTypes.length) {
          throw new Error(
            "No Notification Service resource types are configured.",
          );
        }

        const apiVersion = this.getApiVersion();

        const view = this;
        this.client = new DataONENotifications.NotificationClient({
          prefixUrl,
          apiVersion,
          resourceTypes,
          getToken: () => GET_USER_MODEL().getTokenPromise(),
          validatePID: (pid) => view.validatePid(pid),
        });

        return this.client;
      },

      /**
       * Fetch the current subscriptions for this PID and update the checkboxes.
       * @returns {Promise<void>} Resolves when the subscriptions have loaded.
       */
      async loadSubscriptions() {
        const setupError = this.getSetupError();
        if (setupError) {
          this.showError(setupError);
          this.loadedSubscriptions = false;
          this.updateControlState();
          return;
        }

        const requestId = this.loadRequestId + 1;
        this.loadRequestId = requestId;
        this.loadingSubscriptions = true;
        this.loadedSubscriptions = false;
        this.showStatus("Loading your current notification settings...");
        this.updateControlState();

        try {
          const client = await this.ensureClient();
          const resourceTypes = await client.getResourceTypesByPid({
            pid: this.pid,
          });

          if (requestId !== this.loadRequestId) return;

          this.setSavedResourceTypes(resourceTypes || []);
          this.loadedSubscriptions = true;
          this.removeError();
        } catch (error) {
          if (requestId !== this.loadRequestId) return;
          this.loadedSubscriptions = false;
          this.showError(
            this.getErrorMessage(
              error,
              "Failed to load your notification settings.",
            ),
          );
        } finally {
          if (requestId === this.loadRequestId) {
            this.loadingSubscriptions = false;
            this.updateControlState();
          }
        }
      },

      /**
       * Render all configured resource type checkboxes.
       */
      renderNotificationTypes() {
        this.checkboxes = {};
        if (!this.form) return;

        this.form.innerHTML = "";

        this.resourceTypeOptions.forEach((option) => {
          this.form.appendChild(this.renderType(option));
        });
      },

      /**
       * Renders a checkbox, label, and description for a notification type.
       * @param {object} options Notification type options.
       * @param {string} options.type The notification type identifier.
       * @param {string} options.label A user-friendly label for the type.
       * @param {string} options.description A description of the notification
       * type.
       * @returns {HTMLElement} The rendered notification type row.
       */
      renderType({ type, label, description }) {
        const id = `${BASE_CLASS}-${this.cid}-${type}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = id;
        checkbox.name = "notification-resource-type";
        checkbox.value = type;
        checkbox.className = CLASS_NAMES.typeCheckbox;

        this.checkboxes[type] = checkbox;

        const labelEl = document.createElement("label");
        labelEl.htmlFor = id;
        labelEl.className = CLASS_NAMES.typeLabel;
        labelEl.textContent = label;

        const content = document.createElement("div");
        content.className = CLASS_NAMES.typeContent;
        content.appendChild(labelEl);

        if (description) {
          const descriptionEl = document.createElement("p");
          descriptionEl.className = CLASS_NAMES.typeDescription;
          descriptionEl.textContent = description;
          content.appendChild(descriptionEl);
        }

        const container = document.createElement("div");
        container.className = CLASS_NAMES.typeRow;
        container.appendChild(checkbox);
        container.appendChild(content);

        return container;
      },

      /**
       * Save the selected notification settings.
       * @param {Event} event The click event.
       * @returns {Promise<void>} Resolves when save completes.
       */
      async saveChanges(event) {
        if (event) event.preventDefault();
        if (this.savingSubscriptions) return;

        const setupError = this.getSetupError();
        if (setupError) {
          this.showError(setupError);
          this.updateControlState();
          return;
        }

        if (!this.loadedSubscriptions) {
          this.showError("Notification settings are still loading.");
          return;
        }

        const selectedResourceTypes = this.getSelectedResourceTypes();
        const changes = this.getSubscriptionChanges(selectedResourceTypes);

        if (!changes.toSubscribe.length && !changes.toUnsubscribe.length) {
          this.hide();
          return;
        }

        this.savingSubscriptions = true;
        this.showStatus("Saving notification settings...");
        this.updateControlState();

        try {
          const client = await this.ensureClient();
          const subscribeRequests = changes.toSubscribe.map((resourceType) =>
            client.subscribe({ pid: this.pid, resourceType }),
          );
          const unsubscribeRequests = changes.toUnsubscribe.map(
            (resourceType) =>
              client.unsubscribe({ pid: this.pid, resourceType }),
          );

          await Promise.all([...subscribeRequests, ...unsubscribeRequests]);
          this.savedResourceTypes = selectedResourceTypes.slice();
          this.setCheckboxes(this.savedResourceTypes);
          this.removeError();
          this.trigger("subscriptions:saved", {
            pid: this.pid,
            resourceTypes: this.savedResourceTypes.slice(),
          });
          this.hide();
        } catch (error) {
          this.showError(
            this.getErrorMessage(
              error,
              "Failed to save your notification settings.",
            ),
          );
        } finally {
          this.savingSubscriptions = false;
          this.updateControlState();
        }
      },

      /**
       * Cancel changes, restore the last saved state, and close the modal.
       * @param {Event} event The click event.
       */
      cancelChanges(event) {
        if (event) event.preventDefault();
        this.resetFormToSavedState();
        this.hide();
      },

      /**
       * Hide the modal.
       */
      hide() {
        if (this.modalInitialized) {
          this.$el.modal("hide");
        }
      },

      /**
       * Reset unsaved form edits after the modal closes.
       */
      handleHidden() {
        this.resetFormToSavedState();
      },

      /**
       * Reset checkboxes to the last loaded or saved subscription state.
       */
      resetFormToSavedState() {
        this.setCheckboxes(this.savedResourceTypes);
        if (!this.getSetupError()) this.removeError();
        this.updateControlState();
      },

      /**
       * Set the last saved subscription state from service response values.
       * Unsupported resource types are ignored.
       * @param {string[]} resourceTypes Resource type names returned by the
       * service.
       */
      setSavedResourceTypes(resourceTypes) {
        const subscribedTypeKeys = new Set(
          Array.isArray(resourceTypes) ? resourceTypes : [],
        );

        this.savedResourceTypes = this.resourceTypeOptions
          .filter((option) => subscribedTypeKeys.has(option.type))
          .map((option) => option.type);

        this.setCheckboxes(this.savedResourceTypes);
      },

      /**
       * Set checkbox values from resource type names.
       * @param {string[]} resourceTypes Resource type names to check.
       */
      setCheckboxes(resourceTypes) {
        const selectedTypeKeys = new Set(
          Array.isArray(resourceTypes) ? resourceTypes : [],
        );

        this.resourceTypeOptions.forEach((option) => {
          const checkbox = this.checkboxes[option.type];
          if (checkbox) {
            checkbox.checked = selectedTypeKeys.has(option.type);
          }
        });
      },

      /**
       * Get selected resource type names in configured display order.
       * @returns {string[]} Selected resource types.
       */
      getSelectedResourceTypes() {
        return this.resourceTypeOptions
          .filter((option) => {
            const checkbox = this.checkboxes[option.type];
            return checkbox?.checked;
          })
          .map((option) => option.type);
      },

      /**
       * Diff selected types against the last saved types.
       * @param {string[]} selectedResourceTypes Current selected resource
       * types.
       * @returns {{toSubscribe: string[], toUnsubscribe: string[]}} Resource
       * type changes.
       */
      getSubscriptionChanges(selectedResourceTypes) {
        const selectedKeys = new Set(selectedResourceTypes);
        const savedKeys = new Set(this.savedResourceTypes);

        return {
          toSubscribe: selectedResourceTypes.filter(
            (type) => !savedKeys.has(type),
          ),
          toUnsubscribe: this.savedResourceTypes.filter(
            (type) => !selectedKeys.has(type),
          ),
        };
      },

      /**
       * Unsubscribe from a notification type.
       * @param {string} resourceType The resource type to unsubscribe from.
       * @returns {Promise<void>} Resolves when the unsubscription is complete.
       */
      async unsubscribe(resourceType) {
        const client = await this.ensureClient();
        await client.unsubscribe({ pid: this.pid, resourceType });
      },

      /**
       * Enable or disable controls based on loading and setup state.
       */
      updateControlState() {
        const busy = this.loadingSubscriptions || this.savingSubscriptions;
        const setupError = this.getSetupError();
        const canSave = !busy && this.loadedSubscriptions && !setupError;
        const disableCheckboxes =
          busy || !this.loadedSubscriptions || !!setupError;

        Object.values(this.checkboxes).forEach((checkbox) => {
          const row = checkbox.closest(`.${CLASS_NAMES.typeRow}`);
          row?.classList.toggle(CLASS_NAMES.typeRowDisabled, disableCheckboxes);

          if (disableCheckboxes) {
            checkbox.setAttribute("disabled", "disabled");
          } else {
            checkbox.removeAttribute("disabled");
          }
        });

        if (this.saveButton) {
          this.saveButton.disabled = !canSave;
          this.saveButton.classList.toggle("disabled", !canSave);
          this.saveButton.textContent = this.savingSubscriptions
            ? "Saving..."
            : "Save";
        }

        if (this.cancelButton) {
          this.cancelButton.disabled = this.savingSubscriptions;
          this.cancelButton.classList.toggle(
            "disabled",
            this.savingSubscriptions,
          );
        }
      },

      /**
       * Display a status message inside the modal.
       * @param {string|HTMLElement} message Status message.
       * @param {string} [classes] Alert classes.
       */
      showStatus(message, classes = CLASS_NAMES.statusInfo) {
        if (!this.statusEl) return;

        if (!message) {
          this.statusEl.innerHTML = "";
          this.statusEl.style.display = "none";
          return;
        }

        this.statusEl.className = `${CLASS_NAMES.status} ${classes}`;
        this.statusEl.innerHTML = "";
        if (typeof message === "string") {
          this.statusEl.textContent = message;
        } else {
          this.statusEl.appendChild(message);
        }
        this.statusEl.style.display = "";
      },

      /**
       * Display an error message in the view.
       * @param {string} message The error message to display.
       */
      showError(message) {
        if (message === MESSAGES.SIGN_IN) {
          this.showStatus(message, CLASS_NAMES.statusInfo);
          this.updateTooltip(message);
          return;
        }

        if (message === MESSAGES.MISSING_EMAIL) {
          this.showMissingEmailPrompt();
          return;
        }

        const messagePrefix =
          "The notification service is unavailable. " +
          "Please try again later or contact support if the issue persists.";

        this.showStatus(
          `${messagePrefix} (${message})`,
          CLASS_NAMES.statusError,
        );
        this.updateTooltip(message);
      },

      /**
       * Prompt users without an email address to update account settings.
       */
      showMissingEmailPrompt() {
        const prompt = document.createElement("span");
        const link = document.createElement("a");
        link.href = this.getAccountSettingsUrl();
        link.textContent = "account settings page";

        prompt.append(
          "Enter an email address on your ",
          link,
          " before managing notifications.",
        );

        this.showStatus(prompt, CLASS_NAMES.statusInfo);
        this.updateTooltip(MESSAGES.MISSING_EMAIL);
      },

      /**
       * Remove the active status/error message.
       */
      removeError() {
        this.showStatus("");
        this.updateTooltip("");
      },

      /**
       * Update the opener button title with the current error when possible.
       * @param {string} message Tooltip text.
       */
      updateTooltip(message) {
        const { buttonEl } = this.options;
        if (!buttonEl) return;

        if (message) {
          buttonEl.setAttribute("title", message);
        } else {
          buttonEl.removeAttribute("title");
        }
      },

      /**
       * Show the notification email address in the modal footer when available.
       */
      updateEmailMessage() {
        if (!this.footerMessageEl) return;

        const emailAddress = this.getEmailAddress();
        this.footerMessageEl.textContent = emailAddress
          ? `Notifications will be sent to ${emailAddress}`
          : "";
      },

      /**
       * Validate that a PID has been provided.
       * @param {string} pid The PID to validate.
       * @returns {boolean} True when the PID is non-empty.
       */
      validatePid(pid) {
        return typeof pid === "string" && pid.trim().length > 0;
      },

      /**
       * Return a setup error that blocks loading or saving.
       * @returns {string|null} Error message or null.
       */
      getSetupError() {
        const featureEnabled = !!MetacatUI.appModel.get(
          "enableNotificationService",
        );
        if (!featureEnabled) {
          return "The Notification Service feature is not available on this repository.";
        }

        if (!GET_USER_MODEL().get("loggedIn")) {
          return MESSAGES.SIGN_IN;
        }

        if (!this.getEmailAddress()) {
          return MESSAGES.MISSING_EMAIL;
        }

        if (!this.validatePid(this.pid)) {
          return "A dataset identifier is required to manage notifications.";
        }

        if (!this.getPrefixUrl()) {
          return "A Notification Service URL must be configured before sending requests.";
        }

        const resourceTypeOptions = this.resourceTypeOptions.length
          ? this.resourceTypeOptions
          : this.getResourceTypes();

        if (!resourceTypeOptions.length) {
          return "This repository does not support notifications.";
        }

        return null;
      },

      /**
       * Reset the cached client when configuration changes.
       */
      resetClient() {
        this.client = null;
        this.loadedSubscriptions = false;
        this.savedResourceTypes = [];
        this.loadRequestId += 1;

        if (this.rendered) {
          this.render();
          if (this.isVisible()) {
            this.loadSubscriptions();
          }
        }
      },

      /**
       * Handle authentication changes.
       */
      onAuthChange() {
        this.resetClient();
      },

      /**
       * Check whether the modal is visible.
       * @returns {boolean} True when visible.
       */
      isVisible() {
        return this.$el.is(":visible") || this.$el.hasClass("in");
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
       * Retrieve the Notification Service API version.
       * @returns {string|false|undefined} The configured API version.
       * Undefined allows the notification client to use its default version.
       */
      getApiVersion() {
        if (this.options.apiVersion !== undefined) {
          return this.options.apiVersion;
        }
        return MetacatUI.appModel.get("notificationServiceApiVersion");
      },

      /**
       * Retrieve configured resource types.
       * @returns {Array.<{type: string, label: string, description: string}>}
       * The resource type display options.
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
       * Get the modal title.
       * @returns {string} Modal title.
       */
      getModalTitle() {
        const datasetTitle = this.getDatasetTitle();
        return datasetTitle
          ? `Manage notifications for ${datasetTitle}`
          : "Manage notifications";
      },

      /**
       * Get a dataset title from options, model, or PID.
       * @returns {string} Dataset title.
       */
      getDatasetTitle() {
        if (this.options.title) return this.asString(this.options.title);

        const model = this.metadataModel || this.model;
        if (model && typeof model.get === "function") {
          const title =
            model.get("title") || model.get("name") || model.get("id");
          const text = this.asString(Array.isArray(title) ? title[0] : title);
          if (text) return text;
        }

        return this.asString(this.pid);
      },

      /**
       * Get the email address the notification service will use.
       * @returns {string} Email address.
       */
      getEmailAddress() {
        const user = GET_USER_MODEL();
        return this.asString(user.get("email")).trim();
      },

      /**
       * Get the user's account settings URL.
       * @returns {string} Account settings URL.
       */
      getAccountSettingsUrl() {
        const username = this.asString(GET_USER_MODEL().get("username")).trim();
        const profilePath = username ? `profile/${username}` : "my-profile";

        return `${MetacatUI.root}/${profilePath}/s=settings/s=account`;
      },

      /**
       * Get a readable error message.
       * @param {Error|string} error Error value.
       * @param {string} fallback Fallback message.
       * @returns {string} Error message.
       */
      getErrorMessage(error, fallback) {
        if (error?.message) return error.message;
        if (typeof error === "string") return error;
        return fallback;
      },

      /**
       * Convert any value to a string.
       * @param {*} value Value to convert.
       * @returns {string} String value.
       */
      asString(value) {
        if (value === null || value === undefined) return "";
        return String(value);
      },

      /**
       * Cleanup listeners when the view is removed.
       * @returns {NotificationServiceView} The view instance.
       */
      onClose() {
        this.stopListening();
        this.$el.off(".notificationService");
        if (this.modalInitialized) {
          this.$el.modal("hide");
          this.$el.data("modal", null);
        }
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return NotificationServiceView;
});
