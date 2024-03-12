'use strict';

define([], function () {
  return class ExpansionPanelViewHarness {
    constructor(view) {
      this.view = view;
    }

    isContentVisible() {
      return this.view.$el.hasClass('show-content');
    }

    getToggle() {
      return this.view.$el.find('.expansion-panel__toggle');
    }

    getIconClassString() {
      return this.view.$el.find('.expansion-panel__icon i').attr('class');
    }

    getTitle() {
      return this.view.$el.find('.expansion-panel__title');
    }

    clickToggle() {
      this.getToggle().click();
    }
  }
});