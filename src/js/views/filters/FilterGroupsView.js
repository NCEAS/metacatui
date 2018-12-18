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

    }

  });
  return FilterGroupsView;
});
