define(['jquery', 'backbone'],
    function($, Backbone) {
        'use strict';
        /**
         * @class Project
         * @classdesc A Project model represents a single instance of a project. This can be
         *          used for a projects list view populating EML projects. It also supports loading
         *          projects from a third-party API in case projects information is located outside of
         *          metacat.
         * @classcategory Models/Projects
         * @since 2.22.0
         */

        var Project = Backbone.Model.extend(/** @lends Project.prototype */{

            idAttribute: "id",
            defaults: {           // Set the project model attributes defaults here.
                id: undefined,
                title: undefined,
            },
            authToken: undefined,
            urlBase: undefined,

            /** Builds  from the urlBase **/
            urlRoot: function(){
                if(this.urlBase)
                {
                    return new URL(new URL(this.urlBase).pathname + this.urlEndpoint, this.urlBase).href
                }
                else {
                    return undefined
                }
            },
            /**
             * Override backbone's parse to set the data after the request returns from the server
             */
            parse: function(response, options) {
                // Add any custom data structure code here.
                return response
            },
            /**
             * Override backbone's sync to set the auth token
             */
            sync: function(method, model, options) {

                if (this.authToken) {
                    if (options.headers === undefined){
                        options.headers = {}
                    }
                    options.headers["Authorization"] = "Bearer " + this.authToken
                }

                if(this.urlBase)
                    return Backbone.Model.prototype.sync.apply(this, [method, model, options])
            },
            /**
             * Initializing the Model objects project variables. The projects are retrieved from the
             * model url service
             */
            initialize: function (options) {
                if (MetacatUI && MetacatUI.appModel)  this.urlBase = MetacatUI.appModel.get("projectsApiUrl")
                if (options.authToken)  this.authToken = options.authToken
                if (options.urlBase) this.urlBase = options.urlBase;

                Backbone.Model.prototype.initialize.apply(this, options)
            }

        });
        return Project;
    }
);