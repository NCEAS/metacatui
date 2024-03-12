'use strict';

define(
  [
    'underscore',
    'views/maps/viewfinder/ZoomPresetsListView',
    'models/maps/viewfinder/ZoomPresetModel',
    'models/maps/viewfinder/ViewfinderModel',
    'models/maps/Map',
    "models/maps/GeoPoint",
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/shared/clean-state.js',
    '/test/js/specs/unit/views/maps/viewfinder/ZoomPresetsListViewHarness.js',
  ],
  (_,
    ZoomPresetsListView,
    ZoomPresetModel,
    ViewfinderModel,
    Map,
    GeoPoint,
    cleanState,
    ZoomPresetsListViewHarness,
  ) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('ZoomPresetsListView Test Suite', () => {
      const state = cleanState(() => {
        const sandbox = sinon.createSandbox();
        const viewfinderModel = new ViewfinderModel({ mapModel: new Map() })
        const zoomPresets = [
          new ZoomPresetModel({
            title: 'Test 1',
            geoPoint: new GeoPoint()
              .set('latitude', 11)
              .set('longitude', 111)
              .set('height', 5000),
            description: 'Test 1 description',
            enabledLayers: ['Layer 1', 'Layer 2'],
          }),
          new ZoomPresetModel({
            title: 'Test 2',
            geoPoint: new GeoPoint()
              .set('latitude', 12)
              .set('longitude', 112)
              .set('height', 5000),
            description: 'Test 1 description',
            enabledLayers: ['Layer 2', 'Layer 3'],
          }),
        ]
        viewfinderModel.set('zoomPresets', zoomPresets);
        const view = new ZoomPresetsListView({ viewfinderModel });
        view.render();
        const harness = new ZoomPresetsListViewHarness(view);

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
          viewfinderModel,
        };
      }, beforeEach);

      afterEach(() => {
        state.sandbox.restore();
        state.testContainer.remove();
      });

      it('creates a ZoomPresetsListView instance', () => {
        state.view.should.be.instanceof(ZoomPresetsListView);
      });

      it('renders a child element for each configured zoom preset', () => {
        expect(state.harness.getZoomPresets().length).to.equal(2);
      });

      it('does not select zoom preset on model before clicking', () => {
        const selectSpy = state.sandbox.spy(state.viewfinderModel, 'selectZoomPreset');

        expect(selectSpy.callCount).to.equal(0);
      });

      it('selects a zoom preset on model when it is clicked', () => {
        const selectSpy = state.sandbox.spy(state.viewfinderModel, 'selectZoomPreset');

        state.harness.clickZoomPresetAt(0);

        expect(selectSpy.callCount).to.equal(1);
      });

      it('marks a zoom preset as selected after clicking it', () => {
        state.harness.clickZoomPresetAt(0);

        expect(state.harness.isZoomPresetActiveAt(0)).to.be.true;
      });

      it('resets the select state of previous zoom presets upon selecting another',
        () => {
          state.harness.clickZoomPresetAt(0);
          state.harness.clickZoomPresetAt(1);

          expect(state.harness.isZoomPresetActiveAt(0)).to.be.false;
        });

      it('can select a different preset after selecting another', () => {
        state.harness.clickZoomPresetAt(0);
        state.harness.clickZoomPresetAt(1);

        expect(state.harness.isZoomPresetActiveAt(1)).to.be.true;
      });
    });
  });