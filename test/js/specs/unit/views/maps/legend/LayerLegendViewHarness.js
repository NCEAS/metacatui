"use strict";

define([], () => {
  return class LayerLegendViewHarness {
    constructor(view) {
      this.view = view;
    }

    getPalette() {
      return this.view.$(".layer-legend__palette");
    }
  };
});
