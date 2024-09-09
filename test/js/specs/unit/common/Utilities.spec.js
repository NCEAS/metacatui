define(["../../../../../../src/js/common/Utilities"], function (EntityUtils) {
  var expect = chai.expect;

  describe("EntityUtils", function () {
    describe("tryParseCSVHeader", function () {
      var parse = EntityUtils.tryParseCSVHeader;

      it("should handle various newlines", function () {
        expect(parse("a,b\n1,2\n")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n1,2")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n1,2\n")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n1,2")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n\n1,2\n\n")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n\n1,2")).to.deep.equal(["a", "b"]);
      });

      it("should handle single quotes", function () {
        expect(parse("'a','b'\n1,2\n")).to.deep.equal(["a", "b"]);
      });

      it("should handle double quotes", function () {
        expect(parse('"a","b"\n1,2\n')).to.deep.equal(["a", "b"]);
      });

      it("should handle a mix of unquoted and quoted", function () {
        expect(parse('a,"b"\n1,2\n')).to.deep.equal(["a", "b"]);
      });
    });

    describe("formatNumber", () => {
      it("rounds number if the range is between 0.0001 and 100000", () => {
        expect(EntityUtils.formatNumber(0.000099999, 0.0001)).to.equal(
          "0.00010",
        );
        expect(EntityUtils.formatNumber(1.9, 100000)).to.equal("2");
      });

      it("uses scientific notation if the range is outside of 0.0001 and 100000", () => {
        expect(EntityUtils.formatNumber(0.000099999, 0.000099999)).to.equal(
          "1.00e-4",
        );
        expect(EntityUtils.formatNumber(1.9, 100001)).to.equal("1.90e+0");
      });

      it("returns empty string if input value isn't a number", () => {
        expect(EntityUtils.formatNumber("1.0", 0.000099999)).to.equal("");
      });

      it("returns value as is if range isn't a number", () => {
        expect(EntityUtils.formatNumber(1.9, "invalid range")).to.equal("1.9");
      });
    });
  });

  describe("Converting bytes to human-readable size", function () {
    it("should handle undefined bytes", function () {
      const result = EntityUtils.bytesToSize(undefined, 2);
      expect(result).to.equal("0 B");
    });

    it("should handle bytes less than 1 KiB", function () {
      const result = EntityUtils.bytesToSize(512, 2);
      expect(result).to.equal("512 B");
    });

    it("should convert bytes to KiB with precision", function () {
      const result = EntityUtils.bytesToSize(2048, 2);
      expect(result).to.equal("2.00 KiB");
    });

    it("should convert bytes to MiB with precision", function () {
      const result = EntityUtils.bytesToSize(2 * 1024 * 1024, 3);
      expect(result).to.equal("2.000 MiB");
    });

    it("should convert bytes to GiB with precision", function () {
      const result = EntityUtils.bytesToSize(2 * 1024 * 1024 * 1024, 4);
      expect(result).to.equal("2.0000 GiB");
    });

    it("should convert bytes to TiB with precision", function () {
      const result = EntityUtils.bytesToSize(2 * 1024 * 1024 * 1024 * 1024, 5);
      expect(result).to.equal("2.00000 TiB");
    });

    it("should handle very large bytes", function () {
      const result = EntityUtils.bytesToSize(
        2 * 1024 * 1024 * 1024 * 1024 * 1024,
        2,
      );
      expect(result).to.equal("2048.00 TiB");
    });
  });
});
