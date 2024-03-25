'use strict';

define(
  [
    'underscore',
    'models/geocoder/Prediction',
    'models/maps/Map',
    'models/maps/viewfinder/ViewfinderModel',
    'views/maps/viewfinder/PredictionsListView',
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/unit/views/maps/viewfinder/PredictionsListViewHarness.js',
    '/test/js/specs/shared/clean-state.js',
  ],
  (
    _,
    Prediction,
    Map,
    ViewfinderModel,
    PredictionsListView,
    PredictionsListViewHarness,
    cleanState,
  ) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('PredictionsListView Test Suite', () => {
      const state = cleanState(() => {
        const predictions = [
          new Prediction({
            description: 'Some Location',
            googleMapsPlaceId: 'someId',
          }),
          new Prediction({
            description: 'Some Location 2',
            googleMapsPlaceId: 'someId2',
          }),
        ];
        const mapModel = new Map();
        const viewfinderModel = new ViewfinderModel({ mapModel });
        viewfinderModel.set('predictions', predictions)
        const view = new PredictionsListView({ viewfinderModel });
        view.render();
        const harness = new PredictionsListViewHarness(view);

        return { harness, view, viewfinderModel };
      }, beforeEach);

      it('creates a PredictionsListView instance', () => {
        state.view.should.be.instanceof(PredictionsListView);
      });

      it('displays a list item per prediction', () => {
        expect(state.harness.getListItems().length).to.equal(2);
      });

      it('re-renders the list when the viewfinder model\'s predictions have changed', () => {
        const newPredictions = [
          new Prediction({
            description: 'Some Location 3',
            googleMapsPlaceId: 'someId3',
          }),
        ];
        state.viewfinderModel.set('predictions', newPredictions);

        expect(state.harness.getListItems().length).to.equal(1);
      });

      it('destroys child views when a selection is made', () => {
        const spy = sinon.spy(state.view.children[0], 'remove');
        const spy2 = sinon.spy(state.view.children[1], 'remove');

        state.viewfinderModel.trigger('selection-made', 'some query');

        expect(spy.callCount).to.equal(1);
        expect(spy2.callCount).to.equal(1);
      });

      it('clears list when a selection is made', () => {
        state.viewfinderModel.trigger('selection-made', 'some query');

        expect(state.harness.getListItems().length).to.equal(0);
      });

      it('does not clear the list if the query is unchanged', () => {
        state.viewfinderModel.set('query', 'some query');

        state.viewfinderModel.trigger('selection-made', 'some query');

        expect(state.harness.getListItems().length).to.equal(2);
      });
    });
  });