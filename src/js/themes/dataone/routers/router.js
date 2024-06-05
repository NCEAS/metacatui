/*global Backbone */
"use strict";

define(["jquery", "underscore", "backbone", "routers/BaseRouter"], function (
  $,
  _,
  Backbone,
  BaseRouter,
) {
  var UIRouter = BaseRouter.extend({
    routes: _.extend(BaseRouter.prototype.routes, {
      "": "renderData",
      tools: "navigateToDefault",
      "share(/*pid)(/)": "navigateToDefault", // Don't render the dataset editor
      "submit(/*pid)(/)": "navigateToDefault", // Don't render the dataset editor
    }),
  });

  return UIRouter;
});
