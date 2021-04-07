"use strict";

define([
  "chai",
  "chai-jquery",
  "chai-backbone",
  "../../../../src/js/common/EntityUtils",
], function (chai, chaiJquery, chaiBackbone, EntityUtils) {
  var expect = chai.expect;

  chai.use(chaiJquery);
  chai.use(chaiBackbone);

  describe("EntityUtilsTestSuite", function () {
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
        expect(parse("\"a\",\"b\"\n1,2\n")).to.deep.equal(["a", "b"]);
      });

      it("should handle a mix of unquoted and quoted", function () {
        expect(parse("a,\"b\"\n1,2\n")).to.deep.equal(["a", "b"]);
      });
    });
  });
});
