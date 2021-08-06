
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'text!templates/maps/scale-bar.html'
  ],
  function (
    $,
    _,
    Backbone,
    Template
  ) {

    /**
    * @class ScaleBarView
    * @classdesc The scale bar is a legend for a map that shows the current longitude,
    * latitude, and elevation, as well as a scale bar to indicate the relative size of
    * geo-spatial features.
    * @classcategory Views/Maps
    * @name ScaleBarView
    * @extends Backbone.View
    * @screenshot maps/ScaleBarView.png // TODO: add screenshot
    * @constructs
    */
    var ScaleBarView = Backbone.View.extend(
      /** @lends ScaleBarView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'ScaleBarView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'scale-bar',

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * Classes that will be used to select elements from the template that will be
         * updated with new coordinates and scale.
         * @name ScaleBarView#classes
         * @type {Object}
         * @property {string} longitude The element that will contain the longitude
         * measurement
         * @property {string} latitude The element that will contain the latitude
         * measurement
         * @property {string} elevation The element that will contain the elevation
         * measurement
         * @property {string} bar The element that will be used as a scale bar
         * @property {string} distance The element that will contain the distance
         * measurement
         */
        classes: {
          longitude: "scale-bar__longitude",
          latitude: "scale-bar__latitude",
          elevation: "scale-bar__elevation",
          bar: "scale-bar__bar",
          distance: "scale-bar__distance"
        },

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function',
        },

        /**
        * Executed when a new ScaleBarView is created
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
            console.log('A ScaleBarView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {ScaleBarView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template());

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Select the elements that will be updatable
            this.subElements = {};
            for (const [element, className] of Object.entries(view.classes)) {
              view.subElements[element] = document.querySelector('.' + className)
            }

            // TODO: remove example data
            this.updateCoordinates("45.504741", "-73.597808", "120m")
            this.updateScale(70, "2km")

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a ScaleBarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         *
         * @param {number} longitude The east-west position of the point to show
         * coordinates for
         * @param {number} latitude The north-south position of the point to show
         * coordinates for
         * @param {number} elevation The distance from sea-level of the point to show
         * coordinates for
         */
        updateCoordinates: function (longitude, latitude, elevation) {
          try {
            // TODO: Format the coordinates and set units

            // Update the displayed coordinates
            this.subElements.longitude.textContent = longitude;
            this.subElements.latitude.textContent = latitude;
            this.subElements.elevation.textContent = elevation;
            
          }
          catch (error) {
            console.log(
              'There was an error updating the coordinates in a ScaleBarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * 
         * @param {number} width The length of the bar, in pixels
         * @param {number} distance The distance that the bar represents, in meters
         */
        updateScale: function (width, distance) {
          try {
            // TODO: Get the rounded distance with units to show
            this.subElements.distance.textContent = distance;
            // this.subElements.bar.setAttribute('style', 'width:'+length+'px;');
            this.subElements.bar.style.width = width + 'px';
          }
          catch (error) {
            console.log(
              'There was an error updating the scale in a ScaleBarView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return ScaleBarView;

  }
);
