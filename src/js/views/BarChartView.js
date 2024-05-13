/*global define */
define(["jquery", "underscore", "backbone", "d3"], function (
  $,
  _,
  Backbone,
  d3,
) {
  "use strict";

  // Build the main header view of the application
  var BarChartView = Backbone.View.extend({
    initialize: function (options) {
      /* OPTIONS:
       * 	data: An array of objects that represents the data to be graphed. Pass in a format of {"x axis label": y-axis number, "className": "class attribute string"}. Example:
       * 			[{x: "2009", y: 20, "className": "bar"}]
       * 			Any objects with the same x value will be graphed as overlapping bars on the same spot on the x-axis, so stacked bar charts can be created that way.
       * 	formatFromSolrFacets = pass true to pass a Solr facets object to format and then use as the data to graph
       *  formatFromSolrFacetRanges = pass true to pass a Solr facet ranges object to format and then use as the data to graph
       *  	Solr facet ranges look like:   [0: "2015-08-08", 1: 160, 2: "2015-09-08", 3: 200]
       *  id: The id to use for the svg element
       * 	className = class to give the SVG element
       *  barClass = a class to give every bar element
       *  yLabel = the text of the label along the y-axis
       *  yFormat = the format to use for the y-axis tick marks, in d3.format syntax (https://github.com/mbostock/d3/wiki/Formatting#d3_format)
       *  width = width of SVG element
       *  height = height of SVG element
       *  roundedRect = pass true to rounded the top corners of the bars. Use false for stacked bar charts
       *  displayBarLabel = pass false to turn off the count labels displayed at the top of each bar
       *  hideBarLabels = if set to true, the bar labels will be in the DOM but will only be shown on mouseover.
       */
      this.data = options.data || [{ x: "", y: 0, className: "default" }];
      this.id = options.id || "";
      this.className = options.className || "";
      this.barClass = options.barClass || "";
      this.yLabel = options.yLabel || "";
      this.yFormat = options.yFormat || null;
      this.width = options.width || 650;
      this.height = options.height || 250;
      this.roundedRect = options.roundedRect || false;
      this.roundedRadius = options.roundedRadius || null;
      this.displayBarLabel = options.displayBarLabel || true;
      this.hideBarLabels = options.hideLabels || false;
      this.barLabelClass = options.barLabelClass || "";

      if (options.formatFromSolrFacets)
        this.data = this.formatFromSolrFacets(
          this.data,
          options.solrFacetField,
        );

      if (options.formatFromSolrFacetRanges)
        this.data = this.formatFromSolrFacetRanges(this.data);

      //If there are less than 3 data objects (3 bars)
      if (this.data.length < 3 && this.width > 650) {
        this.width = 650;
      }
    },

    // http://stackoverflow.com/questions/9651167/svg-not-rendering-properly-as-a-backbone-view
    // Give our el a svg namespace because Backbone gives a different one automatically
    nameSpace: "http://www.w3.org/2000/svg",
    _ensureElement: function () {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, "attributes"));
        if (this.id) attrs.id = _.result(this, "id");
        if (this.className) attrs["class"] = _.result(this, "className");
        var $el = $(
          window.document.createElementNS(
            _.result(this, "nameSpace"),
            _.result(this, "tagName"),
          ),
        ).attr(attrs);
        this.setElement($el, false);
      } else {
        this.setElement(_.result(this, "el"), false);
      }
    },

    tagName: "svg",

    /*
     * --Adapted from http://bl.ocks.org/mbostock/7441121--
     * This function draws a simple bar chart
     */
    render: function () {
      var viewRef = this;

      /*
       * ========================================================================
       * Gather and create preliminary data for our bar chart
       * ========================================================================
       */

      var margin = { top: 20, right: 10, bottom: 70, left: 80 },
        width = this.width - margin.left - margin.right,
        height = this.height - margin.top - margin.bottom;

      this.margin = margin;

      var x = d3.scale.ordinal().rangeRoundBands([0, width], 0.3);

      var min = d3.min(this.data, function (d) {
          return d.y;
        }),
        max = d3.max(this.data, function (d) {
          return d.y;
        }),
        difference = max - min;

      if (difference > 30000 || (min < 10 && difference > 10000)) {
        var y = d3.scale.log().range([height, 0]);
        var log = true;
        this.className += " log-scale";
      } else {
        var y = d3.scale.linear().range([height, 0]);
        var log = false;
      }

      var xAxis = d3.svg.axis().scale(x).orient("bottom");

      if (log)
        this.yFormat = function (d) {
          return y.tickFormat(0, d3.format(",d"))(d);
        };
      else if (!this.yFormat) this.yFormat = d3.format(",d");

      var yAxis = d3.svg
        .axis()
        .scale(y)
        .orient("left")
        .innerTickSize(["-" + this.width])
        .tickFormat(this.yFormat);

      var chart = d3
        .select(this.el)
        .attr("class", "bar-chart " + this.className)
        // make responsive
        .attr(
          "viewBox",
          "0, 0," +
            (width + margin.left + margin.right) +
            "," +
            (height + margin.top + margin.bottom),
        )
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      x.domain(
        this.data.map(function (d) {
          return d.x;
        }),
      );

      if (max > 1) y.domain([1, max]);
      else y.domain([0, 1]);

      chart
        .append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)");

      chart.append("g").attr("class", "y axis").call(yAxis);

      /* rounded_rect: A function for drawing a rounded rectangle 
			    	x: x-coordinate
					y: y-coordinate
					w: width
					h: height
					r: corner radius
					tl: top_left rounded?
					tr: top_right rounded?
					bl: bottom_left rounded?
					br: bottom_right rounded?
			   */
      function rounded_rect(x, y, w, h, r, tl, tr, bl, br) {
        var retval;
        retval = "M" + (x + r) + "," + y;
        retval += "h" + (w - 2 * r);
        if (tr) {
          retval += "a" + r + "," + r + " 0 0 1 " + r + "," + r;
        } else {
          retval += "h" + r;
          retval += "v" + r;
        }
        retval += "v" + (h - 2 * r);
        if (br) {
          retval += "a" + r + "," + r + " 0 0 1 " + -r + "," + r;
        } else {
          retval += "v" + r;
          retval += "h" + -r;
        }
        retval += "h" + (2 * r - w);
        if (bl) {
          retval += "a" + r + "," + r + " 0 0 1 " + -r + "," + -r;
        } else {
          retval += "h" + -r;
          retval += "v" + -r;
        }
        retval += "v" + (2 * r - h);
        if (tl) {
          retval += "a" + r + "," + r + " 0 0 1 " + r + "," + -r;
        } else {
          retval += "v" + -r;
          retval += "h" + r;
        }
        retval += "z";
        return retval;
      }

      /*
       * ========================================================================
       * Draw the bars
       * ========================================================================
       */

      var bars = chart.selectAll(".bar").data(this.data).enter().append("g"),
        //Hide the bar labels when there are more than 20 bars AND if some of the labels are more than 2 characters wide (2 characters/digits will fit within a bar width)
        hideLabels = (bars[0].length > 20 && max > 100) || this.hideBarLabels;

      if (hideLabels) this.barClass += " show-label";

      bars
        .append("path")
        .attr("d", function (d) {
          if (!d.y) return null; // Do not draw anything if this y-value is 0

          if (viewRef.roundedRect) {
            if (viewRef.roundedRadius && bars[0].length < 20) {
              var radius = viewRef.roundedRadius;
            } else {
              var radius = Math.min(x.rangeBand() / 2, 30); //Try to make the bars completely rounded on top - i.e. the radius for both corners is half the width of the bar. - but don't go over 30 pixels because really wide bars with a completely round top look very odd
            }

            var DOMheight = height - y(d.y);
            radius = Math.min(radius, DOMheight / 2); //If bars are too short, the rounded corners will mess up the rendering so make sure the rounded corners are no more than half the height of the SVG path element
          } else var radius = 0; //Square corners

          return rounded_rect(
            x(d.x),
            y(d.y),
            x.rangeBand(),
            height - y(d.y),
            radius,
            true,
            true,
          );
        })
        .attr("x", function (d) {
          return x(d.x);
        })
        .attr("y", function (d) {
          return y(d.y);
        })
        .attr("class", function (d) {
          if (!d.className) {
            d.className = "";
          }
          return "bar " + d.className + " " + viewRef.barClass;
        })
        .attr("data-id", function (d) {
          return d.x;
        });

      if (hideLabels) {
        bars.on("mouseover", function (d) {
          //Hide all other bars
          viewRef.$(".bar-label").hide();

          var id = $(this).children("path").attr("data-id");
          viewRef.$(".bar-label[data-id='" + d.x + "']").fadeIn(200);
        });
        bars.on("mouseout", function (d) {
          var id = $(this).children("path").attr("data-id");
          viewRef.$(".bar-label[data-id='" + id + "']").hide();
        });

        //Add the hide labels class to the chart
        this.$el.attr("class", this.$el.attr("class") + " hide-labels");
      }

      /*
       * ========================================================================
       * Display the count above the bar
       * ========================================================================
       */
      if (this.displayBarLabel) {
        //When there are more than 20 bars, hide the label and display on hover
        if (hideLabels) {
          this.barLabelClass += " hidden";

          var labelWidth = 160,
            labelHeight = 20,
            labelXPadding = 10,
            labelYPadding = 10,
            width = this.width - margin.left - margin.right;

          var barLabels = chart
            .selectAll(".bar-label")
            .data(this.data)
            .enter()
            .append("g")
            .attr("class", "bar-label-container");
          barLabels
            .append("rect")
            .attr("x", function (d, i) {
              var xPos = x(d.x) + x.rangeBand() / 2;
              //Don't let our label bleed off the edge
              if (xPos < 0) xPos = xPos + labelWidth;
              if (xPos + labelWidth > width)
                xPos = xPos - labelWidth + labelXPadding;

              return xPos;
            })
            .attr("y", function (d, i) {
              var yPos = y(d.y) - 10;

              //Don't let our label bleed off the edge
              if (yPos < viewRef.margin.top * -1) yPos = yPos + labelHeight;
              else if (yPos > viewRef.height - labelHeight)
                yPos = yPos - labelHeight;

              return yPos;
            })
            .attr("width", function (d) {
              return (
                (d.x + ": " + MetacatUI.appView.commaSeparateNumber(d.y))
                  .length *
                  8 +
                labelXPadding
              );
            })
            .attr("height", labelHeight + labelYPadding)
            .attr("rx", 5) //For rounded corners
            .attr("ry", 5) //For rounded corners
            .attr("class", "bg bar-label " + this.barLabelClass)
            .attr("text-anchor", "end")
            .attr("data-id", function (d, i) {
              return d.x;
            });
          barLabels
            .append("text")
            .attr("x", function (d, i) {
              var xPos = x(d.x) + x.rangeBand() / 2;
              //Don't let our label bleed off the edge
              if (xPos < 0) xPos = xPos + labelWidth;
              if (xPos + labelWidth > width)
                xPos = xPos - labelWidth + labelXPadding;

              return xPos + labelXPadding;
            })
            .attr("y", function (d, i) {
              var yPos = y(d.y) - 10;

              //Don't let our label bleed off the edge
              if (yPos < viewRef.margin.top * -1) yPos = yPos + labelHeight;
              else if (yPos > viewRef.height - labelHeight)
                yPos = yPos - labelHeight;

              return yPos + labelYPadding * 2;
            })
            .text(function (d) {
              var val = MetacatUI.appView.commaSeparateNumber(d.y);
              if (max < 1 && viewRef.yFormat().indexOf("%") > -1)
                val = val * 100 + "%";
              return d.x + ": " + val;
            })
            .attr("class", "bar-label " + this.barLabelClass)
            .attr("text-anchor", "start")
            .attr("data-id", function (d) {
              return d.x;
            });
        } else {
          bars
            .append("text")
            .attr("transform", function (d) {
              var textX = x(d.x) + x.rangeBand() / 2,
                textY = y(d.y) - 10;

              return "translate(" + textX + "," + textY + ")";
            })
            .text(function (d) {
              var val = MetacatUI.appView.commaSeparateNumber(d.y);
              if (max < 1 && viewRef.yFormat().indexOf("%") > -1)
                val = val * 100 + "%";
              return val;
            })
            .attr("text-anchor", "middle")
            .attr("class", this.barLabelClass);
        }
      }

      /*
       * ========================================================================
       * Add a label to the y-axis
       * ========================================================================
       */
      d3.select(this.el)
        .append("text")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "middle")
        .text(this.yLabel)
        .attr("class", "title")
        .attr("transform", "translate(0, " + this.height / 2 + ") rotate(-90)");

      return this;
    },

    // This function will take a single object of key:value pairs (identical to the format that Solr returns for facets) and format it as needed to draw a bar chart
    // param rawData: Format example: {"cats": 5, "dogs": 6, "fish": 10}
    // param field: optional field to use when extracting from a complex value, e.g., "mean". For example:
    // {"urn:node:mnDemo5": {"min":0.25,"max":1.0,"count":11,"missing":0,"sum":6.682560903149138,"sumOfSquares":4.8545478685001076,"mean":0.6075055366499217,"stddev":0.2819317507548068}}
    formatFromSolrFacets: function (rawData, field) {
      var keys = Object.keys(rawData);
      var data = [];
      for (var i = 0; i < keys.length; i++) {
        var value = rawData[keys[i]];
        if (field) {
          value = rawData[keys[i]][field];
        }
        data.push({
          x: keys[i],
          y: value,
        });
      }

      return data;
    },

    formatFromSolrFacetRanges: function (rawData) {
      var keys = Object.keys(rawData),
        data = [],
        monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "June",
          "July",
          "Aug",
          "Sept",
          "Oct",
          "Nov",
          "Dec",
        ];

      for (var i = 0; i < keys.length - 1; i += 2) {
        var date = new Date(rawData[i]),
          formattedDate =
            monthNames[date.getUTCMonth()] + " " + date.getFullYear();

        data.push({
          x: formattedDate,
          y: rawData[i + 1],
          rawDate: rawData[i],
        });
      }

      return data;
    },
  });
  return BarChartView;
});
