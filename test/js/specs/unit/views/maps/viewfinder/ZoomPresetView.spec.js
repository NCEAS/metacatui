'use strict';

define(
  [
    'underscore',
    'views/maps/viewfinder/ZoomPresetView',
    'models/maps/viewfinder/ZoomPresetModel',
    'models/maps/GeoPoint',
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/unit/views/maps/viewfinder/ZoomPresetViewHarness.js',
    '/test/js/specs/shared/clean-state.js',
  ],
  (_, ZoomPresetView, ZoomPresetModel, GeoPoint, ZoomPresetViewHarness, cleanState) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('ZoomPresetView Test Suite', () => {
      const state = cleanState(() => {
        const sandbox = sinon.createSandbox();
        const title = "Some preset";
        const geoPoint = new GeoPoint()
          .set('latitude', 42.33)
          .set('longigude', -83.05)
          .set('height', 5000);
        const description = "For testing the view";
        const enabledLayers = ["Layer 1", "Layer 2"];
        const preset = new ZoomPresetModel({ title, geoPoint, description, enabledLayers });
        const selectCallbackSpy = sandbox.spy();
        const view = new ZoomPresetView({ preset, selectCallback: selectCallbackSpy });
        view.render();
        const harness = new ZoomPresetViewHarness(view);

        // Actually render the view to document to test focus events.
        const testContainer = document.createElement("div");
        testContainer.id = "test-container";
        testContainer.append(view.el);
        document.body.append(testContainer);

        return {
          harness,
          sandbox,
          selectCallbackSpy,
          testContainer,
          view,
        };
      }, beforeEach);

      afterEach(() => {
        state.sandbox.restore();
        state.testContainer.remove();
      });

      it('creates a ZoomPresetView instance', () => {
        state.view.should.be.instanceof(ZoomPresetView);
      });

      it('starts inactive', () => {
        expect(state.harness.isActive()).to.be.false;
      });

      it('can be selected', () => {
        state.harness.click();

        expect(state.harness.isActive()).to.be.true;
      });

      it('does not call a select callback before selected', () => {
        expect(state.selectCallbackSpy.callCount).to.equal(0);
      });

      it('calls a select callback when selected', () => {
        state.harness.click();

        expect(state.selectCallbackSpy.callCount).to.equal(1);
      });

      it('can reset selected state', () => {
        state.harness.click();
        state.harness.reset();

        expect(state.harness.isActive()).to.be.false;
      });

      it('shows a title', () => {
        expect(state.harness.getTitle()).to.match(/Some preset/);
      });

      it('shows a description', () => {
        expect(state.harness.getDescription()).to.match(/For testing/);
      });

      it('shows which layers are enabled', () => {
        expect(state.harness.getEnabledLayers()).to.match(/Layer 1/);
        expect(state.harness.getEnabledLayers()).to.match(/Layer 2/);
      });
    });
  });