"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/assets/MapAsset",
  "text!templates/maps/layer-detail.html",
], ($, _, Backbone, MapAsset, Template) => {
  /**
   * @class LayerDetailView
   * @classdesc A LayerDetailView creates a section to be inserted into a
   * LayerDetailsView. It renders a label and a toggle to collapse and expand
   * the section's contents. The contents of the Detail section can be rendered
   * by any other view, but the view should be one that shows details about a
   * MapAsset or allows editing elements of the MapAsset.
   * @classcategory Views/Maps
   * @name LayerDetailView
   * @augments Backbone.View
   * @screenshot views/maps/LayerDetailView.png
   * @since 2.18.0
   * @constructs
   */
  const LayerDetailView = Backbone.View.extend(
    /** @lends LayerDetailView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerDetailView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "layer-detail",

      /**
       * The model that this view uses
       * @type {MapAsset}
       */
      model: undefined,

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * CSS classes for HTML elements within this view.
       * @property {string} toggle The element in the template that acts as a
       * toggle to expand or collapse this Layer Detail section.
       * @property {string} open The class to add to the view when the contents
       * are visible (i.e. the section is expanded)
       * @property {string} noHeader The class to add to the view when there is
       * no title/label and the view is not collapsible.
       * @property {string} label The element that holds the view's label text
       * @property {string} contentContainer The container into which the
       * ContentView's rendered content will be placed
       */
      classes: {
        open: "layer-detail--open",
        noHeader: "layer-detail--no-header",
        label: "layer-detail__label",
        toggle: "layer-detail__toggle",
        contentContainer: "layer-detail__content",
      },

      /**
       * Indicates whether this section is collapsed or expanded
       * @type {boolean}
       */
      isOpen: true,

      /**
       * The name to display for the Layer Detail section
       * @type {string}
       */
      label: null,

      /**
       * The sub-view constructor that will show details about, or allow editing
       * of, the given Layer model. The ContentView will be passed the Layer
       * model.
       * @type {Backbone.View}
       */
      ContentView: null,

      /** @inheritdoc */
      events() {
        const events = {};
        // Collapse or expand this Detail section when the toggle button is
        // clicked. Get the class of the toggle button from the classes property
        // set in this view.
        events[`click .${this.classes.toggle}`] = "toggle";
        return events;
      },

      /**
       * Executed when a new LayerDetailView is created
       * @param {object} [options] - A literal object with options to pass to
       * the view
       */
      initialize(options) {
        // Get all the options and apply them to this view
        if (typeof options === "object") {
          Object.keys(options).forEach((key) => {
            this[key] = options[key];
          });
        }
      },

      /**
       * Renders this view
       * @returns {LayerDetailView} Returns the rendered view element
       */
      render() {
        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        // Display the section's contents depending on the view's initial
        // setting
        if (this.isOpen) {
          this.el.classList.add(this.classes.open);
        }

        // Insert the template into the view
        this.$el.html(
          this.template({
            label: this.label,
            collapsible: this.collapsible,
            showTitle: this.showTitle,
          }),
        );

        // Render the content for this Layer Detail section
        if (this.ContentView) {
          const contentContainer = this.el.querySelector(
            `.${this.classes.contentContainer}`,
          );
          this.renderedContentView = new this.ContentView({
            model: this.model,
          });
          contentContainer.append(this.renderedContentView.el);
          this.renderedContentView.render();
        }

        if (!this.collapsible && !this.showTitle) {
          this.el.classList.add(this.classes.noHeader);
        }

        return this;
      },

      /**
       * Show or hide this section's contents by adding or removing the open
       * class.
       */
      toggle() {
        this.el.classList.toggle(this.classes.open);
        if (this.isOpen) {
          this.isOpen = false;
        } else {
          this.isOpen = true;
        }
      },

      /**
       * Perform clean-up functions when this view is about to be removed from
       * the page or navigated away from.
       */
      onClose() {
        if (
          this.renderedContentView &&
          typeof this.renderedContentView.onClose === "function"
        ) {
          this.renderedContentView.onClose();
        }
      },
    },
  );

  return LayerDetailView;
});
