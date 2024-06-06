"use strict";

define([], function () {
  return class LayerCategoryItemViewHarness {
    constructor(view) {
      this.view = view;
    }

    toggleExpand() {
      this.view.$(".layer-category-item__metadata").click();
    }

    getLayers() {
      return this.view.$(".layer-category-item__layers");
    }
  };
});
