define([
  "jquery",
  "underscore",
  "backbone",
  "collections/Filters",
  "models/filters/Filter",
  "models/filters/FilterGroup",
  "views/filters/FilterGroupView",
  "views/filters/FilterView",
  "text!templates/filters/filterGroups.html",
], function (
  $,
  _,
  Backbone,
  Filters,
  Filter,
  FilterGroup,
  FilterGroupView,
  FilterView,
  Template,
) {
  "use strict";

  /**
   * @class FilterGroupsView
   * @classdesc Creates a view of one or more FilterGroupViews
   * @classcategory Views/Filters
   * @name FilterGroupsView
   * @extends Backbone.View
   * @constructor
   */
  var FilterGroupsView = Backbone.View.extend(
    /** @lends FilterGroupsView.prototype */ {
      /**
       * The FilterGroup models to display in this view
       * @type {FilterGroup[]}
       */
      filterGroups: [],

      /**
       * The Filters Collection that contains the same Filter
       * models from each FilterGroup and any additional Filter Models that may not be in
       * FilterGroups because they're not displayed or applied behind the scenes.
       * @type {Filters}
       */
      filters: null,

      /**
       * A reference to the PortalEditorView
       * @type {PortalEditorView}
       */
      editorView: undefined,

      /**
       * @inheritdoc
       */
      tagName: "div",

      /**
       * @inheritdoc
       */
      className: "filter-groups tabbable",

      /**
       * The template for this view. An HTML file is converted to an Underscore.js template
       * @since 2.17.0
       */
      template: _.template(Template),

      /**
       * If true, displays the FilterGroups in a vertical list
       * @type {Boolean}
       */
      vertical: false,

      /**
       * Set to true to render this view as a FilterGroups editor; allow the user add, edit,
       * and remove FilterGroups (TODO), and to add, delete, and edit filters within groups.
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

      /**
       * The initial query to use when the view is first rendered. This is a text value
       * that will be set on the general `text` Solr field.
       * @type {string}
       * @since 2.25.0
       */
      initialQuery: undefined,

      /**
       * @inheritdoc
       */
      events: {
        "click .remove-filter": "handleRemove",
        "click .clear-all": "removeAllFilters",
      },

      /**
       * @inheritdoc
       */
      initialize: function (options) {
        if (!options || typeof options != "object") {
          var options = {};
        }

        this.filterGroups = options.filterGroups || new Array();
        this.filters = options.filters || new Filters();

        // For portal search filters, ID filters should be added to the query with an AND
        // operator, so that ID searches search *within* the definition collection.
        if (this.filters) {
          this.filters.mustMatchIds = true;
        }

        if (options.vertical == true) {
          this.vertical = true;
        }

        this.parentView = options.parentView || null;
        this.editorView = options.editorView || null;

        if (options.edit === true) {
          this.edit = true;
        }

        if (options.initialQuery) {
          this.initialQuery = options.initialQuery;
        }

        if (options.collapsible && typeof options.collapsible === "boolean") {
          this.collapsible = options.collapsible;
        }
      },

      /**
       * @inheritdoc
       */
      render: function () {
        //Since this view may be re-rendered at some point, empty the element and remove listeners
        this.$el.empty();
        this.stopListening();

        // Add information about editing the filter groups if this view is in edit mode
        if (this.edit) {
          var title =
            "Change how people can search for data within your collection";
          var isNew = this.filterGroups.length === 0;
          if (
            this.filterGroups.length === 1 &&
            this.filterGroups[0].isEmpty()
          ) {
            var isNew = true;
          }

          if (isNew) {
            title =
              "Add filters to help people find data within your collection";
          }

          var description =
              "Search filters allow people to filter your data by specific " +
              "metadata fields.",
            learnMoreUrl = MetacatUI.appModel.get("portalSearchFiltersInfoURL");

          if (learnMoreUrl) {
            description =
              description + ' <a href="' + learnMoreUrl + '">Learn more</a>';
          }

          this.$el.html(
            this.template({
              title: title,
              description: description,
              helpText: "",
            }),
          );

          // Remove this when the custom search filter builder is no longer new:
          this.$el
            .find(".port-editor-subtitle")
            .append(
              $(
                '<span class="new-icon" style="margin-left:10px; font-size:1rem; line-height: 25px;"><i class="icon icon-star icon-on-right"></i> NEW </span>',
              ),
            );
        }

        //Create an unordered list for all the filter tabs
        var groupTabs = $(document.createElement("ul")).addClass(
          "nav nav-tabs filter-group-links",
        );

        // Until we allow adding/editing filter groups in the portal data page, hide the group tabs
        // element if the portal does not already have groups in the editor.
        if (
          this.filterGroups.length === 1 &&
          !this.filterGroups[0].get("label") &&
          !this.filterGroups[0].get("icon")
        ) {
          groupTabs.hide();
        }

        //Create a container div for the filter groups
        var filterGroupContainer = $(document.createElement("div")).addClass(
          "tab-content",
        );

        //Add the filter group elements to this view
        this.$el.append(groupTabs, filterGroupContainer);

        var divideIntoGroups = true;

        _.each(
          this.filterGroups,
          function (filterGroup) {
            //If there is only one filter group specified, and there is no label or icon,
            // then don't divide the filters into separate filter groups
            if (
              this.filterGroups.length == 1 &&
              !this.filterGroups[0].get("label") &&
              !this.filterGroups[0].get("icon")
            ) {
              divideIntoGroups = false;
            }

            if (divideIntoGroups) {
              //Create a link to the filter group
              var groupTab = $(document.createElement("li")).addClass(
                "filter-group-link",
              );
              var groupLink = $(document.createElement("a"))
                .attr(
                  "href",
                  "#" + filterGroup.get("label").replace(/([^a-zA-Z0-9])/g, ""),
                )
                .attr("data-toggle", "tab");

              //Add the FilterGroup icon
              if (filterGroup.get("icon")) {
                groupLink.append(
                  $(document.createElement("i")).addClass(
                    "icon icon-" + filterGroup.get("icon"),
                  ),
                );
              }

              //Add the FilterGroup label
              if (filterGroup.get("label")) {
                groupLink.append(filterGroup.get("label"));
              }

              //Insert the link into the tab and add the tab to the tab list
              groupTab.append(groupLink);
              groupTabs.append(groupTab);

              //Create a tooltip for the link
              groupTab.tooltip({
                placement: "top",
                title: filterGroup.get("description"),
                trigger: "hover",
                delay: {
                  show: 800,
                },
              });

              //Make all the tab widths equal
              groupTab.css("width", 100 / this.filterGroups.length + "%");
            }

            // Create a FilterGroupView. Ensure the FilterGroup is in edit mode if the parent
            // FilterGroups is.
            var filterGroupView = new FilterGroupView({
              model: filterGroup,
              edit: this.edit,
              editorView: this.editorView,
              collapsible: this.collapsible,
            });

            //Render the FilterGroupView
            filterGroupView.render();

            //Add the FilterGroupView element to this view
            filterGroupContainer.append(filterGroupView.el);

            //Store a reference to the FilterGroupView in the tab link
            if (divideIntoGroups) {
              groupLink.data("view", filterGroupView);
            }

            //If a new filter is ever added to this filter group, re-render this view
            this.listenTo(
              filterGroup.get("filters"),
              "add remove",
              this.render,
            );
          },
          this,
        );

        if (divideIntoGroups) {
          //Mark the first filter group as active
          groupTabs.children("li").first().addClass("active");

          //When each filter group tab is shown, perform any post render function, if needed.
          this.$('a[data-toggle="tab"]').on("shown", function (e) {
            //Get the filter group view
            var filterGroupView = $(e.target).data("view");

            //If there is a post render function, call it
            if (filterGroupView && filterGroupView.postRender) {
              filterGroupView.postRender();
            }
          });
        }

        //Mark the first filter group as active
        var firstFilterGroupEl = filterGroupContainer
          .find(".filter-group")
          .first();
        firstFilterGroupEl.addClass("active");
        var activeFilterGroup = firstFilterGroupEl.data("view");

        //Call postRender() now for the active FilterGroup, since the `shown` event
        // won't trigger until/unless it's hidden then shown again.
        if (activeFilterGroup) {
          activeFilterGroup.postRender();
        }

        // Applied filters and the general search input are not needed when this view is
        // in editing mode
        if (!this.edit) {
          //Add a header element above the filter groups
          this.$el.prepend(
            $(document.createElement("div")).addClass("filters-header"),
          );

          //Render the applied filters
          this.renderAppliedFiltersSection();

          // Render an "All" filter. If the view was initialized with an initial
          // query, set it on this filter.
          this.renderAllFilter(this.initialQuery);
        }

        if (this.edit) {
          this.$el.addClass("edit-mode");
        }

        if (this.vertical) {
          this.$el.addClass("vertical");
        }
      },

      /**
       * Renders the section of the view that will display the currently-applied filters
       */
      renderAppliedFiltersSection: function () {
        //Add a title to the header
        var appliedFiltersContainer = $(document.createElement("div")).addClass(
            "applied-filters-container",
          ),
          headerText = $(document.createElement("h5"))
            .addClass("filters-title")
            .text("Current search")
            .append(
              $(document.createElement("a"))
                .text("Clear all")
                .addClass("clear-all")
                .prepend(
                  $(document.createElement("i")).addClass(
                    "icon icon-remove icon-on-left",
                  ),
                ),
            );

        //Make the applied filters list
        var appliedFiltersEl = $(document.createElement("ul")).addClass(
          "applied-filters",
        );

        //Add the applied filters element to the filters header
        appliedFiltersContainer.append(headerText, appliedFiltersEl);
        this.$(".filters-header").append(appliedFiltersContainer);

        //Get all the nonNumeric filter models. Reject nested filterGroups.
        var nonNumericFilters = this.filters.reject(function (filterModel) {
          return ["FilterGroup", "NumericFilter", "DateFilter"].includes(
            filterModel.type,
          );
        });
        //Listen to changes on the "values" attribute for nonNumeric filters
        _.each(
          nonNumericFilters,
          function (nonNumericFilter) {
            this.listenTo(
              nonNumericFilter,
              "change:values",
              this.updateAppliedFilters,
            );

            if (nonNumericFilter.get("values").length) {
              this.updateAppliedFilters(nonNumericFilter, {
                displayWithoutChanges: true,
              });
            }
          },
          this,
        );

        //Get the numeric filters and listen to the min and max values
        var numericFilters = _.where(this.filters.models, {
          type: "NumericFilter",
        });
        _.each(
          numericFilters,
          function (numericFilter) {
            if (numericFilter.get("range") == true) {
              this.listenTo(
                numericFilter,
                "change:min change:max",
                this.updateAppliedRangeFilters,
              );

              var filterDefaults = numericFilter.defaults();

              if (
                numericFilter.get("min") != filterDefaults.min ||
                numericFilter.get("max") != filterDefaults.max ||
                numericFilter.get("values").length
              ) {
                this.updateAppliedRangeFilters(numericFilter, {
                  displayWithoutChanges: true,
                });
              }
            } else {
              this.listenTo(
                numericFilter,
                "change:values",
                this.updateAppliedRangeFilters,
              );

              if (
                numericFilter.get("values")[0] !=
                numericFilter.defaults().values[0]
              ) {
                this.updateAppliedRangeFilters(numericFilter, {
                  displayWithoutChanges: true,
                });
              }
            }
          },
          this,
        );

        //Get the date filters and listen to the min and max values
        var dateFilters = _.where(this.filters.models, { type: "DateFilter" });
        _.each(
          dateFilters,
          function (dateFilter) {
            this.listenTo(
              dateFilter,
              "change:min change:max",
              this.updateAppliedRangeFilters,
            );

            if (
              dateFilter.get("min") != dateFilter.defaults().min ||
              dateFilter.get("max") != dateFilter.defaults().max
            ) {
              this.updateAppliedRangeFilters(dateFilter, {
                displayWithoutChanges: true,
              });
            }
          },
          this,
        );

        //When a Filter has been removed from the Filters collection, remove it's DOM element from the page
        this.listenTo(this.filters, "remove", function (removedFilter) {
          this.removeAppliedFilterElByModel(removedFilter);
        });
      },

      /**
       * Renders an "All" filter that will search the general `text` Solr field
       * @param {string} searchFor - The initial value of the "All" filter. This
       * will get set on the filter model and trigger a change event. Optional.
       */
      renderAllFilter: function (searchFor = "") {
        //Create an "All" filter that will search the general `text` Solr field
        var filter = new Filter({
          fields: ["text"],
          label: "Search",
          description:
            "Search the datasets by typing in any keyword, topic, creator, etc.",
          placeholder: "Search these datasets",
        });
        this.filters.add(filter);

        //Create a FilterView for the All filter
        var filterView = new FilterView({
          model: filter,
        });
        this.listenTo(filter, "change:values", this.updateAppliedFilters);

        //Render the view and add the element to the filters header
        filterView.render();
        this.$(".filters-header").prepend(filterView.el);

        if (searchFor && searchFor.length) {
          filter.set("values", [searchFor]);
        }
      },

      postRender: function () {
        var groupTabs = this.$(".filter-group-links");

        //Check if there is a difference in heights
        var maxHeight = 0;

        _.each(groupTabs.find("a"), function (link) {
          if ($(link).height() > maxHeight) {
            maxHeight = $(link).height();
          }
        });

        //Set the height of each filter group link so they are all equal
        _.each(groupTabs.find("a"), function (link) {
          if ($(link).height() < maxHeight) {
            $(link).height(maxHeight + "px");
          }
        });
      },

      /**
       * Renders the values of the given Filter Model in the current filter model
       *
       * @param {Filter} filterModel - The FilterModel to display
       * @param {object} options - Additional options for this function
       * @property {boolean} options.displayWithoutChanges - If true, this filter will
       * display even if the value hasn't been changed
       */
      updateAppliedFilters: function (filterModel, options) {
        //Create an options object if one wasn't sent
        if (typeof options != "object") {
          var options = {};
        }
        this.options = options;
        var view = this;

        //If the value of this filter has changed, or if the displayWithoutChanges option
        // was passed, and if the filter is not invisible, then display it
        if (
          !filterModel.get("isInvisible") &&
          ((filterModel.changed && filterModel.changed.values) ||
            options.displayWithoutChanges)
        ) {
          //Get the new values and the previous values
          var newValues = options.displayWithoutChanges
              ? filterModel.get("values")
              : filterModel.changed.values,
            previousValues = options.displayWithoutChanges
              ? []
              : filterModel.previousAttributes().values,
            //Find the values that were removed
            removedValues = _.difference(previousValues, newValues),
            //Find the values that were added
            addedValues = _.difference(newValues, previousValues);

          //If a filter has been added, display it
          _.each(
            addedValues,
            function (value) {
              //Add the applied filter to the view
              this.$(".applied-filters").append(
                this.createAppliedFilter(filterModel, value),
              );
            },
            this,
          );

          //Iterate over each removed filter value and remove them
          _.each(
            removedValues,
            function (value) {
              //Find all applied filter elements with a matching value
              var matchingFilters = this.$(
                ".applied-filter[data-value='" + value + "']",
              );

              //Iterate over each filter element with a matching value
              _.each(matchingFilters, function (matchingFilter) {
                //If this is the filter element associated with this filter model, then remove it
                if ($(matchingFilter).data("model") == filterModel) {
                  $(matchingFilter).remove();
                }
              });
            },
            this,
          );
        }

        //Toggle the applied filters header
        this.toggleAppliedFiltersHeader();
      },

      /**
       * Hides or shows the applied filter list title/header, as well as the help
       * message that lets the user know they can add filters when there are none
       */
      toggleAppliedFiltersHeader: function () {
        //If there is an applied filter
        if (this.$(".applied-filter").length) {
          // hide the "add some filters" help text
          //$(this.parentView.helpTextContainer).css("display", "none");
          // show the Clear All button
          this.$(".filters-title").css("display", "block");
        }
        //If there are no applied filters
        else {
          // show the "add some filters" help text
          //  $(this.parentView.helpTextContainer).css("display", "block");
          // hide the Clear All button
          this.$(".filters-title").css("display", "none");
        }
      },

      /**
       * When a NumericFilter or DateFilter model is changed, update the applied filters in the UI
       * @param {DateFilter|NumericFilter} filterModel - The model whose values to display
       * @param {object} [options] - Additional options for this function
       * @property {boolean} [options.displayWithoutChanges] - If true, this filter will display even if the value hasn't been changed
       */
      updateAppliedRangeFilters: function (filterModel, options) {
        if (!filterModel) {
          return;
        }

        if (typeof options === "undefined" || !options) {
          var options = {};
        }

        //If the Filter is invisible, don't render it
        if (filterModel.get("isInvisible")) {
          return;
        }

        //If the minimum and maximum values are set to the default, remove the filter element
        if (
          filterModel.get("min") == filterModel.get("rangeMin") &&
          filterModel.get("max") == filterModel.get("rangeMax")
        ) {
          //Find the applied filter element for this filter model
          _.each(
            this.$(".applied-filter"),
            function (filterEl) {
              if ($(filterEl).data("model") == filterModel) {
                //Remove the applied filter element
                $(filterEl).remove();
              }
            },
            this,
          );
        }
        //If the values attribue has changed, or if the displayWithoutChanges attribute was passed
        else if (
          (filterModel.changed &&
            (filterModel.changed.min || filterModel.changed.max)) ||
          options.displayWithoutChanges
        ) {
          //Create the filter label for ranges of numbers
          var filterValue = filterModel.getReadableValue();

          //Create the applied filter
          var appliedFilter = this.createAppliedFilter(
            filterModel,
            filterValue,
          );

          //Keep track if this filter is already displayed and needs to be replaced
          var replaced = false;

          //Check if this filter model already has an applied filter in the UI
          _.each(
            this.$(".applied-filter"),
            function (appliedFilterEl) {
              //If this applied filter already is displayed, replace it
              if ($(appliedFilterEl).data("model") == filterModel) {
                //Replace the applied filter element with the new one
                $(appliedFilterEl).replaceWith(appliedFilter);
                replaced = true;
              }
            },
            this,
          );

          if (!replaced) {
            //Add the applied filter to the view
            this.$(".applied-filters").append(appliedFilter);
          }
        }

        this.toggleAppliedFiltersHeader();
      },

      /**
       * Creates a single applied filter element and returns it. Filters can
       *  have multiple values, so one value is passed to this function at a time.
       * @param {Filter} filterModel - The Filter model that is being added to the display
       * @param {string|number|Boolean} value - The new value set on the Filter model that is displayed in this applied filter
       * @returns {jQuery} - The complete applied filter element
       */
      createAppliedFilter: function (filterModel, value) {
        //Create the filter label
        var filterLabel = filterModel.get("label"),
          filterValue = value;

        //If the filter type is Choice, get the choice label which can be different from the value
        if (filterModel.type == "ChoiceFilter") {
          //Find the choice object with the given value
          var matchingChoice = _.findWhere(filterModel.get("choices"), {
            value: value,
          });

          //Get the label for that choice
          if (matchingChoice) {
            filterValue = matchingChoice.label;
          }
        }
        //Create the filter label for boolean filters
        else if (filterModel.type == "BooleanFilter") {
          //If the filter is set to false, remove the applied filter element
          if (filterModel.get("values")[0] === false) {
            //Iterate over the applied filters
            _.each(
              this.$(".applied-filter"),
              function (appliedFilterEl) {
                //If this is the applied filter element for this model,
                if ($(appliedFilterEl).data("model") == filterModel) {
                  //Remove the applied filter element from the page
                  $(appliedFilterEl).remove();
                }
              },
              this,
            );

            //Exit the function at this point since there is nothing else to
            // do for false BooleanFilters
            return;
          } else if (filterModel.get("values")[0] === true) {
            if (!filterLabel) {
              filterLabel = filterModel.get("fields")[0];
              filterValue = "";
            }
          }
        } else if (filterModel.type == "ToggleFilter") {
          if (filterModel.get("values")[0] == filterModel.get("trueValue")) {
            if (filterModel.get("label") && filterModel.get("trueLabel")) {
              filterValue = filterModel.get("trueLabel");
            } else if (
              !filterModel.get("label") &&
              filterModel.get("trueLabel")
            ) {
              filterLabel = "";
              filterValue = filterModel.get("trueLabel");
            } else if (filterModel.get("label")) {
              filterLabel = "";
              filterValue = filterModel.get("label");
            }
          } else {
            if (filterModel.get("label") && filterModel.get("falseLabel")) {
              filterValue = filterModel.get("falseLabel");
            } else if (
              !filterModel.get("label") &&
              filterModel.get("falseLabel")
            ) {
              filterLabel = "";
              filterValue = filterModel.get("falseLabel");
            } else if (filterModel.get("label")) {
              filterLabel = "";
              filterValue = filterModel.get("label");
            }
          }
        }
        //If this Filter model is a full-text search, don't display a label
        else if (
          filterModel.get("fields").length == 1 &&
          filterModel.get("fields")[0] == "text"
        ) {
          filterLabel = "";
        }
        //isPartOf filters should just display the label, not the value
        else if (
          filterModel.get("fields").length == 1 &&
          filterModel.get("fields")[0] == "isPartOf"
        ) {
          filterValue = "";
        }
        //If the filter value is just an asterisk (i.e. `match anything`), just display the label
        else if (
          filterModel.get("values").length == 1 &&
          filterModel.get("values")[0] == "*"
        ) {
          filterValue = "";
        }
        //Filters with the valueLabels attribute want to display an alternate value from the raw value here
        else if (filterModel.get("valueLabels")) {
          filterValue = filterModel.get("valueLabels")[value] || value;
        } else if (!filterLabel) {
          filterLabel = filterModel.get("fields")[0];
        }

        //Create the applied filter element
        var removeIcon = $(document.createElement("a"))
            .addClass("icon icon-remove remove-filter icon-on-right")
            .attr("title", "Remove this filter"),
          appliedFilter = $(document.createElement("li"))
            .addClass("applied-filter label")
            .append(removeIcon)
            .data("model", filterModel)
            .attr("data-value", value);

        //Create an element to contain both the label and value
        var filterLabelEl = $(document.createElement("span")).addClass("label");
        var filterValueEl = $(document.createElement("span"))
          .addClass("value")
          .text(filterValue);

        var filterTextContainer = $(document.createElement("span")).append(
          filterLabelEl,
          filterValueEl,
        );

        //If there is both a label and value, separated them with a colon
        if (filterLabel && filterValue) {
          filterLabelEl.text(filterLabel + ": ");
        }
        //Otherwise just use the label text only
        else if (filterLabel) {
          filterLabelEl.text(filterLabel);
        }

        //Add the filter text to the filter element
        appliedFilter.prepend(filterTextContainer);

        // Add a tooltip to the filter
        if (filterModel.get("description")) {
          appliedFilter.tooltip({
            placement: "right",
            title: filterModel.get("description"),
            trigger: "hover",
            delay: {
              show: 700,
            },
          });
        }

        return appliedFilter;
      },

      /**
       * Adds a custom filter that likely exists outside of the FilterGroups but needs
       * to be displayed with these other applied fitlers.
       *
       * @param {Filter} filterModel - The Filter Model to display
       */
      addCustomAppliedFilter: function (filterModel) {
        //If the Filter is invisible, don't render it
        if (filterModel.get("isInvisible")) {
          return;
        }

        //If this filter already exists in the applied filter list, exit this function
        var alreadyExists = _.find(
          this.$(".applied-filter.custom"),
          function (appliedFilterEl) {
            return $(appliedFilterEl).data("model") == filterModel;
          },
        );

        if (alreadyExists) {
          return;
        }

        //Create the applied filter element
        var removeIcon = $(document.createElement("a"))
            .addClass("icon icon-remove remove-filter icon-on-right")
            .attr("title", "Remove this filter"),
          filterText = $(document.createElement("span")).text(
            filterModel.get("label"),
          ),
          appliedFilter = $(document.createElement("li"))
            .addClass("applied-filter label custom")
            .append(filterText, removeIcon)
            .data("model", filterModel)
            .attr("data-value", filterModel.get("values"));

        if (filterModel.type == "SpatialFilter") {
          filterText.prepend(
            $(document.createElement("i")).addClass(
              "icon icon-on-left icon-" + filterModel.get("icon"),
            ),
          );
        }

        //Add the applied filter to the view
        this.$(".applied-filters").append(appliedFilter);

        //Display the filters title
        this.toggleAppliedFiltersHeader();
      },

      /**
       * Removes the custom applied filter from the UI.
       *
       * @param {Filter} filterModel - The Filter Model to display
       */
      removeCustomAppliedFilter: function (filterModel) {
        _.each(
          this.$(".custom.applied-filter"),
          function (appliedFilterEl) {
            if ($(appliedFilterEl).data("model") == filterModel) {
              $(appliedFilterEl).remove();
              this.trigger("customAppliedFilterRemoved", filterModel);
            }
          },
          this,
        );

        //Hide the filters title
        this.toggleAppliedFiltersHeader();
      },

      /**
    * When a remove button is clicked, get the filter model associated with it
    /* and remove the filter from the filter group
    *
    * @param {Event} - The DOM Event that occured on the filter remove icon
    */
      handleRemove: function (e) {
        // Ensure tooltips are removed
        try {
          if (e.delegateTarget) {
            $(e.delegateTarget).find(".tooltip").remove();
          }
        } catch (e) {
          console.log(
            "Could not remove tooltip from filter label, error message: " + e,
          );
        }

        //Get the applied filter element and the filter model associated with it
        var appliedFilterEl = $(e.target).parents(".applied-filter"),
          filterModel = appliedFilterEl.data("model");

        if (appliedFilterEl.is(".custom")) {
          this.removeCustomAppliedFilter(filterModel);
        } else {
          //Remove the filter from the filter group model
          this.removeFilter(filterModel, appliedFilterEl);
        }
      },

      /**
       * Remove the filter from the UI and the Search collection
       * @param {Filter} filterModel The Filter to remove from the Filters collection
       * @param {Element} appliedFilterEl The DOM Element for the applied filter on the page
       * @param {object} options Additional options for this function
       * @param {boolean} options.removeSilently If true, the Filter model will be removed siltently from the Filters collection.
       *  This is useful when removing multiple Filters at once, and triggering a remove/change/reset event after all have
       *  been removed.
       */
      removeFilter: function (filterModel, appliedFilterEl, options) {
        var removeSilently = false;

        //Create an options object if one wasn't sent
        if (typeof options != "object") {
          var options = {};
        }
        this.options = options;
        var view = this;

        //Parse all the additional options for this function
        if (typeof options == "object") {
          removeSilently =
            typeof options.removeSilently != "undefined"
              ? options.removeSilently
              : false;
        }

        if (filterModel) {
          //NumericFilters and DateFilters get the min and max values reset
          if (
            filterModel.type == "NumericFilter" ||
            filterModel.type == "DateFilter"
          ) {
            //Set the min and max values
            filterModel.set({
              min: filterModel.get("rangeMin"),
              max: filterModel.get("rangeMax"),
              values: filterModel.defaults().values,
            });

            if (!removeSilently) {
              //Trigger the reset event
              filterModel.trigger("rangeReset");
            }
          }
          //For all other filter types
          else {
            //Get the current value
            var modelValues = filterModel.get("values"),
              thisValue = $(appliedFilterEl).data("value");

            //Numbers that are set on the element `data` are stored as type `number`, but when `number`s are
            // set on Backbone models, they are converted to `string`s. So we need to check for this use case.
            if (typeof thisValue == "number") {
              //Convert the number to a string
              thisValue = thisValue.toString();
            }

            //Remove the value that was in this applied filter
            var newValues = _.without(modelValues, thisValue),
              setOptions = {};

            if (removeSilently) {
              setOptions.silent = true;
            }

            //Updates the values on the model
            filterModel.set("values", newValues, setOptions);
          }
        }
      },

      /**
       * Gets all the applied filters in this view and their associated filter models
       *   and removes them.
       */
      removeAllFilters: function () {
        let removedFilters = [];

        //Iterate over each applied filter in the view
        _.each(
          this.$(".applied-filter"),
          function (appliedFilterEl) {
            var $appliedFilterEl = $(appliedFilterEl);

            removedFilters.push($appliedFilterEl.data("model"));

            if ($appliedFilterEl.is(".custom")) {
              this.removeCustomAppliedFilter($appliedFilterEl.data("model"));
            } else {
              //Remove the filter from the fitler group. Do this silently since we will trigger a "reset" event later
              this.removeFilter(
                $appliedFilterEl.data("model"),
                appliedFilterEl,
                { removeSilently: true },
              );
            }

            //Remove the applied filter element from the page
            $appliedFilterEl.remove();
          },
          this,
        );

        //Trigger the reset event on the Filters collection
        this.filters.trigger("reset");

        //Trigger the remove event on all the models now that they are all removed
        _.invoke(removedFilters, "trigger", "remove");

        //Toggle the applied filters header
        this.toggleAppliedFiltersHeader();
      },

      /**
       * Remove the applied filter element for the given model
       * This only removed the element from the page, it doesn't update the model at all or
       * trigger any events.
       * @param {Filter} - The Filter model whose elements will be deleted
       */
      removeAppliedFilterElByModel: function (filterModel) {
        //Iterate over each applied filter element and find the matching filters
        this.$(".applied-filter").each(function (i, el) {
          if ($(el).data("model") == filterModel) {
            //Remove the element from the page
            $(el).remove();
          }
        });

        //Toggle the applied filters header
        this.toggleAppliedFiltersHeader();
      },
    },
  );
  return FilterGroupsView;
});
