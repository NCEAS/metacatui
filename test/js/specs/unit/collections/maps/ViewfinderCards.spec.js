define([
  "collections/maps/viewfinder/ViewfinderCards",
  "/test/js/specs/shared/clean-state.js",
], (ViewfinderCards, cleanState) => {
  const expect = chai.expect;

  describe("ViewfinderCards Test Suite", () => {
    const state = cleanState(() => {
      const mapModel = {
        getAllLayers() {
          return [];
        },
      };

      const collection = new ViewfinderCards([], { mapModel });

      return {
        collection,
      };
    }, beforeEach);

    describe("LEO Network parsing", () => {
      it("maps feature id to map action id and upgrades thumbnail image to resized", () => {
        state.collection.parse({
          url: "https://leonetwork.org/en/lists/geojson/A54B4AEA-21F9-4162-AEB7-AFE930C0D4E4",
          layerIds: ["ls", "ahri", "habitat-buildings", "habitat-roads", "iwp"],
        });

        const features = {
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [-162.96528, 67.57111],
              },
              properties: {
                id: "DF03993D-BF84-4A36-9CE3-99FECAB15A6A",
                localized_date: "2025 Jun 16",
                thumbnail_url:
                  "/en/attachments/thumbnail/533DF1E6-2F16-4E71-AEFA-E883D9DFD7A1",
                observation: {
                  title: "Erosion results in loss of revetment wall",
                  summary:
                    "High water on the Noatak River is accelerating erosion and causing the destruction of a decades-old cement pillow revetment wall in Noatak.",
                },
              },
            },
          ],
        };

        const parsed = state.collection.parse(features);
        expect(parsed).to.have.lengthOf(1);

        const card = parsed[0];
        expect(card.get("title")).to.equal(
          "Erosion results in loss of revetment wall",
        );
        expect(card.get("image")).to.equal(
          "https://leonetwork.org/en/attachments/resized/533DF1E6-2F16-4E71-AEFA-E883D9DFD7A1",
        );
        expect(card.get("imageFallback")).to.equal(
          "https://leonetwork.org/en/attachments/thumbnail/533DF1E6-2F16-4E71-AEFA-E883D9DFD7A1",
        );
        expect(card.get("layerIds")).to.be.undefined;
        expect(card.get("latitude")).to.be.undefined;
        expect(card.get("longitude")).to.be.undefined;

        const buttons = card.get("buttons");
        expect(buttons).to.have.lengthOf(1);
        expect(buttons[0]).to.deep.include({
          id: "DF03993D-BF84-4A36-9CE3-99FECAB15A6A",
          type: "map",
          latitude: 67.57111,
          longitude: -162.96528,
          height: 800,
          label: "View Layers",
          icon: "eye-open",
          ordinality: "secondary",
        });
        expect(buttons[0].layerIds).to.deep.equal([
          "ls",
          "ahri",
          "habitat-buildings",
          "habitat-roads",
          "iwp",
        ]);
      });
    });
  });
});
