/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/Filter',
        'text!templates/filters/filter.html'],
  function($, _, Backbone, Filter, Template) {
  'use strict';

  /**
  * @class FilterView
  * @classdesc Render a view of a single FilterModel
  * @classcategory Views/Filters
  * @extends Backbone.View
  */
  var FilterView = Backbone.View.extend(
    /** @lends FilterView.prototype */{

    /**
    * A Filter model to be rendered in this view
    * @type {Filter} */
    model: null,

    tagName: "div",

    className: "filter",

    template: _.template(Template),

    events: {
      "click .btn"     : "handleChange",
      "keypress input" : "handleTyping"
    },

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new Filter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );
    },

    /**
    * When the user presses Enter in the input element, update the view and model
    *
    * @param {Event} - The DOM Event that occured on the filter view input element
    */
    handleTyping: function(e){

      if (e.keyCode != 13){
        return;
      }

      this.handleChange();

    },

    /**
    * Updates the view when the filter input is updated
    *
    * @param {Event} - The DOM Event that occured on the filter view input element
    */
    handleChange: function(){

      this.updateModel();

      //Clear the value of the text input
      this.$("input").val("");

    },

    /**
    * Updates the value set on the Filter Model associated with this view.
    * The filter value is grabbed from the input element in this view.
    *
    */
    updateModel: function(){

      //Get the new value from the text input
      var newValue = this.$("input").val();

      if( newValue == "" )
        return;

      //Get the current values array from the model
      var currentValue = this.model.get("values");

      //Create a copy of the array
      var newValuesArray = _.flatten(new Array(currentValue, newValue));

      //Trigger the change event manually since it is an array
      this.model.set("values", newValuesArray);

    }

  });
  return FilterView;
});
