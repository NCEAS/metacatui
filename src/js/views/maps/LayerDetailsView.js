"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/assets/MapAsset",
  "text!templates/maps/layer-details.html",
  // Sub-Views
  "views/maps/LayerDetailView",
  "views/maps/LayerOpacityView",
  "views/maps/LayerInfoView",
  "views/maps/LayerNavigationView",
  "views/maps/LegendView",
], (
  $,
  _,
  Backbone,
  MapAsset,
  Template,
  // Sub-Views
  LayerDetailView,
  LayerOpacityView,
  LayerInfoView,
  LayerNavigationView,
  LegendView,
) => {
  /**
   * @class LayerDetailsView
   * @classdesc A panel with additional information about a Layer (a Map Asset like
   * imagery or vector data), plus some UI for updating the appearance of the Layer on
   * the map, such as the opacity.
   * @classcategory Views/Maps
   * @name LayerDetailsView
   * @augments Backbone.View
   * @screenshot views/maps/LayerDetailsView.png
   * @since 2.18.0
   * @constructs
   */
  const LayerDetailsView = Backbone.View.extend(
    /** @lends LayerDetailsView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerDetailsView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "layer-details",

      /**
       * The MapAsset model that this view uses
       * @type {MapAsset}
       */
      model: undefined,

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * Classes that are used to identify the HTML elements that comprise this view.
       * @type {Object}
       * @property {string} open The class to add to the outermost HTML element for this
       * view when the layer details view is open/expanded (not hidden)
       * @property {string} toggle The element in the template that acts as a toggle to
       * close/hide the details view
       * @property {string} sections The container for all of the LayerDetailViews.
       * @property {string} label The label element for the layer that displays a title
       * in the header of the details view
       * @property {string} notification The element that holds the notification message,
       * if there is one. Inserted before all the details sections.
       * @property {string} badge The class to add to the badge element that is shown
       * when the layer has a notification message.
       */
      classes: {
        open: "layer-details--open",
        toggle: "layer-details__toggle",
        sections: "layer-details__sections",
        label: "layer-details__label",
        notification: "layer-details__notification",
        badge: "map-view__badge",
      },

      /**
       * Configuration for a Layer Detail section to show within this Layer Details
       * view.
       * @typedef {Object} DetailSectionOption
       * @property {string} label The name to display for this section
       * @property {Backbone.View} view Any view that will render content for the Layer
       * Detail section. This view will be passed the MapAsset model. The view should
       * display information about the MapAsset and/or allow some aspect of the
       * MapAsset's appearance to be edited - e.g. a LayerInfoView or a
       * LayerOpacityView.
       * @property {boolean} collapsible Whether or not this section should be
       * expandable and collapsible.
       * @property {boolean} showTitle Whether or not to show the title/label for this
       * section.
       * @property {boolean} hideIfError Set to true to hide this section when there is
       * an error loading the layer. Example: we should hide the opacity slider for
       * layers that are not visible on the map
       */

      /**
       * A list of sections to render within this view that give details about the
       * MapAsset, or allow editing of the MapAsset appearance. Each section will have a
       * title and its content will be collapsible.
       * @type {DetailSectionOption[]}
       */
      sections: [
        {
          label: "Navigation",
          view: LayerNavigationView,
          collapsible: false,
          showTitle: false,
          hideIfError: true,
        },
        {
          label: "Legend",
          view: LegendView,
          collapsible: false,
          showTitle: true,
          hideIfError: true,
        },
        {
          label: "Opacity",
          view: LayerOpacityView,
          collapsible: false,
          showTitle: true,
          hideIfError: true,
        },
        {
          label: "Info & Data",
          view: LayerInfoView,
          collapsible: true,
          showTitle: true,
          hideIfError: false,
        },
      ],

      /**
       * Creates an object that gives the events this view will listen to and the
       * associated function to call. Each entry in the object has the format 'event
       * selector': 'function'.
       * @returns {object}
       */
      events() {
        const events = {};
        // Close the layer details panel when the toggle button is clicked. Get the
        // class of the toggle button from the classes property set in this view.
        events[`click .${this.classes.toggle}`] = "close";
        return events;
      },

      /**
       * Whether or not the layer details view is open
       * @type {Boolean}
       */
      isOpen: false,

      /**
       * Executed when a new LayerDetailsView is created
       * @param {object} [options] - A literal object with options to pass to the view
       */
      initialize(options) {
        try {
          // Get all the options and apply them to this view
          if (typeof options === "object") {
            Object.keys(options).forEach((key) => {
              this[key] = options[key];
            });
          }
        } catch (e) {
          console.log(
            `A LayerDetailsView failed to initialize. Error message: ${e}`,
          );
        }
      },

      /**
       * Renders this view
       * @returns {LayerDetailsView} Returns the rendered view element
       */
      render() {
        try {
          // Save a reference to this view
          const view = this;
          const { model } = this;

          // Show the layer details box as open if the view is set to have it open
          // already
          if (this.isOpen) {
            this.el.classList.add(this.classes.open);
          }

          // Insert the template into the view
          this.$el.html(
            this.template({
              label: model ? model.get("label") || "" : "",
            }),
          );

          // Ensure the view's main element has the given class name
          this.el.classList.add(this.className);

          // Select elements in the template that we will need to manipulate
          const sectionsContainer = this.el.querySelector(
            `.${this.classes.sections}`,
          );
          const labelEl = this.el.querySelector(`.${this.classes.label}`);

          // Render each section in the Details panel
          this.renderedSections = _.clone(this.sections);

          // Remove and do not render opacity section if showOpacitySlider is false
          if (model && model.get("showOpacitySlider") === false) {
            this.renderedSections = this.renderedSections.filter(
              (item) => item.label !== "Opacity",
            );
          }

          this.renderedSections.forEach((section) => {
            const detailSection = new LayerDetailView({
              label: section.label,
              contentView: section.view,
              model,
              collapsible: section.collapsible,
              showTitle: section.showTitle,
            });
            sectionsContainer.append(detailSection.el);
            detailSection.render();
            // Hide the section if there is an error with the asset, and this section
            // does make sense to show for a layer that can't be displayed
            if (section.hideIfError && model) {
              if (model && model.get("status") === "error") {
                detailSection.el.style.display = "none";
              }
            }
            section.renderedView = detailSection;
          });

          // Hide/show sections with the 'hideIfError' property when the status of the
          // MapAsset changes
          this.stopListening(model, "change:status");
          this.listenTo(model, "change:status", function (model, status) {
            const hideIfErrorSections = _.filter(
              this.renderedSections,
              (section) => section.hideIfError,
            );
            let displayProperty = "";
            if (status === "error") {
              displayProperty = "none";
            }
            hideIfErrorSections.forEach((section) => {
              section.renderedView.el.style.display = displayProperty;
            });
          });

          // If this layer has a notification, show the badge and notification
          // message
          const notice = model ? model.get("notification") : null;
          if (notice && (notice.message || notice.badge)) {
            // message
            if (notice.message) {
              const noticeEl = document.createElement("div");
              noticeEl.classList.add(this.classes.notification);
              noticeEl.innerText = notice.message;
              if (notice.style) {
                const badgeClass = `${this.classes.notification}--${notice.style}`;
                noticeEl.classList.add(badgeClass);
              }
              sectionsContainer.prepend(noticeEl);
            }
            // badge
            if (notice.badge) {
              const badge = document.createElement("span");
              badge.classList.add(this.classes.badge);
              badge.innerText = notice.badge;
              if (notice.style) {
                const badgeClass = `${this.classes.badge}--${notice.style}`;
                badge.classList.add(badgeClass);
              }
              labelEl.append(badge);
            }
          }

          return this;
        } catch (error) {
          console.log(
            `There was an error rendering a LayerDetailsView` +
              `. Error details: ${error}`,
          );
        }
      },

      /**
       * Show/expand the Layer Details panel. Opening the panel also changes the
       * MapAsset model's 'selected attribute' to true.
       */
      open() {
        try {
          this.el.classList.add(this.classes.open);
          this.isOpen = true;
          // Ensure that the model is marked as selected
          if (this.model) {
            this.model.set("selected", true);
          }
        } catch (error) {
          console.log(
            `There was an error opening the LayerDetailsView` +
              `. Error details: ${error}`,
          );
        }
      },

      /**
       * Hide/collapse the Layer Details panel. Closing the panel also changes the
       * MapAsset model's 'selected attribute' to false.
       */
      close() {
        try {
          this.el.classList.remove(this.classes.open);
          this.isOpen = false;
          // Ensure that the model is not marked as selected
          if (this.model) {
            this.model.set("selected", false);
          }
        } catch (error) {
          console.log(
            `There was an error closing the LayerDetailsView` +
              `. Error details: ${error}`,
          );
        }
      },

      /**
       * Updates the MapAsset model set on the view then re-renders the view and
       * displays information about the new model.
       * @param {MapAsset|null} newModel the new MapAsset model to use to render the
       * view. If set to null, then the view will be rendered without any layer
       * information.
       */
      updateModel(newModel) {
        try {
          // Remove listeners from sub-views
          this.renderedSections.forEach((section) => {
            if (
              section.renderedView &&
              typeof section.renderedView.onClose === "function"
            ) {
              section.renderedView.onClose();
            }
          });
          this.model = newModel;
          this.render();
        } catch (error) {
          console.log(
            `There was an error updating the MapAsset model in a LayerDetailsView` +
              `. Error details: ${error}`,
          );
        }
      },
    },
  );

  return LayerDetailsView;
});
