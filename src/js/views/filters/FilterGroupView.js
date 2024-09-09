define([
  "jquery",
  "underscore",
  "backbone",
  "models/filters/FilterGroup",
  "views/filters/FilterView",
  "views/filters/BooleanFilterView",
  "views/filters/ChoiceFilterView",
  "views/filters/DateFilterView",
  "views/filters/NumericFilterView",
  "views/filters/ToggleFilterView",
  "views/searchSelect/AnnotationFilterView",
  "views/searchSelect/SearchSelectView",
  "views/filters/SemanticFilterView",
], function (
  $,
  _,
  Backbone,
  FilterGroup,
  FilterView,
  BooleanFilterView,
  ChoiceFilterView,
  DateFilterView,
  NumericFilterView,
  ToggleFilterView,
  AnnotationFilterView,
  SearchSelectView,
  SemanticFilterView,
) {
  "use strict";

  /**
   * @class FilterGroupView
   * @classdesc Renders a display of a group of filters
   * @classcategory Views/Filters
   * @extends Backbone.View
   */
  var FilterGroupView = Backbone.View.extend(
    /** @lends FilterGroupView.prototype */ {
      /**
       * A FilterGroup model to be rendered in this view
       * @type {FilterGroup} */
      model: null,

      /**
       * A reference to the PortalEditorView
       * @type {PortalEditorView}
       */
      editorView: undefined,

      subviews: new Array(),

      tagName: "div",

      className: "filter-group tab-pane",

      /**
       * Set to true to render this view as a FilterGroup editor; allow the user to add,
       * delete, and edit filters within this group.
       * @type {boolean}
       * @since 2.17.0
       */
      edit: false,

      /**
       * If set to true, then all filters within this group will be collapsible.
       * See {@link FilterView#collapsible}
       * @type {boolean}
       * @since 2.25.0
       * @default false
       */
      collapsible: false,

      initialize: function (options) {
        if (!options || typeof options != "object") {
          var options = {};
        }

        this.model = options.model || new FilterGroup();

        this.editorView = options.editorView || null;

        this.subviews = new Array();

        if (options.edit === true) {
          this.edit = true;
        }

        if (options.collapsible && typeof options.collapsible === "boolean") {
          this.collapsible = options.collapsible;
        }
      },

      render: function () {
        var view = this;

        //Add the id attribute from the filter group label
        this.$el.attr(
          "id",
          this.model.get("label").replace(/([^a-zA-Z0-9])/g, ""),
        );

        //Attach a reference to this view to the element
        this.$el.data("view", this);

        // Get the collection of filters from the FilterGroup model
        var filters = this.model.get("filters");

        var filtersRow = $(document.createElement("div")).addClass(
          "filters-container",
        );
        this.$el.append(filtersRow);

        // If this is a FilterGroup editor, pass the "edit" status on to the Filter Views
        // so that a user can make changes to filters in this group.
        var filterMode = this.edit ? "edit" : "regular";

        //Render each filter model in the FilterGroup model
        filters.each(function (filter, i) {
          // The options to pass on to every FilterView
          var viewOptions = {
            model: filter,
            mode: filterMode,
            editorView: this.editorView,
            collapsible: this.collapsible,
          };

          //Some filters are handled specially
          //The isPartOf filter should be rendered as a ToggleFilter
          if (filter.get && filter.get("fields").includes("isPartOf")) {
            //Set a trueValue on the model so it works with the ToggleView
            if (filter.get("values").length && filter.get("values")[0]) {
              filter.set("trueValue", filter.get("values")[0]);
            }

            //Create a ToggleView
            var filterView = new ToggleFilterView(viewOptions);
          } else if (
            view.areAllFieldsSemantic(filter.get("fields")) &&
            MetacatUI.appModel.get("bioportalAPIKey") &&
            filter.type === "Filter"
          ) {
            var filterView = new SemanticFilterView(viewOptions);
          } else {
            //Depending on the filter type, create a filter view
            switch (filter.type) {
              case "Filter":
                var filterView = new FilterView(viewOptions);
                break;
              case "BooleanFilter":
                // TODO: Set up "edit" and "uiBuilder" mode for BooleanFilters
                var filterView = new BooleanFilterView(viewOptions);
                break;
              case "ChoiceFilter":
                var filterView = new ChoiceFilterView(viewOptions);
                break;
              case "DateFilter":
                var filterView = new DateFilterView(viewOptions);
                break;
              case "NumericFilter":
                // TODO: Set up "edit" and "uiBuilder" mode for numeric filters
                var filterView = new NumericFilterView({ model: filter });
                break;
              case "ToggleFilter":
                var filterView = new ToggleFilterView(viewOptions);
                break;
              default:
                var filterView = new FilterView(viewOptions);
            }
          }

          //Render the view and append it's element to this view
          filterView.render();

          //Append the filter view element to the view el
          filtersRow.append(filterView.el);

          //Save a reference to this subview
          this.subviews.push(filterView);
        }, this);

        // Insert a button to add a new Filter model if this view is in edit mode
        if (this.edit) {
          require(["views/filters/FilterEditorView"], function (FilterEditor) {
            var addFilterButton = new FilterEditor({
              collection: view.model.get("filters"),
              mode: "edit",
              isNew: true,
              editorView: view.editorView,
            });
            // Render the view and append it's element to this view
            addFilterButton.render();
            // Append the filter view element to the view el
            filtersRow.append(addFilterButton.el);
            // Save a reference to this subview
            view.subviews.push(addFilterButton);
          });
        }
      },

      /**
       * Actions to perform after the render() function has completed and this view's
       * element is added to the webpage.
       */
      postRender: function () {
        //Iterate over each subview and call postRender() if it exists
        _.each(this.subviews, function (subview) {
          if (subview.postRender) {
            subview.postRender();
          }
        });
      },

      /**
       * Helper function to check whether or not a set of query field names are
       * all semantic fields.
       *
       * Checks the array "fields"
       *
       * @param {string[]} fields The list of query fields to check
       * @return {boolean} Whether or not all members of fields are semantic.
       * Returns true only when fields and AppModel.querySemanticFields are
       * non-zero in length and all values of fields are present in
       * AppModel.querySemanticFields.
       */
      areAllFieldsSemantic: function (fields) {
        if (!fields || !fields.length) {
          return false;
        }

        var querySemanticFields = MetacatUI.appModel.get("querySemanticFields");

        if (!querySemanticFields) {
          return false;
        }

        return fields.every(function (field) {
          return querySemanticFields.includes(field);
        });
      },
    },
  );
  return FilterGroupView;
});
