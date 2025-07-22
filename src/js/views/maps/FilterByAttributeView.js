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
       * The events this view will listen to and the associated function to call.
       * @type {Object}
       */
      events: {
        // 'event selector': 'function',
      },

      /**
       * Executed when a new FilterByAttributeView is created
       * @param {Object} [options] - A literal object with options to pass to the view
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
        // alert("Control here");
        try {
          // Ensure the view's main element has the given class name
          this.el.classList.add(this.className);

          // Insert the template into the view
          this.$el.html(this.template({}));

          if (this.model && this.model.attributes) {
            // Add attribute dropdown
            this.addAttributeSelect();
            // Add attribute values dropdown
            this.addAttributeValuesSelect();
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

      addAttributeSelect() {
        const filters = this.model.get("filters");
        if (!filters) {
          return;
        }
        const attributeOptions = [];
        filters.each((filterModel) => {
          const label = filterModel.get("property");
          const val = filterModel.get("property");
          attributeOptions.push({ label, value: val });
        });

        // Build the SearchSelect dropdown
        this.attributeSelect = new SearchSelect({
          options: attributeOptions,
          allowMulti: false, // set to false since this is a single-select dropdown
          inputLabel: "Select option",
          placeholderText: "",
          clearable: true,
          selected: [], // optionally preselect attributes
        });

        // append to DOM and render
        const container = this.$(".filter-by-attribute__attributes-container");
        container.append(this.attributeSelect.el);
        this.attributeSelect.render();

        // listen for changes
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

        // const container = this.$(".taxa-quick-add__selects")[0];

        // Update the existing dropdown
        if (this.filterSelect) {
          this.filterSelect.model.updateOptions(attributeOptions);
          this.filterSelect.model.set("selected", []);
        }

        // Listen for changes
        this.stopListening(this.filterSelect.model, "change:selected");
        this.listenTo(
          this.filterSelect.model,
          "change:selected",
          (_model, valuesSelected) => {
            this.handleValueSelectionChange(targetProperty, valuesSelected);
          },
        );
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

          if (targetProperty === property) {
            // Replace the existing values with selectedValues
            filterModel.set("allValues", selectedValues);
            // filterModel.set("values", [...values]); // code from Robyn

            // code from Robyn
            // const values = filterModel.get("values");
            // values.push(selectedValues);
            // const copiedValues = [...values];
            // filterModel.set("values", copiedValues);
          }
        });

        // Checking if values of the filter are being updated
        //  filters.each(function(filterModel) {
        //   console.log("Writing new values");
        //   console.log(filterModel.get("values"));
        //   });

        // manually trigger listeners
        // console.log("Trigerring updateFeatureVisibility");
        // this.model.trigger("change:opacity change:color change:visible");
        this.model.trigger("change:opacity");
        // filters.trigger("update");

        // filters.trigger("update");
        // setTimeout(()=>{filters.trigger("update")}, 1000);
      },
    },
  );

  return FilterByAttributeView;
});
