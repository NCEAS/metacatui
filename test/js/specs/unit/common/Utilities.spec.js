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
        expect(EntityUtils.formatNumber(0.000099999, 0, 0.0001)).to.equal(
          "0.0001",
        );
        expect(EntityUtils.formatNumber(1.9, 0, 100000)).to.equal("2");
      });

      it("uses scientific notation if the range is outside of 0.0001 and 100000", () => {
        expect(EntityUtils.formatNumber(0.000099999, 0, 0.000099999)).to.equal(
          "1.00e-4",
        );
        expect(EntityUtils.formatNumber(1.9, 0, 100001)).to.equal("1.90e+0");
      });
    });
  });
});
