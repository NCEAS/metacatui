"use strict";

define([], function () {
  return class LayerItemViewHarness {
    constructor(view) {
      this.view = view;
    }

    getLabelText() {
      return this.view.$(`.${this.view.classes.labelText}`);
    }

    getVisibilityToggle() {
      return this.view.$(`.${this.view.classes.visibilityToggle}`);
    }

    getLayerIconVisibilityToggle() {
      return this.getVisibilityToggle().children(
        `.${this.view.classes.icon}`,
      )[0];
    }
  };
});
