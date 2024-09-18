"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/scale-bar.html",
], ($, _, Backbone, Template) => {
  /**
   * @class ScaleBarView
   * @classdesc The scale bar is a legend for a map that shows the current longitude,
   * latitude, and elevation, as well as a scale bar to indicate the relative size of
   * geo-spatial features.
   * @classcategory Views/Maps
   * @name ScaleBarView
   * @augments Backbone.View
   * @screenshot views/maps/ScaleBarView.png
   * @since 2.18.0
   * @constructs
   */
  const ScaleBarView = Backbone.View.extend(
    /** @lends ScaleBarView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ScaleBarView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "scale-bar",

      /**
       * The model that holds the current scale of the map in pixels:meters
       * @type {GeoScale}
       * @since 2.27.0
       */
      scaleModel: null,

      /**
       * The model that holds the current position of the mouse on the map
       * @type {GeoPoint}
       * @since 2.27.0
       */
      pointModel: null,

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * Classes that will be used to select elements from the template that will be
       * updated with new coordinates and scale.
       * @name ScaleBarView#classes
       * @type {object}
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
        longitude: "scale-bar__coord--longitude",
        latitude: "scale-bar__coord--latitude",
        elevation: "scale-bar__coord--elevation",
        longitudeLabel: "scale-bar__label--longitude",
        latitudeLabel: "scale-bar__label--latitude",
        elevationLabel: "scale-bar__label--elevation",
        bar: "scale-bar__bar",
        distance: "scale-bar__distance",
      },

      /**
       * Allowed values for the displayed distance measurement in the scale bar. The
       * length (in pixels) of the scale bar will be adjusted so that it is proportional
       * to one of the listed numbers in meters.
       * @type {number[]}
       */
      distances: [
        0.1, 0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000,
        3000, 5000, 10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000,
        1000000, 2000000, 3000000, 5000000, 10000000, 20000000, 30000000,
        50000000,
      ],

      /**
       * The maximum width of the scale bar element, in pixels
       * @type {number}
       */
      maxBarWidth: 100,

      /**
       * The events this view will listen to and the associated function to call.
       * @type {object}
       */
      events: {
        // 'event selector': 'function',
      },

      /**
       * Executed when a new ScaleBarView is created
       * @param {object} [options] - A literal object with options to pass to the view
       */
      initialize(options) {
        // Get all the options and apply them to this view
        if (typeof options === "object") {
          Object.entries(options).forEach(([key, value]) => {
            this[key] = value;
          });
        }
      },

      /**
       * Renders this view
       * @returns {ScaleBarView} Returns the rendered view element
       */
      render() {
        // Save a reference to this view
        const view = this;

        // Insert the template into the view
        this.$el.html(this.template());

        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        // Select the elements that will be updatable
        this.subElements = {};
        Object.entries(view.classes).forEach(([element, className]) => {
          view.subElements[element] = this.el.querySelector(`.${className}`);
        });

        // Start with empty values
        this.updateCoordinates();
        this.updateScale();

        // Listen for changes to the models
        this.listenToScaleModel();
        this.listenToPointModel();

        return this;
      },

      /**
       * Update the scale bar when the pixel:meters ratio changes
       * @since 2.27.0
       */
      listenToScaleModel() {
        const view = this;
        this.listenTo(this.scaleModel, "change", () => {
          view.updateScale(
            view.scaleModel.get("pixels"),
            view.scaleModel.get("meters"),
          );
        });
      },

      /**
       * Stop listening to the scale model
       * @since 2.27.0
       */
      stopListeningToScaleModel() {
        this.stopListening(this.scaleModel, "change");
      },

      /**
       * Update the scale bar view when the lat and long change
       * @since 2.27.0
       */
      listenToPointModel() {
        const view = this;
        this.listenTo(
          this.pointModel,
          "change:latitude change:longitude",
          () => {
            view.updateCoordinates(
              view.pointModel.get("latitude"),
              view.pointModel.get("longitude"),
            );
          },
        );
      },

      /**
       * Stop listening to the point model
       */
      stopListeningToPointModel() {
        this.stopListening(this.pointModel, "change:latitude change:longitude");
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
      updateCoordinates(latitude, longitude, elevation) {
        if ((latitude || latitude === 0) && (longitude || longitude === 0)) {
          // Update the displayed coordinates
          this.subElements.latitude.textContent =
            Number.parseFloat(latitude).toFixed(5);
          this.subElements.longitude.textContent =
            Number.parseFloat(longitude).toFixed(5);
          this.subElements.latitudeLabel.style.display = null;
          this.subElements.longitudeLabel.style.display = null;
        } else {
          // Update the displayed coordinates
          this.subElements.latitude.textContent = "";
          this.subElements.longitude.textContent = "";
          this.subElements.latitudeLabel.style.display = "none";
          this.subElements.longitudeLabel.style.display = "none";
        }

        if (elevation || elevation === 0) {
          // TODO: round/prettify elevation number
          this.subElements.elevation.textContent = `${elevation}m`;
          this.subElements.elevationLabel.style.display = "none";
        } else {
          this.subElements.elevation.textContent = "";
          this.subElements.elevationLabel.style.display = "none";
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
      updateScale(pixels, meters) {
        // Hide the scale bar if a measurement is not available
        let label = null;
        let barWidth = 0;

        if (pixels && meters && pixels > 0 && meters > 0) {
          const prettyValues = this.prettifyScaleValues(pixels, meters);
          label = prettyValues.label;
          barWidth = prettyValues.pixels;
        }

        if (barWidth === undefined || barWidth === null || !label) {
          barWidth = 0;
        }

        this.subElements.distance.textContent = label;
        this.subElements.bar.style.width = `${barWidth}px`;
      },

      /**
       * Takes a pixel:meters ratio and returns values ready to use in the scale bar.
       * @param {number} pixels A length in pixels. Must be > 0.
       * @param {number} meters A distance, in meters, that is equivalent to the given
       * distance in pixels. Must be > 0.
       * @returns {object} Returns the prettified values.  Returns null for both values
       * if a matching distance was not found (see {@link ScaleBarView#distances})
       * @property {number|null} pixels The updated pixel value that is less than the
       * maxBarWidth and equivalent to the distance given by the label.
       * @property {string|null} label A string that gives a rounded distance
       * measurement along with a unit, either meters or kilometers (when > 1000m).
       */
      prettifyScaleValues(pixels, meters) {
        try {
          const view = this;
          let prettyValues = {
            pixels: null,
            label: null,
          };

          if (pixels && meters && pixels > 0 && meters > 0) {
            const onePixelInMeters = meters / pixels;

            // Find the first distance that makes the scale bar less than the maxBarWidth
            let distance;
            for (
              let i = view.distances.length - 1;
              !(distance !== undefined && distance !== null) && i >= 0;
              i -= 1
            ) {
              if (view.distances[i] / onePixelInMeters < view.maxBarWidth) {
                distance = view.distances[i];
              }
            }

            if (distance !== undefined && distance !== null) {
              let label;
              if (distance >= 1000) {
                label = `${(distance / 1000).toString()} km`;
              } else if (distance > 1) {
                label = `${distance.toString()} m`;
              } else {
                label = `${(distance * 100).toString()} cm`;
              }

              prettyValues = {
                pixels: distance / onePixelInMeters,
                label,
              };
            }
          }

          return prettyValues;
        } catch (error) {
          return {
            pixels: null,
            label: null,
          };
        }
      },

      /**
       * Function to execute when this view is removed from the DOM
       * @since 2.27.0
       */
      onClose() {
        this.stopListeningToScaleModel();
        this.stopListeningToPointModel();
      },
    },
  );

  return ScaleBarView;
});
