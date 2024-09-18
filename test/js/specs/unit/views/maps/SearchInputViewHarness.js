"use strict";

define([], function () {
  return class SearchInputViewHarness {
    constructor(view) {
      this.view = view;
    }

    typeQuery(searchString) {
      this.view.getInput().val(searchString);
      this.view.getInput().trigger("keyup");
    }

    clickSearch() {
      this.getSearchButton().click();
    }

    clickCancel() {
      this.getCancelButton().click();
    }

    getInput() {
      return this.view.getInput();
    }

    focusInput() {
      this.view.getInput().focus();
    }

    blurInput() {
      this.view.getInput().blur();
    }

    keydown(key) {
      this.view.getInput().trigger({ type: "keydown", key });
    }

    keyup(key) {
      this.view.getInput().trigger({ type: "keyup", key });
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

    getCancelButtonContainer() {
      return this.view.$el.find(".search-input__cancel-button-container");
    }

    hasErrorInput() {
      return this.view.getInputField().hasClass("search-input__error-input");
    }
  };
});
