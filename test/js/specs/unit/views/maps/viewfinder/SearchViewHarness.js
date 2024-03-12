'use strict';

define([], function () {
  return class ViewFinderViewHarness {
    constructor(view) {
      this.view = view;
    }

    focusInput() {
      this.getInput().focus();
    }

    blurInput() {
      this.getInput().blur();
    }

    setQuery(searchString) {
      this.getInput().val(searchString);
      this.getInput().trigger('change');
    }

    typeQuery(searchString) {
      this.getInput().val(searchString);
      this.getInput().trigger('keydown');
      this.getInput().trigger('keyup');
    }

    clickSearch() {
      this.view.$el.find(".search-input__search-button").click();
    }

    hitEnter() {
      this.getInput().trigger({ type: 'keyup', key: 'Enter', });
    }

    hitArrowUp() {
      this.getInput().trigger({ type: 'keyup', key: 'ArrowUp', });
    }

    hitArrowDown() {
      this.getInput().trigger({ type: 'keyup', key: 'ArrowDown', });
    }

    getError() {
      return this.view.$el.find('.search-input__error-text').text();
    }

    getInput() {
      return this.view.searchInput.getInput();
    }

    hasError() {
      return this.getError() !== ''
    }
  }
});