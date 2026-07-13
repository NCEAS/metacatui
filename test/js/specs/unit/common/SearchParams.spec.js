define(["common/SearchParams"], (SearchParams) => {
  const expect = chai.expect;
  const sandbox = sinon.createSandbox();
  const stub = sandbox.stub;

  describe("SearchParams Test Suite", () => {
    beforeEach(() => {
      SearchParams.clearStateInUrl();
    });

    afterEach(() => {
      sandbox.restore();

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
          openPanel: SearchParams.OPEN_PANEL_VALUES.viewfinder,
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
  });
});
