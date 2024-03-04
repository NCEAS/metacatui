"use strict";

define([], function () {
  return class ViewFinderViewHarness {
    constructor(view) {
      this.view = view;
    }

    setQuery(searchString) {
      this.view.getInput().val(searchString);
      this.view.getInput().trigger("change");
    }

    typeQuery(searchString) {
      this.setQuery(searchString);
      this.view.getInput().trigger("keyup");
    }

    clickSearch() {
      this.view.getButton().click();
    }

    hitEnter() {
      this.view.getInput().trigger({ type: "keyup", key: 'Enter', });
    }

    getError() {
      return this.view.$el.find(".viewfinder__error").text();
    }

    getInput() {
      return this.view.getInput();
    }

    hasError() {
      return this.getError() !== ''
    }
  }
});
