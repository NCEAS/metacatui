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
   * @classdesc VectorFilterView is a shared component for visualizing data
   * based on the "filter" attributes set up in the map configuration file. The
   * initial implementation of this component focuses on time-series data
   * visualization.
   * @classcategory Views/Maps
   * @name VectorFilterView
   * @augments Backbone.View
   * @since 2.34.0
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
       * Classes that are used to identify the HTML elements that comprise this
       * view.
       * @type {object}
       */
      classes: {
        attributeSelectClass: "layer-details--open",
        selected: "layer-item--selected",
        filterPropertyDropdownContainer:
          "filter-by-attribute__attributes-container",
        valuesDropdownContainer: "filter-by-attribute__values-container",
      },

      /**
       * Executed when a new VectorFilterView is created
       * @param {object} attributes - The attributes to initialize the view with
       */
      initialize(attributes) {
        // Allow the view to be initialized with a model
        if (attributes.model) {
          this.model = attributes.model; // Set the model from the passed attributes
        }
        this.filters = this.model?.get("filters"); // Retrieve filters attribute from the Map model
        this.filterModel = this.filters?.at(0); // Get the first filter model
      },

      /**
       * Renders this view
       * @returns {VectorFilterView} Returns the rendered view element
       */
      render() {
        // Exit early if there's no filter model
        if (!this.filterModel) {
          this.$el.html(); // Clear DOM elements if filter model does not exist
          return this;
        }

        // Insert the template into the view
        this.$el.html(this.template({}));

        // Add filter properties dropdown (to select the attribute/property to
        // filter on)
        this.renderPropertySelect();

        // Add filter property values dropdown (to select specific values for
        // the chosen attribute/property)
        this.renderValueSelect();

        return this;
      },

      /**
       * Renders the dropdown for selecting a property (i.e., filterable
       * attributes) from the filter models. These filterable attributes are
       * defined by the "property" key in the portal configuration (Map model).
       */
      renderPropertySelect() {
        const filterPropertyOptions = [];

        // Collect all filter model properties (i.e., attributes that are
        // "filterable") for the selected layer
        this.filters.each((filterModel) => {
          const propertyName = filterModel.get("property");
          filterPropertyOptions.push({
            label: propertyName,
            value: propertyName,
          });
        });

        const filterProperty = this.filterModel.get("property");

        // Initialize the property selection dropdown using SearchSelect
        this.propretySelect = new SearchSelect({
          options: filterPropertyOptions,
          allowMulti: false, // Allow only a single attribute to be selected at a time
          inputLabel: "Select property",
          placeholderText: "Property name",
          clearable: false,
          //  TODO: after a filter model is created is should not be part of
          //  subsequent filter models This needs to be part of a parent
          //  VectorFiltersView
          selected: filterProperty ? [filterProperty] : [],
          // disabled: true, // Can be enabled later when multiple properties
          // are supported
        });

        // Append the dropdown to the DOM and render it
        const propretySelectContainer = this.$(
          `.${this.classes.filterPropertyDropdownContainer}`,
        );
        propretySelectContainer.append(this.propretySelect.el);
        this.propretySelect.render();

        // Listen for changes to the selected property and update the value
        // selector accordingly
        this.stopListening(this.propretySelect.model, "change:selected");
        this.listenTo(
          this.propretySelect.model,
          "change:selected",
          (_model, propretySelection) => {
            this.handlePropertyChange(propretySelection);
          },
        );
      },

      /**
       * Updates the property values dropdown for the selected filter property
       * @param {string[]} selectedFilterProperty - The property selected in the
       * filter property dropdown in an array format.
       */
      handlePropertyChange(selectedFilterProperty) {
        const selectedProperty = selectedFilterProperty?.[0];

        this.filterModel.set("property", selectedProperty);
        this.filterModel.set("values", []); // Clear values when property changes

        let allValues = [];
        let selectedValues = [];
        this.filters.each((filterModel) => {
          const property = filterModel.get("property");
          if (selectedProperty === property) {
            allValues = filterModel.get("allValues") || [];
            selectedValues = filterModel.get("values") || [];
          }
        });

        // Update the filter model with the new values
        this.filterModel.set("allValues", allValues);
        this.filterModel.set("values", selectedValues);

        // Re-render
        this.render();
      },

      /**
       * Renders the dropdown for selecting values corresponding to a filter
       * property selection. Retrieves values from the (vector filter) model.
       * During initialization, the filterStatus is false, and the "values"
       */
      renderValueSelect() {
        const propertyAllValuesOptions = [];

        const propertyAllValues = this.filterModel.get("allValues") || [];
        if (Array.isArray(propertyAllValues)) {
          propertyAllValues.forEach((val) => {
            propertyAllValuesOptions.push({
              label: val,
              value: val,
            });
          });
        }
        const selectedValues = [...(this.filterModel.get("values") || [])];

        const valuesSelectContainer = this.$(
          `.${this.classes.valuesDropdownContainer}`,
        )[0];

        if (!this.valuesSelect) {
          const filterValuesSelect = new SearchSelect({
            options: propertyAllValuesOptions,
            placeholderText: "Values",
            inputLabel: "Select value(s)",
            allowMulti: true,
            allowAdditions: false,
            separatorTextOptions: false,
            selected: selectedValues,
          });

          valuesSelectContainer.appendChild(filterValuesSelect.el); // Append to DOM
          filterValuesSelect.render();

          this.valuesSelect = filterValuesSelect;

          // Listen for changes Call the function to update layer visibility
          // based on filter values set on the filter model
          this.stopListening(this.valuesSelect.model, "change:selected");
          this.listenTo(
            this.valuesSelect.model,
            "change:selected",
            (_model, valuesSelected) => {
              this.handleValueChange(valuesSelected);
            },
          );
        } else {
          // Update dropdown values later when the visibility of the layer is
          // toggled on and off. The dropdown elements already exist at this
          // stage.
          this.valuesSelect.updateOptions(propertyAllValuesOptions);
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
      handleValueChange(selectedValues) {
        const filterValues = (selectedValues || []).filter(
          (value) => value !== "",
        ); // filterValues will be 0 when everything is cleared

        this.filterModel.set("values", [...filterValues]);

        // If there is any value selected in the Filter by Property feature,
        // then make sure the asset is also visible. This updates the layer
        // toggle visibility icon (i.e., eye icon) and makes the layer visible
        // on the map.
        if (filterValues?.length && !this.model.isVisible()) {
          this.model.show();
        } else if (!filterValues?.length && this.model.isVisible()) {
          // When all values are cleared from the attribute values dropdown, the
          // layer visibility is set to false, and the filter icon is turned off
          // (i.e., transparent).
          this.model.set("visible", false);
        }
      },
    },
  );

  return VectorFilterView;
});
