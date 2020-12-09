/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/FilterGroup',
        'views/filters/FilterView',
        'views/filters/BooleanFilterView',
        'views/filters/ChoiceFilterView',
        'views/filters/DateFilterView',
        'views/filters/NumericFilterView',
        'views/filters/ToggleFilterView'],
  function($, _, Backbone, FilterGroup, FilterView, BooleanFilterView, ChoiceFilterView,
    DateFilterView, NumericFilterView, ToggleFilterView) {
  'use strict';

  /**
  * @class FilterGroupView
  * @classdesc Renders a display of a group of filters
  * @classcategory Views/Filters
  * @extends Backbone.View
  */
  var FilterGroupView = Backbone.View.extend(
    /** @lends FilterGroupView.prototype */{

    /**
    * A FilterGroup model to be rendered in this view
    * @type {FilterGroup} */
    model: null,

    subviews: new Array(),

    tagName: "div",

    className: "filter-group tab-pane",

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new FilterGroup();

      this.subviews = new Array();

    },

    render: function () {

      //Add the id attribute from the filter group label
      this.$el.attr("id", this.model.get("label").replace( /([^a-zA-Z0-9])/g, "") );

      //Attach a reference to this view to the element
      this.$el.data("view", this);

      //Get the collection of filters
      var filters = this.model.get("filters");

      var filtersRow = $(document.createElement("div")).addClass("filters-container");
      this.$el.append(filtersRow);

      //Render each filter model in the FilterGroup model
      filters.each(function(filter, i){

        //Some filters are handled specially
        //The isPartOf filter should be rendered as a ToggleFilter
        if( filter.get("fields").includes("isPartOf") ){

          //Set a trueValue on the model so it works with the ToggleView
          if( filter.get("values").length && filter.get("values")[0] ){
            filter.set("trueValue", filter.get("values")[0]);
          }

          //Create a ToggleView
          var filterView = new ToggleFilterView({ model: filter });
        }
        else{
          //Depending on the filter type, create a filter view
          switch( filter.type ){
            case "Filter":
              var filterView = new FilterView({ model: filter });
              break;
            case "BooleanFilter":
              var filterView = new BooleanFilterView({ model: filter });
              break;
            case "ChoiceFilter":
              var filterView = new ChoiceFilterView({ model: filter });
              break;
            case "DateFilter":
              var filterView = new DateFilterView({ model: filter });
              break;
            case "NumericFilter":
              var filterView = new NumericFilterView({ model: filter });
              break;
            case "ToggleFilter":
              var filterView = new ToggleFilterView({ model: filter });
              break;
            default:
              var filterView = new FilterView({ model: filter });
          }
        }

        //Render the view and append it's element to this view
        filterView.render();

        //Append the filter view element to the view el
        filtersRow.append(filterView.el);

        //Save a reference to this subview
        this.subviews.push(filterView);

      }, this);

    },

    /**
    * Actions to perform after the render() function has completed and this view's
    * element is added to the webpage.
    */
    postRender: function(){

      //Iterate over each subview and call postRender() if it exists
      _.each( this.subviews, function(subview){

        if( subview.postRender ){
          subview.postRender();
        }

      });

    }

  });
  return FilterGroupView;
});
