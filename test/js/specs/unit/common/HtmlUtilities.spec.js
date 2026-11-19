"use strict";

define(["common/HtmlUtilities"], (HtmlUtilities) => {
  const { expect } = chai;
  const { htmlToText } = HtmlUtilities;

  describe("HtmlUtilities Test Suite", () => {
    describe("htmlToText", () => {
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
});
