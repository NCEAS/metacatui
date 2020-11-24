"use strict";

define(["jquery", "underscore", "backbone", "models/bookkeeper/Quota"],
  function($, _, Backbone, Quota) {

  /**
   * @class Quotas
   * @classdesc Quotas are limits set for a particular DataONE Product, such as the number
   * of portals allowed, disk space allowed, etc. Quotas have a soft and hard limit
   * per unit to help with communicating limit warnings.
   */
  var Quotas = Backbone.Collection.extend(
    /** @lends Quotas.prototype */ {

    /**
    * The class/model that is contained in this collection.
    * @type {Backbone.Model}
    */
    model: Quota,

    /**
    * A list of query parameters that are supported by the Bookkeeper Quotas API. These
    * query parameters can be passed to {@link Quotas#fetch} in the `options` object, and they
    * will be used during the fetch.
    * @type {string[]}
    */
    queryParams: ["quotaType", "subscriber"],

    /**
    * Constructs a URL string for fetching this collection and returns it
    * @param {Object} [options]
    * @property {string} options.quotaType  The Usage quotaType to fetch
    * @property {string} options.subscriber  The user or group subject associated with these Quotas
    * @returns {string} The URL string
    */
    url: function(options){

      var url = "";

      //Use the attributes from the options object for the URL, if it is passed to this function
      if( typeof options == "object" ){

        _.each( this.queryParams, function(name){
          if( typeof options[name] !== "undefined"){
            if( url.length == 0 ){
              url += "?";
            }
            else{
              url += "&";
            }

            url += name + "=" + encodeURIComponent(options[name]);
          }
        });

      }

      //Prepend the Bookkeeper Usages URL to the url query parameters string
      url = MetacatUI.appModel.get("bookkeeperQuotasUrl") + url;

      return url;

    },

    /**
    * Fetches a list of Quotas from the DataONE Bookkeeper service, parses them, and
    * stores them on this collection.
    * @param {Object} [options]
    * @property {string} options.quotaType  The quotaType to fetch
    * @property {string} options.subscriber  The user or group subject associated with these Quotas
    */
    fetch: function(options){

      var fetchOptions = {
        url: this.url(options)
      }

      fetchOptions = Object.assign(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());

      //Call Backbone.Collection.fetch to retrieve the info
      return Backbone.Collection.prototype.fetch.call(this, fetchOptions);

    },

    /**
    * Parses the fetch() of this collection. Bookkeeper returns JSON already, so there
    * isn't much parsing to do.
    * @returns {JSON} The collection data in JSON form
    */
    parse: function(response){

      return response.quotas;
    }

  });

  return Quotas;
});
