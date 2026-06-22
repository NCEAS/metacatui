"use strict";

define([
  "underscore",
  "views/maps/viewfinder/ViewfinderCardsListView",
  "models/maps/viewfinder/ViewfinderCardModel",
  "collections/maps/viewfinder/ViewfinderCards",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/unit/views/maps/viewfinder/ZoomPresetsListViewHarness.js",
], (
  _,
  ViewfinderCardsListView,
  ViewfinderCardModel,
  ViewfinderCards,
  cleanState,
  ZoomPresetsListViewHarness,
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
            description: "Test 1 description",
            enabledLayers: ["Layer 2", "Layer 3"],
          },
          { parse: true },
        ),
      ]);
      const selectViewfinderCardSpy = sandbox.spy();
      const view = new ViewfinderCardsListView({
        viewfinderCards,
        selectViewfinderCard: selectViewfinderCardSpy,
      });
      view.render();
      const harness = new ZoomPresetsListViewHarness(view);
      // Actually render the view to document to test focus events.
      const testContainer = document.createElement("div");
      testContainer.id = "test-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      return {
        harness,
        sandbox,
        selectViewfinderCardSpy,
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
      expect(state.harness.getZoomPresets().length).to.equal(2);
    });

    it("does not select viewfinder card on model before clicking", () => {
      expect(state.selectViewfinderCardSpy.callCount).to.equal(0);
    });

    it("selects a viewfinder card on model when it is clicked", () => {
      state.harness.clickZoomPresetAt(0);

      expect(state.selectViewfinderCardSpy.callCount).to.equal(1);
    });

    it("marks a viewfinder card as selected after clicking it", () => {
      state.harness.clickZoomPresetAt(0);

      expect(state.harness.isZoomPresetActiveAt(0)).to.be.true;
    });

    it("resets the select state of previous cards upon selecting another", () => {
      state.harness.clickZoomPresetAt(0);
      state.harness.clickZoomPresetAt(1);

      expect(state.harness.isZoomPresetActiveAt(0)).to.be.false;
    });

    it("can select a different card after selecting another", () => {
      state.harness.clickZoomPresetAt(0);
      state.harness.clickZoomPresetAt(1);

      expect(state.harness.isZoomPresetActiveAt(1)).to.be.true;
    });
  });
});
