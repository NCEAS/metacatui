"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/assets/MapAsset",
  "common/IconUtilities",
  "text!templates/maps/layer-item.html",
], ($, _, Backbone, MapAsset, IconUtilities, Template) => {
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
      className: "layer-item",

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
       * Classes that are used to identify or create the HTML elements that comprise this
       * view.
       * @type {object}
       * @property {string} label The element that contains the layer's name/label
       * @property {string} icon The span element that contains the SVG icon
       * @property {string} visibilityToggle The element that acts like a button to
       * switch the Layer's visibility on and off
       * @property {string} selected The class that gets added to the view when the Layer
       * Item is selected
       * @property {string} shown The class that gets added to the view when the Layer
       * Item is visible
       * @property {string} badge The class to add to the badge element that is shown
       * when the layer has a notification message
       * @property {string} tooltip Class added to tooltips used in this view
       */
      classes: {
        label: "layer-item__label",
        icon: "layer-item__icon",
        visibilityToggle: "layer-item__visibility-toggle",
        selected: "layer-item--selected",
        shown: "layer-item--shown",
        labelText: "layer-item__label-text",
        highlightedText: "layer-item__highlighted-text",
        categorized: "layer-item__categorized",
        settings: "layer-item__settings",
        badge: "map-view__badge",
        tooltip: "map-tooltip",
        button: "map-view__button",
        filterIcon: "icon-filter",
        active: "icon-filter--active",
      },

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
        events[`click .${this.classes.settings}`] = "toggleSelected";
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
            label: this.model.get("label"),
            classes: this.classes,
          }),
        );
        // Save a reference to the label element
        this.labelEl = this.el.querySelector(`.${this.classes.label}`);

        // Insert the icon on the left
        if (!this.isCategorized) {
          this.insertIcon();
        }

        // Add filter icon for "filterable" layers
        if (this.model.get("filters")?.length) {
          this.insertFilterIcon();
        }

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
          this.toggleFilterIconVisibility();
        });

        // Update the item in the list to show when it is loading, loaded, or there's
        // been an error.
        this.stopListening(this.model, "change:status");
        this.listenTo(this.model, "change:status", this.showStatus);

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
        iconContainer.classList.add(this.classes.icon);
        iconContainer.innerHTML = icon;
        this.el
          .querySelector(`.${this.classes.visibilityToggle}`)
          .replaceChildren(iconContainer);

        const iconStatus = model.get("iconStatus");
        if (iconStatus && iconStatus === "fetching") {
          this.listenToOnce(model, "change:iconStatus", this.insertIcon);
        }
      },

      /**
       * Insert the filter icon to the right of the label element text.
       * This icon appears for layers that are "filterable" based on their atrributes.
       * Filter attributes for each layer are defined in the map model.
       * Layer items with this icon will have the Filter feature (built using VectorFilterView).
       */
      insertFilterIcon() {
        const filterIconEl = document.createElement("button");
        filterIconEl.className = `${this.classes.visibilityToggle} ${this.classes.button}`;
        filterIconEl.title = "Filter by property"; // add tooltip
        // filterIconEl.className = `${this.classes.button}`;
        filterIconEl.innerHTML = `<i class="${this.classes.filterIcon}"></i>`;
        this.labelEl.appendChild(filterIconEl);
      },

      /**
       * Turn off the Layer model's 'filter' icon (i.e., set to transparent), if the default
       * filters is selected. Default filters indicated all values on the layer are visible and
       * not user-selected filters are applied. The icon also is set to transparent when the
       * layer visibility is toggled off.
       * @since 0.0.0
       */
      toggleFilterIconVisibility() {
        const filterIconEl = this.$(
          `.${this.classes.visibilityToggle}.${this.classes.button} .${this.classes.filterIcon}`,
        );
        if (
          this.model.get("filters").hasActiveFilters() &&
          this.model.isVisible()
        ) {
          filterIconEl.addClass(this.classes.active);
        } else {
          if (filterIconEl.hasClass(this.classes.active)) {
            filterIconEl.removeClass(this.classes.active);
          }
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
          this.$(`.${this.classes.settings}`).is(event.target) ||
          this.$(`.${this.classes.settings}`).has(event.target).length > 0
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
          this.$(`.${this.classes.settings}`).addClass(this.classes.selected);
        } else {
          this.$(`.${this.classes.settings}`).removeClass(
            this.classes.selected,
          );
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
          this.$el.addClass(this.classes.shown);
        } else {
          this.$el.removeClass(this.classes.shown);
        }
      },

      /**
       * Gets the Map Asset model's status and updates this Layer Item View to reflect
       * that status to the user.
       */
      showStatus() {
        const layerModel = this.model;
        const status = layerModel.get("status");
        if (status === "error") {
          const errorMessage = layerModel.get("statusDetails");
          this.showError(errorMessage);
        } else if (status === "ready") {
          this.removeStatuses();
          const notice = layerModel.get("notification");
          const badge = notice ? notice.badge : null;
          if (badge) {
            this.showBadge(badge, notice.style);
          }
        } else if (status === "loading") {
          this.showLoading();
        }
      },

      /**
       * Remove any icons, tooltips, or other visual indicators of a Map Asset's error
       * or loading status in this view
       */
      removeStatuses() {
        if (this.statusIcon) {
          this.statusIcon.remove();
        }
        if (this.badge) {
          this.badge.remove();
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
        this.badge.classList.add(this.classes.badge);
        this.badge.innerText = text;
        this.labelEl.append(this.badge);
        if (style) {
          const badgeClass = `${this.classes.badge}--${style}`;
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
        const view = this;

        // Remove any style elements for other statuses
        this.removeStatuses();

        // Show a warning icon
        this.statusIcon = document.createElement("span");
        this.statusIcon.innerHTML = `<i class="icon-warning-sign icon icon-on-right"></i>`;
        this.statusIcon.style.opacity = "0.6";
        this.labelEl.append(this.statusIcon);

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
          template: `<div class="tooltip ${view.classes.tooltip}"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>`,
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

        // Show a spinner icon
        this.statusIcon = document.createElement("span");
        this.statusIcon.innerHTML = `<i class="icon-spinner icon-spin icon-small loading icon icon-on-right"></i>`;
        this.statusIcon.style.opacity = "0.6";
        this.labelEl.append(this.statusIcon);
      },

      /**
       * Searches and only displays self if layer label matches the text. Highlights the
       * matched text.
       * @param {string} [text] - The search text from user input.
       * @returns {boolean} - True if a layer label matches the text
       */
      search(text) {
        let newLabel = this.model.get("label");
        if (text) {
          const regex = new RegExp(text, "ig");
          newLabel = this.model
            .get("label")
            .replaceAll(regex, (matchedText) =>
              $("<span />")
                .addClass(this.classes.highlightedText)
                .html(matchedText)
                .prop("outerHTML"),
            );

          // Label is unchanged.
          if (newLabel === this.model.get("label")) {
            this.$el.hide();
            return false;
          }
        }

        this.labelEl.querySelector(`.${this.classes.labelText}`).innerHTML =
          newLabel;
        this.$el.show();
        return true;
      },
    },
  );

  return LayerItemView;
});
