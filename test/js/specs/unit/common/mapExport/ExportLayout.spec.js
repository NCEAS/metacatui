"use strict";

define([
  "common/mapExport/ExportLayout",
  "common/mapExport/scaleBar",
  "common/mapExport/htmlText",
], (ExportLayout, ScaleBar, htmlToText) => {
  const { expect } = chai;

  // Every character is half as wide as the font size is tall.
  const measure = (text, fontPx = 10) => text.length * fontPx * 0.5;

  const makeEntry = (i, categories = 3) => ({
    layerId: `layer-${i}`,
    name: `Layer number ${i}`,
    type: "categorical",
    categories: Array.from({ length: categories }, (_, c) => ({
      label: `Category ${c}`,
      css: "rgb(10, 20, 30)",
    })),
  });

  describe("ExportLayout Test Suite", () => {
    describe("computeFrameRect", () => {
      it("starts to the right of the sidebar", () => {
        const frame = ExportLayout.computeFrameRect(
          { left: 50, right: 450 },
          { left: 50, top: 0, width: 1000, height: 600 },
          10,
        );
        expect(frame).to.deep.equal({
          left: 410,
          top: 10,
          width: 580,
          height: 580,
        });
      });

      it("uses the whole container when there is no sidebar", () => {
        const frame = ExportLayout.computeFrameRect(
          null,
          { left: 0, top: 0, width: 800, height: 400 },
          10,
        );
        expect(frame).to.deep.equal({
          left: 10,
          top: 10,
          width: 780,
          height: 380,
        });
      });

      it("never returns a negative size", () => {
        const frame = ExportLayout.computeFrameRect(
          { left: 0, right: 900 },
          { left: 0, top: 0, width: 800, height: 5 },
          10,
        );
        expect(frame.width).to.equal(0);
        expect(frame.height).to.equal(0);
      });
    });

    describe("computeResolutionScale", () => {
      const base = {
        desired: 2,
        baseRatio: 1,
        container: { width: 1000, height: 500 },
        frame: { width: 600, height: 400 },
      };

      it("uses the desired factor when nothing limits it", () => {
        const result = ExportLayout.computeResolutionScale(base);
        expect(result.scale).to.equal(2);
        expect(result.reduced).to.equal(false);
        expect(result.outputWidth).to.equal(1200);
        expect(result.outputHeight).to.equal(800);
      });

      it("includes the bands below the frame in the output height", () => {
        const result = ExportLayout.computeResolutionScale({
          ...base,
          extraHeight: 100,
        });
        expect(result.outputHeight).to.equal(1000);
      });

      it("is limited by the GPU's maximum viewport", () => {
        const result = ExportLayout.computeResolutionScale({
          ...base,
          limits: { maxViewportWidth: 1500, maxViewportHeight: 1500 },
        });
        expect(result.scale).to.equal(1.5);
        expect(result.reduced).to.equal(true);
      });

      it("is limited by the maximum number of pixels", () => {
        const result = ExportLayout.computeResolutionScale({
          ...base,
          maxPixels: 1e6,
        });
        expect(result.scale).to.be.below(2);
        expect(result.outputWidth * result.outputHeight).to.be.at.most(1e6);
        expect(result.reduced).to.equal(true);
      });
    });

    describe("computeCrop", () => {
      it("maps the frame to the enlarged canvas", () => {
        const crop = ExportLayout.computeCrop({
          frame: { left: 100, top: 10, width: 500, height: 300 },
          container: { width: 800, height: 400 },
          canvas: { width: 1600, height: 800 },
        });
        expect(crop).to.deep.equal({ sx: 200, sy: 20, sw: 1000, sh: 600 });
      });

      it("stays inside the canvas", () => {
        const crop = ExportLayout.computeCrop({
          frame: { left: 100, top: 10, width: 800, height: 500 },
          container: { width: 800, height: 400 },
          canvas: { width: 800, height: 400 },
        });
        expect(crop.sx + crop.sw).to.be.at.most(800);
        expect(crop.sy + crop.sh).to.be.at.most(400);
      });
    });

    describe("wrapText", () => {
      const m = (text) => text.length;

      it("breaks at spaces", () => {
        expect(ExportLayout.wrapText("aaa bbb ccc", 7, m)).to.deep.equal([
          "aaa bbb",
          "ccc",
        ]);
      });

      it("breaks words that are too long", () => {
        expect(ExportLayout.wrapText("abcdefgh", 3, m)).to.deep.equal([
          "abc",
          "def",
          "gh",
        ]);
      });

      it("returns one empty line for empty text", () => {
        expect(ExportLayout.wrapText("", 10, m)).to.deep.equal([""]);
        expect(ExportLayout.wrapText(null, 10, m)).to.deep.equal([""]);
      });
    });

    describe("compute", () => {
      const frame = { width: 800, height: 500 };

      it("puts the legend in the lower left of the frame", () => {
        const layout = ExportLayout.compute({
          frame,
          entries: [makeEntry(1)],
          citations: [],
          measure,
        });
        expect(layout.legend).to.not.equal(null);
        expect(layout.legend.x).to.be.at.least(0);
        expect(layout.legend.y + layout.legend.layout.height).to.be.below(
          frame.height,
        );
        expect(layout.overflowCount).to.equal(0);
        expect(layout.overflowBand).to.equal(null);
        expect(layout.citationsBand).to.equal(null);
        expect(layout.extraHeight).to.equal(0);
      });

      it("has no legend when there are no entries", () => {
        const layout = ExportLayout.compute({
          frame,
          entries: [],
          citations: [],
          measure,
        });
        expect(layout.legend).to.equal(null);
      });

      it("moves layers that do not fit to a band below the frame", () => {
        const entries = Array.from({ length: 30 }, (_, i) => makeEntry(i, 6));
        const layout = ExportLayout.compute({
          frame: { width: 600, height: 250 },
          entries,
          citations: [],
          measure,
        });
        expect(layout.overflowCount).to.be.above(0);
        expect(layout.overflowBand).to.not.equal(null);
        expect(layout.extraHeight).to.equal(layout.overflowBand.height);
        expect(layout.legend.layout.height).to.be.at.most(250);
      });

      it("adds the citations below everything else", () => {
        const layout = ExportLayout.compute({
          frame,
          entries: [makeEntry(1)],
          citations: ["Layer A: Source A", "Layer B: Source B"],
          measure,
        });
        expect(layout.citationsBand).to.not.equal(null);
        expect(layout.citationsBand.y).to.equal(frame.height);
        expect(layout.extraHeight).to.equal(layout.citationsBand.height);
      });
    });

    describe("placeScaleBar and placeNorthArrow", () => {
      const frame = { width: 800, height: 500 };

      it("places the scale bar in the lower right", () => {
        const choice = { meters: 1000, widthPx: 100, label: "1 km" };
        const bar = ExportLayout.placeScaleBar({ frame, choice, measure });
        expect(bar.label).to.equal("1 km");
        expect(bar.x + bar.width).to.be.at.most(frame.width);
        expect(bar.y + bar.height).to.be.at.most(frame.height);
        expect(bar.x).to.be.above(frame.width / 2);
        expect(bar.y).to.be.above(frame.height / 2);
      });

      it("returns no scale bar when the scale is unknown", () => {
        expect(ExportLayout.placeScaleBar({ frame, choice: null, measure })).to
          .be.null;
      });

      it("places the north arrow even without a scale bar", () => {
        const arrow = ExportLayout.placeNorthArrow({ frame, scaleBar: null });
        expect(arrow).to.be.an("object");
      });
    });
  });

  describe("scaleBar Test Suite", () => {
    it("chooses the longest distance that fits", () => {
      const choice = ScaleBar.chooseScaleBar(10, 150);
      // 10 m per pixel: 1 km is 100 px, 2 km is 200 px.
      expect(choice.meters).to.equal(1000);
      expect(choice.widthPx).to.equal(100);
      expect(choice.label).to.equal("1 km");
    });

    it("returns null when the scale is unknown", () => {
      expect(ScaleBar.chooseScaleBar(null, 150)).to.equal(null);
      expect(ScaleBar.chooseScaleBar(0, 150)).to.equal(null);
      expect(ScaleBar.chooseScaleBar(NaN, 150)).to.equal(null);
    });

    it("formats distances", () => {
      expect(ScaleBar.formatDistance(50000)).to.equal("50 km");
      expect(ScaleBar.formatDistance(200)).to.equal("200 m");
      expect(ScaleBar.formatDistance(0.5)).to.equal("50 cm");
    });
  });

  describe("htmlToText Test Suite", () => {
    it("removes tags and collapses whitespace", () => {
      expect(htmlToText("<b>Land</b>   <i>cover</i>\n(2020)")).to.equal(
        "Land cover (2020)",
      );
    });

    it("decodes entities", () => {
      expect(htmlToText("A &amp; B")).to.equal("A & B");
    });

    it("does not run scripts or load images", () => {
      window.mapExportXss = false;
      htmlToText('<img src="x" onerror="window.mapExportXss = true">');
      const result = window.mapExportXss;
      delete window.mapExportXss;
      expect(result).to.equal(false);
    });

    it("returns an empty string for missing values", () => {
      expect(htmlToText(null)).to.equal("");
      expect(htmlToText(undefined)).to.equal("");
    });
  });
});
