require([
  "../../../../../../../../src/js/models/CitationModel",
  "../../../../../../../../src/js/collections/Citations",
  "../../../../../../../../src/js/models/metadata/eml211/EML211",
  "../../../../../../../../src/js/models/metadata/eml211/EMLParty",
  "../../../../../../../../src/js/models/SolrResult",
], function (Citation, Citations, EML211, EMLParty, SolrResult) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("Citation Model Test Suite", function () {
    let citation;

    beforeEach(function () {
      citation = new Citation();
    });

    afterEach(function () {
      citation = undefined;
    });

    it("should create a Citation model", function () {
      citation.should.be.instanceof(Citation);
    });

    /**
     * Conversion to CSL JSON
     */
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

    /**
     * Parsing Metrics Service Response
     */
    describe("Parsing Metrics Service Response", function () {

      let cmParsed;
      beforeEach(function () {
        cmParsed = citation.parse({
          citationMetadata: {
            "10.18739/A2KK94B8Q": {
              origin: ["FirstName LastName"],
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

      it("should convert the origin to CSL JSON", function () {
        const author =
          cmParsed.citationMetadata.models[0].get("originArray")[0];
        author.should.deep.equal({
          family: "LastName",
          given: "FirstName",
        });
      });

      it("should add the doi prefix to the pid", function () {
        const sourceId = cmParsed.citationMetadata.models[0].get("pid");
        sourceId.should.equal("doi:10.18739/A2KK94B8Q");
      });
    });

    /**
     * Custom set method
     */
    describe("Custom set method", function () {
      it("should format the title string", function () {
        citation.set("title", "Title with period.");
        citation.get("title").should.equal("Title with period");
      });

      it("should convert origin to CSL JSON", function () {
        citation.set("origin", "FirstName LastName");
        citation.get("originArray").should.deep.equal([
          {
            family: "LastName",
            given: "FirstName",
          },
        ]);
      });

      it("should automatically set DOI URLS from DOIs", function () {
        citation.set("pid", "10.18739/A2KK94B8Q");
        citation.set("seriesId", "10.18739/A2KK94B8Q");
        citation
          .get("pid_url")
          .should.equal("https://doi.org/10.18739/A2KK94B8Q");
        citation
          .get("seriesId_url")
          .should.equal("https://doi.org/10.18739/A2KK94B8Q");
      });

      it("should automatically set PIDs and series IDs from DOIs", function () {
        citation.set("pid_url", "https://doi.org/10.18739/A2KK94B8Q");
        citation.set("seriesId_url", "https://doi.org/10.18739/A2KK94B8Q");
        citation.get("pid").should.equal("doi:10.18739/A2KK94B8Q");
        citation.get("seriesId").should.equal("doi:10.18739/A2KK94B8Q");
      });
    });

    /**
     * Populate from EML model
     */
    describe("Populate from EML model", function () {

      let eml;
      beforeEach(function () {
        eml = new EML211({
          title: "Test Title",
          creator: [
            new EMLParty({
              individualName: {
                givenName: "FirstName",
                surName: "LastName",
              },
            }),
          ],
          id: "10.18739/A2KK94B8Q",
          seriesId: "10.18739/A2KK94B8Q",
          pubDate: "2018-03-15T00:00:00Z",
          datasource: "urn:node:ARCTIC"
        });
        citation.setSourceModel(eml);
      });

      afterEach(function () {
        citation.setSourceModel(undefined);
        eml = undefined;
      });

      it("should set the title", function () {
        citation.get("title").should.equal("Test Title");
      });

      it("should set the originArray", function () {
        const csl = citation.get("originArray")[0]
        csl.family.should.equal("LastName");
        csl.given.should.equal("FirstName");
      });

      it("should set the pid", function () {
        citation.get("pid").should.equal("10.18739/A2KK94B8Q");
      });

      it("should set the seriesId", function () {
        citation.get("seriesId").should.equal("10.18739/A2KK94B8Q");
      });

      it("should set the year of publishing", function () {
        citation.get("year_of_publishing").should.equal(2018);
      });

      it("should set the source model", function () {
        citation.get("sourceModel").should.be.instanceof(EML211);
      });

      it("should update the originArray when the EMLParty changes", function () {
        const eml = citation.get("sourceModel");
        const creator = eml.get("creator")[0];
        creator.set("individualName", {
          givenName: "NewFirstName",
          surName: "NewLastName",
        });
        const csl = citation.get("originArray")[0]
        csl.family.should.equal("NewLastName");
        csl.given.should.equal("NewFirstName");
      });
    });

    describe("Populate from SOLR model", function () {
      let solr;
      beforeEach(function () {
        solr = new SolrResult({
          id: "10.18739/A2KK94B8Q",
          title: "Test Title",
          origin: "FirstName LastName",
          pubDate: "2018-03-15T00:00:00Z",
          seriesId: "10.18739/A2KK94B8Q",
          datasource: "urn:node:ARCTIC"
        });
        citation.setSourceModel(solr);
      });

      afterEach(function () {
        citation.setSourceModel(undefined);
        solr = undefined;
      });

      it("should set the title", function () {
        citation.get("title").should.equal("Test Title");
      });

      it("should set the originArray", function () {
        const csl = citation.get("originArray")[0]
        csl.family.should.equal("LastName");
        csl.given.should.equal("FirstName");
      });

      it("should set the pid", function () {
        citation.get("pid").should.equal("10.18739/A2KK94B8Q");
      });

      it("should set the seriesId", function () {
        citation.get("seriesId").should.equal("10.18739/A2KK94B8Q");
      });

      it("should set the year of publishing", function () {
        citation.get("year_of_publishing").should.equal(2018);
      });

      it("should set the source model", function () {
        citation.get("sourceModel").should.be.instanceof(SolrResult);
      });
    });
  });
});
