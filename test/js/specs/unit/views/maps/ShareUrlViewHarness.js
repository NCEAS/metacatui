"use strict";

define([], function () {
  return class ShareUrlViewHarness {
    constructor(view) {
      this.view = view;
    }

    clickRemove() {
      this.view.$el.find(".share-url__remove").click();
    }

    clickCopy() {
      this.view.$el.find(".share-url__copy").click();
    }

    hasHint() {
      return this.view.$el.find(".share-url__hint").text() !== "";
    }

    hasError() {
      return this.view.$el.find(".share-url__error").text() !== "";
    }
  };
});
