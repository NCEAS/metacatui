define(["jquery", "underscore", "backbone", "d3"], function (
  $,
  _,
  Backbone,
  d3,
) {
  "use strict";

  // Build the main header view of the application
  var CircleBadgeView = Backbone.View.extend({
    initialize: function (options) {
      if (!d3) {
        console.log("SVG is not supported");
        return null;
      }

      /* OPTIONS:
			 *  data: an array of content with which to draw the circle badge. 
			 *  Each item in the array represents one circle badge and should have a count and may include an optional className to give the circle SVG elements and a label to display underneath the circle
			 *  	Example format:	
			 *  				[{count: 1045, 		   label: "metadata", className: "metadata"},
								 {count: "inner text", label: "data", 	  className: "data", r: 40}]
					r = radius of the circle - can be an int or if nothing is sent for radius, it will be determined based on the count length
			 *  id: The id to use for the svg element
			 *  title = optional text to append to the end of the row of circles
			 *  useGlobalR = use the same radius for all circles in the data array. Pass true to determine the radius for each circle dynamically and use the largest found
			 *  globalR = use the same radius for all circles in the data array. Pass a number to use as the radius for every circle
			 *  className = class to give the SVG element
			 *  margin = margin in pixels between circles
			 */

      this.id = options.id || "";
      this.data = options.data || [{ count: 0, className: "default" }];
      this.title = options.title || null;
      this.globalR = options.globalR || null;
      this.useGlobalR = options.useGlobalR || false;
      this.className = options.className || "";
      this.margin = options.margin || 20;
      this.titlePlacement = options.titlePlacement || null;
      this.height = options.height || null;
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

    render: function () {
      var viewRef = this;

      /*
       * ========================================================================
       * Calculate the radius for the circle/circles
       * ========================================================================
       */

      var radiuses = [30, 30, 30, 30, 40, 50, 60];
      _.each(this.data, function (d, i) {
        if (viewRef.globalR) {
          d.r = viewRef.globalR;
        }
        //If no radius or global radius number is specified, we will determine the radius based on the count length
        if (!d.r) {
          if (d.count < 10) {
            //i.e. is 1 digit
            d.r = radiuses[0];
            if (radiuses[0] > viewRef.globalR) {
              viewRef.globalR = radiuses[0];
            }
          } else if (d.count >= 10 && d.count < 100) {
            //i.e. is 2 digits
            d.r = radiuses[1];
            if (radiuses[1] > viewRef.globalR) {
              viewRef.globalR = radiuses[1];
            }
          } else if (d.count >= 100 && d.count < 1000) {
            //i.e. is 3 digits
            d.r = radiuses[2];
            if (radiuses[2] > viewRef.globalR) {
              viewRef.globalR = radiuses[2];
            }
          } else if (d.count >= 1000 && d.count < 10000) {
            //i.e. is 4 digits
            d.r = radiuses[3];
            if (radiuses[3] > viewRef.globalR) {
              viewRef.globalR = radiuses[3];
            }
          } else if (d.count >= 10000 && d.count < 100000) {
            //i.e. is 5 digits
            d.r = radiuses[4];
            if (radiuses[4] > viewRef.globalR) {
              viewRef.globalR = radiuses[4];
            }
          } else if (d.count >= 100000 && d.count < 1000000) {
            //i.e. is 6 digits
            d.r = radiuses[5];
            if (radiuses[5] > viewRef.globalR) {
              viewRef.globalR = radiuses[5];
            }
          } else if (d.count >= 1000000) {
            //i.e. is 7+ digits
            d.r = radiuses[6];
            if (radiuses[6] > viewRef.globalR) {
              viewRef.globalR = radiuses[6];
            }
          }
        }
      });

      /*
       * ========================================================================
       * Draw the circles
       * ========================================================================
       */

      //Select the SVG element
      var svg = d3
        .select(this.el)
        .attr("class", "circle-badge " + this.className);

      if (this.height) svg.attr("height", this.height);

      //Draw the circles
      var circle = svg
        .selectAll("circle")
        .data(this.data)
        .enter()
        .append("svg:circle")
        .attr("class", function (d, i) {
          return d.className;
        })
        .attr("r", function (d, i) {
          if (viewRef.useGlobalR) {
            d.r = viewRef.globalR;
          }
          return d.r;
        })
        .attr("transform", function (d, i) {
          if (i == 0) {
            d.x = d.r + 5;
          } else {
            d.x =
              viewRef.data[i - 1].x +
              viewRef.data[i - 1].r +
              viewRef.margin +
              d.r;
          }
          return "translate(" + d.x + "," + (d.r + 5) + ")"; //Add 5 pixels to allow for a 5px stroke
        });

      /*
       * ========================================================================
       * Draw the text inside and beside the circle(s)
       * ========================================================================
       */
      //Draw the text labels underneath the circles
      svg
        .append("g")
        .selectAll("text")
        .data(this.data)
        .enter()
        .append("svg:text")
        .attr("transform", function (d, i) {
          return "translate(" + d.x + "," + (d.r * 2 + 25) + ")";
        })
        .attr("class", function (d) {
          return d.className + " label";
        })
        .attr("text-anchor", "middle")
        .text(function (d) {
          return d.label;
        });

      //Draw the count labels inside the circles
      svg
        .append("g")
        .selectAll("text")
        .data(this.data)
        .enter()
        .append("svg:text")
        .text(function (d) {
          return typeof d.count == "string"
            ? d.count
            : MetacatUI.appView.commaSeparateNumber(d.count) || 0;
        })
        .attr("transform", function (d, i) {
          var y = viewRef.titlePlacement == "inside" ? d.r - 12 : d.r + 12;

          return "translate(" + d.x + "," + y + ")";
        })
        .attr("class", function (d) {
          return d.className + " count";
        })
        .attr("text-anchor", "middle");

      if (this.title) {
        if (this.titlePlacement == "inside") {
          //Draw the title next to the circles at the end
          var title = svg
            .append("text")
            .data(this.data)
            .text(this.title)
            .attr("class", "title")
            .attr("text-anchor", "middle")
            .attr("transform", function (d, i) {
              return "translate(" + d.x + "," + (d.r + 30) + ")";
            });
        } else {
          //Draw the title next to the circles at the end
          svg
            .append("text")
            .text(this.title)
            .attr("class", "title")
            .attr("transform", function (d, i) {
              return (
                "translate(" +
                (viewRef.data[viewRef.data.length - 1].x +
                  viewRef.data[viewRef.data.length - 1].r +
                  viewRef.margin) +
                "," +
                (viewRef.data[viewRef.data.length - 1].r + 5) +
                ")"
              );
            })
            .attr("text-anchor", "left");
        }
      }

      return this;
    },
  });
  return CircleBadgeView;
});
