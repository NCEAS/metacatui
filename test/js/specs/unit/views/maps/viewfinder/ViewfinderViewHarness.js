"use strict";

define([], function () {
  return class ViewFinderViewHarness {
    constructor(view) {
      this.view = view;
    }

    hasZoomPresets() {
      return !!this.view.getZoomPresets().html();
    }
  };
});
