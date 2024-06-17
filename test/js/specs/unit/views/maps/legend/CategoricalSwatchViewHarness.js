"use strict";

define([], () => {
  return class CategoricalSwatchViewHarness {
    constructor(view) {
      this.view = view;
    }

    getSwatch() {
      return this.view.$(".categorical-swatch__swatch");
    }
  };
});
