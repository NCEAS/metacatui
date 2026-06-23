"use strict";

define([], function () {
  return class ViewfinderCardViewHarness {
    constructor(view) {
      this.view = view;
    }

    /** Click the "View Layers" button to trigger the select/zoom action. */
    click() {
      this.view.$el.find(".viewfinder-card__button-secondary").click();
    }

    /**
     * Click the CTA button at the given index (0-based).
     * @param {number} [index=0]
     */
    clickButton(index = 0) {
      this.view.$el
        .find(`.viewfinder-card__button-primary[data-button-index="${index}"]`)
        .click();
    }

    reset() {
      this.view.resetActiveState();
    }

    isActive() {
      return this.view.$el.hasClass("viewfinder-card--active");
    }

    getTitle() {
      return this.view.$el.find(".viewfinder-card__title").text();
    }

    getDescription() {
      return this.view.$el.find(".viewfinder-card__description").text();
    }

    getEnabledLayers() {
      return this.view.$el.find(".viewfinder-card__layers").text();
    }
  };
});
