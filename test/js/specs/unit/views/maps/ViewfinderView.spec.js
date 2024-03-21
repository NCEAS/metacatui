define([
  "views/maps/ViewfinderView",
  "models/maps/Map",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/unit/views/maps/ViewfinderViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/shared/create-spy.js",
], (ViewfinderView, Map, ViewfinderViewHarness, cleanState, createSpy) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("ViewfinderView Test Suite", () => {
    const state = cleanState(() => {
      const view = new ViewfinderView({ model: new Map() });
      const spy = createSpy();
      view.model.zoomTo = spy;
      const harness = new ViewfinderViewHarness(view);

      return { harness, spy, view };
    }, beforeEach);

    it("creates a ViewfinderView instance", () => {
      state.view.should.be.instanceof(ViewfinderView);
    });

    it("has an input for the user's search query", () => {
      state.view.render();

      state.harness.typeQuery("123")

      expect(state.view.getInput().val()).to.equal("123");
    });

    it("zooms to the specified location on clicking search button", () => {
      state.view.render();

      state.harness.typeQuery("13,37")
      state.harness.clickSearch();

      expect(state.spy.callCount).to.equal(1);
    });

    it("zooms to the specified location on hitting 'Enter' key", () => {
      state.view.render();

      state.harness.typeQuery("13,37")
      state.harness.hitEnter();

      expect(state.spy.callCount).to.equal(1);
    });

    it("zooms to the specified location on clicking search button when value is entered without using keyboard", () => {
      state.view.render();

      state.harness.typeQuery("13,37")
      state.harness.clickSearch();

      expect(state.spy.callCount).to.equal(1);
    });

    describe("good search queries", () => {
      it("uses the user's search query when zooming", () => {
        state.view.render();

        state.harness.typeQuery("13,37")
        state.harness.clickSearch();

        // First argument of the first call.
        expect(state.spy.callArgs[0][0]).to.include({ latitude: 13, longitude: 37 });
      });

      it("accepts user input of two space-separated numbers", () => {
        state.view.render();

        state.harness.typeQuery("13 37")
        state.harness.clickSearch();

        // First argument of the first call.
        expect(state.spy.callArgs[0][0]).to.include({ latitude: 13, longitude: 37 });
      });

      it("accepts user input of with '-' signs", () => {
        state.view.render();

        state.harness.typeQuery("13,-37")
        state.harness.clickSearch();

        // First argument of the first call.
        expect(state.spy.callArgs[0][0]).to.include({ latitude: 13, longitude: -37 });
      });

      it("accepts user input of with '+' signs", () => {
        state.view.render();

        state.harness.typeQuery("+13,37")
        state.harness.clickSearch();

        // First argument of the first call.
        expect(state.spy.callArgs[0][0]).to.include({ latitude: 13, longitude: 37 });
      });
    });

    describe("bad search queries", () => {
      it("shows an error when only a single number is entered", () => {
        state.view.render();

        state.harness.typeQuery("13")
        state.harness.clickSearch();

        expect(state.harness.getError()).to.have.string("Try entering a search query with two numerical values");
      });

      it("does not try to zoom to location when only a single number is entered", () => {
        state.view.render();

        state.harness.typeQuery("13")
        state.harness.clickSearch();

        expect(state.spy.callCount).to.equal(0);
      });

      it("shows an error when non-numeric characters are entered", () => {
        state.view.render();

        state.harness.typeQuery("13,37a")
        state.harness.clickSearch();

        expect(state.harness.getError()).to.have.string("Try entering a search query with two numerical values");
      });

      it("does not try to zoom to location when non-numeric characters are entered", () => {
        state.view.render();

        state.harness.typeQuery("13,37a")
        state.harness.clickSearch();

        expect(state.spy.callCount).to.equal(0);
      });

      it("shows an error when out of bounds latitude is entered", () => {
        state.view.render();

        state.harness.typeQuery("91,37")
        state.harness.clickSearch();

        expect(state.harness.getError()).to.have.string("Latitude values outside of the");
      });

      it("still zooms to location when out of bounds latitude is entered", () => {
        state.view.render();

        state.harness.typeQuery("91,37")
        state.harness.clickSearch();

        expect(state.spy.callCount).to.equal(1);
      });

      it("shows an error when out of bounds longitude is entered", () => {
        state.view.render();

        state.harness.typeQuery("13,181")
        state.harness.clickSearch();

        expect(state.harness.getError()).to.have.string("Longitude values outside of the");
      });

      it("still zooms to location when out of bounds longitude is entered", () => {
        state.view.render();

        state.harness.typeQuery("13,181")
        state.harness.clickSearch();

        expect(state.spy.callCount).to.equal(1);
      });

      it("clears errors after fixing input error and searching again", () => {
        state.view.render();

        state.harness.typeQuery("13")
        state.harness.clickSearch();
        state.harness.typeQuery("13,37")
        state.harness.clickSearch();

        expect(state.harness.hasError()).to.be.false;
      });

      it("zooms to the entered location after fixing input error and searching again", () => {
        state.view.render();

        state.harness.typeQuery("13")
        state.harness.clickSearch();
        state.harness.typeQuery("13,37")
        state.harness.clickSearch();

        expect(state.spy.callCount).to.equal(1);
      });
    });
  });
});
