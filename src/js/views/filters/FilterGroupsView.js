/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/Filter',
        'models/filters/FilterGroup',
        'views/filters/FilterGroupView',
      'views/filters/FilterView'],
  function($, _, Backbone, Filter, FilterGroup, FilterGroupView, FilterView) {
  'use strict';

  // Renders a display multiple FilterGroups
  var FilterGroupsView = Backbone.View.extend({

    //An array of FilterGroups
    filterGroups: [],

    // @type Filters - The Filters collection that corresponds to all the Filter
    // models in these FIlterGroups
    filters: null,

    tagName: "div",

    className: "filter-groups tabbable",

    events: {
      "click .remove-filter" : "handleRemove",
      "click .clear-all"     : "removeAllFilters"
    },

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.filterGroups = options.filterGroups || new Array();
      this.filters = options.filters || null;

    },

    render: function () {

      //Create an unordered list for all the filter tabs
      var groupTabs = $(document.createElement("ul")).addClass("nav nav-tabs filter-group-links");

      //Create a container div for the filter groups
      var filterGroupContainer = $(document.createElement("div")).addClass("tab-content");

      //Add the filter group elements to this view
      this.$el.append(groupTabs, filterGroupContainer);

      var divideIntoGroups = true;

      _.each( this.filterGroups, function(filterGroup){

        //If there is only one filter group specified, and there is no label or icon,
        // then don't divide the filters into separate filter groups
        if( this.filterGroups.length == 1 && !this.filterGroups[0].get("label") &&
            !this.filterGroups[0].get("icon") ){
          divideIntoGroups = false;
        }

        if( divideIntoGroups ){
          //Create a link to the filter group
          var groupTab  = $(document.createElement("li")).addClass("filter-group-link");
          var groupLink = $(document.createElement("a"))
                              .attr("href", "#" + filterGroup.get("label").replace( /([^a-zA-Z0-9])/g, "") )
                              .attr("data-toggle", "tab")
                              .append( $(document.createElement("i")).addClass("icon icon-" + filterGroup.get("icon")) )
                              .append(filterGroup.get("label"));

          //Insert the link into the tab and add the tab to the tab list
          groupTab.append(groupLink);
          groupTabs.append(groupTab);

          //Create a tooltip for the link
          groupTab.tooltip({
            placement: "top",
            title: filterGroup.get("description"),
            trigger: "hover",
            delay: {
              show: 800
            }
          });

          //Make all the tab widths equal
          groupTab.css("width", (100 / this.filterGroups.length) + "%");
        }

        //Create a FilterGroupView
        var filterGroupView = new FilterGroupView({
          model: filterGroup
        });

        //Render the FilterGroupView
        filterGroupView.render();

        //Add the FilterGroupView element to this view
        filterGroupContainer.append(filterGroupView.el);

        //Store a reference to the FilterGroupView in the tab link
        if( divideIntoGroups ){
          groupLink.data("view", filterGroupView);
        }

      }, this);

      if( divideIntoGroups ){
        //Mark the first filter group as active
        groupTabs.children("li").first().addClass("active");

        //When each filter group tab is shown, perform any post render function, if needed.
        this.$('a[data-toggle="tab"]').on('shown', function (e) {
          //Get the filter group view
          var filterGroupView = $(e.target).data("view");

          //If there is a post render function, call it
          if( filterGroupView && filterGroupView.postRender ){
            filterGroupView.postRender();
          }

        });
      }

      //Mark the first filter group as active
      var firstFilterGroupEl = filterGroupContainer.find(".filter-group").first();
      firstFilterGroupEl.addClass("active");
      var activeFilterGroup = firstFilterGroupEl.data("view");

      //Call postRender() now for the active FilterGroup, since the `shown` event
      // won't trigger until/unless it's hidden then shown again.
      if( activeFilterGroup ){
        activeFilterGroup.postRender();
      }

      //Add a header element above the filter groups
      this.$el.prepend( $(document.createElement("div")).addClass("filters-header") );

      //Render the applied filters
      this.renderAppliedFiltersSection();

    },

    /*
    * Renders the section of the view that will display the currently-applied filters
    */
    renderAppliedFiltersSection: function(){

      //Add a title to the header
      var appliedFiltersContainer = $(document.createElement("div")).addClass("applied-filters-container"),
          headerText = $(document.createElement("h5"))
                        .addClass("filters-title")
                        .text("Current search")
                        .append( $(document.createElement("a"))
                                  .text("Clear all")
                                  .addClass("clear-all")
                                  .prepend( $(document.createElement("i"))
                                              .addClass("icon icon-remove icon-on-left") ));

      //Make the applied filters list
      var appliedFiltersEl = $(document.createElement("ul")).addClass("applied-filters");

      //Add the applied filters element to the filters header
      appliedFiltersContainer.append(headerText, appliedFiltersEl);
      this.$(".filters-header").append(appliedFiltersContainer);

      _.each( this.filterGroups, function(filterGroup){

        //Get all the FilterModels
        var filters = filterGroup.get("filters");

        //Get all the nonNumeric filter models
        var nonNumericFilters = filters.reject(function(filterModel){
          return (filterModel.type == "NumericFilter" || filterModel.type == "DateFilter");
        });
        //Listen to changes on the "values" attribute for nonNumeric filters
        _.each(nonNumericFilters, function(nonNumericFilter){
          this.listenTo(nonNumericFilter, "change:values", this.updateAppliedFilters);
        }, this);

        //Get the numeric filters and listen to the min and max values
        var numericFilters = _.where(filters.models, { type: "NumericFilter" });
        _.each(numericFilters, function(numericFilter){
          this.listenTo(numericFilter, "change:min change:max", this.updateAppliedRangeFilters);
        }, this);

        //Get the date filters and listen to the min and max values
        var dateFilters = _.where(filters.models, { type: "DateFilter" });
        _.each(dateFilters, function(dateFilter){
          this.listenTo(dateFilter, "change:min change:max", this.updateAppliedRangeFilters);
        }, this);

      }, this);

      //Render an "All" filter
      this.renderAllFilter();

    },

    renderAllFilter: function(){

      //Create an "All" filter that will search the general `text` Solr field
      var filter = new Filter({
        fields: ["text"],
        description: "Filter the datasets by typing in any keyword, topic, creator, etc.",
        placeholder: "Filter datasets"
      });
      this.filters.add( filter );

      //Create a FilterView for the All filter
      var filterView = new FilterView({
        model: filter
      });
      this.listenTo(filter, "change:values", this.updateAppliedFilters);

      //Render the view and add the element to the filters header
      filterView.render();
      this.$(".filters-header").prepend(filterView.el);

    },

    postRender: function(){

      var groupTabs = this.$(".filter-group-links");

      //Check if there is a difference in heights
      var maxHeight = 0;

      _.each( groupTabs.find("a"), function(link){

        if( $(link).height() > maxHeight ){
          maxHeight = $(link).height();
        }

      });

      //Set the height of each filter group link so they are all equal
      _.each( groupTabs.find("a"), function(link){

        if( $(link).height() < maxHeight ){
          $(link).css("line-height", maxHeight + "px");
        }

      });
    },

    /*
    * Renders the values of the given Filter Model in the current filter model
    *
    * @param {Filter} - The FilterModel to display
    */
    updateAppliedFilters: function(filterModel){

      //If the values attribue has changed...
      if( filterModel.changed && filterModel.changed.values ){

        //Get the new values and the previous values
        var newValues      = filterModel.changed.values,
            previousValues = filterModel.previousAttributes().values,
            //Find the values that were removed
            removedValues  = _.difference(previousValues, newValues),
            //Find the values that were added
            addedValues    = _.difference(newValues, previousValues);

        //If a filter has been added, display it
        _.each(addedValues, function(value){

          //Create the filter label
          var filterLabel = value;

          //If the filter type is Choice, get the choice label which can be different from the value
          if( filterModel.type == "ChoiceFilter" ){
            //Find the choice object with the given value
            var matchingChoice = _.findWhere(filterModel.get("choices"), { "value" : value });

            //Get the label for that choice
            if(matchingChoice)
              filterLabel = matchingChoice.label;

            //If there is no label, default to the value
            if( !filterLabel )
              filterLabel = value;
          }
          //Create the filter label for boolean filters
          else if( filterModel.type == "BooleanFilter" ){

            //If the filter is set to true, show the filter label
            if( filterModel.get("values")[0] ){
              filterLabel = filterModel.get("label");
            }
            //If the filter is set to false, remove the applied filter element
            else{

              //Iterate over the applied filters
              _.each(this.$(".applied-filter"), function(appliedFilterEl){

                //If this is the applied filter element for this model,
                if( $(appliedFilterEl).data("model") == filterModel ){
                  //Remove the applied filter element from the page
                  $(appliedFilterEl).remove();
                }

              }, this);

              //Exit the function at this point since there is nothing else to
              // do for false BooleanFilters
              return;
            }

          }
          else if( filterModel.type == "ToggleFilter" ){

            if( filterModel.get("values")[0] == filterModel.get("trueValue") ){
              filterLabel = filterModel.get("label") + ": " + filterModel.get("trueLabel");
            }
            else{
              filterLabel = filterModel.get("label") + ": " + filterModel.get("falseLabel");
            }

          }

          //Create the applied filter element
          var removeIcon    = $(document.createElement("a"))
                                .addClass("icon icon-remove remove-filter icon-on-right")
                                .attr("title", "Remove this filter"),
              appliedFilter = $(document.createElement("li"))
                                .addClass("applied-filter label")
                                .text(filterLabel)
                                .append(removeIcon)
                                .data("model", filterModel)
                                .attr("data-value", value);

          //Add the applied filter to the view
          this.$(".applied-filters").append(appliedFilter);

        }, this);

        //Iterate over each removed filter value and remove them
        _.each(removedValues, function(value){

          //Find all applied filter elements with a matching value
          var matchingFilters = this.$(".applied-filter[data-value='" + value + "']");

          //Iterate over each filter element with a matching value
          _.each(matchingFilters, function(matchingFilter){

            //If this is the filter element associated with this filter model, then remove it
            if( $(matchingFilter).data("model") == filterModel ){
              $(matchingFilter).remove();
            }

          });

        }, this);

      }

      //Toggle the applied filters header
      this.toggleAppliedFiltersHeader();

    },

    /*
    * Hides or shows the applied filter list title/header
    */
    toggleAppliedFiltersHeader: function(){

      //If there is an applied filter, show the Clear All button
      if( this.$(".applied-filter").length ){
        this.$(".filters-title").css("visibility", "visible");
      }
      //If there are no applied filters, hide the Clear All button
      else{
        this.$(".filters-title").css("visibility", "hidden");
      }

    },

    /*
    * When a NumericFilter or DateFilter model is changed, update the applied filters in the UI
    */
    updateAppliedRangeFilters: function(filterModel){

      //If the minimum and maximum values are set to the default, remove the filter element
      if( filterModel.get("min") == filterModel.get("minDefault") &&
          filterModel.get("max") == filterModel.get("maxDefault")){

        //Find the applied filter element for this filter model
        _.each(this.$(".applied-filter"), function(filterEl){

          if( $(filterEl).data("model") == filterModel ){
            //Remove the applied filter element
            $(filterEl).remove();
          }

        }, this);

      }
      //If the values attribue has changed...
      else if( filterModel.changed && (filterModel.changed.min || filterModel.changed.max) ){

        //Create the filter label for ranges of numbers
        if( filterModel.type == "DateFilter" || filterModel.get("range") ){
          var filterLabel = filterModel.get("label") + ": " + filterModel.get("min") +
            " to " + filterModel.get("max");
        }
        //Create the filter label for a single number value
        else{
          var filterLabel = filterModel.get("label") + ": " + filterModel.get("min");
        }

        //Create the applied filter element
        var removeIcon    = $(document.createElement("a"))
                              .addClass("icon icon-remove remove-filter icon-on-right")
                              .attr("title", "Remove this filter"),
            appliedFilter = $(document.createElement("li"))
                              .addClass("applied-filter label")
                              .text(filterLabel)
                              .append(removeIcon)
                              .data("model", filterModel);

        //Keep track if this filter is already displayed and needs to be replaced
        var replaced = false;

        //Check if this filter model already has an applied filter in the UI
        _.each(this.$(".applied-filter"), function(appliedFilterEl){

          //If this applied filter already is displayed, replace it
          if( $(appliedFilterEl).data("model") == filterModel ){
            //Replace the applied filter element with the new one
            $(appliedFilterEl).replaceWith(appliedFilter);
            replaced = true;
          }

        }, this);

        if( !replaced ){
          //Add the applied filter to the view
          this.$(".applied-filters").append(appliedFilter);
        }

      }

      //If there is an applied filter, show the Clear All button
      if( this.$(".applied-filter").length ){
        this.$(".clear-all").show();
      }
      //If there are no applied filters, hide the Clear All button
      else{
        this.$(".clear-all").hide();
      }

    },


    /*
    * Adds a custom filter that likely exists outside of the FilterGroups but needs
    * to be displayed with these other applied fitlers.
    *
    * @param {Filter} filterModel - The Filter Model to display
    */
    addCustomAppliedFilter: function(filterModel){

      //If this filter already exists in the applied filter list, exit this function
      var alreadyExists = _.find( this.$(".applied-filter.custom"), function(appliedFilterEl){
        return $(appliedFilterEl).data("model") == filterModel;
      });

      if( alreadyExists ){
        return;
      }

      //Create the applied filter element
      var removeIcon    = $(document.createElement("a"))
                            .addClass("icon icon-remove remove-filter icon-on-right")
                            .attr("title", "Remove this filter"),
          appliedFilter = $(document.createElement("li"))
                            .addClass("applied-filter label custom")
                            .text(filterModel.get("label"))
                            .append(removeIcon)
                            .data("model", filterModel)
                            .attr("data-value", filterModel.get("values"));

      //Add the applied filter to the view
      this.$(".applied-filters").append(appliedFilter);

      //Display the filters title
      this.toggleAppliedFiltersHeader();

    },

    /*
    * Removes the custom applied filter from the UI.
    *
    * @param {Filter} filterModel - The Filter Model to display
    */
    removeCustomAppliedFilter: function(filterModel){

      _.each(this.$(".custom.applied-filter"), function(appliedFilterEl){
        if( $(appliedFilterEl).data("model") == filterModel ){
          $(appliedFilterEl).remove();
          this.trigger("customAppliedFilterRemoved", filterModel);
        }
      }, this);

      //Hide the filters title
      this.toggleAppliedFiltersHeader();

    },

    /*
    * When a remove button is clicked, get the filter model associated with it
    /* and remove the filter from the filter group
    *
    * @param {Event} - The DOM Event that occured on the filter remove icon
    */
    handleRemove: function(e){

      //Get the applied filter element and the filter model associated with it
      var appliedFilterEl = $(e.target).parents(".applied-filter"),
          filterModel =  appliedFilterEl.data("model");

      if( appliedFilterEl.is(".custom") ){
        this.removeCustomAppliedFilter(filterModel);
      }
      else{
        //Remove the filter from the filter group model
        this.removeFilter(filterModel, appliedFilterEl);
      }

    },

    /*
    * Remove the filter from the UI and the Search collection
    *
    */
    removeFilter: function(filterModel, appliedFilterEl){


      if( filterModel ){

        //NumericFilters and DateFilters get the min and max values reset
        if( filterModel.type == "NumericFilter" || filterModel.type == "DateFilter" ){

          //Set the min and max values
          filterModel.set({
            min: filterModel.get("minDefault"),
            max: filterModel.get("maxDefault")
          });

          //Trigger the reset event
          filterModel.trigger("rangeReset");

        }
        //For all other filter types
        else{
          //Get the current value
          var values = filterModel.get("values"),
              //Remove the value that was in this applied filter
              newValues = _.without(values, $(appliedFilterEl).data("value").toString() );

          //Updates the values on the model
          filterModel.set("values", newValues);
        }

      }

    },

    /*
    * Gets all the applied filters in this view and their associated filter models
    *   and removes them.
    */
    removeAllFilters: function(){

      //Iterate over each applied filter in the view
      _.each( this.$(".applied-filter"), function(appliedFilterEl){

        var $appliedFilterEl = $(appliedFilterEl);

        if( $appliedFilterEl.is(".custom") ){
          this.removeCustomAppliedFilter( $appliedFilterEl.data("model") );
        }
        else{

          //Remove the filter from the fitler group
          this.removeFilter( $appliedFilterEl.data("model"), appliedFilterEl );

        }

      }, this);
    }

  });
  return FilterGroupsView;
});
