"use strict";

define([
  "underscore",
  "views/maps/viewfinder/ViewfinderCardView",
  "models/maps/viewfinder/ViewfinderCardModel",
  "models/maps/GeoPoint",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/unit/views/maps/viewfinder/ViewfinderCardViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
], (
  _,
  ViewfinderCardView,
  ViewfinderCardModel,
  GeoPoint,
  ViewfinderCardViewHarness,
  cleanState,
) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("ViewfinderCardView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const title = "Some preset";
      const geoPoint = new GeoPoint({
        latitude: 42.33,
        longigude: -83.05,
        height: 5000,
      });
      const description = "For testing the view";
      const enabledLayerLabels = ["Layer 1", "Layer 2"];
      const card = new ViewfinderCardModel({
        title,
        geoPoint,
        description,
        enabledLayerLabels,
      });
      const selectCallbackSpy = sandbox.spy();
      const view = new ViewfinderCardView({
        preset: card,
        selectCallback: selectCallbackSpy,
      });
      view.render();
      const harness = new ViewfinderCardViewHarness(view);

      // Actually render the view to document to test focus events.
      const testContainer = document.createElement("div");
      testContainer.id = "test-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      return {
        harness,
        sandbox,
        selectCallbackSpy,
        testContainer,
        view,
      };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      state.testContainer.remove();
    });

    it("creates a ViewfinderCardView instance", () => {
      state.view.should.be.instanceof(ViewfinderCardView);
    });

    it("starts inactive", () => {
      expect(state.harness.isActive()).to.be.false;
    });

    it("can be selected", () => {
      state.harness.click();

      expect(state.harness.isActive()).to.be.true;
    });

    it("does not call a select callback before selected", () => {
      expect(state.selectCallbackSpy.callCount).to.equal(0);
    });

    it("calls a select callback when selected", () => {
      state.harness.click();

      expect(state.selectCallbackSpy.callCount).to.equal(1);
    });

    it("opens iframe actions even when rendered as secondary", () => {
      const sandbox = sinon.createSandbox();
      const ctaCallbackSpy = sandbox.spy();
      const selectCallbackSpy = sandbox.spy();
      const card = new ViewfinderCardModel({
        title: "Iframe preset",
        description: "For testing iframe actions",
        buttons: [
          {
            type: "iframe",
            ordinality: "secondary",
            label: "View dashboard",
            url: "https://water-timeseries.streamlit.app/",
          },
        ],
      });
      const view = new ViewfinderCardView({
        preset: card,
        ctaCallback: ctaCallbackSpy,
        selectCallback: selectCallbackSpy,
      });
      view.render();
      const harness = new ViewfinderCardViewHarness(view);
      const testContainer = document.createElement("div");
      testContainer.id = "iframe-test-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      try {
        harness.click();

        expect(ctaCallbackSpy.callCount).to.equal(1);
        expect(ctaCallbackSpy.firstCall.args[0]).to.equal(
          "https://water-timeseries.streamlit.app/",
        );
        expect(selectCallbackSpy.callCount).to.equal(0);
      } finally {
        sandbox.restore();
        testContainer.remove();
      }
    });

    it("can reset selected state", () => {
      state.harness.click();
      state.harness.reset();

      expect(state.harness.isActive()).to.be.false;
    });

    it("shows a title", () => {
      expect(state.harness.getTitle()).to.match(/Some preset/);
    });

    it("shows a description", () => {
      expect(state.harness.getDescription()).to.match(/For testing/);
    });

    it("shows which layers are enabled", () => {
      expect(state.harness.getEnabledLayers()).to.match(/Layer 1/);
      expect(state.harness.getEnabledLayers()).to.match(/Layer 2/);
    });
  });
});
