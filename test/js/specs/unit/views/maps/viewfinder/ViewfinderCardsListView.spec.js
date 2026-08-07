"use strict";

define([
  "underscore",
  "views/maps/viewfinder/ViewfinderCardsListView",
  "models/maps/viewfinder/ViewfinderCardModel",
  "collections/maps/viewfinder/ViewfinderCards",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/unit/views/maps/viewfinder/ViewfinderCardsListViewHarness.js",
], (
  _,
  ViewfinderCardsListView,
  ViewfinderCardModel,
  ViewfinderCards,
  cleanState,
  ViewfinderCardsListViewHarness,
) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("ViewfinderCardsListView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const viewfinderCards = new ViewfinderCards([
        new ViewfinderCardModel(
          {
            title: "Test 1",
            position: {
              latitude: 11,
              longitude: 111,
              height: 5000,
            },
            description: "Test 1 description",
            enabledLayers: ["Layer 1", "Layer 2"],
          },
          { parse: true },
        ),
        new ViewfinderCardModel(
          {
            title: "Test 2",
            position: {
              latitude: 12,
              longitude: 112,
              height: 5000,
            },
            description: "Test 2 description",
            enabledLayers: ["Layer 2", "Layer 3"],
          },
          { parse: true },
        ),
      ]);
      const onMapActionSpy = sandbox.spy();
      const view = new ViewfinderCardsListView({
        viewfinderCards,
        onMapAction: onMapActionSpy,
      });
      view.render();
      const harness = new ViewfinderCardsListViewHarness(view);
      // Actually render the view to document to test focus events.
      const testContainer = document.createElement("div");
      testContainer.id = "test-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      return {
        harness,
        sandbox,
        onMapActionSpy,
        testContainer,
        view,
      };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      state.testContainer.remove();
    });

    it("creates a ViewfinderCardsListView instance", () => {
      state.view.should.be.instanceof(ViewfinderCardsListView);
    });

    it("renders a child element for each configured viewfinder card", () => {
      expect(state.harness.getCards().length).to.equal(2);
    });

    it("does not select a card before clicking", () => {
      expect(state.onMapActionSpy.callCount).to.equal(0);
    });

    it("selects a card when it is clicked", () => {
      state.harness.clickCardAt(0);

      expect(state.onMapActionSpy.callCount).to.equal(1);
    });

    it("marks a card as selected after clicking it", () => {
      state.harness.clickCardAt(0);

      expect(state.harness.isCardActiveAt(0)).to.be.true;
    });

    it("resets the selected state of previous cards upon selecting another", () => {
      state.harness.clickCardAt(0);
      state.harness.clickCardAt(1);

      expect(state.harness.isCardActiveAt(0)).to.be.false;
    });

    it("can select a different card after selecting another", () => {
      state.harness.clickCardAt(0);
      state.harness.clickCardAt(1);

      expect(state.harness.isCardActiveAt(1)).to.be.true;
    });
  });
});
