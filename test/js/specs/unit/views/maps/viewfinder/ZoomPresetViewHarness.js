"use strict";

define([], function () {
  return class ZoomPresetViewHarness {
    constructor(view) {
      this.view = view;
    }

    click() {
      this.view.$el.find(".viewfinder-zoom-preset__preset").click();
    }

    reset() {
      this.view.resetActiveState();
    }

    isActive() {
      return this.view.$el.hasClass("viewfinder-zoom-preset--active");
    }

    getTitle() {
      return this.view.$el.find(".viewfinder-zoom-preset__title").text();
    }

    getDescription() {
      return this.view.$el.find(".viewfinder-zoom-preset__description").text();
    }

    getEnabledLayers() {
      return this.view.$el.find(".viewfinder-zoom-preset__layers").text();
    }
  };
});
