define(["common/SearchParams"], (SearchParams) => {
  const expect = chai.expect;
  const sandbox = sinon.createSandbox();
  const stub = sandbox.stub;
  const resetUrl = () => {
    window.history.replaceState(null, "", window.location.pathname);
  };

  describe("SearchParams Test Suite", () => {
    beforeEach(() => {
      resetUrl();
      SearchParams.clearStateInUrl();
    });

    afterEach(() => {
      sandbox.restore();

      resetUrl();
      SearchParams.clearStateInUrl();
    });

    describe("clearStateInUrl", () => {
      it("removes all saved view-related search parameters", () => {
        SearchParams.updateStateInUrl({
          destination: {
            latitude: 45,
            longitude: 135,
            height: 9999,
            heading: 0,
            pitch: 0,
            roll: 0,
          },
        });

        SearchParams.clearStateInUrl();

        expect(SearchParams.parseStateFromUrl().destination).to.deep.equal({});
      });
    });

    describe("parseStateFromUrl destination", () => {
      it("returns a partial destination when latitude is missing", () => {
        SearchParams.updateStateInUrl({
          destination: {
            longitude: 135,
            height: 9999,
            heading: 0,
            pitch: 0,
            roll: 0,
          },
        });

        expect(SearchParams.parseStateFromUrl().destination).to.deep.equal({
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });
      });

      it("returns a partial destination when longitude is missing", () => {
        SearchParams.updateStateInUrl({
          destination: {
            latitude: 45,
            height: 9999,
            heading: 0,
            pitch: 0,
            roll: 0,
          },
        });

        expect(SearchParams.parseStateFromUrl().destination).to.deep.equal({
          latitude: 45,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });
      });

      it("returns a partial destination when height is missing", () => {
        SearchParams.updateStateInUrl({
          destination: {
            latitude: 45,
            longitude: 135,
            heading: 0,
            pitch: 0,
            roll: 0,
          },
        });

        expect(SearchParams.parseStateFromUrl().destination).to.deep.equal({
          latitude: 45,
          longitude: 135,
          heading: 0,
          pitch: 0,
          roll: 0,
        });
      });

      it("returns an object with keys and values corresponding to the destination", () => {
        SearchParams.updateStateInUrl({
          destination: {
            latitude: 45,
            longitude: 135,
            height: 9999,
            heading: 0,
            pitch: 0,
            roll: 0,
          },
        });

        expect(SearchParams.parseStateFromUrl().destination).to.be.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });
      });

      it("returns an object with keys and values corresponding to the destination even without a heading, pitch, or roll", () => {
        SearchParams.updateStateInUrl({
          destination: {
            latitude: 45,
            longitude: 135,
            height: 9999,
          },
        });

        expect(SearchParams.parseStateFromUrl().destination).to.be.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
        });
      });
    });

    describe("parseStateFromUrl enabledLayerIds", () => {
      it("returns a list of layers from the enabled layer search param", () => {
        SearchParams.updateStateInUrl({
          enabledLayerIds: ["somelayer", "someotherlayer"],
        });

        expect(SearchParams.parseStateFromUrl().enabledLayerIds).to.deep.equal([
          "somelayer",
          "someotherlayer",
        ]);
      });
    });

    describe("updateStateInUrl enabledLayerIds", () => {
      it("replaces enabledLayerIds with the provided list", () => {
        SearchParams.updateStateInUrl({
          enabledLayerIds: ["somelayer", "someotherlayer"],
        });
        SearchParams.updateStateInUrl({ enabledLayerIds: ["someotherlayer"] });

        expect(SearchParams.parseStateFromUrl().enabledLayerIds).to.deep.equal([
          "someotherlayer",
        ]);
      });

      it("persists explicit empty enabledLayerIds as el in the URL", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: [] });

        const url = new URL(window.location.href);
        expect(url.searchParams.has("el")).to.equal(true);
        expect(SearchParams.parseStateFromUrl().enabledLayerIds).to.deep.equal(
          [],
        );
      });
    });

    describe("updateStateInUrl destination", () => {
      it("sets all saved view-related search parameters", () => {
        SearchParams.updateStateInUrl({
          destination: {
            latitude: 45,
            longitude: 135,
            height: 9999,
            heading: 0,
            pitch: 0,
            roll: 0,
          },
        });

        expect(SearchParams.parseStateFromUrl().destination).to.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });
      });
    });

    describe("parseStateFromUrl", () => {
      it("treats URLs without sv as schema 0 and ignores phase-1 params", () => {
        window.history.replaceState(
          null,
          "",
          "?lt=1&ln=2&ht=3&a=someAction&op=viewfinder",
        );

        const state = SearchParams.parseStateFromUrl();

        expect(state.schemaVersion).to.equal(0);
        expect(state.destination).to.deep.equal({
          latitude: 1,
          longitude: 2,
          height: 3,
        });
        expect(state.activeActionId).to.be.null;
        expect(state.openPanel).to.be.null;
      });

      it("parses phase-1 params when sv=1", () => {
        window.history.replaceState(
          null,
          "",
          "?sv=1&a=action-123&op=layers&lt=1&ln=2&ht=3",
        );

        const state = SearchParams.parseStateFromUrl();

        expect(state.schemaVersion).to.equal(1);
        expect(state.activeActionId).to.equal("action-123");
        expect(state.openPanel).to.equal("layers");
      });
    });

    describe("updateStateInUrl", () => {
      it("preserves unrelated query params", () => {
        window.history.replaceState(null, "", "?foo=bar");

        SearchParams.updateStateInUrl({
          openPanel: "viewfinder",
        });

        const url = new URL(window.location.href);
        expect(url.searchParams.get("foo")).to.equal("bar");
        expect(url.searchParams.get("sv")).to.equal("1");
        expect(url.searchParams.get("op")).to.equal("viewfinder");
      });
    });

    describe("clearStateInUrl", () => {
      it("removes known restore params and leaves unrelated params", () => {
        window.history.replaceState(
          null,
          "",
          "?foo=bar&sv=1&a=abc&op=layers&lt=1&ln=2&ht=3&el=l1,l2",
        );

        SearchParams.clearStateInUrl();

        const url = new URL(window.location.href);
        expect(url.searchParams.get("foo")).to.equal("bar");
        expect(url.searchParams.get("sv")).to.be.null;
        expect(url.searchParams.get("a")).to.be.null;
        expect(url.searchParams.get("op")).to.be.null;
        expect(url.searchParams.get("lt")).to.be.null;
        expect(url.searchParams.get("ln")).to.be.null;
        expect(url.searchParams.get("ht")).to.be.null;
        expect(url.searchParams.get("el")).to.be.null;
      });
    });

    describe("resolveActionUrl", () => {
      it("returns a base URL when no namespaced params exist", () => {
        const resolved = SearchParams.resolveActionUrl({
          id: "wt",
          url: "https://lostlakes.arcticdata.io/{+path}{?selected_lake,lat,lon,zoom}{#section_id}",
        });

        expect(resolved).to.equal("https://lostlakes.arcticdata.io/");
      });

      it("applies namespaced params to a URI template", () => {
        window.history.replaceState(
          null,
          "",
          "?a=wt&wt-selected_lake=b7g1zd63mmt8&wt-lat=64.123&wt-lon=-148.456&wt-zoom=8&wt-section_id=time-series-header",
        );

        const resolved = SearchParams.resolveActionUrl({
          id: "wt",
          url: "https://lostlakes.arcticdata.io/{+path}{?selected_lake,lat,lon,zoom}{#section_id}",
        });

        expect(resolved).to.equal(
          "https://lostlakes.arcticdata.io/?selected_lake=b7g1zd63mmt8&lat=64.123&lon=-148.456&zoom=8#time-series-header",
        );
      });

      it("ignores namespaced params when share-url syncing is disabled", () => {
        window.history.replaceState(
          null,
          "",
          "?a=wt&wt-selected_lake=b7g1zd63mmt8&wt-zoom=8",
        );

        const resolved = SearchParams.resolveActionUrl(
          {
            id: "wt",
            url: "https://lostlakes.arcticdata.io/{?selected_lake,lat,lon,zoom}",
            initialQueryParams: {
              theme: "light",
            },
          },
          false,
        );

        expect(resolved).to.equal(
          "https://lostlakes.arcticdata.io/?theme=light",
        );
      });

      it("appends initial query params after template expansion", () => {
        window.history.replaceState(
          null,
          "",
          "?a=wt&wt-selected_lake=b7g1zd63mmt8&wt-zoom=8",
        );

        const resolved = SearchParams.resolveActionUrl({
          id: "wt",
          url: "https://lostlakes.arcticdata.io/{?selected_lake,lat,lon,zoom}{#section_id}",
          initialQueryParams: {
            theme: "light",
            show_share: "false",
          },
        });

        expect(resolved).to.equal(
          "https://lostlakes.arcticdata.io/?selected_lake=b7g1zd63mmt8&zoom=8&theme=light&show_share=false",
        );
      });
    });

    describe("syncActionStateFromVisualizationUrl", () => {
      it("writes allow-listed values and clears omitted keys", () => {
        window.history.replaceState(
          null,
          "",
          "?foo=bar&wt-selected_lake=old-lake&wt-lat=65&wt-lon=-149&wt-theme=dark",
        );

        const synced = SearchParams.syncActionStateFromVisualizationUrl({
          actionId: "wt",
          actionUrlTemplate:
            "https://lostlakes.arcticdata.io/{+path}{?selected_lake,lat,lon,zoom,theme}{#section_id}",
          visualizationUrl:
            "https://lostlakes.arcticdata.io/?selected_lake=b7g1zd63mmt8&lat=64.123&zoom=8",
        });

        expect(synced).to.equal(true);

        const url = new URL(window.location.href);
        expect(url.searchParams.get("foo")).to.equal("bar");
        expect(url.searchParams.get("wt-selected_lake")).to.equal(
          "b7g1zd63mmt8",
        );
        expect(url.searchParams.get("wt-lat")).to.equal("64.123");
        expect(url.searchParams.get("wt-zoom")).to.equal("8");
        expect(url.searchParams.get("wt-lon")).to.be.null;
        expect(url.searchParams.get("wt-theme")).to.be.null;
      });

      it("writes values when the visualization URL omits the trailing slash after the host", () => {
        window.history.replaceState(null, "", "?foo=bar");

        const synced = SearchParams.syncActionStateFromVisualizationUrl({
          actionId: "wt",
          actionUrlTemplate:
            "https://lostlakes.arcticdata.io/{?selected_lake,lat,lon,zoom,theme}{#section_id}",
          visualizationUrl:
            "https://lostlakes.arcticdata.io?selected_lake=b7fce5fz7s55&lat=66.37929&lon=-164.74705&zoom=12#time-series-header",
        });

        expect(synced).to.equal(true);

        const url = new URL(window.location.href);
        expect(url.searchParams.get("wt-selected_lake")).to.equal(
          "b7fce5fz7s55",
        );
        expect(url.searchParams.get("wt-lat")).to.equal("66.37929");
        expect(url.searchParams.get("wt-lon")).to.equal("-164.74705");
        expect(url.searchParams.get("wt-zoom")).to.equal("12");
      });

      it("writes allow-listed values when the visualization URL contains extra query or hash state", () => {
        window.history.replaceState(null, "", "?foo=bar");

        const synced = SearchParams.syncActionStateFromVisualizationUrl({
          actionId: "wt",
          actionUrlTemplate:
            "https://lostlakes.arcticdata.io/{?selected_lake,lat,lon,zoom}",
          visualizationUrl:
            "https://lostlakes.arcticdata.io/?selected_lake=b7g6k2stc04z&lat=66.49299&lon=-163.98669&zoom=12&hide_stable=1#time-series-header",
        });

        expect(synced).to.equal(true);

        const url = new URL(window.location.href);
        expect(url.searchParams.get("wt-selected_lake")).to.equal(
          "b7g6k2stc04z",
        );
        expect(url.searchParams.get("wt-lat")).to.equal("66.49299");
        expect(url.searchParams.get("wt-lon")).to.equal("-163.98669");
        expect(url.searchParams.get("wt-zoom")).to.equal("12");
      });

      it("keeps previous namespaced params when the visualization URL does not match the template", () => {
        window.history.replaceState(
          null,
          "",
          "?foo=bar&wt-selected_lake=old-lake&wt-lat=65&wt-lon=-149&wt-zoom=7",
        );

        const synced = SearchParams.syncActionStateFromVisualizationUrl({
          actionId: "wt",
          actionUrlTemplate:
            "https://lostlakes.arcticdata.io/{?selected_lake,lat,lon,zoom}",
          visualizationUrl:
            "https://example.org/?selected_lake=b7g6k2stc04z&lat=66.49299&zoom=12",
        });

        expect(synced).to.equal(false);

        const url = new URL(window.location.href);
        expect(url.searchParams.get("foo")).to.equal("bar");
        expect(url.searchParams.get("wt-selected_lake")).to.equal("old-lake");
        expect(url.searchParams.get("wt-lat")).to.equal("65");
        expect(url.searchParams.get("wt-lon")).to.equal("-149");
        expect(url.searchParams.get("wt-zoom")).to.equal("7");
      });
    });

    describe("clearActionStateInUrl", () => {
      it("removes only namespaced params for the given action", () => {
        window.history.replaceState(
          null,
          "",
          "?foo=bar&wt-selected_lake=abc&wt-lat=65&xy-lat=11",
        );

        SearchParams.clearActionStateInUrl("wt");

        const url = new URL(window.location.href);
        expect(url.searchParams.get("foo")).to.equal("bar");
        expect(url.searchParams.get("xy-lat")).to.equal("11");
        expect(url.searchParams.get("wt-selected_lake")).to.be.null;
        expect(url.searchParams.get("wt-lat")).to.be.null;
      });
    });

    describe("activeFeatureIds", () => {
      it("returns empty array by default", () => {
        const state = SearchParams.parseStateFromUrl();
        expect(state.activeFeatureIds).to.deep.equal([]);
      });

      it("parses f param as activeFeatureIds when sv=1", () => {
        window.history.replaceState(null, "", "?sv=1&f=feature-abc-123");

        const state = SearchParams.parseStateFromUrl();
        expect(state.activeFeatureIds).to.deep.equal(["feature-abc-123"]);
      });

      it("ignores f param when sv is absent (schema 0)", () => {
        window.history.replaceState(null, "", "?f=feature-abc-123");

        const state = SearchParams.parseStateFromUrl();
        expect(state.activeFeatureIds).to.deep.equal([]);
      });

      it("parses repeated f params as activeFeatureIds when sv=1", () => {
        window.history.replaceState(
          null,
          "",
          "?sv=1&f=id-one&f=id-two&f=id-three",
        );

        const state = SearchParams.parseStateFromUrl();
        expect(state.activeFeatureIds).to.deep.equal([
          "id-one",
          "id-two",
          "id-three",
        ]);
      });

      it("writes activeFeatureIds as repeated f params and bumps schema to 1", () => {
        SearchParams.updateStateInUrl({ activeFeatureIds: ["feat-xyz"] });

        const url = new URL(window.location.href);
        expect(url.searchParams.getAll("f")).to.deep.equal(["feat-xyz"]);
        expect(url.searchParams.get("sv")).to.equal("1");
      });

      it("writes multiple feature ids as repeated f params", () => {
        SearchParams.updateStateInUrl({
          activeFeatureIds: ["id-a", "id-b"],
        });

        const url = new URL(window.location.href);
        expect(url.searchParams.getAll("f")).to.deep.equal(["id-a", "id-b"]);
      });

      it("round-trips feature ids containing commas", () => {
        SearchParams.updateStateInUrl({
          activeFeatureIds: ["Washington, DC", "id-b"],
        });

        const state = SearchParams.parseStateFromUrl();
        expect(state.activeFeatureIds).to.deep.equal([
          "Washington, DC",
          "id-b",
        ]);
      });

      it("omits f param when activeFeatureIds is empty", () => {
        SearchParams.updateStateInUrl({
          openPanel: "viewfinder",
          activeFeatureIds: [],
        });

        const url = new URL(window.location.href);
        expect(url.searchParams.has("f")).to.equal(false);
      });

      it("clears f param via clearStateInUrl", () => {
        window.history.replaceState(
          null,
          "",
          "?sv=1&f=feature-abc-123&op=viewfinder",
        );

        SearchParams.clearStateInUrl();

        const url = new URL(window.location.href);
        expect(url.searchParams.has("f")).to.equal(false);
        expect(url.searchParams.has("op")).to.equal(false);
      });

      it("preserves unrelated params when writing activeFeatureIds", () => {
        window.history.replaceState(null, "", "?unrelated=keep");

        SearchParams.updateStateInUrl({ activeFeatureIds: ["feat-1"] });

        const url = new URL(window.location.href);
        expect(url.searchParams.get("unrelated")).to.equal("keep");
        expect(url.searchParams.getAll("f")).to.deep.equal(["feat-1"]);
      });

      it("round-trips activeFeatureIds through updateStateInUrl and parseStateFromUrl", () => {
        SearchParams.updateStateInUrl({
          activeFeatureIds: ["uuid-1", "uuid-2"],
        });

        const state = SearchParams.parseStateFromUrl();
        expect(state.activeFeatureIds).to.deep.equal(["uuid-1", "uuid-2"]);
      });
    });
  });
});
