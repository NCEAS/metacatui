/* global define */
"use strict";

define(["jquery", "underscore", "backbone", "models/CitationModel"], function (
  $,
  _,
  Backbone,
  CitationModel,
) {
  /**
   * @class Citations
   * @classdesc Citations represents the Citations list
   * found at https://app.swaggerhub.com/apis/nenuji/data-metrics/1.0.0.3.
   * For details regarding a single Citation Entity, refer `models/CitationModel`
   * @classcategory Collections
   * @name Citations
   * @extends Backbone.Collection
   * @constructor
   */
  var Citations = Backbone.Collection.extend(
    /** @lends Citations.prototype */ {
      model: function (attrs, options) {
        // We use the inline require here in addition to the define above to
        // avoid an issue caused by the circular dependency between
        // CitationModel and Citations
        var CitationModel = require("models/CitationModel");
        return new CitationModel(attrs, options);
      },

      //The name of this type of collection
      type: "Citations",

      // Used for sorting the year in the reverse Chronological order
      comparator: function (model) {
        return -model.get("year_of_publishing"); // Note the minus!
      },
    },
  );

  return Citations;
});
