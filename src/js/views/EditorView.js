define([
  "require",
  "underscore",
  "jquery",
  "backbone",
  "views/SignInView",
  "text!templates/editorSubmitMessage.html",
], (localRequire, _, $, Backbone, SignInView, EditorSubmitMessageTemplate) => {
  /**
   * @class EditorView
   * @classdesc A basic shell of a view, primarily meant to be extended for views that allow editing capabilities.
   * @classcategory Views
   * @name EditorView
   * @augments Backbone.View
   * @constructs
   */
  const EditorView = Backbone.View.extend(
    /** @lends EditorView.prototype */ {
      /**
       * References to templates for this view. HTML files are converted to Underscore.js templates
       */
      editorSubmitMessageTemplate: _.template(EditorSubmitMessageTemplate),

      /**
       * The element this view is contained in. A jQuery selector or the element itself.
       * @type {string|DOMElement}
       */
      el: "#Content",

      /**
       * The text to use in the editor submit button
       * @type {string}
       */
      submitButtonText: "Save",

      /**
       * The text to use in the editor submit button
       * @type {string}
       */
      accessPolicyModalID: "editor-access-policy-modal",

      /**
       * The selector for the HTML element that will contain a button/link/control for
       * opening the AccessPolicyView modal window. If this element doesn't exist on the page,
       * then the AccessPolicyView will be inserted into the `accessPolicyViewContainer` directly, rather than a modal window.
       * @type {string}
       */
      accessPolicyControlContainer: ".access-policy-control-container",

      /**
       * The selector for the HTML element that will contain the AccessPolicyView.
       * If this element doesn't exist on the page, then the AccessPolicyView will not be inserted into the page.
       * If a `accessPolicyControlContainer` element is on the page, then this element will
       * contain the modal window element.
       * @type {string}
       */
      accessPolicyViewContainer: ".access-policy-view-container",
      /**
       * The events this view will listen to and the associated function to call
       * @type {object}
       */
      events: {
        "click #save-editor": "save",
        "click .access-policy-control": "showAccessPolicyModal",
        "keypress input:not(.ignore-changes)": "showControls",
        "keypress textarea:not(.ignore-changes)": "showControls",
        "keypress [contenteditable]:not(.ignore-changes)": "showControls",
        "click .image-uploader": "showControls",
        "change .access-policy-view": "showControls",
        "click .access-policy-view .remove": "showControls",
      },

      /**
       * Renders this view
       */
      render() {
        // Style the body as an Editor
        $("body").addClass("Editor rendering");

        this.delegateEvents();

        // If there is no active alternate repository, set one
        if (
          !MetacatUI.appModel.getActiveAltRepo() &&
          MetacatUI.appModel.get("alternateRepositories").length
        ) {
          MetacatUI.appModel.setActiveAltRepo();
        }
      },

      /**
       * Set listeners on the view's model.
       * This function centralizes all the listeners so that when/if the view's
       * model is replaced, the listeners can be reset.
       */
      setListeners() {
        // Stop listening first
        this.stopListening(this.model, "errorSaving", this.saveError);
        this.stopListening(this.model, "successSaving", this.saveSuccess);
        this.stopListening(this.model, "invalid", this.showValidation);

        // Set listeners
        this.listenTo(this.model, "errorSaving", this.saveError);
        this.listenTo(this.model, "successSaving", this.saveSuccess);
        this.listenTo(this.model, "invalid", this.showValidation);

        // //Set a beforeunload event only if there isn't one already
        // if( !this.beforeunloadCallback ){
        //   var view = this;
        //   //When the Window is about to be closed, show a confirmation message
        //   this.beforeunloadCallback = function(e){
        //     if( !view.canClose() ){
        //       //Browsers don't support custom confirmation messages anymore,
        //       // so preventDefault() needs to be called or the return value has to be set
        //       e.preventDefault();
        //       e.returnValue = "";
        //     }
        //     return;
        //   }
        //   window.addEventListener("beforeunload", this.beforeunloadCallback);
        // }
      },

      /**
       * Show Sign In buttons
       */
      showSignIn() {
        const container = $(document.createElement("div")).addClass(
          "container center",
        );
        this.$el.html(container);
        const signInButtons = new SignInView().render().el;
        $(container).append("<h1>Sign in to submit data</h1>", signInButtons);
      },

      /**
       * Saves the model
       */
      save() {
        this.showSaving();
        this.model.save();
      },

      /**
       * Cancel all edits in the editor by simply re-rendering the view
       */
      cancel() {
        this.render();
      },

      /**
       * Trigger a save error with a message that the save was cancelled
       */
      handleSaveCancel() {
        if (this.model.get("uploadStatus") === "e") {
          this.saveError("Your submission was cancelled due to an error.");
        }
      },

      /**
       * Adds top-level control elements to this editor.
       */
      renderEditorControls() {
        // If the AccessPolicy editor is enabled, add a button for opening it
        if (MetacatUI.appModel.get("allowAccessPolicyChanges")) {
          this.renderAccessPolicyControl();
        }
      },

      /**
       * Adds a Share button for editing the access policy
       */
      renderAccessPolicyControl() {
        // If the AccessPolicy editor is enabled, add a button for opening it
        if (this.isAccessPolicyEditEnabled()) {
          const isHiddenBehindControl =
            this.$(this.accessPolicyControlContainer).length > 0;

          // Render the AccessPolicy control, if the container element is on the page
          if (isHiddenBehindControl) {
            // If it isn't, then add it to the page.
            // Create an anchor tag with an icon and the text "Share" and add it to the editor controls container
            this.$(this.accessPolicyControlContainer).prepend(
              $(document.createElement("a"))
                .attr("href", "#")
                .addClass("access-policy-control btn")
                .append(
                  $(document.createElement("i")).addClass(
                    "icon-group icon icon-on-left",
                  ),
                  "Share",
                ),
            );
          }

          // If the authorization has already been checked
          if (this.model.get("isAuthorized_changePermission") === true) {
            // Render the AccessPolicyView
            this.renderAccessPolicy();
          } else {
            // When the user's changePermission authority has been checked, edit their
            //  access to the AccessPolicyView
            this.listenToOnce(
              this.model,
              "change:isAuthorized_changePermission",
              () => {
                // If there is an AccessPolicy control, disable it
                if (isHiddenBehindControl) {
                  if (
                    this.model.get("isAuthorized_changePermission") === false
                  ) {
                    // Disable the button for the AccessPolicyView if the user is not authorized
                    this.$(".access-policy-control")
                      .attr("disabled", "disabled")
                      .attr(
                        "title",
                        `You do not have access to change the ${MetacatUI.appModel.get(
                          "accessPolicyName",
                        )}`,
                      )
                      .addClass("disabled");
                  }
                } else {
                  // Render the AccessPolicyView
                  this.renderAccessPolicy();
                }
              },
            );

            // Check the user's authority to change permissions on this object
            this.model.checkAuthority("changePermission");
          }
        }
      },

      /**
       * Shows the AccessPolicyView for the object being edited.
       * @param {Event} e Click event
       * @param {Backbone.Model|null} [model] Model to show the view for
       * @param {object} [options] Access policy view options
       * @param {boolean} [options.packageLevel] Whether this edits package
       * level sharing
       */
      showAccessPolicyModal(e, model, options = {}) {
        try {
          // Exit if the AccessPolicy editor is disabled in this app, or if the
          // clicked control is disabled. Check the clicked control specifically,
          // not the first one in the view, so one disabled row does not block
          // sharing on other rows.
          const control = $(e.currentTarget);
          if (
            !MetacatUI.appModel.get("allowAccessPolicyChanges") ||
            control.attr("disabled") === "disabled" ||
            control.hasClass("disabled")
          ) {
            return;
          }

          this.once("accessPolicyViewRendered", () => {
            // Add modal classes to the access policy view
            this.$(".access-policy-view")
              .addClass("access-policy-view-modal modal")
              .css("height", window.outerHeight * 0.7)
              .modal()
              .modal("show");
          });

          this.renderAccessPolicy(model, options);
        } catch (error) {
          console.error("Error trying to show the AccessPolicyView: ", error);
        }
      },

      /**
       * Shows a loading state in the AccessPolicy modal.
       * @param {Event} e Click event
       * @param {string} [message] Loading message
       * @returns {boolean} Whether the loading modal was shown
       * @since 0.0.0
       */
      showAccessPolicyLoadingModal(e, message = "Loading sharing settings...") {
        try {
          const control = $(e.currentTarget);
          if (
            !MetacatUI.appModel.get("allowAccessPolicyChanges") ||
            control.attr("disabled") === "disabled" ||
            control.hasClass("disabled")
          ) {
            return false;
          }

          const modal = $(document.createElement("div"))
            .addClass("access-policy-view access-policy-view-modal modal")
            .css("height", window.outerHeight * 0.7)
            .html(
              `<div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h4><i class="icon icon-group icon-on-left"></i>${_.escape(
                  MetacatUI.appModel.get("accessPolicyName"),
                )}</h4>
              </div>
              <div class="modal-body">
                <p class="subtle">
                  <i class="icon icon-spinner icon-spin icon-on-left"></i>${_.escape(message)}
                </p>
              </div>
              <div class="modal-footer">
                <a class="btn cancel" href="#" data-dismiss="modal">Cancel</a>
              </div>`,
            );

          this.removeAccessPolicyView();
          this.$(this.accessPolicyViewContainer).html(modal);
          modal.modal().modal("show");
          return true;
        } catch (error) {
          console.error(
            "Error trying to show the AccessPolicyView loading modal: ",
            error,
          );
          return false;
        }
      },

      /**
       * Shows an error in the AccessPolicy modal body.
       * @param {string} message Error message
       * @since 0.0.0
       */
      showAccessPolicyLoadError(message) {
        const modal = this.$(
          `${this.accessPolicyViewContainer} .access-policy-view-modal`,
        );
        if (!modal.length) {
          return;
        }

        modal
          .find(".modal-body")
          .html(
            `<div class="alert alert-error">${_.escape(
              message || "Sharing settings could not be loaded.",
            )}</div>`,
          );
        modal
          .find(".modal-footer")
          .html(
            '<a class="btn cancel" href="#" data-dismiss="modal">Close</a>',
          );
      },

      /**
       * Renders the AccessPolicyView
       * @param {Backbone.Model} [model] Model to render
       * @param {object} [options] Access policy view options
       * @param {Array<object>} [options.policy] System Metadata access policy
       * @param {object} [options.policyContext] Policy display/editor context
       * @param {Function} [options.onApply] Async apply callback
       * @param {boolean} [options.packageLevel] Whether this edits package
       * level sharing
       */
      renderAccessPolicy(model, options = {}) {
        const hasExplicitPolicy = Object.prototype.hasOwnProperty.call(
          options,
          "policy",
        );
        const accessPolicyModel = model || this.model;

        try {
          // If the AccessPolicy editor is disabled in this app, then exit now
          if (!MetacatUI.appModel.get("allowAccessPolicyChanges")) {
            return;
          }

          const thisView = this;
          localRequire(["views/AccessPolicyView"], (AccessPolicyView) => {
            // Create a new AccessPolicyView using the AccessPolicy collection
            const viewOptions = hasExplicitPolicy
              ? {
                  policy: options.policy,
                  policyContext: options.policyContext,
                  onApply: options.onApply,
                }
              : { collection: accessPolicyModel.get("accessPolicy") };
            const accessPolicyView = new AccessPolicyView(viewOptions);

            // Explicit callers identify package-level sharing directly. Legacy
            // metadata models retain their existing broadcast behavior.
            accessPolicyView.broadcast =
              options.packageLevel === true ||
              (!hasExplicitPolicy &&
                accessPolicyModel.get("type") === "Metadata");

            thisView.removeAccessPolicyView();

            // Store a reference to the AccessPolicyView on this view
            thisView.accessPolicyView = accessPolicyView;

            const existingModal = thisView.$(
              `${thisView.accessPolicyViewContainer} .access-policy-view-modal`,
            );

            if (existingModal.length) {
              accessPolicyView.setElement(existingModal.first());
            } else {
              // Add the view to the page
              thisView
                .$(thisView.accessPolicyViewContainer)
                .html(accessPolicyView.el);
            }

            // Render the AccessPolicyView
            accessPolicyView.render();

            thisView.trigger("accessPolicyViewRendered");

            thisView.listenTo(
              accessPolicyView.collection,
              "add remove",
              thisView.showControls,
            );
          });
        } catch (e) {
          console.error("Error trying to render the AccessPolicyView: ", e);
        }
      },

      /**
       * Remove the current AccessPolicyView and its editor listener.
       * @since 0.0.0
       */
      removeAccessPolicyView() {
        const { accessPolicyView } = this;
        if (!accessPolicyView) {
          return;
        }

        this.stopListening(
          accessPolicyView.collection,
          "add remove",
          this.showControls,
        );
        accessPolicyView.remove();
        this.accessPolicyView = null;
      },

      /**
       * Returns false in the base editor. Subclasses override this method to
       * enable access policy editing for supported model types.
       * @returns {boolean} Whether access policy editing is enabled
       * @since 2.15.0
       */
      isAccessPolicyEditEnabled() {
        return false;
      },

      /**
       * Show the editor footer controls (Save bar)
       */
      showControls() {
        const view = this;
        this.$(".editor-controls")
          .removeClass("hidden")
          .slideDown(300, () => {
            if (typeof view.handleScroll === "function") {
              view.handleScroll();
            }
          });
      },

      /**
       * Hide the editor footer controls (Save bar)
       */
      hideControls() {
        const view = this;
        this.hideSaving();
        this.$(".editor-controls").slideUp(300, () => {
          if (typeof view.handleScroll === "function") {
            view.handleScroll();
          }
        });
      },

      /**
       * Change the styling of this view to show that the object is in the process of saving
       */
      showSaving() {
        // Change the style of the save button
        this.$("#save-editor")
          .html('<i class="icon icon-spinner icon-spin"></i> Submitting ...')
          .addClass("btn-disabled");

        // Remove all the validation messaging
        this.removeValidation();

        // Get all the inputs in the Editor
        const allInputs = this.$("input, textarea, select, button");

        // Mark the disabled inputs so we can re-disable them later
        allInputs
          .filter(":disabled")
          .not(".label-container .label-input-text")
          .addClass("disabled-saving");

        // Remove the latest success or error alert
        this.$el.children(".alert-container").remove();

        // Disable all the inputs
        allInputs.prop("disabled", true);
      },

      /**
       *  Remove the styles set in showSaving()
       */
      hideSaving() {
        this.$("input, textarea, select, button")
          .not(".label-container .label-input-text")
          .prop("disabled", false);

        this.$(".disabled-saving, input.disabled")
          .not(".label-container .label-input-text")
          .prop("disabled", true)
          .removeClass("disabled-saving");

        // When the package is saved, revert the Save button back to normal
        this.$("#save-editor")
          .html(this.submitButtonText)
          .removeClass("btn-disabled");
      },

      /**
       * Enable the Save button. Resets any changes made in {@link EditorView#disableControls}
       * @since 2.17.1
       */
      enableControls() {
        // When the package is saved, revert the Save button back to normal
        this.$("#save-editor")
          .html(this.submitButtonText)
          .removeClass("btn-disabled")
          .parent()
          .tooltip("destroy");
        this.$(".addFiles")
          .removeClass("btn-disabled")
          .parent()
          .tooltip("destroy");
      },

      /**
       * Disable the Save button and display a message to explain why
       * @param {string} [message] - A short text message to display in the Save button
       * @param {string} tooltipMessage -- A message that is the reason for buttons being disabled. This message will be displayed in a tooltip.
       * @since 2.17.1
       */
      disableControls(message, tooltipMessage = "Files are uploading.") {
        // When the package is saved, revert the Save button back to normal
        this.$("#save-editor")
          .html(message || "Waiting for files to finish uploading...")
          .addClass("btn-disabled")
          .parent() // Add a tooltip to the parent element since tooltips won't work on a disabled button
          .tooltip({
            placement: "top",
            trigger: "hover focus click",
            html: false,
            title: `Saving is disabled. ${tooltipMessage} Please wait...`,
            container: "body",
            delay: 600,
          });
        // When the package is saved, revert the Add button back to normal
        this.$(".addFiles")
          .addClass("btn-disabled")
          .parent()
          // Add a tooltip to the parent element since tooltips won't work on a disabled button
          .tooltip({
            placement: "top",
            trigger: "hover focus click",
            html: false,
            title: `Adding files disabled. ${tooltipMessage} Please wait...`,
            container: "body",
            delay: 600,
          });
      },

      /**
       * Style the view to show that it is loading
       * @param {string|DOMElement} container - The element to put the loading styling in. Either a jQuery selector or the element itself.
       * @param {string|DOMElement} message - The message to display next to the loading icon. Either a jQuery selector or the element itself.
       */
      showLoading(container, message) {
        const target = container || this.$el;

        $(target).html(MetacatUI.appView.loadingTemplate({ msg: message }));
      },

      /**
       * Remove the styles set in showLoading()
       * @param {string|DOMElement} container - The element the loading message is conttained in. Either a jQuery selector or the element itself.
       */
      hideLoading(container) {
        const target = container || this.$el;

        $(target).find(".loading").remove();
      },

      /**
       * Called when there is no object found with this ID
       */
      showNotFound() {
        // If we haven't checked the logged-in status of the user yet, wait a bit until we show a 404 msg, in case this content is their private content
        if (!MetacatUI.appUserModel.get("checked")) {
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            this.showNotFound,
          );
          return;
        }
        // If the user is not logged in
        if (!MetacatUI.appUserModel.get("loggedIn")) {
          this.showSignIn();
          return;
        }

        if (!this.model.get("notFound")) return;

        const msg =
          "<h4>Nothing was found for one of the following reasons:</h4>" +
          "<ul class='indent'>" +
          `<li>The ID <span id='editor-view-not-found-pid'>${this.pid}</span> does not exist.</li>` +
          '<li>This may be private content. (Are you <a href="<%= MetacatUI.root %>/signin">signed in?</a>)</li>' +
          "<li>The content was removed because it was invalid.</li>" +
          "</ul>";

        this.showFullPageAlert(
          msg,
          "error",
          `Unable to find the dataset with ID ${this.pid}`,
        );
      },

      /**
       * Check the validity of this view's model
       */
      checkValidity() {
        if (this.model.isValid()) this.model.trigger("valid");
      },

      /**
       * Show validation errors, if there are any
       */
      showValidation() {
        this.saveError(
          "Unable to save. Either required information is missing or isn't filled out correctly.",
        );
      },

      /**
       * Removes all the validation error styling and messaging from this view
       */
      removeValidation() {
        this.$(".notification.error").removeClass("error").empty();
        this.$(".validation-error-icon").hide();
      },

      /**
       * When the object is saved successfully, tell the user
       */
      saveSuccess() {
        const message = this.editorSubmitMessageTemplate({
          messageText: "Your changes have been submitted.",
          viewURL: MetacatUI.appModel.get("baseUrl"),
          buttonText: "Return home",
        });

        MetacatUI.appView.showAlert(message, "alert-success", this.$el, null, {
          remove: true,
        });

        this.hideSaving();
      },

      /**
       * When the object fails to save, tell the user
       * @param {string} errorMsg - The error message resulting from a failed attempt to save
       */
      saveError(errorMsg) {
        const messageContainer = $(document.createElement("div")).append(
          document.createElement("p"),
        );
        const messageParagraph = messageContainer.find("p");
        const messageClasses = "alert-error";

        messageParagraph.append(errorMsg);

        // If the model has an error message set on it, show it in a collapseable technical details section
        if (this.model.get("errorMessage")) {
          const errorId = `error${Math.round(Math.random() * 100)}`;
          messageParagraph.after(
            $(document.createElement("p")).append(
              $(document.createElement("a"))
                .text("See technical details")
                .attr("data-toggle", "collapse")
                .attr("data-target", `#${errorId}`)
                .addClass("pointer"),
            ),
            $(document.createElement("div"))
              .addClass("collapse")
              .attr("id", errorId)
              .append(
                $(document.createElement("pre")).text(
                  this.model.get("errorMessage"),
                ),
              ),
          );
        }

        MetacatUI.appView.showAlert(
          messageContainer,
          messageClasses,
          this.$el,
          null,
          {
            emailBody: errorMsg,
            remove: true,
          },
        );

        this.hideSaving();
      },

      /**
       * Empty the body of this view and show a full-page alert message. The
       * message will not be dissmissable, and the user will not be able to
       * interact with the page until they refresh or navigate away. All
       * listeners will be removed.
       * @param {string} message - The message to display in the alert
       * @param {"warning"|"error"|"success"|"info"} type - The type of alert to
       * show. Defaults to "warning".
       * @param {string} [emailBody] - Optional. The body of the email to send
       * when the user clicks the "Email Support" button.
       * @param {string} [emailSubject] - Optional. The subject of the email to send
       * when the user clicks the "Email Support" button.
       * @since 2.34.0
       */
      showFullPageAlert(
        message,
        type = "warning",
        emailBody = "",
        emailSubject = "",
      ) {
        const classes = `alert-${type} centered-block`;
        const container = this.$("#editor-body");
        container.empty();
        MetacatUI.appView.showAlert({
          message,
          classes,
          container,
          emailBody,
          emailSubject,
          remove: false,
        });
        this.hideLoading();
        this.hideControls();
        this.stopListening();
        this.model.off();
      },

      /**
       * Shows the required icons for the sections and fields that must be completed in this editor.
       * @param {object} requiredFields - A literal object that specified which fields should be required.
       *  The keys on the object map to model attributes, and the value is true if required, false if optional.
       */
      renderRequiredIcons(requiredFields) {
        // If no required fields are given, exit now
        if (typeof requiredFields === "undefined") {
          return;
        }

        _.each(Object.keys(requiredFields), (field) => {
          if (requiredFields[field]) {
            const reqEl = this.$(`.required-icon[data-category='${field}']`);

            // Show the required icon for this category/field
            reqEl.show();

            // Show the required icon for the section
            const sectionName = reqEl
              .parents(".section[data-section]")
              .attr("data-section");
            this.$(`.required-icon[data-section='${sectionName}']`).show();
          }
        });

        // When new inputs have been added to this Editor, re-render these required icons.
        // This is helpful when new questions are added to the editor after the intial rendering.
        this.off("editorInputsAdded");
        this.on("editorInputsAdded", () => {
          this.renderRequiredIcons(requiredFields);
        });
      },

      /**
       * Gets a list of required fields for this editor, or an empty object if there are none.
       * @returns {object} Required fields keyed by model attribute
       * @since 2.19.0
       */
      getRequiredFields() {
        return {};
      },

      /**
       * Checks if there are unsaved changes in this Editor that should prevent closing of this view.
       * This function is also executed by the AppView, which controls the top-level navigation.
       * @returns {boolean} Returns true if this view should be closed. False if it should remain opened and active.
       */
      canClose() {
        // If the user isn't logged in, we can leave this view without confirmation
        if (!MetacatUI.appUserModel.get("loggedIn")) return true;

        // If there are no unsaved changes, we can leave this view without confirmation
        if (!this.hasUnsavedChanges()) {
          return true;
        }

        return false;
      },

      /**
       * This function is called whenever the user is about to leave this view.
       * @returns {string} The message that asks the user if they are sure they want to close this view
       */
      getConfirmCloseMessage() {
        // Return a confirmation message
        return "Leave this page? All of your unsaved changes will be lost.";
      },

      /**
       * Returns true if there are unsaved changes in this Editor
       * This function should be extended by each subclass of EditorView to check for unsaved changes for that model type
       * @returns {boolean} Whether this editor has unsaved changes
       */
      hasUnsavedChanges() {
        return true;
      },

      /**
       * Creates an HTML string to display this error message on the page. Errors can be
       * strings, arrays of strings, arrays of literal objects with string values, or a literal object with strings as the values.
       * @param {string|string[]|object} error A single error message in string format or a collection of error strings as an array or object
       * @returns {string} The error message HTML
       * @since 2.18.0
       */
      getErrorListItem(error) {
        try {
          let errorMessage = "";

          // Strings get added to a list item HTML element
          if (typeof error === "string" && error.trim().length) {
            return `<li>${error}</li>`;
          }
          // If the error is an array, iterate over each error in the array
          if (Array.isArray(error)) {
            _.each(error, (subError) => {
              errorMessage += this.getErrorListItem(subError);
            });
            return errorMessage;
          }
          // If the error is a literal object, iterate over each key in the object
          if (typeof error === "object") {
            _.each(Object.keys(error), (errorKey) => {
              errorMessage += this.getErrorListItem(error[errorKey]);
            });
            return errorMessage;
          }
          // Default to returning an empty string

          return "";
        } catch (e) {
          console.error(
            "Failed to create the error message to show in the editor: ",
            e,
          );
          return "";
        }
      },

      /**
       *  Perform clean-up functions when this view is about to be removed from the page or navigated away from.
       */
      onClose() {
        // Remove the listener on the Window
        if (this.beforeunloadCallback) {
          window.removeEventListener("beforeunload", this.beforeunloadCallback);
          delete this.beforeunloadCallback;
        }

        // Reset the active alternate repository
        MetacatUI.appModel.set("activeAlternateRepositoryId", null);

        // Remove the class from the body element
        $("body").removeClass("Editor rendering");

        // Remove listeners
        this.stopListening();
        this.undelegateEvents();
      },
    },
  );

  return EditorView;
});
