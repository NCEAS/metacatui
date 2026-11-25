"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/assets/MapAsset",
  "text!templates/maps/layer-detail.html",
], ($, _, Backbone, MapAsset, Template) => {
  const CLASS_NAMES = {
    open: "layer-detail--open",
    noHeader: "layer-detail--no-header",
    label: "layer-detail__label",
    toggle: "layer-detail__toggle",
    contentContainer: "layer-detail__content",
  };

  /**
   * @class LayerDetailView
   * @classdesc A section within a {@link LayerDetailsView}, with an optional
   * label and collapse toggle. A child view renders information or controls for
   * the section's {@link MapAsset}.
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
       * The view type identifier.
       * @type {string}
       */
      type: "LayerDetailView",

      /**
       * The CSS class for this view's root element.
       * @type {string}
       */
      className: "layer-detail",

      /**
       * The map asset passed to the child view, if one is set.
       * @type {MapAsset|null|undefined}
       */
      model: undefined,

      /**
       * The compiled template for the section's label, toggle, and content
       * container.
       * @type {function(object): string}
       */
      template: _.template(Template),

      /**
       * CSS class names used to find and style elements in this view.
       * @type {object}
       * @property {string} open Class applied to the root element when the
       * section is expanded.
       * @property {string} noHeader Class applied to the root element when both
       * the title and collapse toggle are hidden.
       * @property {string} label Class identifying the section's label element.
       * @property {string} toggle Class identifying the collapse toggle.
       * @property {string} contentContainer Class identifying the container for
       * the child view's element.
       */
      classes: CLASS_NAMES,

      /**
       * Whether the section is expanded.
       * @type {boolean}
       * @default true
       */
      isOpen: true,

      /**
       * The section label, displayed when showTitle is truthy.
       * @type {string|null}
       * @default null
       */
      label: null,

      /**
       * The child view constructor, instantiated during render with this view's
       * model. When null, the section's content container stays empty.
       * @type {?function(new:Backbone.View, object=)}
       * @default null
       */
      ContentView: null,

      /** @inheritdoc */
      events() {
        return { [`click .${this.classes.toggle}`]: "toggle" };
      },

      /**
       * Copy the supplied options onto this view.
       * @param {object} [options] Properties to assign to the view, including
       * standard Backbone.View options and the section options below
       * @param {MapAsset|null} [options.model] The asset passed to the child
       * view
       * @param {string|null} [options.label] The section label. Defaults to
       * null
       * @param {Function} [options.ContentView] The constructor used to render
       * the section's content. Defaults to null
       * @param {boolean} [options.collapsible] Whether to show a collapse
       * toggle. An omitted or false value hides the toggle
       * @param {boolean} [options.showTitle] Whether to show the section label.
       * An omitted or false value hides the label
       * @param {boolean} [options.isOpen] Whether to expand the section when it
       * is rendered. Defaults to true
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
       * Render the section's template and create and render its child view, if
       * a ContentView constructor is configured.
       * @returns {LayerDetailView} This view, for chaining
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
          /**
           * The child view instance created by the most recent render that had
           * a ContentView constructor.
           * @type {Backbone.View}
           */
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

      /** Expand or collapse the section */
      toggle() {
        this.el.classList.toggle(this.classes.open);
        if (this.isOpen) {
          this.isOpen = false;
        } else {
          this.isOpen = true;
        }
      },

      /** Call the child view's close hook if it has one */
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
