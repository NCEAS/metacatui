define(["collections/ObjectFormats"], function (ObjectFormats) {
  const { expect } = chai;
  chai.should();

  describe("ObjectFormats", function () {
    it("starts with the built-in DataONE format list", function () {
      const formats = new ObjectFormats();

      formats.length.should.equal(ObjectFormats.FALLBACK_FORMATS.length);
    });

    it("classifies fallback metadata, data, and resource formats", function () {
      const formats = new ObjectFormats();

      formats
        .isMetadata({ formatId: "http://www.loc.gov/METS/" })
        .should.equal(true);
      formats.isData({ formatId: "text/csv" }).should.equal(true);
      formats
        .isResourceMap({
          formatId: "http://www.openarchives.org/ore/terms",
        })
        .should.equal(true);
    });

    it("uses fallback names for static friendly format lookups", function () {
      ObjectFormats.getFriendlyFormat("application/vnd.sqlite3").should.equal(
        "SQLite Database",
      );
    });

    it("matches mediaType fields that differ from formatId", function () {
      const formats = new ObjectFormats();

      formats
        .getFormatId({ mediaType: "text/tab-separated-values" })
        .should.equal("text/tsv");
    });

    it("uses generic format IDs for ambiguous fallback extensions", function () {
      const formats = new ObjectFormats();

      formats.getFormatId({ filename: "photo.jpg" }).should.equal("image/jpeg");
      formats
        .getFormatId({ filename: "metadata.xml" })
        .should.equal("text/xml");
      formats.getFormatType({ filename: "metadata.xml" }).should.equal("DATA");
      formats
        .getFormatId({ filename: "metadata.json" })
        .should.equal("application/json");
    });

    it("matches fallback extensions case-insensitively", function () {
      const formats = new ObjectFormats();

      formats
        .getFormatId({ filename: "script.R" })
        .should.equal("application/R");
      formats
        .getFormatId({ filename: "analysis.Rmd" })
        .should.equal("text/x-rmarkdown");
    });

    it("uses server-provided models instead of adding fallback rows", function () {
      const formats = new ObjectFormats([
        {
          formatId: "custom-format",
          formatName: "Custom Format",
          formatType: "DATA",
        },
      ]);

      formats.length.should.equal(1);
      formats.isData({ formatId: "custom-format" }).should.equal(true);
      formats.isData({ formatId: "text/csv" }).should.equal(false);
    });

    it("can be constructed without fallback rows", function () {
      const formats = new ObjectFormats([], { fallback: false });

      formats.length.should.equal(0);
      expect(formats.getFormatType({ formatId: "text/csv" })).to.equal(null);
    });
  });
});
