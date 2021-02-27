/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/Filter',
        'text!templates/filters/filter.html',
        'text!templates/filters/filterLabel.html'],
  function($, _, Backbone, Filter, Template, LabelTemplate) {
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

    /**
     * The Filter model that this View renders. This is used to create a new
     * instance of the model if one is not provided to the view.
     * @type {Backbone.Model}
     * @since 2.15.0
     */
    modelClass: Filter,

    tagName: "div",

    className: "filter",

    /**
    * Reference to template for this view. HTML files are converted to Underscore.js
    * templates
    * @type {Underscore.Template}
    */
    template: _.template(Template),

    /**
    * The template that renders the icon and label of a filter
    * @type {Underscore.Template}
    * @since 2.15.0
    */
    labelTemplate: _.template(LabelTemplate),

    /**
     * One of "normal", "edit", or "uiBuilder". "normal" renders a regular filter used to
     * update a search model in a DataCatalogViewWithFilters. "edit" creates a filter that
     * cannot update a search model, but which has an "EDIT" button that opens a modal
     * with an interface for editing the filter model's properties (e.g. fields, model
     * type, etc.). "uiBuilder" is the view of the filter within this editing modal; it
     * has inputs that are overlaid above the filter elements where a user can edit the
     * placeholder text, label, etc. in a WYSIWYG fashion.
     * @type {string}
     * @since 2.15.0
     */
    mode: "normal",

    /**
     * The class to add to the filter when it is in "uiBuilder" mode
     * @type {string}
     * @since 2.15.0
     */
    uiBuilderClass: "ui-build",

    events: {
      "click .btn"     : "handleChange",
      "keypress input" : "handleTyping"
    },

    /**
     * Function executed whenever a new FilterView is created.
     * @param {Object} [options] - A literal object of options to set on this View
     */
    initialize: function (options) {

      try {
        if (!options || typeof options != "object") {
          var options = {};
        }

        if (options.mode && ["edit", "uiBuilder", "normal"].includes(options.mode)) {
          this.mode = options.mode
        }

        // When this view is being rendered in an editable mode (e.g. in the custom search
        // filter editor), then overwrite the functions that update the search model. This
        // way the user can interact with the filter without causing the
        // dataCatalogViewWithFilters to update the search results. For simplicity, and
        // because extended Filter Views call this function, update functions from other
        // types of Filter views are included here.
        if (["edit", "uiBuilder"].includes(this.mode)) {
          var functionsToOverwrite = [
            "updateModel", "handleChange", "handleTyping",
            "updateChoices", "updateToggle", "updateYearRange"
          ]
          functionsToOverwrite.forEach(function (fnName) {
            if (typeof this[fnName] === "function") {
              this[fnName] = function () { return }
            }
          }, this)
        }

        this.model = options.model || new this.modelClass();
      }
      catch (error) {
        console.log( 'There was an error initializing a FilterView' +
          ' Error details: ' + error );
      }

    },

    /**
     * Render an instance of a Filter View. All of the extended Filter Views also call
     * this render function.
     * @param {Object} templateVars - The variables to use in the HTML template. If not
     * provided, defaults to the model in JSON
     */
    render: function (templateVars) {
      try {
        var view = this;
      
        if(!templateVars){
          var templateVars = this.model.toJSON()
        }

        // Pass the mode (e.g. "edit", "uiBuilder") to the template
        templateVars = _.extend(templateVars, { mode: this.mode } )

        // Render the filter HTML (without label or icon)
        this.$el.html( this.template( templateVars ) );
        // Add the filter label & icon (common between most filters)
        this.$el.prepend( this.labelTemplate( templateVars ) );

        // a FilterEditorView adds an "EDIT" button, which opens a modal allowing the user
        // to change the UI options of the filter - e.g., label, icon, placeholder text,
        // etc.
        if(this.mode === "edit"){
          require(['views/filters/FilterEditorView'], function(FilterEditor){
            var filterEditor = new FilterEditor({
              model: view.model
            });
            filterEditor.render();
            view.$el.prepend(filterEditor.el);
          });
        }
        if(this.mode === "uiBuilder"){
          this.$el.addClass(this.uiBuilderClass);
        }
      }
      catch (error) {
        console.log( 'There was an error rendering a FilterView' +
          ' Error details: ' + error );
      }
    },

    /**
    * When the user presses Enter in the input element, update the view and model
    *
    * @param {Event} - The DOM Event that occurred on the filter view input element
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
