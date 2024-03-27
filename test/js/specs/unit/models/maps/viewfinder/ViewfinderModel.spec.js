'use strict';

define(
  [
    'underscore',
    'models/maps/viewfinder/ViewfinderModel',
    'models/maps/Map',
    'models/geocoder/Prediction',
    'models/geocoder/GeocodedLocation',
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/shared/clean-state.js',
  ],
  (_, ViewfinderModel, Map, Prediction, GeocodedLocation, cleanState) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('ViewfinderModel Test Suite', () => {
      const state = cleanState(() => {
        const sandbox = sinon.createSandbox();
        const model = new ViewfinderModel({ mapModel: new Map() });
        const zoomSpy = sinon.spy(model.mapModel, 'zoomTo');
        const autocompleteSpy = sandbox.stub(model.geocoderSearch, 'autocomplete').returns([])
        const geocodeSpy = sandbox.stub(model.geocoderSearch, 'geocode').returns([]);
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
        model.set({
          query: 'somewhere',
          error: 'some error',
          predictions,
          focusIndex: 0,
        });

        return {
          autocompleteSpy,
          geocodeSpy,
          model,
          predictions,
          sandbox,
          zoomSpy,
        };
      }, beforeEach);

      afterEach(() => {
        state.sandbox.restore();
      })

      it('creates a ViewfinderModel instance', () => {
        state.model.should.be.instanceof(ViewfinderModel);
      });

      describe('autocomplete search', () => {
        it('uses a GeocoderSearch to find autocompletions', () => {
          state.model.autocompleteSearch('somewhere else');

          expect(state.autocompleteSpy.callCount).to.equal(1);
        });

        it('does not autocomplete search if query is unchanged', () => {
          state.model.autocompleteSearch('somewhere');

          expect(state.autocompleteSpy.callCount).to.equal(0);
        });

        it('resets query when query is empty', () => {
          state.model.autocompleteSearch('');

          expect(state.model.get('query')).to.equal('');
        });

        it('resets error when query is empty', () => {
          state.model.autocompleteSearch('');

          expect(state.model.get('error')).to.equal('');
        });

        it('resets predictions when query is empty', () => {
          state.model.autocompleteSearch('');

          expect(state.model.get('predictions')).to.deep.equal([]);
        });

        it('resets focus index when query is empty', () => {
          state.model.autocompleteSearch('');

          expect(state.model.get('focusIndex')).to.equal(-1);
        });

        it('resets query when input could be a lat,long pair', () => {
          state.model.autocompleteSearch('1,23');

          expect(state.model.get('query')).to.equal('');
        });

        it('resets predictions when input could be a lat,long pair', () => {
          state.model.autocompleteSearch('1,23');

          expect(state.model.get('predictions')).to.deep.equal([]);
        });

        it('resets focus index when input could be a lat,long pair', () => {
          state.model.autocompleteSearch('1,23');

          expect(state.model.get('focusIndex')).to.equal(-1);
        });

        it('sets predictions from autocomplete search', async () => {
          const predictions = [new Prediction({
            description: 'Some Other Location',
            googleMapsPlaceId: 'someOtherId',
          })];
          state.autocompleteSpy.callsFake(() => predictions);

          state.model.autocompleteSearch("somewhere else");
          // Wait for new predictions to be set on model.
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(state.model.get('predictions').length).to.equal(1);
          expect(state.model.get('predictions')[0].get('description')).to.equal('Some Other Location');
        });

        it('shows permissions error if autocomplete search request is denied',
          () => {
            state.autocompleteSpy.callsFake(() => {
              const error = new Error('Request error');
              error.code = 'REQUEST_DENIED';
              error.endpoint = 'PLACES_AUTOCOMPLETE';
              throw error;
            });

            state.model.autocompleteSearch("somewhere else");

            expect(state.model.get('error')).to.match(/We're having trouble/);
          });

        it('shows \'no results\' message if autocomplete search throws some other error',
          () => {
            state.autocompleteSpy.callsFake(() => {
              const error = new Error('Some other error');
              throw error;
            });

            state.model.autocompleteSearch("somewhere else");

            expect(state.model.get('error')).to.match(/No search results/);
          });

        it('shows \'no results\' message if predictions are empty', async () => {
          state.autocompleteSpy.callsFake(() => ([]));

          state.model.autocompleteSearch("somewhere else");
          // Wait for new predictions to be set on model.
          await new Promise(resolve => setTimeout(resolve, 0));

          expect(state.model.get('predictions').length).to.equal(0);
          expect(state.model.get('error')).to.match(/No search results/);
        });
      });

      describe('manages the focused prediction index', () => {
        it('increments focus index', () => {
          state.model.incrementFocusIndex();

          expect(state.model.get('focusIndex')).to.equal(1);
        });

        it('sets focus index to max if trying to increment beyond max', () => {
          state.model.set('focusIndex', 1);

          state.model.incrementFocusIndex();

          expect(state.model.get('focusIndex')).to.equal(1);
        });

        it('decrements focus index', () => {
          state.model.set('focusIndex', 1);

          state.model.decrementFocusIndex();

          expect(state.model.get('focusIndex')).to.equal(0);
        });

        it('sets focus index to 0 if trying to decrement from -1', () => {
          state.model.set('focusIndex', -1);

          state.model.decrementFocusIndex();

          expect(state.model.get('focusIndex')).to.equal(0);
        });

        it('resets focus index', () => {
          state.model.resetFocusIndex();

          expect(state.model.get('focusIndex')).to.equal(-1);
        });
      });


      describe('flying to a location on the map', () => {
        it('flies to a location on cesium map', () => {
          const geocodedLoc = new GeocodedLocation({
            box: { north: 1, south: 2, east: 3, west: 4 }
          });

          state.model.goToLocation(geocodedLoc);

          expect(state.zoomSpy.callCount).to.equal(1);
        });

        it('does nothing if geocoded location is falsy', () => {
          state.model.goToLocation();

          expect(state.zoomSpy.callCount).to.equal(0);
        });
      });

      describe('selecting a prediction', () => {
        it('geocodes the selected prediction', async () => {
          await state.model.selectPrediction(state.predictions[0]);

          expect(state.geocodeSpy.callCount).to.equal(1);
        });

        it('shows a \'no results\' error message if there are not geocodings', async () => {
          await state.model.selectPrediction(state.predictions[0]);

          expect(state.model.get('error')).to.match(/No search results/);
        });

        it('triggers a \'selection-made\' event', async () => {
          const triggerSpy = state.sandbox.stub(state.model, 'trigger');
          state.geocodeSpy.returns([
            new GeocodedLocation({
              box: { north: 1, south: 2, east: 3, west: 4 }
            })
          ]);

          await state.model.selectPrediction(state.predictions[0]);

          expect(triggerSpy.callCount).to.equal(1);
        });

        it('shows permissions error if geocoder request is denied',
          async () => {
            state.geocodeSpy.callsFake(() => {
              const error = new Error('Request error');
              error.code = 'REQUEST_DENIED';
              error.endpoint = 'GEOCODER_GEOCODE';
              throw error;
            });

            await state.model.selectPrediction(state.predictions[0]);

            expect(state.model.get('error')).to.match(/We're having trouble/);
          });

        it('shows \'no results\' message if geocoder throws some other error',
          async () => {
            state.geocodeSpy.callsFake(() => {
              const error = new Error('Some other error');
              throw error;
            });

            await state.model.selectPrediction(state.predictions[0]);

            expect(state.model.get('error')).to.match(/No search results/);
          });

        it('navigates to the geocoded location', async () => {
          state.geocodeSpy.returns([
            new GeocodedLocation({
              box: { north: 1, south: 2, east: 3, west: 4 }
            })
          ]);

          await state.model.selectPrediction(state.predictions[0]);

          expect(state.zoomSpy.callCount).to.equal(1);
        });

        it('does nothing if there is not prediction', async () => {
          await state.model.selectPrediction();

          expect(state.geocodeSpy.callCount).to.equal(0);
        });
      });

      describe('searching for a location', () => {
        it('does nothing if the search string is null', async () => {
          await state.model.search();

          expect(state.zoomSpy.callCount).to.equal(0);
        });

        it('does nothing if the search string is empty', async () => {
          await state.model.search('');

          expect(state.zoomSpy.callCount).to.equal(0);
        });

        it('geocodes and selects the focused prediction', async () => {
          state.geocodeSpy.returns([
            new GeocodedLocation({
              box: { north: 1, south: 2, east: 3, west: 4 }
            })
          ]);

          await state.model.search("somewhere");

          expect(state.zoomSpy.callCount).to.equal(1);
        });

        it('geocodes and selects the first prediction on search if no prediction is focused', async () => {
          state.model.set('focusIndex', -1);
          state.geocodeSpy.returns([
            new GeocodedLocation({
              box: { north: 1, south: 2, east: 3, west: 4 }
            })
          ]);

          await state.model.search("somewhere");

          expect(state.zoomSpy.callCount).to.equal(1);
        });

        it('zooms to a lat, long pair', async () => {
          await state.model.search("45,135");

          expect(state.zoomSpy.callCount).to.equal(1);
        });

        it('clears errors when entering lat, long pair', async () => {
          await state.model.search("45,135");

          expect(state.model.get('error')).to.equal('');
        });

        it('sets an error if latitude value is bad', async () => {
          await state.model.search("91,135");

          expect(state.model.get('error')).to.match(/Invalid latitude/);
        });

        it('sets an error if longitude value is bad', async () => {
          await state.model.search("45,181");

          expect(state.model.get('error')).to.match(/Invalid longitude/);
        });

        it('sets an error if search string is not valid as a lat, long pair ', async () => {
          await state.model.search("45,");

          expect(state.model.get('error')).to.match(
            /Try entering a search query with two numerical/
          );
        });
      });
    });
  });