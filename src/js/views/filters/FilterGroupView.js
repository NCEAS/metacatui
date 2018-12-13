/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/FilterGroup',
        'views/filters/FilterView',
        'views/filters/BooleanFilterView',
        'views/filters/ChoiceFilterView',
        'views/filters/DateFilterView',
        'views/filters/NumericFilterView',
        'views/filters/ToggleFilterView',
        'text!templates/filters/filterGroup.html'],
  function($, _, Backbone, FilterGroup, FilterView, BooleanFilterView, ChoiceFilterView,
    DateFilterView, NumericFilterView, ToggleFilterView, Template) {
  'use strict';

  // Renders a display of a group of filters
  var FilterGroupView = Backbone.View.extend({

    // @type {FilterGroup} - A FilterGroup model to be rendered in this view
    model: null,

    tagName: "div",

    className: "filter-group tab-pane",

    template: _.template(Template),

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new FilterGroup();

    },

    render: function () {

      //Add the id attribute from the filter group label
      this.$el.attr("id", this.model.get("label").replace( /([^a-zA-Z0-9])/g, "") );

      //Get the collection of filters
      var filters = this.model.get("filters");

      //Render each filter model in the FilterGroup model
      filters.each(function(filter, i){

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

        //Render the view and append it's element to this view
        filterView.render();
        this.$el.append(filterView.el);

        //Add a margin to the filter element if there are at least three, since
        // it will likely appear in a new row
        if( i > 2 ){
          filterView.$el.css("margin-top", "20px");
        }

      }, this);

    }

  });
  return FilterGroupView;
});
