'use strict';

define(
  [
    '/test/js/specs/shared/clean-state.js',
    'models/geocoder/GoogleMapsGeocoder',
    'models/geocoder/Prediction',
  ],
  (cleanState, GoogleMapsGeocoder, Prediction) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('GoogleMapsGeocoder Test Suite', () => {
      const state = cleanState(() => {
        const googleMapsGeocoder = new GoogleMapsGeocoder();
        const sandbox = sinon.createSandbox();
        sandbox.stub(googleMapsGeocoder.geocoder, 'geocode').returns({
          results: [{
            address_components: [{ long_name: 'some result', }],
            geometry: { viewport: { toJSON() { } } }
          }]
        });
        const prediction = new Prediction({
          description: 'some desc',
          googleMapsPlaceId: 'abc123',
        });

        return { googleMapsGeocoder, prediction, sandbox }
      }, beforeEach);

      it('creates a GoogleMapsGeocoder instance', () => {
        state.googleMapsGeocoder.should.be.instanceof(GoogleMapsGeocoder);
      });

      it('calls the Google Maps API', async () => {
        await state.googleMapsGeocoder.geocode(state.prediction);

        expect(state.googleMapsGeocoder.geocoder.geocode.callCount).to.equal(1);
      });

      it('calls the Google Maps API with the provided place ID', async () => {
        await state.googleMapsGeocoder.geocode(state.prediction);

        expect(state.googleMapsGeocoder.geocoder.geocode.getCall(0).firstArg)
          .to.deep.equal({ placeId: 'abc123' });
      });

      it('returns results from the Google Maps API', async () => {
        const response =
          await state.googleMapsGeocoder.geocode(state.prediction);

        expect(response[0].get('displayName')).to.equal('some result');
      });

      it('throws an error if the Google Maps API throws', async () => {
        state.sandbox.restore();
        state.sandbox.stub(
          state.googleMapsGeocoder.geocoder,
          'geocode'
        ).rejects();

        expect(
          async () => state.googleMapsGeocoder.geocode(state.prediction)
        ).to.throw;
      });
    });
  });