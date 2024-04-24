'use strict';

define(
  [
    'underscore',
    'views/maps/viewfinder/ViewfinderView',
    'models/maps/Map',
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/unit/views/maps/viewfinder/ViewfinderViewHarness.js',
    '/test/js/specs/shared/clean-state.js',
  ],
  (
    _,
    ViewfinderView,
    Map,
    ViewfinderViewHarness,
    cleanState,
  ) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('ViewfinderView Test Suite', () => {
      const state = cleanState(() => {
        const sandbox = sinon.createSandbox();
        const view = new ViewfinderView({ model: new Map() });
        const harness = new ViewfinderViewHarness(view);
        view.render();

        // Actually render the view to document to test focus events.
        const testContainer = document.createElement("div");
        testContainer.id = "test-container";
        testContainer.append(view.el);
        document.body.append(testContainer);

        return {
          harness,
          sandbox,
          testContainer,
          view,
        };
      }, beforeEach);

      afterEach(() => {
        state.sandbox.restore();
        state.testContainer.remove();
      });

      it('creates a ViewfinderView instance', () => {
        state.view.should.be.instanceof(ViewfinderView);
      });

      it('shows zoom presets UI when enabled in config', () => {
        const view = new ViewfinderView({ model: new Map({ showZoomPresets: true }) });
        const harness = new ViewfinderViewHarness(view);
        view.render();

        expect(harness.hasZoomPresets()).to.be.true;
      });

      it('does not show zoom presets UI when disabled in config', () => {
        expect(state.harness.hasZoomPresets()).to.be.false;
      });
    });
  });