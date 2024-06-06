"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @class QualityCheck
   * @classdesc This model represents a single metadata quality check. Currently, This
   * model is only used when an entire quality suite resuslt is fetched from
   * the quality server (and all quality checks are populated), but in the
   * future it may be used to request/fetch quality result for a single
   * quality check (and not an entire suite).
   * @classcategory Models
   * @extends Backbone.Model
   */
  var QualityCheck = Backbone.Model.extend(
    /** @lends QualityCheck.prototype */ {
      /* The default object format fields */
      defaults: function () {
        return {
          check: null,
          output: null,
          status: null,
          timestamp: null,
        };
      },

      /* Constructs a new instance */
      initialize: function (attrs, options) {},

      /* No op - Formats are read only */
      save: function () {
        return false;
      },
    },
  );

  return QualityCheck;
});
