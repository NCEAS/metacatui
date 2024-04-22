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
  ],
  (
    _,
    ViewfinderView,
    Map,
    Prediction,
    ViewfinderViewHarness,
    PredictionsListViewHarness,
    cleanState,
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
        const sandbox = sinon.createSandbox();
        // sinon.useFakeTimers() doesn't work with _.debounce, so stubbing instead.
        const debounceStub = sandbox.stub(_, 'debounce').callsFake(function (fnToDebounce) {
          return function (...args) {
            fnToDebounce.apply(this, args);
          };
        });
        const view = new ViewfinderView({ model: new Map() });
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

        // Actually render the view to document to test focus events.
        const testContainer = document.createElement("div");
        testContainer.id = "test-container";
        testContainer.append(view.el);
        document.body.append(testContainer);

        return {
          autocompleteSpy,
          debounceStub,
          harness,
          sandbox,
          testContainer,
          view,
          zoomSpy,
        };
      }, beforeEach);

      afterEach(() => {
        state.sandbox.restore();
        state.testContainer.remove();
      });

      it('creates a ViewfinderView instance', () => {
        state.view.should.be.instanceof(ViewfinderView);
      });

      it('has an input for the user\'s search query', () => {
        state.view.render();

        state.harness.typeQuery('123')

        expect(state.harness.getInput().val()).to.equal('123');
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
          state.harness.hitEnter();

          expect(state.harness.hasError()).to.be.false;
        });

        it('zooms to the entered location after fixing input error and searching again', () => {
          state.view.render();

          state.harness.typeQuery('13')
          state.harness.clickSearch();
          state.harness.typeQuery('13,37')
          state.harness.hitEnter();

          expect(state.zoomSpy.callCount).to.equal(1);
        });
      });

      it('shows an error when a new error is present', () => {
        state.view.render();
        state.view.viewfinderModel.set('error', 'some error');

        expect(state.harness.getError()).to.match(/some error/);
      });

      it('does not show an autocompletions list when input is not focused',
        () => {
          state.view.render();
          state.harness.blurInput();

          expect(state.view.getList().is(":visible")).to.be.false;
        });

      it('updates autocompletions when list is shown with updated query string', () => {
        state.view.render();
        // Focus is called on render, reset call count.
        state.autocompleteSpy.resetHistory();
        state.view.viewfinderModel.set('query', 'some query');
        state.harness.focusInput();

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
        it('debounces calls to update autocompletions as the user types',
          () => {
            state.view.render();
            state.harness.typeQuery('a');
            state.harness.typeQuery('b');

            expect(state.debounceStub.callCount).to.equal(1);
          });

        it('renders a list of predictions', () => {
          state.view.render();
          const predictionsListHarness = new PredictionsListViewHarness(
            state.view.predictionsView
          );

          expect(predictionsListHarness.getListItems().length).to.equal(2);
        });

        it('silently unsets the query string on the model when the search query is empty',
          () => {
            const unsetSpy = sinon.spy(state.view.viewfinderModel, 'unset');
            state.view.render();
            state.harness.typeQuery('');

            expect(unsetSpy.callCount).to.equal(1);
            expect(unsetSpy.getCall(0).args).to.deep.equal([
              'query', { silent: true }
            ]);
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