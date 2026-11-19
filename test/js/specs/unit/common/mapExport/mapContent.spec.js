"use strict";

define([
  "backbone",
  "common/mapExport/legendEntries",
  "common/mapExport/citations",
], (Backbone, getLegendEntries, getCitations) => {
  const { expect } = chai;

  const makeLayer = (attributes) => ({
    get: (key) => attributes[key],
  });

  const makeMap = (layers) => ({
    getAllLayers: () => layers,
  });

  const makeColor = (label, value, css) => {
    const color = new Backbone.Model({ label, value });
    color.getCss = () => css;
    return color;
  };

  const makePalette = (attributes, colors) => {
    const palette = new Backbone.Model({
      ...attributes,
      colors: new Backbone.Collection(colors),
    });
    return palette;
  };

  describe("mapExport content Test Suite", () => {
    describe("getCitations", () => {
      it("lists the attribution of visible layers only", () => {
        const map = makeMap([
          makeLayer({ visible: true, label: "A", attribution: "Source 1" }),
          makeLayer({ visible: false, label: "B", attribution: "Source 2" }),
        ]);
        expect(getCitations(map)).to.deep.equal([
          { layers: ["A"], text: "Source 1" },
        ]);
      });

      it("groups layers that share an attribution", () => {
        const map = makeMap([
          makeLayer({ visible: true, label: "A", attribution: "Same" }),
          makeLayer({ visible: true, label: "B", attribution: "Same" }),
        ]);
        expect(getCitations(map)).to.deep.equal([
          { layers: ["A", "B"], text: "Same" },
        ]);
      });

      it("converts HTML to text and skips empty attributions", () => {
        const map = makeMap([
          makeLayer({
            visible: true,
            label: "<b>A</b>",
            attribution: '<a href="https://example.com">Example</a> &amp; Co',
          }),
          makeLayer({ visible: true, label: "B", attribution: "" }),
        ]);
        expect(getCitations(map)).to.deep.equal([
          { layers: ["A"], text: "Example & Co" },
        ]);
      });

      it("falls back to the imagery provider's credit", () => {
        const map = makeMap([
          makeLayer({
            visible: true,
            label: "A",
            cesiumModel: { imageryProvider: { credit: { html: "Credit" } } },
          }),
        ]);
        expect(getCitations(map)[0].text).to.equal("Credit");
      });

      it("formats a citation with its layers", () => {
        expect(
          getCitations.formatCitation({ layers: ["A", "B"], text: "Text" }),
        ).to.equal("A, B: Text");
        expect(
          getCitations.formatCitation({ layers: [], text: "Text" }),
        ).to.equal("Text");
      });
    });

    describe("getLegendEntries", () => {
      const categorical = makePalette(
        { paletteType: "categorical", property: "type" },
        [
          makeColor("Forest", "forest", "rgb(0, 100, 0)"),
          makeColor("Water", "water", "rgb(0, 0, 100)"),
        ],
      );

      it("returns an entry for a visible layer with a palette", () => {
        const map = makeMap([
          makeLayer({
            visible: true,
            label: "Land cover",
            layerId: "lc",
            colorPalette: categorical,
          }),
        ]);
        const entries = getLegendEntries(map);
        expect(entries).to.have.lengthOf(1);
        expect(entries[0].layerId).to.equal("lc");
        expect(entries[0].name).to.equal("Land cover (type)");
        expect(entries[0].type).to.equal("categorical");
        expect(entries[0].categories).to.deep.equal([
          { label: "Forest", css: "rgb(0, 100, 0)" },
          { label: "Water", css: "rgb(0, 0, 100)" },
        ]);
      });

      it("skips hidden layers, layers hidden in the legend and layers without a palette", () => {
        const map = makeMap([
          makeLayer({ visible: false, label: "A", colorPalette: categorical }),
          makeLayer({
            visible: true,
            label: "B",
            hideInLegend: true,
            colorPalette: categorical,
          }),
          makeLayer({ visible: true, label: "C" }),
        ]);
        expect(getLegendEntries(map)).to.deep.equal([]);
      });

      it("leaves out categories removed by a filter", () => {
        const filter = new Backbone.Model({
          property: "type",
          filterType: "categorical",
          values: ["water"],
        });
        const map = makeMap([
          makeLayer({
            visible: true,
            label: "Land cover",
            colorPalette: categorical,
            filters: new Backbone.Collection([filter]),
          }),
        ]);
        expect(getLegendEntries(map)[0].categories).to.deep.equal([
          { label: "Water", css: "rgb(0, 0, 100)" },
        ]);
      });

      it("returns the gradient and labels of a continuous palette", () => {
        const palette = makePalette(
          { paletteType: "continuous", property: "depth" },
          [
            makeColor("", 0, "rgb(0, 0, 0)"),
            makeColor("", 100, "rgb(255, 255, 255)"),
          ],
        );
        const map = makeMap([
          makeLayer({ visible: true, label: "Depth", colorPalette: palette }),
        ]);
        const [entry] = getLegendEntries(map);
        expect(entry.type).to.equal("continuous");
        expect(entry.stops).to.deep.equal([
          { offset: 0, css: "rgb(0, 0, 0)" },
          { offset: 1, css: "rgb(255, 255, 255)" },
        ]);
        expect(entry.labels).to.have.lengthOf(3);
      });
    });
  });
});
