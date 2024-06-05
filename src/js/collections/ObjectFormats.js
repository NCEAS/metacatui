/* global define */
"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "x2js",
  "models/formats/ObjectFormat",
], function ($, _, Backbone, X2JS, ObjectFormat) {
  /**
   * @class ObjectFormats
   * @classdesc ObjectFormats represents the DataONE object format list
   * found at https://cn.dataone.org/cn/v2/formats, or
   * the Coordinating Node environment configured `AppModel.d1CNBaseUrl`
   * This collection is intended to be used as a formats cache -
   * retrieved once, and only refreshed later if an object format
   * isn't present when needed.
   * @classcategory Collections
   * @extends Backbone.Collection
   * @constructor
   */
  var ObjectFormats = Backbone.Collection.extend(
    /** @lends ObjectFormats.prototype */ {
      model: ObjectFormat,

      /**
       * The constructed URL of the collection
       * (/cn/v2/formats)
       * @returns {string} - The URL to use during fetch
       */
      url: function () {
        // no need for authentication token, just the URL
        return MetacatUI.appModel.get("formatsServiceUrl");
      },

      /**
       * Retrieve the formats from the Coordinating Node
       * @extends Backbone.Collection#fetch
       */
      fetch: function (options) {
        var fetchOptions = _.extend({ dataType: "text" }, options);

        return Backbone.Model.prototype.fetch.call(this, fetchOptions);
      },

      /**
       * Parse the XML response from the CN
       */
      parse: function (response) {
        // If the collection is already parsed, just return it
        if (typeof response === "object") return response;

        // Otherwise, parse it
        var x2js = new X2JS();
        var formats = x2js.xml_str2json(response);

        return formats.objectFormatList.objectFormat;
      },
    },
  );

  return ObjectFormats;
});
