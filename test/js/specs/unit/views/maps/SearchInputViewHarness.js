"use strict";

define([], function () {
  return class SearchInputViewHarness {
    constructor(view) {
      this.view = view;
    }

    typeQuery(searchString) {
      this.view.getInput().val(searchString);
    }

    clickSearch() {
      this.getSearchButton().click();
    }

    clickCancel() {
      this.getCancelButton().click();
    }

    hitEnter() {
      this.view.getInput().trigger({ type: "keyup", key: "Enter" });
    }

    getSearchButton() {
      return this.view.$el.find(".search-input__search-button");
    }

    getCancelButton() {
      return this.view.$el.find(".search-input__cancel-button");
    }

    hasErrorInput() {
      return this.view.getInput().hasClass("search-input__error-input");
    }
  }
});
