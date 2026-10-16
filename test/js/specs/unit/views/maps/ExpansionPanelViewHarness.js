"use strict";

define(["views/maps/ExpansionPanelView"], function (ExpansionPanelView) {
  const { CLASS_NAMES } = ExpansionPanelView;

  return class ExpansionPanelViewHarness {
    constructor(view) {
      this.view = view;
    }

    isContentVisible() {
      return this.view.$el.hasClass(CLASS_NAMES.EXPANDED);
    }

    getToggle() {
      return this.view.$el.find(`.${CLASS_NAMES.TOGGLE}`);
    }

    getIconClassString() {
      return this.view.$el.find(`.${CLASS_NAMES.ICON} i`).attr("class");
    }

    hasSvgIcon() {
      return this.view.$el.find(`.${CLASS_NAMES.ICON} > svg`).length === 1;
    }

    getTitle() {
      return this.view.$el.find(`.${CLASS_NAMES.TITLE}`);
    }

    clickToggle() {
      this.getToggle().click();
    }
  };
});
