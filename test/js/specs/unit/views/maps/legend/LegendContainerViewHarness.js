"use strict";

define([], () => {
  return class LegendContainerViewHarness {
    constructor(view) {
      this.view = view;
    }

    getContent() {
      return this.view.$(".legend-container__content");
    }

    isExpanded() {
      return this.view.$el.hasClass("expanded");
    }
  };
});
