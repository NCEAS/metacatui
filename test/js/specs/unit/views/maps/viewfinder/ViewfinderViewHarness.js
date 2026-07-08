"use strict";

define([], function () {
  return class ViewFinderViewHarness {
    constructor(view) {
      this.view = view;
    }

    hasViewfinderCards() {
      return !!this.view.getViewfinderCards().html();
    }

    /** @deprecated Use hasViewfinderCards instead. */
    hasZoomPresets() {
      return this.hasViewfinderCards();
    }
  };
});
