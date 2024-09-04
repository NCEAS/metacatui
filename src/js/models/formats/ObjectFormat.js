"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @class ObjectFormat
   * @classdesc An ObjectFormat represents a V2 DataONE object format
   * See https://purl.dataone.org/architecture/apis/Types2.html#v2_0.Types.ObjectFormat
   * @classcategory Models/Formats
   * @extends Backbone.Model
   */
  var ObjectFormat = Backbone.Model.extend(
    /** @lends ObjectFormat.prototype */ {
      /* The default object format fields */
      defaults: function () {
        return {
          formatId: null,
          formatName: null,
          formatType: null,
          mediaType: null,
          extension: null,
        };
      },

      /* Constructs a new instance */
      initialize: function (attrs, options) {},

      /*
       * The constructed URL of the model
       * (/cn/v2/formats/{formatId})
       */
      url: function () {
        if (!this.get("formatId")) return "";

        return (
          MetacatUI.appModel.get("formatsServiceUrl") +
          encodeURIComponent(this.get("formatId"))
        );
      },

      /* No op - Formats are read only */
      save: function () {
        return false;
      },
    },
  );

  return ObjectFormat;
});
