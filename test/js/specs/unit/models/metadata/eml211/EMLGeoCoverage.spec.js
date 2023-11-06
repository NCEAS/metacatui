define([
  "../../../../../../../../src/js/models/metadata/eml211/EMLGeoCoverage",
], function (EMLGeoCoverage) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLGeoCoverage Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      let testEML = `<geographicCoverage>
          <geographicDescription>Rhine-Main-Observatory</geographicDescription>
          <boundingCoordinates>
            <westBoundingCoordinate>9.0005</westBoundingCoordinate>
            <eastBoundingCoordinate>9.0005</eastBoundingCoordinate>
            <northBoundingCoordinate>50.1600</northBoundingCoordinate>
            <southBoundingCoordinate>50.1600</southBoundingCoordinate>
          </boundingCoordinates>
        </geographicCoverage>`;
      // remove ALL whitespace
      testEML = testEML.replace(/\s/g, "");
      this.testEML = testEML;
    });

    /* Tear down */
    afterEach(function () {
      delete this.testEML;
    });

    describe("Initialization", function () {
      it("should create a EMLGeoCoverage instance", function () {
        new EMLGeoCoverage().should.be.instanceof(EMLGeoCoverage);
      });
    });

    describe("parse()", function () {
      it("should parse EML", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );

        emlGeoCoverage
          .get("description")
          .should.equal("Rhine-Main-Observatory");
        emlGeoCoverage.get("east").should.equal("9.0005");
        emlGeoCoverage.get("north").should.equal("50.1600");
        emlGeoCoverage.get("south").should.equal("50.1600");
        emlGeoCoverage.get("west").should.equal("9.0005");
      });
    });

    describe("serialize()", function () {
      it("should serialize to XML", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        var xmlString = emlGeoCoverage.serialize();
        xmlString.should.equal(this.testEML);
      });
    });

    describe("validation", function () {
      it("should get the status of the coordinates", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        var status = emlGeoCoverage.getCoordinateStatus();
        status.north.isSet.should.equal(true);
        status.north.isValid.should.equal(true);
        status.east.isSet.should.equal(true);
        status.east.isValid.should.equal(true);
        status.south.isSet.should.equal(true);
        status.south.isValid.should.equal(true);
        status.west.isSet.should.equal(true);
        status.west.isValid.should.equal(true);
      });

      it("should validate the coordinates", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        var status = emlGeoCoverage.getCoordinateStatus();
        const errors = emlGeoCoverage.generateStatusErrors(status);
        expect(errors).to.be.empty;
      });

      it("should give an error if the coordinates are invalid", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        emlGeoCoverage.set("north", "100");
        const errors = emlGeoCoverage.validate();
        const expectedMsg = emlGeoCoverage.errorMessages.north;
        errors.north.should.equal(expectedMsg);
      });

      it("should give an error if the coordinates are missing", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        emlGeoCoverage.set("north", "");
        const errors = emlGeoCoverage.validate();
        const expectedMsg = emlGeoCoverage.errorMessages.missing;
        errors.north.should.equal(expectedMsg);
      });

      it("should give an error if the north and south coordinates are reversed", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        emlGeoCoverage.set("north", "40");
        emlGeoCoverage.set("south", "50");
        const errors = emlGeoCoverage.validate();
        const expectedMsg = emlGeoCoverage.errorMessages.northSouthReversed;
        errors.north.should.equal(expectedMsg);
        errors.south.should.equal(expectedMsg);
      });

      it("should give an error if the bounds cross the anti-meridian", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        emlGeoCoverage.set("west", "170");
        emlGeoCoverage.set("east", "-170");
        const errors = emlGeoCoverage.validate();
        const expectedMsg = emlGeoCoverage.errorMessages.crossesAntiMeridian;
        errors.west.should.equal(expectedMsg);
        errors.east.should.equal(expectedMsg);
      });

      it("should give an error if the bounds contain the north pole", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        emlGeoCoverage.set("north", "90");
        const errors = emlGeoCoverage.validate();
        const expectedMsg = emlGeoCoverage.errorMessages.containsPole;
        errors.north.should.equal(expectedMsg);
      });

      it("should give an error if the bounds contain the south pole", function () {
        var emlGeoCoverage = new EMLGeoCoverage(
          { objectDOM: this.testEML },
          { parse: true }
        );
        emlGeoCoverage.set("south", "-90");
        const errors = emlGeoCoverage.validate();
        const expectedMsg = emlGeoCoverage.errorMessages.containsPole;
        errors.south.should.equal(expectedMsg);
      });
    });
  });
});
