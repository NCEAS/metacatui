/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/ChoiceFilter',
        'views/filters/FilterView',
        'text!templates/filters/choiceFilter.html'],
  function($, _, Backbone, ChoiceFilter, FilterView, Template) {
  'use strict';

  // Render a view of a single ChoiceFilter model
  var ChoiceFilterView = FilterView.extend({

    // @type {ChoiceFilter} - A ChoiceFilter model to be rendered in this view
    model: null,

    className: "filter choice",

    template: _.template(Template),

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new ChoiceFilter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );

      var select = this.$("select");

      //Create the default option
      var defaultOption = $(document.createElement("option"))
                            .attr("value", "")
                            .text( this.model.get("placeholder") || "Choose a " + this.model.get("label") );
      select.append(defaultOption);

      //Create an option element for each choice listen in the model
      _.each( this.model.get("choices"), function(choice){

        select.append( $(document.createElement("option"))
                         .attr("value", choice.value)
                         .text(choice.label) );

      }, this );
      
    }

  });
  return ChoiceFilterView;
});
