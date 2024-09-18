"use strict";

define(["jquery", "underscore", "backbone", "routers/BaseRouter"], function (
  $,
  _,
  Backbone,
  BaseRouter,
) {
  /**
   * @class UIRouter
   * @classdesc MetacatUI Router
   * @extends Backbone.Router
   * @constructor
   */
  var KNBRouter = BaseRouter.extend(
    /** @lends UIRouter.prototype */ {
      /* Extend the routes hash */
      routes: function () {
        return _.extend(
          {
            /* Add a preservation plan route */
            "preservation(/:anchorId)(/)": "renderPreservation",
            "profile(/*username)(/s=:section)(/s=:subsection)": "renderProfile",
          },
          BaseRouter.prototype.routes,
        );
      },

      /*
       * Render the preservation plan page
       * @param anchorId the page anchor identifier to scroll to
       */
      renderPreservation: function (anchorId) {
        this.routeHistory.push("preservation");
        MetacatUI.appModel.set("anchorId", anchorId);

        var options = {
          pageName: "preservation",
          anchorId: anchorId,
        };

        // Call super.renderText()
        this.renderText(options);
      },

      // Rendering profiles in KNB
      renderProfile: function (username, section, subsection) {
        this.closeLastView();

        if (!username || !MetacatUI.appModel.get("enableUserProfiles")) {
          this.routeHistory.push("summary");

          // flag indicating /profile view
          var viewOptions = { nodeSummaryView: true };

          if (!MetacatUI.appView.statsView) {
            require(["views/StatsView"], function (StatsView) {
              MetacatUI.appView.statsView = new StatsView({
                userType: "repository",
              });

              MetacatUI.appView.showView(
                MetacatUI.appView.statsView,
                viewOptions,
              );
            });
          } else
            MetacatUI.appView.showView(
              MetacatUI.appView.statsView,
              viewOptions,
            );
        } else {
          this.routeHistory.push("profile");
          MetacatUI.appModel.set("profileUsername", username);

          if (section || subsection) {
            var viewOptions = { section: section, subsection: subsection };
          }

          if (!MetacatUI.appView.userView) {
            require(["views/UserView"], function (UserView) {
              MetacatUI.appView.userView = new UserView();

              MetacatUI.appView.showView(
                MetacatUI.appView.userView,
                viewOptions,
              );
            });
          } else
            MetacatUI.appView.showView(MetacatUI.appView.userView, viewOptions);
        }
      },
    },
  );

  return KNBRouter;
});
