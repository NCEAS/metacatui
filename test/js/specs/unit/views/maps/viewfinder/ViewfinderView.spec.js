'use strict';

define(
  [
    'underscore',
    'views/maps/viewfinder/ViewfinderView',
    'models/maps/Map',
    'models/geocoder/Prediction',
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/unit/views/maps/viewfinder/ViewfinderViewHarness.js',
    '/test/js/specs/unit/views/maps/viewfinder/PredictionsListViewHarness.js',
    '/test/js/specs/shared/clean-state.js',
    '/test/js/specs/shared/mock-gmaps-module.js',
  ],
  (
    _,
    ViewfinderView,
    Map,
    Prediction,
    ViewfinderViewHarness,
    PredictionsListViewHarness,
    cleanState,
    // Import for side effect, unused.
    unusedGmapsMock,
  ) => {
    const should = chai.should();
    const expect = chai.expect;

    // Extract the attributes that tests care about.
    const firstCallLatLong = spy => {
      const geoPoint = spy.getCall(0).firstArg;
      return {
        latitude: geoPoint.attributes.latitude,
        longitude: geoPoint.attributes.longitude,
      };
    };

    describe('ViewfinderView Test Suite', () => {
      const state = cleanState(() => {
        const view = new ViewfinderView({ model: new Map() });
        const sandbox = sinon.createSandbox();
        const zoomSpy = sandbox.stub(view.model, 'zoomTo');
        const autocompleteSpy = sandbox.stub(view.viewfinderModel, 'autocompleteSearch');
        const harness = new ViewfinderViewHarness(view);
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
        view.viewfinderModel.set('predictions', predictions);

        return { harness, autocompleteSpy, zoomSpy, view, sandbox };
      }, beforeEach);

      afterEach(() => {
        state.sandbox.restore();
      });

      it('creates a ViewfinderView instance', () => {
        state.view.should.be.instanceof(ViewfinderView);
      });

      it('has an input for the user\'s search query', () => {
        state.view.render();

        state.harness.typeQuery('123')

        expect(state.view.getInput().val()).to.equal('123');
      });

      it('zooms to the specified location on clicking search button', () => {
        state.view.render();

        state.harness.typeQuery('13,37')
        state.harness.clickSearch();

        expect(state.zoomSpy.callCount).to.equal(1);
      });

      it('zooms to the specified location on hitting \'Enter\' key', () => {
        state.view.render();

        state.harness.typeQuery('13,37')
        state.harness.hitEnter();

        expect(state.zoomSpy.callCount).to.equal(1);
      });

      it('zooms to the specified location on clicking search button when value is entered without using keyboard', () => {
        state.view.render();

        state.harness.typeQuery('13,37')
        state.harness.clickSearch();

        expect(state.zoomSpy.callCount).to.equal(1);
      });

      it('uses the user\'s search query when zooming', () => {
        state.view.render();

        state.harness.typeQuery('13,37')
        state.harness.clickSearch();

        expect(firstCallLatLong(state.zoomSpy)).to.deep.equal({
          latitude: 13,
          longitude: 37,
        });
      });

      describe('bad search queries', () => {
        it('clears errors after fixing input error and searching again', () => {
          state.view.render();

          state.harness.typeQuery('13')
          state.harness.clickSearch();
          state.harness.typeQuery('13,37')
          state.harness.clickSearch();

          expect(state.harness.hasError()).to.be.false;
        });

        it('zooms to the entered location after fixing input error and searching again', () => {
          state.view.render();

          state.harness.typeQuery('13')
          state.harness.clickSearch();
          state.harness.typeQuery('13,37')
          state.harness.clickSearch();

          expect(state.zoomSpy.callCount).to.equal(1);
        });
      });

      it('shows an error when a new error is present', () => {
        state.view.viewfinderModel.set('error', 'some error');
        state.view.render();

        expect(state.harness.getError()).to.match(/some error/);
      });

      it('initially does not show a autocompletions list', () => {
        state.view.render();

        expect(state.autocompleteSpy.callCount).to.equal(0);
      });

      it('updates autocompletions when list is shown with updated query string', () => {
        state.view.render();
        state.view.viewfinderModel.set('query', 'some query');
        state.harness.clickInput();

        expect(state.autocompleteSpy.callCount).to.equal(1);
      });

      it('shows no focused item to start', () => {
        state.view.render();
        const predictionsListHarness = new PredictionsListViewHarness(
          state.view.predictionsView
        );

        expect(predictionsListHarness.getFocusedItemIndex()).to.equal(-1);
      });

      describe('as the user types', () => {
        it('updates autocompletions as the user types', () => {
          state.view.render();
          state.harness.typeQuery('a');
          state.harness.typeQuery('b');

          expect(state.autocompleteSpy.callCount).to.equal(2);
        });

        it('renders a list of predictions', () => {
          state.view.render();
          const predictionsListHarness = new PredictionsListViewHarness(
            state.view.predictionsView
          );

          expect(predictionsListHarness.getListItems().length).to.equal(2);
        });
      });

      describe('arrow key interactions', () => {
        it('changes focused element on arrow down', () => {
          state.view.render();
          const predictionsListHarness = new PredictionsListViewHarness(
            state.view.predictionsView
          );

          state.harness.hitArrowDown();

          expect(predictionsListHarness.getFocusedItemIndex()).to.equal(0);
        });

        it('changes focused element on arrow up', () => {
          state.view.render();
          const predictionsListHarness = new PredictionsListViewHarness(
            state.view.predictionsView
          );

          state.harness.hitArrowUp();

          expect(predictionsListHarness.getFocusedItemIndex()).to.equal(0);
        });
      });

      describe('selecting a prediction', () => {
        it('updates search query when a selection is made', () => {
          state.view.render();
          state.view.viewfinderModel.trigger('selection-made', 'some new query');

          expect(state.harness.getInput().val()).to.equal('some new query');
        });
      });
    });
  });