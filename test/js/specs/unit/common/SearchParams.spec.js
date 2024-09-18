define(["common/SearchParams"], (SearchParams) => {
  const expect = chai.expect;
  const sandbox = sinon.createSandbox();
  const stub = sandbox.stub;

  describe("SearchParams Test Suite", () => {
    beforeEach(() => {
      SearchParams.clearSavedView();
    });

    afterEach(() => {
      sandbox.restore();

      SearchParams.clearSavedView();
    });

    describe("addEnabledLayer", () => {
      it("does nothing if not string", () => {
        SearchParams.addEnabledLayer(123);

        expect(SearchParams.getEnabledLayers()).to.deep.equal([]);
      });

      it("does nothing if the layer id is already in the search param", () => {
        SearchParams.addEnabledLayer("somelayer");
        SearchParams.addEnabledLayer("somelayer");

        expect(SearchParams.getEnabledLayers()).to.deep.equal(["somelayer"]);
      });

      it("adds the layer id to the search param", () => {
        SearchParams.addEnabledLayer("somelayer");

        expect(SearchParams.getEnabledLayers()).to.include.members([
          "somelayer",
        ]);
      });
    });

    describe("clearSavedView", () => {
      it("removes all saved view-related search parameters", () => {
        SearchParams.updateDestination({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });

        SearchParams.clearSavedView();

        expect(SearchParams.getDestination()).to.be.undefined;
      });
    });

    describe("getDestination", () => {
      it("returns undefined if latitude is missing", () => {
        SearchParams.updateDestination({
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });

        expect(SearchParams.getDestination()).to.be.undefined;
      });

      it("returns undefined if longitude is missing", () => {
        SearchParams.updateDestination({
          latitude: 45,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });

        expect(SearchParams.getDestination()).to.be.undefined;
      });

      it("returns undefined if height is missing", () => {
        SearchParams.updateDestination({
          latitude: 45,
          longitude: 135,
          heading: 0,
          pitch: 0,
          roll: 0,
        });

        expect(SearchParams.getDestination()).to.be.undefined;
      });

      it("returns an object with keys and values corresponding to the destination", () => {
        SearchParams.updateDestination({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });

        expect(SearchParams.getDestination()).to.be.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });
      });

      it("returns an object with keys and values corresponding to the destination even without a heading, pitch, or roll", () => {
        SearchParams.updateDestination({
          latitude: 45,
          longitude: 135,
          height: 9999,
        });

        expect(SearchParams.getDestination()).to.be.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
        });
      });
    });

    describe("getEnabledLayers", () => {
      it("returns a list of layers from the enabled layer search param", () => {
        SearchParams.addEnabledLayer("somelayer");
        SearchParams.addEnabledLayer("someotherlayer");

        expect(SearchParams.getEnabledLayers()).to.deep.equal([
          "somelayer",
          "someotherlayer",
        ]);
      });
    });

    describe("removeEnabledLayer", () => {
      it("does nothing if the layer id passed in is not a string", () => {
        SearchParams.addEnabledLayer("somelayer");
        SearchParams.addEnabledLayer("someotherlayer");

        SearchParams.removeEnabledLayer(123);

        expect(SearchParams.getEnabledLayers()).to.deep.equal([
          "somelayer",
          "someotherlayer",
        ]);
      });

      it("does nothing if the layer id passed in is not in the search param", () => {
        SearchParams.addEnabledLayer("somelayer");
        SearchParams.addEnabledLayer("someotherlayer");

        SearchParams.removeEnabledLayer("somediffererntlayer");

        expect(SearchParams.getEnabledLayers()).to.deep.equal([
          "somelayer",
          "someotherlayer",
        ]);
      });

      it("removes a layer id from the enabled layers search param", () => {
        SearchParams.addEnabledLayer("somelayer");
        SearchParams.addEnabledLayer("someotherlayer");

        SearchParams.removeEnabledLayer("somelayer");

        expect(SearchParams.getEnabledLayers()).to.deep.equal([
          "someotherlayer",
        ]);
      });
    });

    describe("updateDestination", () => {
      it("sets all saved view-related search parameters", () => {
        SearchParams.updateDestination({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });

        expect(SearchParams.getDestination()).to.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 0,
          pitch: 0,
          roll: 0,
        });
      });
    });
  });
});
