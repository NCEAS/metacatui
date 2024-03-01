'use strict';

define(
  [
    'underscore',
    'models/geocoder/Prediction',
    'models/maps/Map',
    'models/maps/viewfinder/ViewfinderModel',
    'views/maps/viewfinder/PredictionView',
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/unit/views/maps/viewfinder/PredictionViewHarness.js',
    '/test/js/specs/shared/clean-state.js',
  ],
  (
    _,
    Prediction,
    Map,
    ViewfinderModel,
    PredictionView,
    PredictionViewHarness,
    cleanState,
  ) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('PredictionView Test Suite', () => {
      const state = cleanState(() => {
        const sandbox = sinon.createSandbox();
        const mapModel = new Map();
        const viewfinderModel = new ViewfinderModel({ mapModel });

        sandbox.stub(viewfinderModel, 'selectPrediction');
        const predictionModel = new Prediction({
          description: 'Some Location',
          googleMapsPlaceId: 'someId',
        });
        const index = 0;
        const view = new PredictionView({
          index,
          predictionModel,
          viewfinderModel,
        });
        view.render();
        const harness = new PredictionViewHarness(view);

        return { harness, view, viewfinderModel };
      }, beforeEach);

      it('creates a PredictionView instance', () => {
        state.view.should.be.instanceof(PredictionView);
      });

      it('renders the prediction\'s description', () => {
        expect(state.harness.getDescription()).to.match(/Some Location/);
      });

      it('renders an element that is not focused', () => {
        expect(state.harness.isFocused()).to.be.false;
      });

      it('re-renders when the focus index changes', () => {
        state.viewfinderModel.set('focusIndex', 0);

        expect(state.harness.isFocused()).to.be.true;
      });

      it('does not show focus styles if index changes to index that does not match', () => {
        state.viewfinderModel.set('focusIndex', 1);

        expect(state.harness.isFocused()).to.be.false;
      });

      it('calls a callback on viewfinder model when the element is clicked', () => {
        state.viewfinderModel.set('focusIndex', 1);

        state.harness.click();

        expect(state.viewfinderModel.selectPrediction.callCount).to.equal(1);
      });
    });
  });