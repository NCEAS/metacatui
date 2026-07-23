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

      it("restores iframe actions without replaying click side effects", () => {
        const sandbox = sinon.createSandbox();
        const ctaCallbackSpy = sandbox.spy();
        const onActionActivatedSpy = sandbox.spy();
        const onActivateSpy = sandbox.spy();
        const card = new ViewfinderCardModel({
          title: "Restored iframe preset",
          description: "For testing restore behavior",
          buttons: [
            {
              type: "iframe",
              ordinality: "primary",
              label: "Open dashboard",
              url: "https://example.org/app",
            },
          ],
        });
        const view = new ViewfinderCardView({
          preset: card,
          ctaCallback: ctaCallbackSpy,
          onActionActivated: onActionActivatedSpy,
          onActivate: onActivateSpy,
        });
        view.render();
        const harness = new ViewfinderCardViewHarness(view);
        const testContainer = document.createElement("div");
        testContainer.id = "restore-iframe-test-container";
        testContainer.append(view.el);
        document.body.append(testContainer);

        try {
          const restored = view.restoreAction(card.get("buttons")[0]);

          expect(restored).to.be.true;
          expect(harness.isActive()).to.be.true;
          expect(onActivateSpy.callCount).to.equal(1);
          expect(onActionActivatedSpy.callCount).to.equal(0);
          expect(ctaCallbackSpy.callCount).to.equal(1);
          expect(ctaCallbackSpy.firstCall.args[0]).to.equal(
            "https://example.org/app",
          );
        } finally {
          sandbox.restore();
          testContainer.remove();
        }
      });

      it("restores tab actions without opening a new tab", () => {
        const sandbox = sinon.createSandbox();
        const openSpy = sandbox.stub(window, "open");
        const card = new ViewfinderCardModel({
          title: "Restored tab preset",
          description: "For testing restore behavior",
          buttons: [
            {
              type: "tab",
              ordinality: "primary",
              label: "Open external app",
              url: "https://example.org/external",
            },
          ],
        });
        const view = new ViewfinderCardView({
          preset: card,
        });
        view.render();
        const harness = new ViewfinderCardViewHarness(view);
        const testContainer = document.createElement("div");
        testContainer.id = "restore-tab-test-container";
        testContainer.append(view.el);
        document.body.append(testContainer);

        try {
          const restored = view.restoreAction(card.get("buttons")[0]);

          expect(restored).to.be.true;
          expect(harness.isActive()).to.be.true;
          expect(openSpy.callCount).to.equal(0);
        } finally {
          sandbox.restore();
          testContainer.remove();
        }
      });

    it("preserves an explicit action id", () => {
      const sandbox = sinon.createSandbox();
      const onActionActivatedSpy = sandbox.spy();
      const card = new ViewfinderCardModel({
        title: "Explicit ID card",
        description: "For testing ids",
        buttons: [
          {
            id: "explicit-action-id",
            type: "iframe",
            label: "Open app",
            url: "https://example.org/app",
          },
        ],
      });
      const view = new ViewfinderCardView({
        preset: card,
        ctaCallback: sandbox.spy(),
        onActionActivated: onActionActivatedSpy,
      });
      view.render();
      const harness = new ViewfinderCardViewHarness(view);
      const testContainer = document.createElement("div");
      testContainer.id = "explicit-action-id-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      try {
        harness.clickButton(0);

        expect(onActionActivatedSpy.callCount).to.equal(1);
        const action = onActionActivatedSpy.firstCall.args[0];
        expect(action.id).to.equal("explicit-action-id");
      } finally {
        sandbox.restore();
        testContainer.remove();
      }
    });

    it("generates a fallback action id when missing", () => {
      const sandbox = sinon.createSandbox();
      const onActionActivatedSpy = sandbox.spy();
      const card = new ViewfinderCardModel(
        {
          title: "Generated ID card",
          description: "For testing generated ids",
          buttons: [
            {
              type: "iframe",
              label: "Open app",
              url: "https://example.org/generated",
            },
          ],
        },
      );
      const view = new ViewfinderCardView({
        preset: card,
        ctaCallback: sandbox.spy(),
        onActionActivated: onActionActivatedSpy,
      });
      view.render();
      const harness = new ViewfinderCardViewHarness(view);
      const testContainer = document.createElement("div");
      testContainer.id = "generated-action-id-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      try {
        harness.clickButton(0);

        expect(onActionActivatedSpy.callCount).to.equal(1);
        const action = onActionActivatedSpy.firstCall.args[0];
        expect(action.id).to.be.a("string");
        expect(action.id).to.match(/^vf-action-/);
      } finally {
        sandbox.restore();
        testContainer.remove();
      }
    });

    it("generates fallback ids for parsed legacy map actions", () => {
      const card = new ViewfinderCardModel(
        {
          title: "Parsed legacy card",
          description: "For testing parse-time normalization",
          position: {
            latitude: 41,
            longitude: -120,
            height: 2000,
          },
          layerIds: ["layer-1"],
        },
        { parse: true },
      );

      expect(card.get("geoPoint")).to.be.instanceof(GeoPoint);
      expect(card.get("buttons")).to.have.length(1);
      expect(card.get("buttons")[0].id).to.match(/^vf-action-/);
    });

    it("does not synthesize a duplicate legacy map action when one is explicit", () => {
      const card = new ViewfinderCardModel(
        {
          title: "Explicit map card",
          description: "For testing explicit map normalization",
          position: {
            latitude: 41,
            longitude: -120,
            height: 2000,
          },
          layerIds: ["layer-1"],
          buttons: [
            {
              type: "map",
              label: "Custom map action",
              latitude: 10,
              longitude: 20,
            },
          ],
        },
        { parse: true },
      );

      expect(card.get("buttons")).to.have.length(1);
      expect(card.get("buttons")[0].ordinality).to.equal("secondary");
      expect(card.get("buttons")[0].icon).to.equal("eye-open");
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
