define([
  "../../../../../../../../src/js/collections/metadata/eml/EMLMissingValueCodes",
], function (EMLMissingValueCodes) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLMissingValueCodes Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.emlMissingValueCodes = new EMLMissingValueCodes();
    });

    /* Tear down */
    afterEach(function () {
      delete this.emlMissingValueCodes;
    });

    describe("Initialization", function () {
      it("should create a EMLMissingValueCodes instance", function () {
        new EMLMissingValueCodes().should.be.instanceof(EMLMissingValueCodes);
      });
    });

    describe("Parsing", function () {
      it("should parse an EMLMissingValueCodes from XML", function () {
        var xmlString = `<missingValueCode>
            <code>9999</code>
            <codeExplanation>Sensor down</codeExplanation>
          </missingValueCode>
          <missingValueCode>
            <code>9998</code>
            <codeExplanation>Technician error</codeExplanation>
          </missingValueCode>`;

        this.emlMissingValueCodes.parse(xmlString);

        this.emlMissingValueCodes.length.should.equal(2);
        this.emlMissingValueCodes.at(0).get("code").should.equal("9999");
        this.emlMissingValueCodes
          .at(0)
          .get("codeExplanation")
          .should.equal("Sensor down");
        this.emlMissingValueCodes.at(1).get("code").should.equal("9998");
        this.emlMissingValueCodes
          .at(1)
          .get("codeExplanation")
          .should.equal("Technician error");
        
      });
    });

    describe("Validation", function () {
      it("should validate valid EMLMissingValueCodes", function () {
        this.emlMissingValueCodes.add({
          code: "9999",
          codeExplanation: "Sensor down",
        })
        var errors = this.emlMissingValueCodes.validate();

        expect(errors).to.be.null;
      });

      it("should validate invalid EMLMissingValueCodes", function () {
        
        this.emlMissingValueCodes.add({
          code: "",
          codeExplanation: "Sensor down",
        })

        var errors = this.emlMissingValueCodes.validate();

        errors.should.be.an("object");
        errors.should.have.property("missingValueCode");
        errors.missingValueCode.should.be.a("string");

      });
    });

  });
});
