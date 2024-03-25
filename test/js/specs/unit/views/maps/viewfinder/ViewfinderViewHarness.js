'use strict';

define([], function () {
  return class ViewFinderViewHarness {
    constructor(view) {
      this.view = view;
    }
    
    focusInput() {
      this.view.getInput().focus();
    }

    blurInput() {
      this.view.getInput().blur();
    }

    setQuery(searchString) {
      this.view.getInput().val(searchString);
      this.view.getInput().trigger('change');
    }

    typeQuery(searchString) {
      this.view.getInput().val(searchString);
      this.view.getInput().trigger('keyup');
    }

    clickSearch() {
      this.view.getButton().click();
    }

    hitEnter() {
      this.view.getInput().trigger({ type: 'keyup', key: 'Enter', });
    }

    hitArrowUp() {
      this.view.getInput().trigger({ type: 'keyup', key: 'ArrowUp', });
    }

    hitArrowDown() {
      this.view.getInput().trigger({ type: 'keyup', key: 'ArrowDown', });
    }

    getError() {
      return this.view.$el.find('.viewfinder__error').text();
    }

    getInput() {
      return this.view.getInput();
    }

    hasError() {
      return this.getError() !== ''
    }
  }
});