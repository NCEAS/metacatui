"use strict";

define(
  ['/test/js/specs/unit/views/maps/viewfinder/ZoomPresetViewHarness.js'],
  function (ZoomPresetViewHarness) {
    return class ZoomPresetsListViewHarness {
      constructor(view) {
        this.view = view;
      }

      getZoomPresets() {
        return this.view.$el.find('.viewfinder-zoom-preset');
      }

      clickZoomPresetAt(index) {
        const presetHarness = new ZoomPresetViewHarness(this.view.children[index]);

        presetHarness.click();
      }

      isZoomPresetActiveAt(index) {
        const presetHarness = new ZoomPresetViewHarness(this.view.children[index]);

        return presetHarness.isActive();
      }
    }
  });
