"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/assets/MapAsset",
  "common/IconUtilities",
  "showdownXssFilter",
  "text!templates/maps/layer-item.html",
], ($, _, Backbone, MapAsset, IconUtilities, sanitizeHTML, Template) => {
  const CLASS_NAMES = {
    BASE: "list-item",
    LABEL: "list-item__label",
    ICON: "list-item__icon",
    ICON_FONT: "icon",
    VISIBILITY_TOGGLE: "list-item__visibility-toggle",
    SELECTED: "list-item--selected",
    SHOWN: "list-item--shown",
    LABEL_TEXT: "list-item__label-text",
    HIGHLIGHTED_TEXT: "list-item__highlighted-text",
    CATEGORIZED: "list-item__categorized",
    SETTINGS: "list-item__settings",
    SETTINGS_TOGGLE: "list-item__settings-toggle",
    BADGE: "map-view__badge",
    TOOLTIP: "map-tooltip",
    BUTTON: "map-view__button",
    FILTER_ICON: "list-item__filter-icon",
    FILTER_ICON_ACTIVE: "list-item__filter-icon--active",
    STATUS_ICON: "list-item__status-icon",
    STATUS_ICON_VISIBLE: "list-item__status-icon--visible",
    VISIBILITY_ICON: "icon-eye-open",
    SETTINGS_ICON: "icon-gear",
    FILTER_GLYPH: "icon-filter",
    WARNING_ICON: "icon-warning-sign",
    SPINNER_ICON: "icon-spinner",
    SPINNING: "icon-spin",
    SMALL_ICON: "icon-small",
    LOADING: "loading",
    TOOLTIP_CONTAINER: "tooltip",
    TOOLTIP_ARROW: "tooltip-arrow",
    TOOLTIP_INNER: "tooltip-inner",
  };

  /**
   * @class LayerItemView
   * @classdesc One item in a Layer List: shows some basic information about the Map
   * Asset (Layer), including label and icon. Also has a button that changes the
   * visibility of the Layer of the map (by updating the 'visibility' attribute in the
   * MapAsset model). Clicking on the Layer Item opens the Layer Details panel (by
   * setting the 'selected' attribute to true in the Layer model.)
   * @classcategory Views/Maps
   * @name LayerItemView
   * @augments Backbone.View
   * @screenshot views/maps/LayerItemView.png
   * @since 2.18.0
   * @constructs
   */
  const LayerItemView = Backbone.View.extend(
    /** @lends LayerItemView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerItemView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: CLASS_NAMES.BASE,

      /**
       * The model that this view uses
       * @type {MapAsset}
       */
      model: undefined,

      /**
       * Whether the layer item is a under a category. Flat layer item and categorized
       * layer item are styled differently.
       * @type {boolean}
       */
      isCategorized: undefined,

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * The text to show in a tooltip when the MapAsset's status is set to 'error'. If
       * the model also has a 'statusMessage', that will be appended to the end of this
       * error message.
       * @type {string}
       */
      errorMessage: "There was a problem showing this layer.",

      /**
       * A function that gives the events this view will listen to and the associated
       * function to call.
       * @returns {object} Returns an object with events in the format 'event selector':
       * 'function'
       */
      events() {
        const events = {};
        events[`click .${CLASS_NAMES.SETTINGS}`] = "toggleSelected";
        events.click = "toggleVisibility";
        return events;
      },

      /**
       * Executed when a new LayerItemView is created
       * @param {object} [options] - A literal object with options to pass to the view
       */
      initialize(options) {
        // Get all the options and apply them to this view
        if (typeof options === "object") {
          Object.assign(this, options);
        }
      },

      /** @inheritdoc */
      render() {
        if (!this.model) {
          return this;
        }

        // Insert the template into the view
        this.$el.html(
          this.template({
            label: sanitizeHTML(this.model.get("label")),
            classNames: CLASS_NAMES,
          }),
        );
        // Save a reference to the label element
        this.labelEl = this.el.querySelector(`.${CLASS_NAMES.LABEL}`);

        // Insert the icon on the left
        if (!this.isCategorized) {
          this.insertIcon();
        }

        // Add filter icon for "filterable" layers
        if (this.model.get("filters")?.length) {
          this.insertFilterIcon();
        }

        // Reserve a fixed-size slot for the status icon up front so that it
        // showing/hiding later never shifts the filter icon or label text.
        this.insertStatusIconSlot();

        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        // Show the item as hidden and/or selected depending on the model properties
        // that are set initially
        this.showVisibility();
        this.showSelection();
        // Show the current status of this layer
        this.showStatus();

        // When the Layer is selected, highlight this item in the Layer List. When
        // it's no longer selected, then make sure it's no longer highlighted. Set a
        // listener because the 'selected' attribute can be changed within this view,
        // from the parent Layers collection, or from the Layer Details View.
        this.stopListening(this.model, "change:selected");
        this.listenTo(this.model, "change:selected", this.showSelection);

        // Similar to above, add or remove the shown class when the layer's
        // visibility changes
        this.stopListening(this.model, "change:visible");
        this.listenTo(this.model, "change:visible", () => {
          this.showVisibility();
          this.showStatus();
          this.toggleFilterIconVisibility();
        });

        // Update the item in the list to show when it is loading, loaded, or there's
        // been an error.
        this.stopListening(this.model, "change:status");
        this.listenTo(this.model, "change:status", this.showStatus);
        this.stopListening(this.model, "change:isLoadingLayer");
        this.listenTo(this.model, "change:isLoadingLayer", this.showStatus);

        this.stopListening(this.model, "change:filters");
        this.listenTo(
          this.model,
          "change:filters",
          this.toggleFilterIconVisibility,
        );

        // Set the initial visibility of the filter icon
        this.toggleFilterIconVisibility();

        return this;
      },

      /**
       * Waits for the icon attribute to be ready in the Map Asset model, then inserts
       * the icon before the label.
       */
      insertIcon() {
        const { model } = this;
        let icon = model.get("icon");
        if (!icon || typeof icon !== "string" || !IconUtilities.isSVG(icon)) {
          icon = model.defaults().icon;
        }
        const iconContainer = document.createElement("span");
        iconContainer.classList.add(CLASS_NAMES.ICON);
        iconContainer.innerHTML = icon;
        this.el
          .querySelector(`.${CLASS_NAMES.VISIBILITY_TOGGLE}`)
          .replaceChildren(iconContainer);

        const iconStatus = model.get("iconStatus");
        if (iconStatus && iconStatus === "fetching") {
          this.listenToOnce(model, "change:iconStatus", this.insertIcon);
        }
      },

      /**
       * Insert the filter icon to the right of the label element text. This
       * icon appears for layers that are "filterable" based on their
       * atrributes. Filter attributes for each layer are defined in the map
       * model. Layer items with this icon will have the Filter feature (built
       * using VectorFilterView).
       * @since 2.34.0
       */
      insertFilterIcon() {
        const filterIconEl = document.createElement("span");
        const classes = [CLASS_NAMES.ICON, CLASS_NAMES.FILTER_ICON];
        filterIconEl.classList.add(...classes);
        filterIconEl.title = "Filter by property"; // add tooltip
        filterIconEl.innerHTML = `<i class="${CLASS_NAMES.ICON_FONT} ${CLASS_NAMES.FILTER_GLYPH}"></i>`;
        this.labelEl.appendChild(filterIconEl);
      },

      /**
       * Create the (always-present, fixed-size) slot used to show the loading
       * spinner or error icon next to the label. Kept in the DOM permanently
       * and toggled via visibility so it never changes the label row's layout.
       * @since 0.0.0
       */
      insertStatusIconSlot() {
        const statusIconEl = document.createElement("span");
        statusIconEl.classList.add(CLASS_NAMES.STATUS_ICON);
        this.statusIconSlot = statusIconEl;
        this.labelEl.appendChild(statusIconEl);
      },

      /**
       * Turn off the Layer model's 'filter' icon (i.e., set to transparent), if the default
       * filters is selected. Default filters indicated all values on the layer are visible and
       * not user-selected filters are applied. The icon also is set to transparent when the
       * layer visibility is toggled off.
       * @since 2.34.0
       */
      toggleFilterIconVisibility() {
        const filterIconEl = this.$(`.${CLASS_NAMES.FILTER_ICON}`);
        if (!filterIconEl?.length || !filterIconEl[0]) {
          return;
        }

        const activeClass = CLASS_NAMES.FILTER_ICON_ACTIVE;
        if (
          this.model.get("filters").hasActiveFilters() &&
          this.model.isVisible()
        ) {
          filterIconEl.addClass(activeClass);
        } else if (filterIconEl.hasClass(activeClass)) {
          filterIconEl.removeClass(activeClass);
        }
      },

      /**
       * Sets the Layer model's 'selected' status attribute to true if it's false, and
       * to false if it's true. Executed when a user clicks on this Layer Item in a
       * Layer List view.
       */
      toggleSelected() {
        const layerModel = this.model;
        if (layerModel.get("selected")) {
          layerModel.set("selected", false);
        } else {
          layerModel.set("selected", true);
        }
      },

      /**
       * Sets the Layer model's visibility status attribute to true if it's false, and
       * to false if it's true. Executed when a user clicks on this view.
       * @param {object} event The click event on this view component.
       */
      toggleVisibility(event) {
        if (
          this.$(`.${CLASS_NAMES.SETTINGS}`).is(event.target) ||
          this.$(`.${CLASS_NAMES.SETTINGS}`).has(event.target).length > 0
        ) {
          return;
        }

        const layerModel = this.model;
        // Hide if visible
        if (layerModel.get("visible")) {
          layerModel.set("visible", false);
          // Show if hidden
        } else {
          layerModel.show();
        }
      },

      /**
       * Highlight/emphasize this item in the Layer List when it is selected (i.e. when
       * the Layer model's 'selected' attribute is set to true). If it is not selected,
       * then remove any highlighting. This function is executed whenever the model's
       * 'selected' attribute changes. It can be changed from within this view (with the
       * toggleSelected function), from the parent Layers collection, or from the
       * Layer Details View.
       */
      showSelection() {
        const layerModel = this.model;
        if (layerModel.get("selected")) {
          this.$(`.${CLASS_NAMES.SETTINGS}`).addClass(CLASS_NAMES.SELECTED);
        } else {
          this.$(`.${CLASS_NAMES.SETTINGS}`).removeClass(CLASS_NAMES.SELECTED);
        }
      },

      /**
       * Add or remove styles that indicate that the layer is shown based on what is
       * set in the Layer model's 'visible' attribute. Executed whenever the 'visible'
       * attribute changes.
       */
      showVisibility() {
        const layerModel = this.model;
        if (layerModel.get("visible")) {
          this.$el.addClass(CLASS_NAMES.SHOWN);
        } else {
          this.$el.removeClass(CLASS_NAMES.SHOWN);
        }
      },

      /**
       * Derive the current status state being rendered for this layer.
       * @returns {object} State data used by the status UI.
       * @since 0.0.0
       */
      getStatusState() {
        const layerModel = this.model;
        const notice = layerModel.get("notification");

        return {
          status: layerModel.get("status"),
          isLoading: layerModel.get("isLoadingLayer") === true,
          notice,
          badge: notice ? notice.badge : null,
          errorMessage: layerModel.get("statusDetails"),
        };
      },

      /**
       * Append a status-related element to the layer label while keeping UI setup
       * centralized.
       * @param {HTMLElement} element The element to append.
       * @since 0.0.0
       */
      appendStatusElement(element) {
        if (!element || !this.labelEl) {
          return;
        }
        this.labelEl.append(element);
      },

      /**
       * Gets the Map Asset model's status and updates this Layer Item View to reflect
       * that status to the user.
       */
      showStatus() {
        const { status, isLoading, badge, notice, errorMessage } =
          this.getStatusState();

        if (status === "error") {
          this.showError(errorMessage);
          return;
        }

        if (isLoading) {
          this.showLoading();
          return;
        }

        this.removeStatuses();
        if (status === "ready" && badge) {
          this.showBadge(badge, notice?.style);
        }
      },

      /**
       * Remove any icons, tooltips, or other visual indicators of a Map Asset's error
       * or loading status in this view
       */
      removeStatuses() {
        if (this.statusIconSlot) {
          this.statusIconSlot.innerHTML = "";
          this.statusIconSlot.classList.remove(CLASS_NAMES.STATUS_ICON_VISIBLE);
        }
        if (this.badge) {
          this.badge.remove();
          this.badge = null;
        }
        this.$el.tooltip("destroy");
      },

      /**
       * Create a badge element and insert it to the right of the layer label.
       * @param {string} text - The text to display in the badge
       * @param {string} [style] - The style of the badge. Can be any of the styles
       * defined in the {@link MapConfig#Notification} style property, e.g. 'green'
       */
      showBadge(text, style) {
        if (!text) {
          return;
        }
        this.removeStatuses();
        this.badge = document.createElement("span");
        this.badge.classList.add(CLASS_NAMES.BADGE);
        this.badge.innerText = text;
        this.appendStatusElement(this.badge);
        if (style) {
          const badgeClass = `${CLASS_NAMES.BADGE}--${style}`;
          this.badge.classList.add(badgeClass);
        }
      },

      /**
       * Indicate to the user that there was a problem showing or loading this error.
       * Shows a 'warning' icon to the right of the label for the asset and a tooltip
       * with more details
       * @param {string} message The error message to show in the tooltip.
       */
      showError(message = "") {
        // Remove any style elements for other statuses
        this.removeStatuses();

        // Show a warning icon in the reserved status icon slot
        this.statusIconSlot.innerHTML = `<i class="${CLASS_NAMES.WARNING_ICON} ${CLASS_NAMES.ICON_FONT}"></i>`;
        this.statusIconSlot.classList.add(CLASS_NAMES.STATUS_ICON_VISIBLE);

        // Show a tooltip with the error message
        let fullMessage = this.errorMessage;
        if (message) {
          fullMessage = `${fullMessage} Error details: ${message}`;
        }
        this.$el.tooltip({
          placement: "top",
          trigger: "hover",
          title: fullMessage,
          container: "body",
          animation: false,
          template: `<div class="${CLASS_NAMES.TOOLTIP_CONTAINER} ${CLASS_NAMES.TOOLTIP}"><div class="${CLASS_NAMES.TOOLTIP_ARROW}"></div><div class="${CLASS_NAMES.TOOLTIP_INNER}"></div></div>`,
          delay: { show: 250, hide: 5 },
        });
      },

      /**
       * Show a spinner icon to the right of the Map Asset label to indicate that this
       * layer is loading
       */
      showLoading() {
        // Remove any style elements for other statuses
        this.removeStatuses();

        // Show a spinner icon in the reserved status icon slot
        this.statusIconSlot.innerHTML = `<i class="${CLASS_NAMES.SPINNER_ICON} ${CLASS_NAMES.SPINNING} ${CLASS_NAMES.SMALL_ICON} ${CLASS_NAMES.LOADING} ${CLASS_NAMES.ICON_FONT}"></i>`;
        this.statusIconSlot.classList.add(CLASS_NAMES.STATUS_ICON_VISIBLE);
      },

      /**
       * Searches and only displays self if layer label matches the text. Highlights the
       * matched text.
       * @param {string} [text] - The search text from user input.
       * @returns {boolean} - True if a layer label matches the text
       */
      search(text) {
        const label = this.labelEl.querySelector(`.${CLASS_NAMES.LABEL_TEXT}`);
        label.innerHTML = sanitizeHTML(this.model.get("label"));
        if (text) {
          const regex = new RegExp(text, "ig");
          const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
          const nodes = [];
          while (walker.nextNode()) nodes.push(walker.currentNode);
          let matched = false;
          // Highlight text nodes so tags and attributes stay unchanged.
          nodes.forEach((node) => {
            const matches = Array.from(node.textContent.matchAll(regex));
            if (matches.length) matched = true;
            matches.reverse().forEach((match) => {
              const range = document.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              const highlight = document.createElement("span");
              highlight.className = CLASS_NAMES.HIGHLIGHTED_TEXT;
              range.surroundContents(highlight);
            });
          });
          if (!matched) {
            this.$el.hide();
            return false;
          }
        }

        this.$el.show();
        return true;
      },
    },
  );

  /**
   * CSS class names used by layer items.
   * @type {Object<string, string>}
   * @since 0.0.0
   */
  LayerItemView.CLASS_NAMES = CLASS_NAMES;

  return LayerItemView;
});
