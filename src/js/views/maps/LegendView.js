'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'd3',
    'models/maps/AssetColorPalette',
    'text!templates/maps/legend.html',
  ],
  function (
    $,
    _,
    Backbone,
    d3,
    AssetColorPalette,
    Template
  ) {

    /**
    * @class LegendView
    * @classdesc Creates a legend for a given Map Asset (Work In Progress). Currently
    * supports making 'preview' legends for CesiumImagery assets and Cesium3DTileset
    * assets (only for color palettes that are type 'categorical'). Eventually, will
    * support full-sized legend for these, and other assets, and all types of color
    * palettes (including 'continuous' and 'classified')
    * @classcategory Views/Maps
    * @name LegendView
    * @extends Backbone.View
    * @screenshot views/maps/LegendView.png
    * @since 2.18.0
    * @constructs
    */
    var LegendView = Backbone.View.extend(
      /** @lends LegendView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LegendView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'map-legend',

        /**
        * The MapAsset model that this view uses - currently supports CesiumImagery and
        * Cesium3DTileset models.
        * @type {MapAsset}
        */
        model: null,

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
         * Which type of legend to show? Can be set to either 'full' for a complete legend
         * with labels, title, and all color coding, or 'preview' for just a small
         * thumbnail of the colors used in the full legend.
         * @type {string}
         */
        mode: 'preview',

        /**
         * For vector preview legends, the relative dimensions to use. The SVG's
         * dimensions are set with a viewBox property only, so the height and width
         * represent an aspect ratio rather than absolute size.
         * @type {Object}
         * @property {number} previewSvgDimensions.width - The width of the entire SVG
         * @property {number} previewSvgDimensions.height - The height of the entire SVG
         * @property {number} squareSpacing - Maximum spacing between each of the squares
         * in the preview legend. Squares will be spaced 20% closed than this when the
         * legend is not hovered over.
         */
        previewSvgDimensions: {
          width: 160,
          height: 45,
          squareSpacing: 20
        },

        /**
         * Classes that are used to identify, or that are added to, the HTML elements that
         * comprise this view.
         * @type {Object}
         * @property {string} preview Additional class to add to legend that are the
         * preview/thumbnail version
         * @property {string} previewSVG The SVG element that holds the shapes with all
         * the legend colours in the preview legend.
         * @property {string} previewImg The image element that represents a thumbnail of
         * image layers, in preview legends
         * @property {string} tooltip Class added to tooltips used in preview legends
         */
        classes: {
          preview: 'map-legend--preview',
          previewSVG: 'map-legend__svg--preview',
          previewImg: 'map-legend__img--preview',
          tooltip: 'map-tooltip',
        },

        /**
        * Executed when a new LegendView is created
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
            console.log('A LegendView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LegendView} Returns the rendered view element
        */
        render: function () {

          try {

            if (!this.model) {
              return;
            }

            // Save a reference to this view
            var view = this;

            // The color palette maps colors to attributes of the map asset
            let colorPalette = null;
            // For color palettes,
            let paletteType = null;
            const mode = this.mode;

            // Insert the template into the view
            this.$el.html(this.template({}));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Add a modifier class if this is a preview of a legend
            if (mode === 'preview') {
              this.el.classList.add(this.classes.preview);
            }

            // Check for a color palette model in the Map Asset model. Even imagery layers
            // may have a color palette configured, specifically to use to create a
            // legend.
            for (const attr in this.model.attributes) {
              if (this.model.attributes[attr] instanceof AssetColorPalette) {
                colorPalette = this.model.get(attr);
                paletteType = colorPalette.get('paletteType')
              }
            }

            if (mode === 'preview') {
              // For categorical vector color palettes, in preview mode
              if (colorPalette && paletteType === 'categorical') {
                this.renderCategoricalPreviewLegend(colorPalette)
              } else if (colorPalette && paletteType === 'continuous') {
                this.renderContinuousPreviewLegend(colorPalette)
              }
              // For imagery layers that do not have a color palette, in preview mode
              else if (typeof this.model.getThumbnail === 'function') {
                if (!this.model.get('thumbnail')) {
                  this.listenToOnce(this.model, 'change:thumbnail', function () {
                    this.renderImagePreviewLegend(this.model.get('thumbnail'))
                  })
                } else {
                  this.renderImagePreviewLegend(this.model.get('thumbnail'))
                }
              }
            }
            // TODO:
            // - preview classified legend
            // - full legends with labels, title, etc.

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a Legend View' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Inserts a thumbnail in image into this view
         * @param {string} thumbnailURL A url to use for the src property of the thumbnail
         * image
         */
        renderImagePreviewLegend: function (thumbnailURL) {
          try {
            const img = new Image()
            img.src = thumbnailURL
            img.classList.add(this.classes.previewImg)
            this.el.append(img)
          }
          catch (error) {
            console.log(
              'There was an error rendering an image preview legend in a LegendView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates a preview legend for categorical color palettes and inserts it into the
         * view
         * @param {AssetColorPalette} colorPalette - The AssetColorPalette that maps
         * feature attributes to colors, used to create the legend
         */
        renderCategoricalPreviewLegend: function (colorPalette) {
          try {
            if (!colorPalette) {
              return
            }
            const view = this
            // Data to use in d3
            let data = colorPalette.get('colors').toJSON().reverse();

            if (data.length === 0) {
              return;
            }
            // The max width of the SVG, to be reduced if there are few colours
            let width = this.previewSvgDimensions.width
            // The height of the SVG
            const height = this.previewSvgDimensions.height
            // Height and width of the square is the height of the SVG, leaving some room
            // for shadow to show
            const squareSize = height * 0.92
            // Maximum spacing between squares. When not hovered, the squares will be
            // spaced 80% of this value.
            let squareSpacing = this.previewSvgDimensions.squareSpacing
            // The maximum number of squares that can fit on the SVG without any spilling
            // over
            const maxNumSquares = Math.floor(((width - squareSize) / squareSpacing) + 1)

            // If there are more colors than fit in the max width of the SVG space, only
            // show the first n squares that will fit
            if (data.length > maxNumSquares) {
              data = data.slice(0, maxNumSquares);
            }
            // Add index to data for sorting later (also works as unique ID)
            data.forEach(function (d, i) {
              d.i = i;
            });

            // Don't create an SVG that is wider than it need to be.
            width = squareSize + ((data.length - 1) * squareSpacing)

            // SVG element
            const svg = this.createSVG({
              dropshadowFilter: true,
              width: width,
              height: height,
            })

            // Add the preview class and dropshadow to the SVG
            svg.classed(this.classes.previewSVG, true)
            svg.style('filter', 'url(#dropshadow)')

            // Calculates the placement of the square along x-axis, when SVG is hovered
            // and when it's not
            function getSquareX(i, hovered) {
              const multiplier = hovered ? 1 : 0.8;
              return ((width - squareSize) - (i * (squareSpacing * multiplier)))
            }

            // Draw the legend (d3)
            const legendSquares = svg.selectAll('rect')
              .data(data)
              .enter()
              .append('rect')
              .attr('x', function (d, i) { return getSquareX(i, false) })
              .attr('height', squareSize)
              .attr('width', squareSize)
              .attr('rx', (squareSize * 0.1))
              .style('fill', function (d) {
                return `rgb(${d.color.red * 255},${d.color.green * 255},${d.color.blue * 255})`
              })
              .style('filter', 'url(#dropshadow)')

            // For legend with multiple colours, show a tooltip with the value/label when
            // the user hovers over a square. Also bring that square to the fore-front of
            // the legend when hovered. Only when MapAsset is visible though.
            if (data.length > 1) {

              // Space the squares further apart when they are hovered over
              svg
                .on('mouseenter', function () {
                  if (view.model.get('visible')) {
                    legendSquares
                      .transition()
                      .duration(250)
                      .attr('x', function (d, i) { return getSquareX(i, true) })
                  }
                })
                .on('mouseleave', function () {
                  legendSquares
                    .transition()
                    .duration(200)
                    .attr('x', function (d, i) { return getSquareX(i, false) })
                })

              legendSquares.on('mouseenter', function (d) {
                // Bring the hovered element to the front, while keeping other
                // legendSquares in order
                legendSquares.sort((a, b) => d3.ascending(a.i, b.i));
                this.parentNode.appendChild(this)
                // Show tooltip
                if (d.label || d.value || d.value === 0) {
                  $(this).tooltip({
                    placement: 'bottom',
                    trigger: 'manual',
                    title: d.label || d.value,
                    container: view.$el,
                    animation: false,
                    template: '<div class="tooltip ' + view.classes.tooltip + '"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>'
                  }).tooltip('show')
                }
              })
                // Hide tooltip and return squares to regular z-ordering
                .on('mouseleave', function (d) {
                  $(this).tooltip('destroy');
                  legendSquares.sort((a, b) => d3.ascending(a.i, b.i));
                })
            }
          }
          catch (error) {
            console.log(
              'There was an error creating a categorical legend preview in a LegendView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates a preview legend for continuous color palettes and inserts it into the
         * view
         * @param {AssetColorPalette} colorPalette - The AssetColorPalette that maps
         * feature attributes to colors, used to create the legend
         */
        renderContinuousPreviewLegend: function (colorPalette) {
          try {
            if (!colorPalette) {
              return
            }
            const view = this
            // Data to use in d3
            let data = colorPalette.get('colors').toJSON();
            // The max width of the SVG
            let width = this.previewSvgDimensions.width
            // The height of the SVG
            const height = this.previewSvgDimensions.height
            // Height of the gradient rectangle, leaving some room for the drop shadow
            const gradientHeight = height * 0.92

            // A unique ID for the gradient
            const gradientId = 'gradient-' + view.cid;

            // Calculate the rounding precision we should use based on the
            // range of the data. This determines how each value in the legend
            // is displayed in the tooltip on mouseover. See the
            // rect.on('mousemove'... function, below
            data = data.sort((a, b) => a.value - b.value);
            const min = data[0].value
            const max = data[data.length - 1].value
            const range = max - min
            let roundingConstant = 10 // Allow 1 decimal place by default
            if (range < 0.0001 || range > 100000) {
              roundingConstant = null // Will use scientific notation
            } else if (range < 0.001) {
              roundingConstant = 100000 // Allow 5 decimal places
            } else if (range < 0.01) {
              roundingConstant = 10000 // Allow 4 decimal places
            } else if (range < 0.1) {
              roundingConstant = 1000 // Allow 3 decimal places
            } else if (range < 1) {
              roundingConstant = 100 // Allow 2 decimal places
            } else if (range > 100) {
              roundingConstant = 1 // No decimal places
            }

            // SVG element
            const svg = this.createSVG({
              dropshadowFilter: false,
              width: width,
              height: height,
            })

            // Add the preview class and dropshadow to the SVG
            svg.classed(this.classes.previewSVG, true)
            svg.style('filter', 'url(#dropshadow)')

            // Create a gradient using the data
            const gradient = svg.append('defs')
              .append('linearGradient')
              .attr('id', gradientId)
              .attr('x1', '0%')
              .attr('y1', '0%')

            var getOffset = function (d, data) {
              return (d.value - min) / (range) * 100 + '%'
            }
            var getStopColor = function (d) {
              const r = d.color.red * 255
              const g = d.color.green * 255
              const b = d.color.blue * 255
              return `rgb(${r},${g},${b})`
            }

            // Add the gradient stops
            data.forEach(function (d, i) {
              gradient.append('stop')
                // offset should be relative to the value in the data
                .attr('offset', getOffset(d, data))
                .attr('stop-color', getStopColor(d))
            })

            // Create the rectangle
            const rect = svg.append('rect')
              .attr('x', 0)
              .attr('y', 0)
              .attr('width', width)
              .attr('height', gradientHeight)
              .attr('rx', (gradientHeight * 0.1))
              .style('fill', 'url(#' + gradientId + ')')

            // Create a proxy element to attach the tooltip to, so that we can move the
            // tooltip to follow the mouse (by moving the proxy element to follow the mouse)
            const proxyEl = svg.append('rect').attr('y', gradientHeight)

            rect.on('mousemove', function () {
              if (view.model.get('visible')) {
                // Get the coordinates of the mouse relative to the rectangle
                let xMouse = d3.mouse(this)[0];
                if (xMouse < 0) {
                  xMouse = 0;
                }
                if (xMouse > width) {
                  xMouse = width;
                }
                // Get the relative position of the mouse to the gradient
                const relativePosition = xMouse / width;
                // Get the value at the relative position by interpolating the data
                let value = d3.interpolate(data[0].value, data[data.length - 1].value)(relativePosition);
                // Show tooltip with the value
                if (value || value === 0) {
                  // Round or show in scientific notation
                  if (roundingConstant) {
                    value = (Math.round(value * roundingConstant) / roundingConstant).toString()
                  } else {
                    value = value.toExponential(2).toString()
                  }
                  // Move the proxy element to follow the mouse
                  proxyEl.attr('x', xMouse)
                  // Attach the tooltip to the proxy element. Tooltip needs to be
                  // refreshed every time the mouse moves
                  $(proxyEl).tooltip('destroy');
                  $(proxyEl).tooltip({
                    placement: 'bottom',
                    trigger: 'manual',
                    title: value,
                    container: view.$el,
                    animation: false,
                    template: '<div class="tooltip ' + view.classes.tooltip + '"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>'
                  }).tooltip('show')
                }
              }
            })
              // Hide tooltip
              .on('mouseleave', function () {
                $(proxyEl).tooltip('destroy');
              })

          }
          catch (error) {
            console.log(
              'There was an error rendering a continuous preview legend in a LegendView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates an SVG element and inserts it into the view
         * @param {object} options Used to configure parts of the SVG
         * @property {boolean} options.dropshadowFilter Set to true to create a filter
         * element that creates a dropshadow behind any element it is applied to. It can
         * be added to child elements of the SVG by setting a `filter: url(#dropshadow);`
         * style rule on the child.
         * @property {number} options.height The relative height of the SVG (for the
         * viewBox property)
         * @property {number} options.width The relative width of the SVG (for the viewBox
         * property)
         * @returns {SVG} Returns the SVG element that is in the view
         */
        createSVG: function (options = {}) {
          try {
            // Create an SVG to hold legend elements
            const container = this.el;
            const width = options.width;
            const height = options.height;

            const svg = d3.select(container)
              .append('svg')
              .attr('preserveAspectRatio', 'xMidYMid')
              .attr('viewBox', [0, 0, width, height]);

            if (options.dropshadowFilter) {

              const filterText =
              `<filter id="dropshadow" height="110%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2"/> <!-- stdDeviation is how much to blur -->
                <feOffset dx="1" dy="1" result="offsetblur"/> <!-- how much to offset -->
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.7"/> <!-- slope is the opacity of the shadow -->
                </feComponentTransfer>
                <feMerge> 
                  <feMergeNode/> <!-- this contains the offset blurred image -->
                  <feMergeNode in="SourceGraphic"/> <!-- this contains the element that the filter is applied to -->
                </feMerge>
              </filter>`

              const filterEl = new DOMParser().parseFromString(
                '<svg xmlns="http://www.w3.org/2000/svg">' + filterText + '</svg>',
                'application/xml'
              ).documentElement.firstChild

              svg.node().appendChild(document.importNode(filterEl, true))
            }

            return svg
          }
          catch (error) {
            console.log(
              'There was an error creating an SVG in a LegendView' +
              '. Error details: ' + error
            );
          }
        }


      }
    );

    return LegendView;

  }
);
