"use strict";

define([], function () {
  return class PredictionsListViewHarness {
    constructor(view) {
      this.view = view;
    }

    getListItems() {
      return this.view.$el.find("li");
    }

    getFocusedItemIndex() {
      return this.view.$el.find(".viewfinder-prediction__focused").index();
    }
  };
});
