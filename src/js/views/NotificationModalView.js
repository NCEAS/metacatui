define([
  "jquery",
  "backbone",
  "models/ObjectNotification",
  "common/Utilities",
  `text!${MetacatUI.root}/css/notification-modal.css`,
], ($, Backbone, ObjectNotification, Utilities, NotificationModalViewCSS) => {
  "use strict";

  const BASE_CLASS = "notification-modal";
  const CSS_ID = "notificationModalView";

  const BOOTSTRAP_CLASS_NAMES = {
    button: "btn",
    buttonPrimary: "btn-primary",
    buttonSecondary: "btn-secondary",
    close: "close",
    disabled: "disabled",
    fade: "fade",
    hide: "hide",
    modal: "modal",
    modalBody: "modal-body",
    modalContent: "modal-content",
    modalDialog: "modal-dialog",
    modalFooter: "modal-footer",
    modalHeader: "modal-header",
    modalTitle: "modal-title",
  };

  const HTML_ATTRS = {
    disabled: "disabled",
  };

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

  const { ERROR_CODES } = ObjectNotification;

  const MESSAGES = {
    ACCOUNT_SETTINGS_LINK_TEXT: "account settings page",
    CANCEL: "Cancel",
    CLIENT_UNAVAILABLE: "The notification client failed to load.",
    FEATURE_DISABLED:
      "The Notification Service feature is not available on this repository.",
    FOOTER_EMAIL_PREFIX: "Notifications will be sent to ",
    LOAD_FAILED: "Failed to load your notification settings.",
    LOADING: "Loading your current notification settings...",
    MISSING_EMAIL: "An email address is required to manage notifications.",
    MISSING_EMAIL_PROMPT_PREFIX: "Enter an email address on your ",
    MISSING_EMAIL_PROMPT_SUFFIX: " before managing notifications.",
    MODAL_TITLE_DEFAULT: "Manage notifications",
    MODAL_TITLE_PREFIX: "Manage notifications for ",
    PID_REQUIRED: "A dataset identifier is required to manage notifications.",
    RESOURCE_TYPES_UNSUPPORTED:
      "This repository does not support notifications.",
    SAVE: "Save",
    SAVE_FAILED: "Failed to save your notification settings.",
    SAVING: "Saving notification settings...",
    SAVING_BUTTON: "Saving...",
    SERVICE_UNAVAILABLE_PREFIX:
      "The notification service is unavailable. Please try again later or contact support if the issue persists.",
    SERVICE_URL_REQUIRED:
      "A Notification Service URL must be configured before sending requests.",
    SIGN_IN_REQUIRED: "Sign in to manage notifications.",
    STILL_LOADING: "Notification settings are still loading.",
  };

  /**
   * @class NotificationModalView
   * @classdesc Modal for subscribing and unsubscribing to notifications for a
   * single DataONE object identifier.
   * @classcategory Views
   * @augments Backbone.View
   * @since 0.0.0
   */
  const NotificationModalView = Backbone.View.extend(
    /** @lends NotificationModalView.prototype */ {
      /**
       * Classes to add to the modal.
       * @type {string}
       */
      className: `${BOOTSTRAP_CLASS_NAMES.modal} ${BOOTSTRAP_CLASS_NAMES.fade} ${BOOTSTRAP_CLASS_NAMES.hide} ${BASE_CLASS}`,

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
       * @returns {HTMLElement} Modal element.
       */
      template({ title }) {
        const template = document.createElement("template");
        const BC = BOOTSTRAP_CLASS_NAMES;
        const C = CLASS_NAMES;
        const titleId = `${IDS.TITLE}-${this.cid}`;
        template.innerHTML = `
          <div class="${BC.modalDialog} ${C.modalDialog}" role="document">
            <div class="${BC.modalContent} ${C.modalContent}">
              <div class="${BC.modalHeader} ${C.modalHeader}">
                <button type="button" class="${BC.close} ${C.closeButton}" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
                <h5 class="${BC.modalTitle} ${C.modalTitle}" id="${titleId}">${Utilities.encodeHTML(title)}</h5>
              </div>
              <div class="${BC.modalBody} ${C.modalBody}">
                <div class="${C.status}" role="status" aria-live="polite"></div>
                <form class="${C.form}"></form>
              </div>
              <div class="${BC.modalFooter} ${C.modalFooter}">
                <div class="${C.footerMessage}"></div>
                <div class="${C.footerActions}">
                  <button type="button" class="${BC.button} ${BC.buttonSecondary} ${C.cancelButton}">${MESSAGES.CANCEL}</button>
                  <button type="button" class="${BC.button} ${BC.buttonPrimary} ${C.saveButton}">${MESSAGES.SAVE}</button>
                </div>
              </div>
            </div>
          </div>
        `;
        return template.content.querySelector(`.${C.modalDialog}`);
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
       * @param {ObjectNotification} [options.model] Model for this modal.
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
        this.model =
          this.options.model ||
          new ObjectNotification({
            apiVersion: this.options.apiVersion,
            metadataModel: this.options.metadataModel || null,
            pid: this.options.pid,
            prefixUrl: this.options.prefixUrl,
            resourceTypes: this.options.resourceTypes,
            title: this.options.title,
          });

        this.modalInitialized = false;
        this.rendered = false;

        MetacatUI.appModel.addCSS(NotificationModalViewCSS, CSS_ID);

        this.stopListening();
        this.listenTo(
          this.model,
          "subscriptions:saved",
          this.handleSubscriptionsSaved,
        );
        this.listenTo(this.model, "notifications:reset", this.handleModelReset);
      },

      /**
       * Render the notification subscription modal.
       * @returns {NotificationModalView} The view instance.
       */
      render() {
        this.model.refreshResourceTypes();
        this.el.innerHTML = "";
        this.el.appendChild(
          this.template({
            title: this.getModalTitle(),
          }),
        );

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

        const setupError = this.model.getSetupError();
        if (setupError) {
          this.showError(setupError);
        } else {
          this.removeError();
        }

        this.setCheckboxes(this.model.get("savedResourceTypes"));
        this.updateControlState();
        this.initializeModal();
        this.rendered = true;

        return this;
      },

      /**
       * Make the modal visible and fetch the user's current subscriptions.
       * @returns {NotificationModalView} The view instance.
       */
      show() {
        this.render();
        this.$el.modal("show");
        this.loadSubscriptions();
        return this;
      },

      /** Initialize Bootstrap modal behavior and modal lifecycle events */
      initializeModal() {
        if (!this.modalInitialized) {
          this.$el.on(
            "hidden.notificationSubscriptionModal",
            this.handleHidden.bind(this),
          );
          this.$el.modal({ show: false });
          this.modalInitialized = true;
        }
      },

      /**
       * Fetch the current subscriptions for this PID and update the checkboxes.
       * @returns {Promise<void>} Resolves when subscriptions have loaded.
       */
      async loadSubscriptions() {
        const setupError = this.model.getSetupError();
        if (setupError) {
          this.showError(setupError);
          this.updateControlState();
          return;
        }

        this.showStatus(MESSAGES.LOADING);
        const loadPromise = this.model.loadSubscriptions();
        this.updateControlState();

        try {
          await loadPromise;
          this.setCheckboxes(this.model.get("savedResourceTypes"));
          this.removeError();
        } catch (error) {
          this.showError(error, "LOAD_FAILED");
        } finally {
          this.updateControlState();
        }
      },

      /** Render all configured resource type checkboxes */
      renderNotificationTypes() {
        this.checkboxes = {};
        if (!this.form) return;

        this.form.innerHTML = "";
        this.model.get("resourceTypeOptions").forEach((option) => {
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
        if (this.model.get("savingSubscriptions")) return;

        const setupError = this.model.getSetupError();
        if (setupError) {
          this.showError(setupError);
          this.updateControlState();
          return;
        }

        this.showStatus(MESSAGES.SAVING);
        const savePromise = this.model.saveSubscriptions(
          this.getSelectedResourceTypes(),
        );
        this.updateControlState();

        try {
          const result = await savePromise;
          this.setCheckboxes(this.model.get("savedResourceTypes"));
          this.removeError();
          this.hide();

          if (!result.changed) {
            this.resetFormToSavedState();
          }
        } catch (error) {
          this.showError(error, "SAVE_FAILED");
        } finally {
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

      /** Hide the modal */
      hide() {
        if (this.modalInitialized) {
          this.$el.modal("hide");
        }
      },

      /** Reset unsaved form edits after the modal closes */
      handleHidden() {
        this.resetFormToSavedState();
      },

      /** Re-render after model configuration or auth changes */
      handleModelReset() {
        if (!this.rendered) return;

        this.render();
        if (this.isVisible()) {
          this.loadSubscriptions();
        }
      },

      /**
       * Re-emit the model saved event for parent views.
       * @param {object} payload Saved subscription payload.
       */
      handleSubscriptionsSaved(payload) {
        this.trigger("subscriptions:saved", payload);
      },

      /** Reset checkboxes to the last loaded or saved subscription state */
      resetFormToSavedState() {
        this.setCheckboxes(this.model.get("savedResourceTypes"));
        if (!this.model.getSetupError()) this.removeError();
        this.updateControlState();
      },

      /**
       * Set checkbox values from resource type names.
       * @param {string[]} resourceTypes Resource type names to check.
       */
      setCheckboxes(resourceTypes) {
        const selectedTypeKeys = new Set(
          Array.isArray(resourceTypes) ? resourceTypes : [],
        );

        this.model.get("resourceTypeOptions").forEach((option) => {
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
        return this.model
          .get("resourceTypeOptions")
          .filter((option) => {
            const checkbox = this.checkboxes[option.type];
            return checkbox?.checked;
          })
          .map((option) => option.type);
      },

      /** Enable or disable controls based on loading and setup state */
      updateControlState() {
        const busy =
          this.model.get("loadingSubscriptions") ||
          this.model.get("savingSubscriptions");
        const setupError = this.model.getSetupError();
        const canSave =
          !busy && this.model.get("loadedSubscriptions") && !setupError;
        const disableCheckboxes =
          busy || !this.model.get("loadedSubscriptions") || !!setupError;

        Object.values(this.checkboxes).forEach((checkbox) => {
          const row = checkbox.closest(`.${CLASS_NAMES.typeRow}`);
          row?.classList.toggle(CLASS_NAMES.typeRowDisabled, disableCheckboxes);

          if (disableCheckboxes) {
            checkbox.setAttribute(HTML_ATTRS.disabled, HTML_ATTRS.disabled);
          } else {
            checkbox.removeAttribute(HTML_ATTRS.disabled);
          }
        });

        if (this.saveButton) {
          this.saveButton.disabled = !canSave;
          this.saveButton.classList.toggle(
            BOOTSTRAP_CLASS_NAMES.disabled,
            !canSave,
          );
          this.saveButton.textContent = this.model.get("savingSubscriptions")
            ? MESSAGES.SAVING_BUTTON
            : MESSAGES.SAVE;
        }

        if (this.cancelButton) {
          const saving = this.model.get("savingSubscriptions");
          this.cancelButton.disabled = saving;
          this.cancelButton.classList.toggle(
            BOOTSTRAP_CLASS_NAMES.disabled,
            saving,
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
       * @param {Error|string} error Error or error code.
       * @param {string} [fallbackCode] Fallback message code.
       */
      showError(error, fallbackCode) {
        const code = this.getErrorCode(error, fallbackCode);
        const message = this.getErrorMessage(code);

        if (code === ERROR_CODES.SIGN_IN_REQUIRED) {
          this.showStatus(message, CLASS_NAMES.statusInfo);
          this.updateTooltip(message);
          return;
        }

        if (code === ERROR_CODES.MISSING_EMAIL) {
          this.showMissingEmailPrompt();
          return;
        }

        const statusMessage = MESSAGES[code]
          ? message
          : `${MESSAGES.SERVICE_UNAVAILABLE_PREFIX} (${message})`;
        this.showStatus(statusMessage, CLASS_NAMES.statusError);
        this.updateTooltip(message);
      },

      /** Prompt users without an email address to update account settings */
      showMissingEmailPrompt() {
        const prompt = document.createElement("span");
        const link = document.createElement("a");
        link.href = this.model.getAccountSettingsUrl();
        link.textContent = MESSAGES.ACCOUNT_SETTINGS_LINK_TEXT;

        prompt.append(
          MESSAGES.MISSING_EMAIL_PROMPT_PREFIX,
          link,
          MESSAGES.MISSING_EMAIL_PROMPT_SUFFIX,
        );

        this.showStatus(prompt, CLASS_NAMES.statusInfo);
        this.updateTooltip(MESSAGES.MISSING_EMAIL);
      },

      /** Remove the active status/error message */
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

      /** Show the notification email address in the modal footer */
      updateEmailMessage() {
        if (!this.footerMessageEl) return;

        const emailAddress = this.model.getEmailAddress();
        this.footerMessageEl.textContent = emailAddress
          ? `${MESSAGES.FOOTER_EMAIL_PREFIX}${emailAddress}`
          : "";
      },

      /**
       * Get the modal title.
       * @returns {string} Modal title.
       */
      getModalTitle() {
        const datasetTitle = this.model.getDatasetTitle();
        return datasetTitle
          ? `${MESSAGES.MODAL_TITLE_PREFIX}${datasetTitle}`
          : MESSAGES.MODAL_TITLE_DEFAULT;
      },

      /**
       * Get an error code from an Error, string, or fallback.
       * @param {Error|string} error Error or code.
       * @param {string} [fallbackCode] Fallback code.
       * @returns {string} Error code.
       */
      getErrorCode(error, fallbackCode) {
        if (error?.message) return error.message;
        if (typeof error === "string") return error;
        return fallbackCode;
      },

      /**
       * Get a display message for an error code.
       * @param {string} code Error code.
       * @returns {string} Display message.
       */
      getErrorMessage(code) {
        return MESSAGES[code] || code || MESSAGES.SERVICE_UNAVAILABLE_PREFIX;
      },

      /**
       * Check whether the modal is visible.
       * @returns {boolean} True when visible.
       */
      isVisible() {
        return this.$el.is(":visible") || this.$el.hasClass("in");
      },

      /**
       * Cleanup listeners when the view is removed.
       * @returns {NotificationModalView} View instance.
       */
      onClose() {
        this.stopListening();
        this.$el.off(".notificationSubscriptionModal");
        if (this.modalInitialized) {
          this.$el.modal("hide");
          this.$el.data("modal", null);
        }
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return NotificationModalView;
});
