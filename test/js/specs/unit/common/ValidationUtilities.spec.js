define(["common/ValidationUtilities"], function (ValidationUtilities) {
  var expect = chai.expect;

  describe("ValidationUtilities", function () {
    describe("isValidDOI", function () {
      it("accepts common DOI formats", function () {
        expect(ValidationUtilities.isValidDOI("10.18739/A2CJ87N8D")).to.equal(
          true,
        );
        expect(
          ValidationUtilities.isValidDOI(
            "https://doi.org/10.18739/A2CJ87N8D",
          ),
        ).to.equal(true);
        expect(ValidationUtilities.isValidDOI("doi:10.1234/example")).to.equal(
          true,
        );
      });

      it("rejects non-DOI strings", function () {
        expect(ValidationUtilities.isValidDOI("not-a-doi")).to.equal(false);
        expect(ValidationUtilities.isValidDOI("https://example.org")).to.equal(
          false,
        );
      });
    });

    describe("createValidationError", function () {
      it("creates field/message validation errors", function () {
        expect(
          ValidationUtilities.createValidationError("fieldA", "Problem"),
        ).to.deep.equal({
          field: "fieldA",
          message: "Problem",
        });
      });
    });

    describe("cloneValidationErrors", function () {
      it("clones error arrays without preserving object references", function () {
        const source = [
          { field: "fieldA", message: "Problem A" },
          { field: "fieldB", message: "Problem B" },
        ];
        const cloned = ValidationUtilities.cloneValidationErrors(source);

        expect(cloned).to.deep.equal(source);
        expect(cloned).to.not.equal(source);
        expect(cloned[0]).to.not.equal(source[0]);
      });

      it("returns an empty array for non-array input", function () {
        expect(ValidationUtilities.cloneValidationErrors(null)).to.deep.equal(
          [],
        );
      });
    });
  });
});
