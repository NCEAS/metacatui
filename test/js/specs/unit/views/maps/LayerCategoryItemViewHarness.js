"use strict";

define([], function () {
  return class LayerCategoryItemViewHarness {
    constructor(view) {
      this.view = view;
    }

    toggleExpand() {
      this.view.$(`.${this.view.classNames.metadata}`).click();
    }

    getLayers() {
      return this.view.$(`.${this.view.classNames.layers}`);
    }
  }
});
