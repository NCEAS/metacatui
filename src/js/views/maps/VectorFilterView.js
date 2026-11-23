"use strict";

define([
  "underscore",
  "backbone",
  "text!templates/maps/vector-filter-panel.html",
  "views/searchSelect/SearchSelectView",
], (_, Backbone, Template, SearchSelect) => {
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
       * @type {MapAsset|undefined}
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
        selected: "list-item--selected",
        filterPropertyDropdownContainer:
          "filter-by-attribute__attributes-container",
        valuesDropdownContainer: "filter-by-attribute__values-container",
      },

      /** Listen for changes to the first filter's selected values */
      initialize() {
        this.filters = this.model?.get("filters");
        this.filterModel = this.filters?.at(0);

        // The legend can change the selected values too.
        this.listenTo(
          this.filterModel,
          "change:values",
          this.renderValueSelect,
        );
      },

      /**
       * Renders this view
       * @returns {VectorFilterView} This view
       */
      render() {
        // Exit early if there's no filter model
        if (!this.filterModel) {
          this.$el.empty();
          return this;
        }

        // Clear the old dropdowns' jQuery data and event handlers on re-render.
        this.$el.html(this.template({}));

        // Add filter properties dropdown (to select the attribute/property to
        // filter on)
        this.renderPropertySelect();

        // Add filter property values dropdown (to select specific values for
        // the chosen attribute/property)
        this.renderValueSelect();

        return this;
      },

      /** Show the layer's filterable properties in the dropdown */
      renderPropertySelect() {
        const filterPropertyOptions = this.filters.models.map((filterModel) => {
          const propertyName = filterModel.get("property");
          return { label: propertyName, value: propertyName };
        });

        const filterProperty = this.filterModel.get("property");

        // Initialize the property selection dropdown using SearchSelect
        this.propertySelect = new SearchSelect({
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
        const propertySelectContainer = this.el.querySelector(
          `.${this.classes.filterPropertyDropdownContainer}`,
        );
        propertySelectContainer?.append(this.propertySelect.el);
        this.propertySelect.render();

        // Listen for changes to the selected property and update the value
        // selector accordingly
        this.stopListening(this.propertySelect.model, "change:selected");
        this.listenTo(
          this.propertySelect.model,
          "change:selected",
          (_model, propertySelection) => {
            this.handlePropertyChange(propertySelection);
          },
        );
      },

      /**
       * Updates the property values dropdown for the selected filter property
       * @param {string[]} selectedFilterProperty The property selected in the
       * filter property dropdown in an array format
       */
      handlePropertyChange(selectedFilterProperty) {
        const selectedProperty = selectedFilterProperty?.[0];

        this.filterModel.set("property", selectedProperty);
        this.filterModel.set("values", []); // Clear values when property changes

        let allValues = [];
        let selectedValues = [];
        this.filters.models.forEach((filterModel) => {
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

      /** Show the available and selected values for the current property */
      renderValueSelect() {
        const propertyAllValues = this.filterModel.get("allValues");
        const propertyAllValuesOptions = Array.isArray(propertyAllValues)
          ? propertyAllValues.map((value) => ({ label: value, value }))
          : [];
        const selectedValues = [...(this.filterModel.get("values") || [])];

        const valuesSelectContainer = this.el.querySelector(
          `.${this.classes.valuesDropdownContainer}`,
        );

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

          valuesSelectContainer.append(filterValuesSelect.el);
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
            valuesSelectContainer.append(this.valuesSelect.el);
          }
          this.valuesSelect.render();
        }
      },

      /**
       * Set the filter values. Show the layer when any values are selected and
       * hide it when the selection is cleared.
       * @param {string[]} selectedValues The value dropdown selection
       */
      handleValueChange(selectedValues) {
        const filterValues = (selectedValues || []).filter(
          (value) => value !== "",
        );

        this.filterModel.set("values", filterValues);

        // If there is any value selected in the Filter by Property feature,
        // then make sure the asset is also visible. This updates the layer
        // toggle visibility icon (i.e., eye icon) and makes the layer visible
        // on the map.
        if (filterValues.length && !this.model.isVisible()) {
          this.model.show();
        } else if (!filterValues.length && this.model.isVisible()) {
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
