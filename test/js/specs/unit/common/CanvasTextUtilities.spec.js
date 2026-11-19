"use strict";

define(["common/CanvasTextUtilities"], (CanvasTextUtilities) => {
  const { expect } = chai;

  describe("CanvasTextUtilities Test Suite", () => {
    describe("wrapText", () => {
      const m = (text) => text.length;

      it("breaks at spaces", () => {
        expect(CanvasTextUtilities.wrapText("aaa bbb ccc", 7, m)).to.deep.equal(
          ["aaa bbb", "ccc"],
        );
      });

      it("breaks words that are too long", () => {
        expect(CanvasTextUtilities.wrapText("abcdefgh", 3, m)).to.deep.equal([
          "abc",
          "def",
          "gh",
        ]);
      });

      it("returns one empty line for empty text", () => {
        expect(CanvasTextUtilities.wrapText("", 10, m)).to.deep.equal([""]);
        expect(CanvasTextUtilities.wrapText(null, 10, m)).to.deep.equal([""]);
      });
    });

    describe("createMeasurer", () => {
      it("sets the font on the context before measuring", () => {
        const ctx = {
          font: "",
          measureText() {
            return { width: this.font.length };
          },
        };
        const measure = CanvasTextUtilities.createMeasurer(ctx, "Foo");
        measure("x", 12, true);
        expect(ctx.font).to.equal("bold 12px Foo");
      });
    });
  });
});
