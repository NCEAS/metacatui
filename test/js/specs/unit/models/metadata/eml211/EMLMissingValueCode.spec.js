define([
  "../../../../../../../../src/js/models/metadata/eml211/EMLMissingValueCode",
], function (EMLMissingValueCode) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLMissingValueCode Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.emlMissingValueCode = new EMLMissingValueCode();
    });

    /* Tear down */
    afterEach(function () {
      delete this.emlMissingValueCode;
    });

    describe("Initialization", function () {
      it("should create a EMLMissingValueCode instance", function () {
        new EMLMissingValueCode().should.be.instanceof(EMLMissingValueCode);
      });
    });

    describe("Parsing", function () {
      it("should parse an EMLMissingValueCode from XML", function () {
        var xmlString =
          "<missingValueCode><code>9999</code><codeExplanation>Missing value</codeExplanation></missingValueCode>";

        var emlMissingValueCode = new EMLMissingValueCode(
          {
            objectDOM: xmlString,
          },
          { parse: true }
        );
        emlMissingValueCode.get("code").should.equal("9999");
        emlMissingValueCode
          .get("codeExplanation")
          .should.equal("Missing value");
      });
    });

    describe("Serializing", function () {
      it("should serialize the EMLMissingValueCode to XML", function () {
        var emlMissingValueCode = new EMLMissingValueCode({
          code: "9999",
          codeExplanation: "Missing value",
        });
        var xmlString = emlMissingValueCode.serialize();
        xmlString.should.be.a("string");
        xmlString.should.equal(
          "<missingValueCode><code>9999</code><codeExplanation>Missing value</codeExplanation></missingValueCode>"
        );
      });
    });

    describe("Validation", function () {
      it("should validate a valid EMLMissingValueCode", function () {
        var emlMissingValueCode = new EMLMissingValueCode({
          code: "9999",
          codeExplanation: "Missing value",
        });
        var errors = emlMissingValueCode.validate();
        expect(errors).to.be.undefined;
      });

      it("should not validate an invalid EMLMissingValueCode", function () {
        var emlMissingValueCode = new EMLMissingValueCode({
          code: "-999",
          codeExplanation: "",
        });
        var errors = emlMissingValueCode.validate();
        expect(errors).to.be.an("object");
        expect(errors.missingValueCode).to.be.a("string");
      });
    });
  });
});
