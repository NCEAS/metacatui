define([
  "underscore",
  "jquery",
  "backbone",
  "localforage",
  "models/metadata/eml211/EMLEntity",
  "views/DataPreviewView",
  "views/metadata/EMLAttributesView",
  "text!templates/metadata/eml-entity.html",
  "common/XMLUtilities",
], (
  _,
  $,
  Backbone,
  LocalForage,
  EMLEntity,
  DataPreviewView,
  EMLAttributesView,
  EMLEntityTemplate,
  XMLUtilities,
) => {
  /**
   * @class EMLEntityView
   * @classdesc An EMLEntityView shows the basic attributes of a DataONEObject,
   * as described by EML
   * @classcategory Views/Metadata
   * @screenshot views/metadata/EMLEntityView.png
   * @augments Backbone.View
   */
  const EMLEntityView = Backbone.View.extend(
    /** @lends EMLEntityView.prototype */ {
      tagName: "div",

      /** @inheritdoc */
      className: "eml-entity modal hide fade",

      /**
       * The template for this view
       * @type {Underscore.Template}
       */
      template: _.template(EMLEntityTemplate),

      /** @inheritdoc */
      events: {
        change: "saveDraft",
        "change input": "updateModel",
        "change textarea": "updateModel",
        "click .entity-container > .nav-tabs a": "showTab",
      },

      /** @inheritdoc */
      initialize(options = {}) {
        this.model = options.model || new EMLEntity();
        this.DataONEObject = options.DataONEObject;
        this.parentView = options.parentView;
      },

      /**
       * Close this modal and open one for another entity in the same
       * collection. Requires the parentView to be set.
       * @param {EMLEntity} otherModel - The other entity to show
       * @since 0.0.0
       */
      switchToOtherEntityView(otherModel) {
        if (!this.parentView) return;
        this.hide();
        this.parentView.showEntityFromModel(otherModel, true);
      },

      /** @inheritdoc */
      render() {
        this.renderEntityTemplate();

        this.renderPreview();

        this.renderAttributes();

        this.listenTo(this.model, "invalid", this.showValidation);
        this.listenTo(this.model, "valid", this.showValidation);

        return this;
      },

      /**
       * Render the entity template
       */
      renderEntityTemplate() {
        const view = this;

        // Render the template using the model attributes
        const modelAttr = this.model.toJSON();
        modelAttr.title = modelAttr.entityName || "this data";
        modelAttr.uniqueId = this.model.cid;
        this.el.innerHTML = this.template(modelAttr);

        // Initialize the modal window
        this.$el.modal();

        // Set the menu height
        this.$el.off("shown");
        this.$el.off("hidden");
        this.$el.on("hidden", (e) => {
          // Make sure that the event was triggered by the view element. Child
          // jquery objects can fire hidden events that bubble up to parent. In
          // this case, the NCBO tree (measurement type) view does this.
          const viewEl = view.$el.length ? view.$el[0] : view.$el;
          if (viewEl !== e.target) return;
          view.onHide();
        });
        this.$el.on("shown", () => {
          view.onShow();
        });
      },

      /**
       * Render the preview of the DataONEObject
       */
      renderPreview() {
        // Get the DataONEObject model
        if (this.DataONEObject) {
          const dataPreview = new DataPreviewView({
            model: this.DataONEObject,
          });
          dataPreview.render();
          this.$(".preview-container").html(dataPreview.el);

          if (dataPreview.$el.children().length) {
            this.$(".description").css("width", "calc(100% - 310px)");
          } else dataPreview.$el.remove();
        }
      },

      /**
       * Render the attributes of the entity
       */
      renderAttributes() {
        const container = this.el.querySelector(
          ".attributes .attribute-container",
        );

        // Render the attributes
        this.attributesView = new EMLAttributesView({
          el: container,
          model: this.model.get("attributeList"),
          parentModel: this.model,
          parentView: this,
        }).render();
      },

      /**
       * Update the model when the user changes an input field
       * @param {Event} e - The change event
       */
      updateModel(e) {
        const changedAttr = $(e.target).attr("data-category");

        if (!changedAttr) return;
        const newValue = XMLUtilities.cleanXMLText($(e.target).val());
        this.model.set(changedAttr, newValue);
        this.model.trickleUpChange();
      },

      /**
       * Will display validation styling and messaging. Should be called after
       * this view's model has been validated and there are error messages to
       * display
       */
      showValidation() {
        // Reset the error messages and styling Only change elements inside the
        // overview-container which contains only the EMLEntity metadata. The
        // Attributes will be changed by the EMLAttributeView.
        this.$(".overview-container .notification").text("");
        this.$(
          ".overview-tab .icon.error, .attributes-tab .icon.error",
        ).remove();
        this.$(
          ".overview-container, .overview-tab a, .attributes-tab a, .overview-container .error",
        ).removeClass("error");

        let overviewTabErrorIcon = false;
        const attributeTabErrorIcon = false;

        _.each(
          this.model.validationError,
          (errorMsg, category) => {
            if (category === "attributeList") {
              // Create an error icon for the Attributes tab
              if (!attributeTabErrorIcon) {
                const errorIcon = $(document.createElement("i"))
                  .addClass("icon icon-on-left icon-exclamation-sign error")
                  .attr("title", "There is missing information in this tab");

                // Add the icon to the Overview tab
                this.$(".attributes-tab a")
                  .prepend(errorIcon)
                  .addClass("error");
              }

              return;
            }

            // Get all the elements for this category and add the error class
            this.$(
              `.overview-container [data-category='${category}']`,
            ).addClass("error");
            // Get the notification element for this category and add the error
            // message
            this.$(
              `.overview-container .notification[data-category='${category}']`,
            ).text(errorMsg);

            // Create an error icon for the Overview tab
            if (!overviewTabErrorIcon) {
              const errorIcon = $(document.createElement("i"))
                .addClass("icon icon-on-left icon-exclamation-sign error")
                .attr("title", "There is missing information in this tab");

              // Add the icon to the Overview tab
              this.$(".overview-tab a").prepend(errorIcon).addClass("error");

              overviewTabErrorIcon = true;
            }
          },
          this,
        );
      },

      /**
       * Show the entity overview or attributes tab depending on the click
       * target
       * @param {Event} e - The click event
       */
      showTab(e) {
        e.preventDefault();

        // Get the clicked link
        const link = $(e.target);

        // Remove the active class from all links and add it to the new active
        // link
        this.$(".entity-container > .nav-tabs li").removeClass("active");
        link.parent("li").addClass("active");

        // Hide all the panes and show the correct one
        this.$(".entity-container > .tab-content > .tab-pane").hide();
        this.$(link.attr("href")).show();
      },

      /** Show the Attributes tab (vs the Overview tab) */
      showAttributesTab() {
        const link = this.$(".attributes-tab a");
        link?.trigger("click");
      },

      /** Show the entity in a modal dialogue */
      show() {
        this.$el.modal("show");
        this.el.display = "grid"; // override the display:block from bootstrap
      },

      /** Close the modal that contains this view */
      hide() {
        this.$el.modal("hide");
      },

      /**
       * Hide the entity modal dialog
       */
      onHide() {
        this.showValidation();
        this.attributesView?.onClose();
      },

      /**
       * Handles the logic to be executed when thw modal view is shown. Restarts
       * existing listeners on the attributesView.
       */
      onShow() {
        this.attributesView?.stopAllListeners();
        this.attributesView?.startAllListeners();
      },

      /**
       * Save a draft of the parent EML model
       */
      saveDraft() {
        const view = this;
        const model = this.model.getParentEML();
        const draftModel = model.clone();
        const title = model.get("title") || "No title";

        LocalForage.setItem(model.get("id"), {
          id: model.get("id"),
          datetime: new Date().toISOString(),
          title: Array.isArray(title) ? title[0] : title,
          draft: draftModel.serialize(),
        }).then(() => {
          view.clearOldDrafts();
        });
      },

      /**
       * Clear older drafts by iterating over the sorted list of drafts stored
       * by LocalForage and removing any beyond a hardcoded limit.
       */
      clearOldDrafts() {
        let drafts = [];
        LocalForage.iterate((value, key) => {
          // Extract each draft
          drafts.push({
            key,
            value,
          });
        })
          .then(() => {
            // Sort by datetime
            drafts = _.sortBy(drafts, (draft) =>
              draft.value.datetime.toString(),
            ).reverse();
          })
          .then(() => {
            _.each(drafts, (draft, i) => {
              const age = new Date() - new Date(draft.value.datetime);
              const isOld = age / 2678400000 > 1; // ~31days
              // Delete this draft is not in the most recent 100 or if older
              // than 31 days
              const shouldDelete = i > 100 || isOld;
              if (!shouldDelete) {
                return;
              }

              LocalForage.removeItem(draft.key).then(() => {
                // Item should be removed
              });
            });
          });
      },
    },
  );

  return EMLEntityView;
});
