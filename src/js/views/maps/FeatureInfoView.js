
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Feature',
    'text!templates/maps/feature-info.html'
  ],
  function (
    $,
    _,
    Backbone,
    Feature,
    Template
  ) {

    /**
    * @class FeatureInfoView
    * @classdesc A card that shows more details about a specific geo-spatial feature
    * displayed on a Map View.
    * @classcategory Views/Maps
    * @name FeatureInfoView
    * @extends Backbone.View
    * @screenshot maps/FeatureInfoView.png // TODO: add screenshot
    * @constructs
    */
    var FeatureInfoView = Backbone.View.extend(
      /** @lends FeatureInfoView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'FeatureInfoView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'feature-info',

        /**
        * The model that this view uses
        * @type {Feature}
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function',
        },

        /**
        * Executed when a new FeatureInfoView is created
        * @param {Object} [options] - A literal object with options to pass to the view
        */
        initialize: function (options) {

          try {
            // Get all the options and apply them to this view
            if (typeof options == 'object') {
              for (const [key, value] of Object.entries(options)) {
                this[key] = value;
              }
            }
          } catch (e) {
            console.log('A FeatureInfoView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {FeatureInfoView} Returns the rendered view element
        */
        render: function () {

          try {
            
            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template({}));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Shows the feature info box
         */
        show : function(){
          try {
            // TODO
          }
          catch (error) {
            console.log(
              'There was an error showing the FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Hide the feature info box from view
         */
        hide : function(){
          try {
            // TODO
          }
          catch (error) {
            console.log(
              'There was an error hiding the FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Update the content that's displayed in a feature info box, based on the
         * information in the Feature model.
         */
        updateContent : function(){
          try {
            // TODO
          }
          catch (error) {
            console.log(
              'There was an error updating the content of a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return FeatureInfoView;

  }
);
