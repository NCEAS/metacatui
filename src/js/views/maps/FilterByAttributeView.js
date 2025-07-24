/* eslint-disable prefer-template */
/* eslint-disable no-restricted-syntax */

"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/filter-by-attribute.html",
  "models/maps/MapAsset",
  "views/searchSelect/SearchSelectView",
  "models/maps/assets/Cesium3DTileset",
], ($, _, Backbone, Template, MapAsset, SearchSelect) => {
  /**
   * @class FilterByAttributeView
   * @classdesc FilterByAttributeView is a shared component for visualizing data based on the "filter" attributes
   * set up in the map configuration file. The initial implementation of this component focuses on time-series
   * data visualization.
   * @classcategory Views/Maps
   * @name FilterByAttributeView
   * @augments Backbone.View
   * @since 2.18.0
   * @constructs FilterByAttributeView
   */

  const FilterByAttributeView = Backbone.View.extend(
    /** @lends FilterByAttributeView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "FilterByAttributeView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "filter-by-attribute",

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
       * Classes that are used to identify the HTML elements that comprise this view.
       * @type {object}
       * @property {string} open The class to add to the outermost HTML element for this
       * view when the layer details view is open/expanded (not hidden)
       */
      classes: {
        attributeSelectClass: "layer-details--open",
        filterIcon: "layer-item__filter-icon",
        selected: "layer-item--selected",
      },

      /**
       * Executed when a new FilterByAttributeView is created
       * @param {object} [options] - A literal object with options to pass to the view
       */
      initialize(options) {
        // alert("Control here");
        try {
          // Get all the options and apply them to this view
          if (typeof options === "object") {
            for (const [key, value] of Object.entries(options)) {
              this[key] = value;
            }
          }
        } catch (e) {
          console.log(
            "A FilterByAttributeView failed to initialize. Error message: " + e,
          );
        }
      },

      /**
       * Renders this view
       * @returns {FilterByAttributeView} Returns the rendered view element
       */
      render() {
        // alert("Control here");
        try {
          // Ensure the view's main element has the given class name
          this.el.classList.add(this.className);

          // Insert the template into the view
          this.$el.html(this.template({}));

          if (this.model && this.model.attributes) {
            // First check layer visibility status
            this.checkSelectionStatus();
            // Add attribute dropdown
            this.addAttributeSelect();
            // Add attribute values dropdown
            this.addAttributeValuesSelect();

            // Manually call handleAttributeChange() after rendering since we preselect the first attribute
            // This is for the initial implementation
            // May need to be removed later
            this.handleAttributeChange(
              this.attributeSelect.model.get("selected"),
            );
          }

          return this;
        } catch (error) {
          console.log(
            "There was an error rendering a FilterByAttributeView" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Checks whether the layer item is selected by default
       */
      checkSelectionStatus() {
        const layerModel = this.model;
        if (layerModel.get("visible")) {
          console.log(layerModel);
        }
      },
      /**
       * Pulls filter attributes from the map model.
       * The attributes are defined using the "property" key.
       * Filter attributes are pre-defined in the portal configuration document.
       */
      addAttributeSelect() {
        const filters = this.model.get("filters");
        if (!filters) {
          return;
        }
        const attributeOptions = [];
        filters.each((filterModel) => {
          const attributeName = filterModel.get("property");
          attributeOptions.push({ label: attributeName, value: attributeName });
        });
        // Build the dropdown with the filter attributes (using SearchSelect)
        this.attributeSelect = new SearchSelect({
          options: attributeOptions,
          allowMulti: false, // set to false allowing user to select only one attribute at a time
          inputLabel: "Select option",
          placeholderText: "Option name",
          clearable: true,
          selected:
            attributeOptions.length > 0 ? [attributeOptions[0].value] : [], // preselect the first attribute (for the initial implementation)
          // disabled: true, // disable for the initial implementation (since there is only one attribute available for selection)
        });

        // Append the dropdown to DOM and render
        const attributeSelectContainer = this.$(
          ".filter-by-attribute__attributes-container",
        );
        attributeSelectContainer.append(this.attributeSelect.el);
        this.attributeSelect.render();

        // Listen for changes
        this.stopListening(this.attributeSelect.model, "change:selected");
        this.listenTo(
          this.attributeSelect.model,
          "change:selected",
          (_model, attributeSelection) => {
            this.handleAttributeChange(attributeSelection);
          },
        );
      },

      handleAttributeChange(targetProperty) {
        const filters = this.model.get("filters");
        if (filters) {
          const attributeOptions = [];
          filters.each((filterModel) => {
            const property = filterModel.get("property");

            if (targetProperty.includes(property)) {
              const values = filterModel.get("allValues");

              if (Array.isArray(values)) {
                values.forEach((val) => {
                  attributeOptions.push({
                    label: val,
                    value: val,
                  });
                });
              }
            }
          });
          // Update the existing dropdown
          if (this.filterSelect) {
            this.filterSelect.model.updateOptions(attributeOptions);
            this.filterSelect.model.set("selected", []);
            // }

            // Listen for changes
            this.stopListening(this.filterSelect.model, "change:selected");
            this.listenTo(
              this.filterSelect.model,
              "change:selected",
              (_model, valuesSelected) => {
                this.handleValueSelectionChange(targetProperty, valuesSelected);
              },
            );
          }
        }
      },

      addAttributeValuesSelect() {
        const container = this.$(".filter-by-attribute__values-container")[0];
        const attributeOptions = [];
        const filterSelect = new SearchSelect({
          options: attributeOptions,
          placeholderText: "Values",
          inputLabel: "Select value(s)",
          allowMulti: true,
          allowAdditions: false,
          separatorTextOptions: false,
          selected: [],
        });

        container.appendChild(filterSelect.el); // Append to DOM
        filterSelect.render();

        this.filterSelect = filterSelect;
        // this.filterSelect.set("disabled", true);
      },

      handleValueSelectionChange(targetProperty, selectedValues) {
        const filters = this.model.get("filters");

        filters.each((filterModel) => {
          const property = filterModel.get("property");
          // eslint-disable-next-line eqeqeq
          if (targetProperty == property) {
            // Replace the existing values with selectedValues
            // filterModel.set("allValues", selectedValues);
            filterModel.set("values", selectedValues);
          }
        });

        // manually trigger listeners
        // this.model.trigger("change:opacity change:color change:visible");
        this.model.trigger("change:opacity");

        // Activate filter icon if there are selected values
        const filterIcon = document.querySelector(".layer-item__filter-icon");
        if (filterIcon) {
          filterIcon.classList.add(this.classes.selected); // Replace with your actual CSS class
        }
      },
    },
  );

  return FilterByAttributeView;
});
