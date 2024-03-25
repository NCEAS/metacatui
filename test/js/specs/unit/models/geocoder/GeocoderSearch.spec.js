'use strict';

define(
  [
    '/test/js/specs/shared/clean-state.js',
    'models/geocoder/GeocoderSearch',
    'models/geocoder/Prediction',
    'models/geocoder/GeocodedLocation',
  ],
  (
    cleanState,
    GeocoderSearch,
    Prediction,
    GeocodedLocation,
  ) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('GeocoderSearch Test Suite', () => {
      const state = cleanState(() => {
        const geoSearch = new GeocoderSearch();

        const sandbox = sinon.createSandbox();
        sandbox.stub(geoSearch.googleMapsAutocompleter, 'autocomplete')
          .returns([new Prediction({
            description: 'some desc',
            googleMapsPlaceId: 'somePlaceId',
          })]);

        sandbox.stub(geoSearch.googleMapsGeocoder, 'geocode')
          .returns([new GeocodedLocation({
            box: {
              north: 1,
              south: 2,
              east: 3,
              west: 4,
            },
            displayName: 'Some Location'
          })]);

        return { geoSearch, sandbox }
      }, beforeEach);

      it('creates a GeocoderSearch instance', () => {
        state.geoSearch.should.be.instanceof(GeocoderSearch);
      });

      it('autcomplete returns Predictions related to search input', async () => {
        const predictions = await state.geoSearch.autocomplete('some query');

        expect(predictions).to.have.lengthOf(1);
        predictions[0].should.be.instanceof(Prediction);
        expect(predictions[0].get('description')).to.equal('some desc');
        expect(predictions[0].get('googleMapsPlaceId')).to.equal('somePlaceId');
      });

      it('searches by Google Maps Place ID and returns geocoded locations', async () => {
        state.geoSearch.should.be.instanceof(GeocoderSearch);

        const geoLocs = await state.geoSearch.geocode(new Prediction({
          description: 'some desc',
          googleMapsPlaceId: 'somePlaceId',
        }));

        expect(geoLocs).to.have.lengthOf(1);
        geoLocs[0].should.be.instanceof(GeocodedLocation);
        expect(geoLocs[0].get('box').getCoords()).to.deep.equal({
          north: 1,
          south: 2,
          east: 3,
          west: 4,
        });
        expect(geoLocs[0].get('displayName')).to.equal('Some Location');
      });
    });
  });