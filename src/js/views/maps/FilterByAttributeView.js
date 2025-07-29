"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/filter-by-attribute.html",
  "models/maps/assets/MapAsset",
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
        selected: "layer-item--selected",
        attributesDropdownContainer:
          "filter-by-attribute__attributes-container",
        valuesDropdownContainer: "filter-by-attribute__values-container",
      },

      /**
       * Executed when a new FilterByAttributeView is created
       * @param {object} [options] - A literal object with options to pass to the view
       */
      // initialize(options) {
      initialize() {
        try {
          // Get all the options and apply them to this view
          // if (typeof options === "object") {
          //   for (const [key, value] of Object.entries(options)) {
          //     this[key] = value;
          //   }
          // }
          if (this.model) {
            this.filters = this.model.get("filters");
            this.filterModel = this.filters.at(0);
            this.currentVisibility = this.model.get("visible");

            // Save the default filter values for this filter model for future use during the session
            // (e.g., toggling layer visibility back on after being turned off).
            // When the map/layer model gets updated using the "Filter by Property" feature, these values are reset in the filter model.
            this.preselectedAttributeValues = this.filterModel.get("values");

            // Update the "Filter by Property" dropdowns when the layer visibility is toggled on and off
            this.stopListening(this.model, "change:filterActive");
            this.listenTo(this.model, "change:filterActive", this.render);
          }
        } catch (e) {
          console.log(
            // eslint-disable-next-line prefer-template
            "A FilterByAttributeView failed to initialize. Error message: " + e,
          );
        }
      },

      /**
       * Renders this view
       * @returns {FilterByAttributeView} Returns the rendered view element
       */
      render() {
        try {
          // Insert the template into the view
          this.$el.html(this.template({}));

          // change this condition to if there is no filter model
          if (!this.filterModel) {
            return this;
          }

          // Add filter attributes (property/option) select dropdown
          this.addAttributeSelect();

          // Add filter attribute values multi-select dropdown
          this.addAttributeValuesSelect();

          return this;
        } catch (error) {
          console.log(
            // eslint-disable-next-line prefer-template
            "There was an error rendering a FilterByAttributeView" +
              ". Error details: " +
              error,
          );
          return this;
        }
      },

      /**
       * Pulls filter attributes from the map model.
       * The attributes are defined using the "property" key.
       * Filter attributes are pre-defined in the portal configuration document.
       */
      addAttributeSelect() {
        const preselectedAttribute = this.filterModel.get("property"); // property that is set as the default filter for the layer in the map model
        const attributeOptions = [];
        // Get all properties that are "filterable" for the layer
        this.filters.each((filterModel) => {
          const attributeName = filterModel.get("property");
          attributeOptions.push({ label: attributeName, value: attributeName });
        });
        // Build the attribute dropdown with the "filterable" properties (using SearchSelect)
        this.attributeSelect = new SearchSelect({
          options: attributeOptions,
          allowMulti: false, // set to false allowing user to select only one attribute at a time
          inputLabel: "Select option",
          placeholderText: "Property name",
          clearable: true,
          //  TO DO: after a filter model is created is should not be part of subsequent filter models
          //  This needs to be part of a parent FilterAttributeView
          selected: [preselectedAttribute], // preselect the first attribute (for the initial implementation)
          // disabled: true, // disable for the initial implementation (since there is only one attribute available for selection)
        });

        // Append the select dropdown to DOM and render
        const attributeSelectContainer = this.$(
          `.${this.classes.attributesDropdownContainer}`,
        );
        attributeSelectContainer.append(this.attributeSelect.el);
        this.attributeSelect.render();

        // Listen for changes
        // Call the function to update the attribute values select dropdown
        this.stopListening(this.attributeSelect.model, "change:selected");
        this.listenTo(
          this.attributeSelect.model,
          "change:selected",
          (_model, attributeSelection) => {
            this.handleAttributeChange(attributeSelection);
          },
        );
      },

      // Updates the attribute values select dropdown when any attribute/property is selected
      handleAttributeChange(targetProperty) {
        if (this.filters) {
          const attributeValuesOptions = [];
          this.filters.each((filterModel) => {
            const property = filterModel.get("property");

            if (targetProperty.includes(property)) {
              const values = filterModel.get("allValues"); // Build the values dropdown with all "filterable" values for the selected property

              if (Array.isArray(values)) {
                values.forEach((val) => {
                  attributeValuesOptions.push({
                    label: val,
                    value: val,
                  });
                });
              }
            }
          });
          // Update the attribute "values" dropdown with all values corresponding to the newly selected attribute
          if (this.filterValuesSelection) {
            this.filterValuesSelection.model.updateOptions(
              attributeValuesOptions,
            );
            this.filterValuesSelection.model.set("selected", []);

            // // Update options
            // this.filterValuesSelection.updateOptions(attributeAllValue);

            // // Update selected values
            // this.filterValuesSelection.model.setSelected([]);
          }
        }
      },

      /**
       * Builds the atrribute values multi-select dropdown (using the selected filter attribute)
       * Pulls filter attribute values from the map model.
       * The attributes values are defined using the "allValues" key for each "property".
       */
      addAttributeValuesSelect() {
        let defaultAttributeValues = []; // corresponds to values are defined using the "values" key for each "property" in the initial map model
        const targetProperty = this.filterModel.get("property"); // TO DO: Get the selected attribute value from the attribute dropdown
        if (this.model.get("visible")) {
          defaultAttributeValues = this.preselectedAttributeValues;
        }
        const allValues = this.filterModel.get("allValues");
        const attributeAllValues = [];
        if (Array.isArray(allValues)) {
          allValues.forEach((val) => {
            attributeAllValues.push({
              label: val,
              value: val,
            });
          });
        }

        const valuesSelectContainer = this.$(
          `.${this.classes.valuesDropdownContainer}`,
        )[0];

        if (!this.filterValuesSelection) {
          const filterValueSelect = new SearchSelect({
            options: attributeAllValues,
            placeholderText: "Values",
            inputLabel: "Select value(s)",
            allowMulti: true,
            allowAdditions: false,
            separatorTextOptions: false,
            selected: defaultAttributeValues,
          });

          valuesSelectContainer.appendChild(filterValueSelect.el); // Append to DOM
          filterValueSelect.render();

          this.filterValuesSelection = filterValueSelect;

          // Listen for changes
          // Call the function to update layer visibility based on filters set on the map model
          this.stopListening(
            this.filterValuesSelection.model,
            "change:selected",
          );
          this.listenTo(
            this.filterValuesSelection.model,
            "change:selected",
            (_model, valuesSelected) => {
              this.handleValueSelectionChange(targetProperty, valuesSelected);
            },
          );
        } else {
          // Update dropdown values later when the visibility of the layer is toggled on and off.
          // The dropdown elements already exist at this stage.
          this.filterValuesSelection.updateOptions(attributeAllValues);
          this.filterValuesSelection.model.setSelected(defaultAttributeValues);

          if (!valuesSelectContainer.contains(this.filterValuesSelection.el)) {
            valuesSelectContainer.appendChild(this.filterValuesSelection.el);
          }
          this.filterValuesSelection.render();
        }
      },

      /**
       * Update the filter values in the filter model based on selection made in the Filter by Property dropdowns
       * Update the map model.
       * Update layer visibility and icons.
       */

      handleValueSelectionChange(targetProperty, selectedValues) {
        const filterValues = (selectedValues || []).filter(
          (value) => value !== "",
        );

        this.filters.each((filterModel) => {
          const property = filterModel.get("property");
          // eslint-disable-next-line eqeqeq
          if (targetProperty == property) {
            // Replace the existing values with selectedValues
            filterModel.set("values", selectedValues);
          }
        });

        // If there is any value selected in the Filter by Property feature, then make sure the asset is
        // also visible. This updates the layer toggle visibility icon (i.e., eye icon).
        if (selectedValues && !this.currentVisibility) {
          this.model.set("visible", true);
        }

        // Set visibility of the layer to false when all values are cleared from the attribute values dropdown
        if (!filterValues.length > 0) {
          this.model.set("visible", false);
        }

        // manually trigger listener for updating layer visibility
        this.model.trigger("change:opacity");
      },
    },
  );

  return FilterByAttributeView;
});
