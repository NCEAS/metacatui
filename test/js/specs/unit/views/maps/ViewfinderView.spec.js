define([
  "views/maps/ViewfinderView",
  "models/maps/Map",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/shared/create-spy.js",
], (ViewfinderView, Map, cleanState, createSpy) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("ViewfinderView Test Suite", () => {
    const state = cleanState(() => {
      const view = new ViewfinderView({ model: new Map() });
      const spy = createSpy();
      view.model.zoomTo = spy;

      return { spy, view };
    }, beforeEach);

    it("creates a ViewfinderView instance", () => {
      state.view.should.be.instanceof(ViewfinderView);
    });

    it("zooms to the specified location on search", () => {
      state.view.render();

      state.view.search("13,37");

      expect(state.spy.callCount).to.equal(1);
    });

    describe("good search queries", () => {
      it("uses the user's search query when zooming", () => {
        state.view.render();

        state.view.search("13,37");

        // First argument of the first call.
        expect(state.spy.callArgs[0][0]).to.include({ latitude: 13, longitude: 37 });
      });

      it("accepts user input of two space-separated numbers", () => {
        state.view.render();

        state.view.search("13 37");

        // First argument of the first call.
        expect(state.spy.callArgs[0][0]).to.include({ latitude: 13, longitude: 37 });
      });

      it("accepts user input of with '-' signs", () => {
        state.view.render();

        state.view.search("13,-37");

        // First argument of the first call.
        expect(state.spy.callArgs[0][0]).to.include({ latitude: 13, longitude: -37 });
      });

      it("accepts user input of with '+' signs", () => {
        state.view.render();

        state.view.search("+13,37");

        // First argument of the first call.
        expect(state.spy.callArgs[0][0]).to.include({ latitude: 13, longitude: 37 });
      });
    });

    describe("bad search queries", () => {
      it("shows an error when only a single number is entered", () => {
        state.view.render();

        const { coords, errorText } = state.view.search("13");

        expect(coords).to.be.undefined;
        expect(errorText).to.have.string("Try entering a search query with two numerical values");
      });

      it("does not try to zoom to location when only a single number is entered", () => {
        state.view.render();

        state.view.search("13");

        expect(state.spy.callCount).to.equal(0);
      });

      it("shows an error when non-numeric characters are entered", () => {
        state.view.render();

        const { coords, errorText } = state.view.search("13,37a");

        expect(coords).to.be.undefined;
        expect(errorText).to.have.string("Try entering a search query with two numerical values");
      });

      it("does not try to zoom to location when non-numeric characters are entered", () => {
        state.view.render();

        state.view.search("13,37a");

        expect(state.spy.callCount).to.equal(0);
      });

      it("shows an error when out of bounds latitude is entered", () => {
        state.view.render();

        const { coords, errorText } = state.view.search("91,37");

        expect(coords).to.be.undefined;
        expect(errorText).to.have.string("Latitude values outside of the");
      });

      it("still zooms to location when out of bounds latitude is entered", () => {
        state.view.render();

        state.view.search("91,37");

        expect(state.spy.callCount).to.equal(1);
      });

      it("shows an error when out of bounds longitude is entered", () => {
        state.view.render();

        const { coords, errorText } = state.view.search("13,181");

        expect(coords).to.be.undefined;
        expect(errorText).to.have.string("Longitude values outside of the");
      });

      it("still zooms to location when out of bounds longitude is entered", () => {
        state.view.render();

        state.view.search("13,181");

        expect(state.spy.callCount).to.equal(1);
      });

      it("zooms to the entered location after fixing input error and searching again", () => {
        state.view.render();

        state.view.search("13");
        state.view.search("13,37");

        expect(state.spy.callCount).to.equal(1);
      });
    });
  });
});