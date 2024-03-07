'use strict';

define(
  [
    '/test/js/specs/shared/clean-state.js',
    'models/geocoder/GoogleMapsAutocompleter',
  ],
  (cleanState, GoogleMapsAutocompleter) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('GoogleMapsAutocompleter Test Suite', () => {
      const state = cleanState(() => {
        const autocompleter = new GoogleMapsAutocompleter();
        const sandbox = sinon.createSandbox();
        sandbox.stub(autocompleter.get('autocompleter'), 'getPlacePredictions')
          .returns(
            { predictions: [{ description: 'some result' }] }
          );

        return { autocompleter, sandbox }
      }, beforeEach);

      it('creates a GoogleMapsAutocompleter instance', () => {
        state.autocompleter.should.be.instanceof(GoogleMapsAutocompleter);
      });

      it('calls the Google Maps API', async () => {
        await state.autocompleter.autocomplete('some place');

        expect(state.autocompleter.get('autocompleter')
          .getPlacePredictions.callCount).to.equal(1);
      });

      it('calls the Google Maps API with the provided input', async () => {
        await state.autocompleter.autocomplete('some place');

        expect(state.autocompleter.get('autocompleter').getPlacePredictions
          .getCall(0).firstArg).to.deep.equal({
            input: 'some place'
          });
      });

      it('returns results from the Google Maps API',
        async () => {
          const response = await state.autocompleter.autocomplete('some place');

          expect(response[0].get('description')).to.equal('some result');
        });

      it('does not throw an error even if the Google Maps API throws',
        async () => {
          state.sandbox.restore();
          state.sandbox.stub(
            state.autocompleter.get('autocompleter'),
            'getPlacePredictions'
          ).rejects();

          expect(async () => await state.autocompleter.autocomplete('some place')).not.to.throw;
        });

      it('returns an empty array if the Google Maps API throws',
        async () => {
          state.sandbox.restore();
          state.sandbox.stub(
            state.autocompleter.get('autocompleter'),
            'getPlacePredictions'
          ).rejects();

          const response = await state.autocompleter.autocomplete('some place');

          expect(response).to.deep.equal([]);
        });
    });
  });