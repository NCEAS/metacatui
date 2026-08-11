"use strict";

define([
  "underscore",
  "common/SearchParams",
  "views/maps/viewfinder/ViewfinderView",
  "models/maps/Map",
  "collections/maps/viewfinder/ViewfinderCards",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/unit/views/maps/viewfinder/ViewfinderViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
], (
  _,
  SearchParams,
  ViewfinderView,
  Map,
  ViewfinderCards,
  ViewfinderViewHarness,
  cleanState,
) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("ViewfinderView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const view = new ViewfinderView({ model: new Map() });
      const harness = new ViewfinderViewHarness(view);
      view.render();

      // Actually render the view to document to test focus events.
      const testContainer = document.createElement("div");
      testContainer.id = "test-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      return {
        harness,
        sandbox,
        testContainer,
        view,
      };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      state.testContainer.remove();
    });

    it("creates a ViewfinderView instance", () => {
      state.view.should.be.instanceof(ViewfinderView);
    });

    it("shows viewfinder cards UI when enabled in config", () => {
      const view = new ViewfinderView(
        {
          model: new Map({ zoomPresets: [{}], allLayers: { models: [] } }),
        },
        { parse: true },
      );

      const harness = new ViewfinderViewHarness(view);
      view.render();

      expect(harness.hasViewfinderCards()).to.be.true;
    });

    it("does not show viewfinder cards UI when disabled in config", () => {
      expect(state.harness.hasViewfinderCards()).to.be.false;
    });

    it("restores the matching action object through the rendered card view", () => {
      const action = {
        id: "action-123",
        type: "iframe",
        url: "https://example.org/app",
      };
      const restoreActionSpy = state.sandbox.stub().returns(true);
      const openSpy = state.sandbox.spy();
      const buttons = [action];
      const cardView = {
        preset: {
          get(name) {
            return name === "buttons" ? buttons : null;
          },
        },
        restoreAction: restoreActionSpy,
      };

      state.view.viewfinderCardsListViews = [
        {
          categoryCid: "category-1",
          children: [cardView],
        },
      ];
      state.view.expansionPanelsByCategoryCid = {
        "category-1": {
          open: openSpy,
        },
      };

      const restored = state.view.restoreActiveAction("action-123");

      expect(restored).to.be.true;
      expect(openSpy.callCount).to.equal(1);
      expect(restoreActionSpy.callCount).to.equal(1);
      expect(restoreActionSpy.firstCall.args[0]).to.equal(action);
    });

    it("syncs visualization state updates into namespaced URL params", () => {
      state.view.mapModel.set("showShareUrl", true);
      state.view.mapModel.set("activeVisualizationActionId", "wt");
      window.history.replaceState(null, "", "?foo=bar");

      state.view.syncVisualizationStateToUrl({
        action: {
          id: "wt",
          url: "https://lostlakes.arcticdata.io/{?selected_lake,lat,lon,zoom}",
        },
        url: "https://lostlakes.arcticdata.io/?selected_lake=abc&lat=64.1&zoom=8",
      });

      const url = new URL(window.location.href);
      expect(url.searchParams.get("foo")).to.equal("bar");
      expect(url.searchParams.get("wt-selected_lake")).to.equal("abc");
      expect(url.searchParams.get("wt-lat")).to.equal("64.1");
      expect(url.searchParams.get("wt-zoom")).to.equal("8");
      expect(url.searchParams.get("wt-lon")).to.be.null;
    });

    it("ignores stale visualization state when the action is no longer active", () => {
      state.view.mapModel.set("showShareUrl", true);
      window.history.replaceState(null, "", "?sv=1");

      state.view.mapModel.set({
        activeVisualizationActionId: "wt",
        activeVisualizationUrl:
          "https://lostlakes.arcticdata.io/?selected_lake=abc",
      });

      state.view.mapModel.set({
        activeVisualizationActionId: null,
        activeVisualizationUrl: null,
      });

      state.view.syncVisualizationStateToUrl({
        action: {
          id: "wt",
          url: "https://lostlakes.arcticdata.io/{?selected_lake,lat,lon,zoom}",
        },
        url: "https://lostlakes.arcticdata.io/?selected_lake=abc&lat=64.1&zoom=8",
      });

      const url = new URL(window.location.href);
      expect(url.searchParams.get("wt-selected_lake")).to.be.null;
      expect(url.searchParams.get("wt-lat")).to.be.null;
      expect(url.searchParams.get("wt-zoom")).to.be.null;
    });

    it("clears active action id and namespaced params when visualization closes", () => {
      state.view.mapModel.set("showShareUrl", true);
      window.history.replaceState(
        null,
        "",
        "?sv=1&a=wt&wt-selected_lake=abc&wt-lat=65",
      );

      state.view.mapModel.set({
        activeVisualizationActionId: "wt",
        activeVisualizationUrl:
          "https://lostlakes.arcticdata.io/?selected_lake=abc",
      });
      state.view.mapModel.set({
        activeVisualizationActionId: null,
        activeVisualizationUrl: null,
      });

      const stateFromUrl = SearchParams.parseStateFromUrl();
      const url = new URL(window.location.href);
      expect(stateFromUrl.activeActionId).to.be.null;
      expect(url.searchParams.get("wt-selected_lake")).to.be.null;
      expect(url.searchParams.get("wt-lat")).to.be.null;
    });
  });
});
