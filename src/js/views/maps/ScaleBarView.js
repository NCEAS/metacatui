
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
          longitude: 'scale-bar__coord--longitude',
          latitude: 'scale-bar__coord--latitude',
          elevation: 'scale-bar__coord--elevation',
          longitudeLabel: 'scale-bar__label--longitude',
          latitudeLabel: 'scale-bar__label--latitude',
          elevationLabel: 'scale-bar__label--elevation',
          bar: 'scale-bar__bar',
          distance: 'scale-bar__distance'
        },

        /**
         * Allowed values for the displayed distance measurement in the scale bar. The
         * length (in pixels) of the scale bar will be adjusted so that it is proportional
         * to one of the listed numbers in meters.
         * @type {number[]}
         */
        distances: [
          0.1,
          0.5,
          1,
          2,
          3,
          5,
          10,
          20,
          30,
          50,
          100,
          200,
          300,
          500,
          1000,
          2000,
          3000,
          5000,
          10000,
          20000,
          30000,
          50000,
          100000,
          200000,
          300000,
          500000,
          1000000,
          2000000,
          3000000,
          5000000,
          10000000,
          20000000,
          30000000,
          50000000
        ],

        /**
         * The maximum width of the scale bar element, in pixels
         * @type {number}
         */
        maxBarWidth: 100,

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

            // Start with empty values
            this.updateCoordinates()
            this.updateScale()

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
         * Updates the displayed coordinates on the scale bar view. Numbers are rounded so
         * that long and lat have 5 digits after the decimal point.
         * @param {number} latitude The north-south position of the point to show
         * coordinates for
         * @param {number} longitude The east-west position of the point to show
         * coordinates for
         * @param {number} elevation The distance from sea-level of the point to show
         * coordinates for
         */
        updateCoordinates: function (latitude, longitude, elevation) {
          try {

            if ((latitude || latitude === 0) && (longitude || longitude === 0)) {
              // Update the displayed coordinates
              this.subElements.latitude.textContent = Number.parseFloat(latitude).toFixed(5);
              this.subElements.longitude.textContent = Number.parseFloat(longitude).toFixed(5);
              this.subElements.latitudeLabel.style.display = null;
              this.subElements.longitudeLabel.style.display = null;
            } else {
              // Update the displayed coordinates
              this.subElements.latitude.textContent = '';
              this.subElements.longitude.textContent = '';
              this.subElements.latitudeLabel.style.display = 'none';
              this.subElements.longitudeLabel.style.display = 'none';
            }

            if ((elevation || elevation === 0)) {
              // TODO: round/prettify elevation number
              this.subElements.elevation.textContent = elevation + 'm';
              this.subElements.elevationLabel.style.display = 'none';
            } else {
              this.subElements.elevation.textContent = '';
              this.subElements.elevationLabel.style.display = 'none';
            }

          }
          catch (error) {
            console.log(
              'There was an error updating the coordinates in a ScaleBarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Change the width of the scale bar and the displayed measurement value based on
         * a new pixel:meters ratio. This function ensures that the resulting values are
         * 'pretty' - the pixel and meter measurements passed to this function do not need
         * to be within any range or rounded, though both values must be > 0.
         * @param {number} pixels A length in pixels
         * @param {number} meters A distance, in meters, that is equivalent to the given
         * distance in pixels
         */
        updateScale: function (pixels, meters) {
          try {

            // Hide the scale bar if a measurement is not available
            let label = null
            let barWidth = 0

            if (pixels && meters && pixels > 0 && meters > 0) {
              const prettyValues = this.prettifyScaleValues(pixels, meters)
              label = prettyValues.label
              barWidth = prettyValues.pixels
            }

            if (barWidth === undefined || barWidth === null || !label) {
              barWidth = 0
            }

            this.subElements.distance.textContent = label;
            this.subElements.bar.style.width = barWidth + 'px';

          }
          catch (error) {
            console.log(
              'Failed to update the ScaleBarView. Error details: ' + error
            );
          }
        },

        /**
         * Takes a pixel:meters ratio and returns values ready to use in the scale bar.
         * @param {number} pixels A length in pixels. Must be > 0.
         * @param {number} meters A distance, in meters, that is equivalent to the given
         * distance in pixels. Must be > 0.
         * @returns {Object} Returns the prettified values.  Returns null for both values
         * if a matching distance was not found (see {@link ScaleBarView#distances})
         * @property {number|null} pixels The updated pixel value that is less than the
         * maxBarWidth and equivalent to the distance given by the label.
         * @property {string|null} label A string that gives a rounded distance
         * measurement along with a unit, either meters or kilometers (when > 1000m).
         */
        prettifyScaleValues: function (pixels, meters) {
          try {

            const view = this
            let prettyValues = {
              pixels: null,
              label: null
            }

            if (pixels && meters && pixels > 0 && meters > 0) {

              const onePixelInMeters = meters / pixels

              // Find the first distance that makes the scale bar less than the maxBarWidth
              let distance;
              for (
                let i = view.distances.length - 1;
                !(distance !== undefined && distance !== null) && i >= 0;
                --i
              ) {
                if (view.distances[i] / onePixelInMeters < view.maxBarWidth) {
                  distance = view.distances[i];
                }
              }

              if ((distance !== undefined && distance !== null)) {

                let label;
                if (distance >= 1000) {
                  label = (distance / 1000).toString() + ' km';
                } else if (distance > 1) {
                  label = distance.toString() + ' m';
                } else {
                  label = (distance * 100).toString() + ' cm';
                }

                prettyValues = {
                  pixels: (distance / onePixelInMeters),
                  label: label
                }
              }
            }

            return prettyValues

          }
          catch (error) {
            console.log(
              'There was an error prettifying scale values in a ScaleBarView' +
              '. Error details: ' + error
            );
            return {
              pixels: null,
              label: null
            }
          }
        },

      }
    );

    return ScaleBarView;

  }
);
