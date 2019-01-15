/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/FilterGroup',
        'views/filters/FilterGroupView'],
  function($, _, Backbone, FilterGroup, FilterGroupView) {
  'use strict';

  // Renders a display multiple FilterGroups
  var FilterGroupsView = Backbone.View.extend({

    //An array of FilterGroups
    filterGroups: [],

    tagName: "div",

    className: "filter-groups tabbable",

    events: {
      "click .remove-filter" : "removeFilter"
    },

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.filterGroups = options.filterGroups || new Array();

    },

    render: function () {

      //Create an unordered list for all the filter tabs
      var groupTabs = $(document.createElement("ul")).addClass("nav nav-tabs");

      //Create a container div for the filter groups
      var filterGroupContainer = $(document.createElement("div")).addClass("tab-content");

      _.each( this.filterGroups, function(filterGroup){

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

        //Create a FilterGroupView
        var filterGroupView = new FilterGroupView({
          model: filterGroup
        });

        //Render the FilterGroupView
        filterGroupView.render();

        //Add the FilterGroupView element to this view
        filterGroupContainer.append(filterGroupView.el);

        //Store a reference to the FilterGroupView in the tab link
        groupLink.data("view", filterGroupView);

      }, this);

      //Mark the first filter group as active
      groupTabs.children("li").first().addClass("active");
      filterGroupContainer.find(".filter-group").first().addClass("active");

      //Add the filter group elements to this view
      this.$el.append(groupTabs, filterGroupContainer);

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

      //When each filter group tab is shown, perform any post render function, if needed.
      this.$('a[data-toggle="tab"]').on('shown', function (e) {
        //Get the filter group view
        var filterGroupView = $(e.target).data("view");

        //If there is a post render function, call it
        if( filterGroupView && filterGroupView.postRender ){
          filterGroupView.postRender();
        }

      });

      this.$el.prepend( $(document.createElement("div")).addClass("filters-header") );

      this.renderAppliedFilters();

    },

    /*
    * Renders the section of the view that will display the currently-applied filters
    */
    renderAppliedFilters: function(){

      var appliedFiltersEl = $(document.createElement("ul")).addClass("applied-filters");

      this.$(".filters-header").append(appliedFiltersEl);

      _.each( this.filterGroups, function(filterGroup){

        var filters = filterGroup.get("filters");
        this.listenTo(filters, "change:values", this.updateAppliedFilters);

        var dateFilters = _.findWhere(filters, { type: "DateFilter" });
        this.listenTo(dateFilters, "change:min change:max", this.updateAppliedDateFilters);

      }, this);

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
        var newValues = filterModel.changed.values,
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

    },

    /*
    * When a DateFilter model is changed, update the applied filters in the UI
    */
    updateAppliedDateFilters: function(filterModel){

    },

    /*
    * Remove the filter from the UI and the Search collection
    *
    * @param {Event} - The DOM Event that occured on the filter remove icon
    */
    removeFilter: function(e){

      //Get the applied filter element and the filter model associated with it
      var appliedFilterEl = $(e.target).parents(".applied-filter"),
          filterModel =  appliedFilterEl.data("model");

      //Remove the given value from the filter model
      if( filterModel ){

        //Get the current value
        var values = filterModel.get("values"),
            //Remove the value that was in this applied filter
            newValues = _.without(values, appliedFilterEl.data("value"));

        //Updates the values on the model
        filterModel.set("values", newValues);

      }

    }

  });
  return FilterGroupsView;
});
