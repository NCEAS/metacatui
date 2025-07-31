"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/vector-filter-panel.html",
  "models/maps/assets/MapAsset",
  "views/searchSelect/SearchSelectView",
  "models/maps/assets/Cesium3DTileset",
], ($, _, Backbone, Template, MapAsset, SearchSelect) => {
  /**
   * @class VectorFilterView
   * @classdesc VectorFilterView is a shared component for visualizing data based on the "filter" attributes
   * set up in the map configuration file. The initial implementation of this component focuses on time-series
   * data visualization.
   * @classcategory Views/Maps
   * @name VectorFilterView
   * @augments Backbone.View
   * @since 0.0.0
   * @constructs VectorFilterView
   */

  const VectorFilterView = Backbone.View.extend(
    /** @lends VectorFilterView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "VectorFilterView",

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
       */
      classes: {
        attributeSelectClass: "layer-details--open",
        selected: "layer-item--selected",
        attributesDropdownContainer:
          "filter-by-attribute__attributes-container",
        valuesDropdownContainer: "filter-by-attribute__values-container",
      },

      /**
       * Executed when a new VectorFilterView is created
       */
      initialize() {
        if (!this.model) return;

        this.filters = this.model.get("filters");
        this.filterModel = this.filters?.at(0);
        if (!this.filterModel) return;
      },

      /**
       * Renders this view
       * @returns {VectorFilterView} Returns the rendered view element
       */
      render() {
        if (!this.filterModel) {
          this.$el.html();
          return;
        }

        // Insert the template into the view
        this.$el.html(this.template({}));

        // Exit early if there's no filter model
        if (!this.filterModel) {
          return this;
        }

        // Add filter attributes (property/option) select dropdown
        if (typeof this.addAttributeSelect === "function") {
          this.addAttributeSelect();
        }

        // Add filter attribute values multi-select dropdown
        if (typeof this.addAttributeValuesSelect === "function") {
          this.addAttributeValuesSelect();
        }

        return this;
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
          clearable: false,
          //  TODO: after a filter model is created is should not be part of subsequent filter models
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

      /**
       * Updates the attribute values select dropdown when any attribute/property is selected
       * @param {*} targetProperty
       */
      handleAttributeChange(targetProperty) {
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
        if (this.valuesSelect) {
          this.valuesSelect.model.updateOptions(attributeValuesOptions);
          this.valuesSelect.model.set("selected", []);
        }
      },

      /**
       * Builds the atrribute values multi-select dropdown (using the selected filter attribute)
       * Pulls filter attribute values from the map model.
       * The attributes values are defined using the "allValues" key for each "property".
       */
      addAttributeValuesSelect() {
        const selectedValues = [...(this.filterModel.get("values") || [])];

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

        if (!this.valuesSelect) {
          const filterValueSelect = new SearchSelect({
            options: attributeAllValues,
            placeholderText: "Values",
            inputLabel: "Select value(s)",
            allowMulti: true,
            allowAdditions: false,
            separatorTextOptions: false,
            selected: selectedValues,
          });

          valuesSelectContainer.appendChild(filterValueSelect.el); // Append to DOM
          filterValueSelect.render();

          this.valuesSelect = filterValueSelect;

          // Listen for changes
          // Call the function to update layer visibility based on filters set on the map model
          this.stopListening(this.valuesSelect.model, "change:selected");
          this.listenTo(
            this.valuesSelect.model,
            "change:selected",
            (_model, valuesSelected) => {
              this.handleValueSelectionChange(valuesSelected);
            },
          );
        } else {
          // Update dropdown values later when the visibility of the layer is toggled on and off.
          // The dropdown elements already exist at this stage.
          this.valuesSelect.updateOptions(attributeAllValues);
          this.valuesSelect.model.setSelected(selectedValues);

          if (!valuesSelectContainer.contains(this.valuesSelect.el)) {
            valuesSelectContainer.appendChild(this.valuesSelect.el);
          }
          this.valuesSelect.render();
        }
      },

      /**
       * Update the filter values in the filter model based on selection made in
       * the Filter by Property dropdowns Update the map model. Update layer
       * visibility and icons.
       * @param {string[]} selectedValues - The values that are selected in
       * values the Select View
       */

      handleValueSelectionChange(selectedValues) {
        // TODO: Debug why we're getting empty values here.
        let filterValues = (selectedValues || []).filter(
          (value) => value !== "",
        );

        if (!filterValues?.length) {
          filterValues = this.filterModel.get("allValues");
        }
        this.filterModel.set("values", filterValues);

        // If there is any value selected in the Filter by Property feature, then make sure the asset is
        // also visible. This updates the layer toggle visibility icon (i.e., eye icon).
        if (filterValues?.length && !this.model.get("visible")) {
          this.model.set("visible", true);
        }

        // Set visibility of the layer to false when all values are cleared from the attribute values dropdown
        if (!filterValues?.length) {
          this.model.set("visible", false);
        }

        // manually trigger listener for updating layer visibility. TODO - the
        // MapAsset model should instead listen to changes in the filter model
        // and trigger the change event in the map.
        this.model.trigger("change:opacity");
      },
    },
  );

  return VectorFilterView;
});
