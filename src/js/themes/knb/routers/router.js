"use strict";

define(["jquery", "underscore", "backbone", "routers/BaseRouter"],
function($, _, Backbone, BaseRouter) {

  /**
  * @class UIRouter
  * @classdesc MetacatUI Router
  * @extends Backbone.Router
  * @constructor
  */
    var KNBRouter = BaseRouter.extend(
      /** @lends UIRouter.prototype */{

        /* Extend the routes hash */
        routes: function() {
            return _.extend({
                /* Add a preservation plan route */
                "preservation(/:anchorId)(/)" : "renderPreservation"
            }, BaseRouter.prototype.routes);
        },

        /*
         * Render the preservation plan page
         * @param anchorId the page anchor identifier to scroll to
         */
        renderPreservation: function(anchorId) {
            this.routeHistory.push("preservation");
            MetacatUI.appModel.set("anchorId", anchorId);

            var options = {
                pageName: "preservation",
                anchorId: anchorId
            }

            // Call super.renderText()
            this.renderText(options);
        }
     });

     return KNBRouter;
});
