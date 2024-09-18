"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/bookkeeper/Usage",
  "models/bookkeeper/Quota",
], function ($, _, Backbone, Usage, Quota) {
  /**
   * @class Usages
   * @classdesc A Usages collection is a collection of Usage Models which track
   * objects that use a portion of a Quota. Each Quota is associated with one or more
   * Usage models, so this collection keeps all those associated Usages together in one collection.
   * This collection also stores a reference to the Quota model associated with these Usages.
   * @classcategory Collections/Bookkeeper
   * @since 2.14.0
   * @extends Backbone.Collection
   */
  var Usages = Backbone.Collection.extend(
    /** @lends Usages.prototype */ {
      /**
       * The class/model that is contained in this collection.
       * @type {Backbone.Model}
       */
      model: Usage,

      /**
       * A reference to a Quota model that this collection of Usages is associated with.
       * @type {Quota}
       */
      quota: null,

      /**
       * A list of query parameters that are supported by the Bookkeeper Usages API. These
       * query parameters can be passed to {@link Usages#fetch} in the `options` object, and they
       * will be used during the fetch.
       * @type {string[]}
       */
      queryParams: ["quotaType", "subscriber"],

      /**
       * Constructs a URL string for fetching this collection and returns it
       * @param {Object} [options]
       * @property {string} options.quotaType  The Usage quotaType to fetch
       * @property {string} options.subscriber  The user or group subject associated with these Usages
       * @returns {string} The URL string
       */
      url: function (options) {
        var url = "";

        //Use the attributes from the options object for the URL, if it is passed to this function
        if (typeof options == "object") {
          _.each(this.queryParams, function (name) {
            if (typeof options[name] !== "undefined") {
              if (url.length == 0) {
                url += "?";
              } else {
                url += "&";
              }

              url += name + "=" + encodeURIComponent(options[name]);
            }
          });
        }

        //Prepend the Bookkeeper Usages URL to the url query parameters string
        url = MetacatUI.appModel.get("bookkeeperUsagesUrl") + url;

        return url;
      },

      /**
       * Fetches a list of Usages from the DataONE Bookkeeper service, parses them, and
       * stores them on this collection.
       * @param {Object} [options]
       * @property {string} options.quotaType  The Usage quotaType to fetch
       * @property {string} options.subscriber  The user or group subject associated with these Usages
       */
      fetch: function (options) {
        var fetchOptions = {
          url: this.url(options),
        };

        fetchOptions = Object.assign(
          fetchOptions,
          MetacatUI.appUserModel.createAjaxSettings(),
        );

        //Call Backbone.Collection.fetch to retrieve the info
        return Backbone.Collection.prototype.fetch.call(this, fetchOptions);
      },

      /**
       * Parses the fetch() of this collection. Bookkeeper returns JSON already, so there
       * isn't much parsing to do.
       * @returns {JSON} The collection data in JSON form
       */
      parse: function (response) {
        return response.usages;
      },

      /**
       * Merges another collection of models with this collection by matching instanceId to seriesId/id.
       * A reference to the model from the otherCollection is stored in the corresponding Usage model.
       * @type {DataPackage|SolrResults}
       */
      mergeCollections: function (otherCollection) {
        //Iterate over each Usage in this collection
        this.each(function (usage) {
          //Find the other model that matches this Usage
          var match = otherCollection.find(function (otherModel) {
            //Make a match on the seriesId
            if (
              _.contains(otherModel.get("seriesId"), usage.get("instanceId"))
            ) {
              return true;
            }
            //Make a match on the id
            else if (
              _.contains(otherModel.get("id"), usage.get("instanceId"))
            ) {
              return true;
            } else {
              return false;
            }
          });

          //If a match is found, store a reference in each model
          if (match) {
            usage.set(match.type, match);
            match.set("usageModel", this);
          }
        }, this);
      },
    },
  );

  return Usages;
});
