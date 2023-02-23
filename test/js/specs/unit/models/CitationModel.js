require([
  "../../../../../../../../src/js/models/CitationModel",
  "../../../../../../../../src/js/collections/Citations",
], function (Citation, Citations) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;
  let citation;
  let cmParsed;

  describe("Citation Model Test Suite", function () {
    beforeEach(function () {
      citation = new Citation();
    });

    afterEach(function () {
      citation = undefined;
    });

    it("should create a Citation model", function () {
      citation.should.be.instanceof(Citation);
    });

    describe("Names to CSL JSON", function () {
      it("should convert author strings to CSL JSON", function () {
        citation.nameStrToCSLJSON("Caitlin A. Meadows").should.deep.equal({
          family: "Meadows",
          given: "Caitlin A",
        });
      });

      it("should handle non-dropping particles", function () {
        citation.nameStrToCSLJSON("Ada A. de la Meadows").should.deep.equal({
          family: "Meadows",
          given: "Ada A",
          "non-dropping-particle": "de la",
        });
      });

      it("should handle one-word literals", function () {
        citation.nameStrToCSLJSON("NCEAS").should.deep.equal({
          literal: "NCEAS",
        });
      });
    });

    describe("Parsing Metrics Service Response", function () {
      beforeEach(function () {
        cmParsed = citation.parse({
          citationMetadata: {
            "10.18739/A2KK94B8Q": {
              origin: ["Jacqueline M. Grebmeier", "Lee W. Cooper"],
              title: "Benthic macroinfaunal samples ...",
              datePublished: "2018-03-15T00:00:00Z",
              dateUploaded: "2019-10-04T17:47:20.736Z",
              dateModified: "2020-07-23T21:22:04.959Z",
            },
          },
        });
      });

      afterEach(function () {
        cmParsed = undefined;
      });

      it("should remove curly braces from the journal", function () {
        const parsed = citation.parse({
          journal: "Deep Sea Research Part {II}",
        });
        parsed.journal.should.equal("Deep Sea Research Part II");
      });

      it("should convert citation metadata to a Citations collection", function () {
        cmParsed.citationMetadata.type.should.equal("Citations");
      });

      it("should get the year from the citation metadata", function () {
        const year =
          cmParsed.citationMetadata.models[0].get("year_of_publishing");
        year.should.equal(2018);
      });
    });
  });
});
