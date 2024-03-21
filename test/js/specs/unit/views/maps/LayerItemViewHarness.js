"use strict";

define([], function () {
  return class LayerItemViewHarness {
    constructor(view) {
      this.view = view;
    }

    getLabelText() {
      return this.view.$(`.${this.view.classes.labelText}`);
    }
  }
});
