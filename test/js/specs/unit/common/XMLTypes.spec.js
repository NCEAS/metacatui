define(["common/XMLTypes", "common/DateUtilities"], function (
  XMLTypes,
  DateUtilities,
) {
  var expect = chai.expect;

  describe("XMLTypes", function () {
    it("normalizes, validates, and serializes text values", function () {
      expect(XMLTypes.text.normalize(" hello ")).to.equal("hello");
      expect(
        XMLTypes.text.validate("", {
          field: "title",
          nonEmptyWhenPresent: true,
        }),
      ).to.have.length(1);
      expect(XMLTypes.text.serialize(" hello ")).to.equal("hello");
    });

    it("normalizes, validates, and serializes integer values", function () {
      expect(XMLTypes.integer.normalize("7")).to.equal(7);
      expect(
        XMLTypes.integer.validate("abc", {
          field: "size",
        }),
      ).to.have.length(1);
      expect(XMLTypes.integer.serialize("7")).to.equal("7");
    });

    it("normalizes, validates, and serializes boolean values", function () {
      expect(XMLTypes.boolean.normalize("TRUE")).to.equal(true);
      expect(
        XMLTypes.boolean.validate("maybe", {
          field: "archived",
        }),
      ).to.have.length(1);
      expect(XMLTypes.boolean.serialize(false)).to.equal("false");
    });

    it("normalizes, validates, and serializes date values", function () {
      const normalized = XMLTypes.date.normalize("2025-01-01T00:00:00Z");

      expect(DateUtilities.isValidDate(normalized)).to.equal(true);
      expect(
        XMLTypes.date.validate("not-a-date", {
          field: "dateUploaded",
        }),
      ).to.have.length(1);
      expect(XMLTypes.date.serialize(normalized)).to.contain("2025-01-01");
    });
  });
});
