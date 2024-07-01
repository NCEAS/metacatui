"use strict";

define([], () => {
  return class ContinuousSwatchViewHarness {
    constructor(view) {
      this.view = view;
    }

    getSwatch() {
      return this.view.$(".continuous-swatch__swatch");
    }
  };
});
