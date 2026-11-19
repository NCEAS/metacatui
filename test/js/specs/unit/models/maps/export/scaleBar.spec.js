"use strict";

define(["models/maps/export/scaleBar"], (ScaleBar) => {
  const { expect } = chai;

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
});
