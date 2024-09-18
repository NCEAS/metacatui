"use strict";

define([], function () {
  return class PredictionViewHarness {
    constructor(view) {
      this.view = view;
    }

    click() {
      this.view.$el.click();
    }

    isFocused() {
      return this.view.$el.find(".viewfinder-prediction__focused").length === 1;
    }

    getDescription() {
      return this.view.$el.find(".viewfinder-prediction__main").text();
    }
  };
});
