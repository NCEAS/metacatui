'use strict';

define(
  [
    '/test/js/specs/shared/clean-state.js',
    'models/geocoder/GoogleMapsGeocoder',
  ],
  (cleanState, GoogleMapsGeocoder) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('GoogleMapsGeocoder Test Suite', () => {
      const state = cleanState(() => {
        const geocoder = new GoogleMapsGeocoder();
        const sandbox = sinon.createSandbox();
        sandbox.stub(geocoder.get('geocoder'), 'geocode').returns({
          results: [{
            address_components: [{ long_name: 'some result', }],
            geometry: { viewport: { toJSON() { } } }
          }]
        }
        );

        return { geocoder, sandbox }
      }, beforeEach);

      it('creates a GoogleMapsGeocoder instance', () => {
        state.geocoder.should.be.instanceof(GoogleMapsGeocoder);
      });

      it('calls the Google Maps API', async () => {
        await state.geocoder.geocode('abc123');

        expect(state.geocoder.get('geocoder').geocode.callCount).to.equal(1);
      });

      it('calls the Google Maps API with the provided place ID', async () => {
        await state.geocoder.geocode('abc123');

        expect(state.geocoder.get('geocoder').geocode.getCall(0).firstArg)
          .to.deep.equal({ placeId: 'abc123' });
      });

      it('returns results from the Google Maps API', async () => {
        const response = await state.geocoder.geocode('abc123');

        expect(response[0].get('displayName')).to.equal('some result');
      });

      it('does not throw an error even if the Google Maps API throws',
        async () => {
          state.sandbox.restore();
          state.sandbox.stub(
            state.geocoder.get('geocoder'),
            'geocode'
          ).rejects();

          expect(async () => await state.geocoder.geocode('abc123')).not.to.throw;
        });

      it('returns an empty array if the Google Maps API throws',
        async () => {
          state.sandbox.restore();
          state.sandbox.stub(
            state.geocoder.get('geocoder'),
            'geocode'
          ).rejects();

          const response = await state.geocoder.geocode('abc123');

          expect(response).to.deep.equal([]);
        });
    });
  });