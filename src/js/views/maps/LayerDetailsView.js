"use strict";

define([
  "underscore",
  "backbone",
  "showdownXssFilter",
  "text!templates/maps/layer-details.html",
  // Sub-Views
  "views/maps/LayerDetailView",
  "views/maps/LayerOpacityView",
  "views/maps/LayerInfoView",
  "views/maps/LayerNavigationView",
  "views/maps/VectorFilterView",
], (
  _,
  Backbone,
  sanitizeHTML,
  Template,
  // Sub-Views
  LayerDetailView,
  LayerOpacityView,
  LayerInfoView,
  LayerNavigationView,
  VectorFilterView,
) => {
  const CLASS_NAMES = {
    open: "layer-details--open",
    toggle: "layer-details__toggle",
    sections: "layer-details__sections",
    label: "layer-details__label",
    notification: "layer-details__notification",
    badge: "map-view__badge",
  };

  /**
   * @class LayerDetailsView
   * @classdesc A panel containing information and controls for a
   * {@link MapAsset}. Each configured section is rendered by a
   * {@link LayerDetailView}. The panel also displays the asset's notification
   * and badge, when present.
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
       * The view type identifier.
       * @type {string}
       */
      type: "LayerDetailsView",

      /**
       * The CSS class for this view's root element.
       * @type {string}
       */
      className: "layer-details",

      /**
       * The map asset displayed by this panel, if one is set.
       * @type {MapAsset|null|undefined}
       */
      model: undefined,

      /**
       * The compiled template for the panel's header and section container.
       * @type {function(object): string}
       */
      template: _.template(Template),

      /**
       * CSS class names used to find and style elements in this view.
       * @type {object}
       * @property {string} open Class applied to the root element when the
       * panel is expanded.
       * @property {string} toggle Class identifying the panel's close button.
       * @property {string} sections Class identifying the container for the
       * detail sections.
       * @property {string} label Class identifying the asset's header label.
       * @property {string} notification Class applied to a notification message
       * inserted before the detail sections.
       * @property {string} badge Class applied to a badge appended to the
       * header label.
       */
      classes: CLASS_NAMES,

      /**
       * Configuration for a section in this panel.
       * @typedef {object} DetailSectionOption
       * @property {string} label The section label.
       * @property {function(new:Backbone.View, object=)} view The child view
       * constructor, instantiated with the panel's model. For example,
       * LayerInfoView displays asset information and LayerOpacityView provides
       * an opacity control.
       * @property {boolean} collapsible Whether to show a collapse toggle.
       * @property {boolean} showTitle Whether to display the section label.
       * @property {boolean} hideIfError Whether to hide the section while the
       * asset's status is "error". This is checked during render and whenever
       * the asset's status changes.
       * @property {function((MapAsset|null|undefined)): boolean} [renderIf]
       * Predicate evaluated during render with the panel's current model. A
       * falsy result skips the section. If omitted, the section is rendered.
       */

      /**
       * Sections to render in order. Each section controls whether its label
       * and collapse toggle are shown and whether it is rendered or hidden.
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
          label: "Filter by Property",
          view: VectorFilterView,
          collapsible: false,
          showTitle: true,
          hideIfError: true,
          renderIf: (model) => model?.get("filters")?.length > 0,
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
       * Map clicks on the panel's close button to close().
       * @returns {Object<string, string>} The delegated DOM event handlers
       */
      events() {
        return { [`click .${this.classes.toggle}`]: "close" };
      },

      /**
       * Whether the panel is expanded.
       * @type {boolean}
       * @default false
       */
      isOpen: false,

      /**
       * Copy the supplied options onto this view.
       * @param {object} [options] Properties to assign to the view, including
       * standard Backbone.View options and the panel options below
       * @param {MapAsset|null} [options.model] The asset displayed by the panel
       * @param {DetailSectionOption[]} [options.sections] Sections to render,
       * replacing the default navigation, filter, opacity, and information
       * sections
       * @param {boolean} [options.isOpen] Whether to expand the panel when it
       * is rendered. Defaults to false
       */
      initialize(options) {
        // Get all the options and apply them to this view
        if (typeof options === "object") {
          Object.assign(this, options);
        }
      },

      /**
       * Render the panel's header, configured sections, notification, and badge
       * for the current model. Listen for asset status changes to update
       * sections marked hideIfError. Sections whose renderIf predicate returns
       * a falsy value are skipped until the next render.
       * @returns {LayerDetailsView} This view, for chaining
       */
      render() {
        const { model } = this;

        // Show the layer details box as open if the view is set to have it open
        // already
        if (this.isOpen) {
          this.el.classList.add(this.classes.open);
        }

        // Replacing the section elements through jQuery also cleans up their widgets.
        this.$el.html(
          this.template({
            label: sanitizeHTML(model?.get("label") || ""),
          }),
        );

        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        // Select elements in the template that we will need to manipulate
        const sectionsContainer = this.el.querySelector(
          `.${this.classes.sections}`,
        );
        const labelEl = this.el.querySelector(`.${this.classes.label}`);

        /**
         * Section configurations paired with their rendered views. Entries
         * skipped by renderIf are null. Assigned during render().
         * @type {Array<?object>}
         */
        this.renderedSections = this.sections.map((section) => {
          // If the section has a renderIf function, check if we should render
          // this section or not
          if (
            typeof section.renderIf === "function" &&
            !section.renderIf(model)
          ) {
            return null; // Skip rendering this section
          }

          const detailSection = new LayerDetailView({
            label: section.label,
            ContentView: section.view,
            model,
            collapsible: section.collapsible,
            showTitle: section.showTitle,
          });
          sectionsContainer.append(detailSection.el);
          detailSection.render();
          if (section.hideIfError && model?.get("status") === "error") {
            detailSection.el.style.display = "none";
          }

          return { ...section, renderedView: detailSection };
        });

        // Hide/show sections with the 'hideIfError' property when the status of
        // the MapAsset changes
        this.stopListening(model, "change:status");
        this.listenTo(model, "change:status", (_model, status) => {
          const displayProperty = status === "error" ? "none" : "";
          this.renderedSections.forEach((section) => {
            if (section?.hideIfError) {
              const { el } = section.renderedView;
              el.style.display = displayProperty;
            }
          });
        });

        // If this layer has a notification, show the badge and notification
        // message
        const notice = model?.get("notification");
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
      },

      /** Open the panel and mark its layer as selected */
      open() {
        this.el.classList.add(this.classes.open);
        this.isOpen = true;
        this.model?.set("selected", true);
      },

      /** Close the panel and clear its layer's selection */
      close() {
        this.el.classList.remove(this.classes.open);
        this.isOpen = false;
        this.model?.set("selected", false);
      },

      /**
       * Call the existing sections' onClose hooks, replace the model, and
       * render the panel again. This view must have been rendered first so that
       * renderedSections exists.
       * @param {MapAsset|null} newModel The asset to display. Pass null to
       * render the panel without an asset
       */
      updateModel(newModel) {
        // Remove listeners from sub-views
        this.renderedSections.forEach((section) => {
          if (
            // Some sections dynamically render their views, so check if the
            // renderedView exists
            section?.renderedView &&
            typeof section.renderedView.onClose === "function"
          ) {
            section.renderedView.onClose();
          }
        });
        this.model = newModel;
        this.render();
      },
    },
  );

  return LayerDetailsView;
});
