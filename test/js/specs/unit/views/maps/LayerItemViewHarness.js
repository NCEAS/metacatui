"use strict";

define(["views/maps/LayerItemView"], function (LayerItemView) {
  const { CLASS_NAMES } = LayerItemView;

  return class LayerItemViewHarness {
    constructor(view) {
      this.view = view;
    }

    getLabelText() {
      return this.view.$(`.${CLASS_NAMES.LABEL_TEXT}`);
    }

    getVisibilityToggle() {
      return this.view.$(`.${CLASS_NAMES.VISIBILITY_TOGGLE}`);
    }

    getLayerIconVisibilityToggle() {
      return this.getVisibilityToggle().children(`.${CLASS_NAMES.ICON}`)[0];
    }
  };
});
