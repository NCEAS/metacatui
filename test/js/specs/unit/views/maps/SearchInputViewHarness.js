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
      this.view.getInput().trigger({ type: "keyup", key: "Enter", });
    }

    getError() {
      return this.view.$el.find(`.${this.view.classNames.errorText}`);
    }

    getSearchButton() {
      return this.view.$el.find(`.${this.view.classNames.searchButton}`);
    }

    getCancelButton() {
      return this.view.$el.find(`.${this.view.classNames.cancelButton}`);
    }

    hasErrorInput() {
      return this.view.getInput().hasClass(this.view.classNames.errorInput);
    }
  }
});
