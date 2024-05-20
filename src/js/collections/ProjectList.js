"use strict";
define(["jquery", "backbone", "models/projects/Project"], function (
  $,
  Backbone,
  Project,
) {
  "use strict";
  /**
         @class ProjectList
         @classdesc A ProjectList represents a collection of projects. This can be
         used for a projects list view populating EML projects. It also supports loading
         projects from a third-party API in case projects information is located outside of
         metacat.
         * @classcategory Collections
         @extends Backbone.Collection
         @constructor
         @since 2.22.0
         */

  var ProjectList = Backbone.Collection.extend(
    /** @lends ProjectList.prototype */ {
      model: Project,
      type: "ProjectList", //The name of this type of collection
      authToken: undefined,
      urlBase: undefined,
      urlEndpoint: "project/",

      /** Builds the url from the urlBase **/
      url: function () {
        if (this.urlBase) {
          return new URL(
            new URL(this.urlBase).pathname + this.urlEndpoint,
            this.urlBase,
          ).href;
        } else {
          return undefined;
        }
      },
      /**
       * Override backbone's parse to set the data after the request returns from the server
       */
      parse: function (response, options) {
        // Add any custom data structure code here.
        return response;
      },
      /**
       * Override backbone's sync to set the auth token
       */
      sync: function (method, model, options) {
        if (this.authToken) {
          if (options.headers === undefined) {
            options.headers = {};
          }
          options.headers["Authorization"] = "Bearer " + this.authToken;
        }
        if (this.urlBase)
          return Backbone.Model.prototype.sync.apply(this, [
            method,
            model,
            options,
          ]);
      },

      /**
       * Initializing the Model objects project variables.
       */
      initialize: function (options) {
        if (MetacatUI && MetacatUI.appModel)
          this.urlBase = MetacatUI.appModel.get("projectsApiUrl");
        if (options) {
          if (options.authToken) this.authToken = options.authToken;
          if (options.urlBase) this.urlBase = options.urlBase;
        }
        Backbone.Collection.prototype.initialize.apply(this, options);
      },
    },
  );

  return ProjectList;
});
