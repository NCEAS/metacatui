"use strict";

define([], function () {
  return class ZoomPresetViewHarness {
    constructor(view) {
      this.view = view;
    }

    /** Click the "View Layers" button to trigger the select/zoom action. */
    click() {
      this.view.$el.find(".viewfinder-zoom-preset__view-layers-button").click();
    }

    /**
     * Click the CTA button at the given index (0-based).
     * @param {number} [index=0]
     */
    clickCta(index = 0) {
      this.view.$el
        .find(`.viewfinder-zoom-preset__cta-button[data-cta-index="${index}"]`)
        .click();
    }

    reset() {
      this.view.resetActiveState();
    }

    isActive() {
      return this.view.$el.hasClass("viewfinder-zoom-preset--active");
    }

    getTitle() {
      return this.view.$el.find(".viewfinder-zoom-preset__title").text();
    }

    getDescription() {
      return this.view.$el.find(".viewfinder-zoom-preset__description").text();
    }

    getEnabledLayers() {
      return this.view.$el.find(".viewfinder-zoom-preset__layers").text();
    }
  };
});
