define(["../../../../../../../../src/js/models/DataONEObject"], function (
  DataONEObject,
) {
  var should = chai.should();
  var expect = chai.expect;

  describe("DataONEObject Test Suite", function () {
    let dataONEObject;

    beforeEach(function () {
      dataONEObject = new DataONEObject();
    });

    afterEach(function () {
      dataONEObject = undefined;
    });

    describe("getFormat function", function () {
      it("should return the human-readable format when formatId is in the formatMap", function () {
        // Mock data
        const formatId = "application/pdf";
        const expectedFormat = "PDF";

        // Set mock data
        dataONEObject.set("formatId", formatId);

        const result = dataONEObject.getFormat();
        expect(result).to.equal(expectedFormat);
      });

      it("should return formatId when formatId is not in the formatMap", function () {
        // Mock data
        const formatId = "unknownFormatId";

        // Set mock data
        dataONEObject.set("formatId", formatId);

        const result = dataONEObject.getFormat();
        expect(result).to.equal(formatId);
      });
    });
  });
});
