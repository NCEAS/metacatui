"use strict";

define([
  "/test/js/specs/unit/views/maps/viewfinder/ViewfinderCardViewHarness.js",
], function (ViewfinderCardViewHarness) {
  return class ViewfinderCardsListViewHarness {
    constructor(view) {
      this.view = view;
    }

    getCards() {
      return this.view.$el.find(".viewfinder-card");
    }

    clickCardAt(index) {
      const cardHarness = new ViewfinderCardViewHarness(
        this.view.children[index],
      );

      cardHarness.click();
    }

    isCardActiveAt(index) {
      const cardHarness = new ViewfinderCardViewHarness(
        this.view.children[index],
      );

      return cardHarness.isActive();
    }
  };
});
