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

      it("merges extra metadata into validation errors", function () {
        expect(
          ValidationUtilities.createValidationError("fieldA", "Problem", {
            code: "badField",
            severity: "warning",
          }),
        ).to.deep.equal({
          field: "fieldA",
          message: "Problem",
          code: "badField",
          severity: "warning",
        });
      });
    });

    describe("createValidationIssue", function () {
      it("creates structured validation issues with defaults and extras", function () {
        expect(
          ValidationUtilities.createValidationIssue({
            field: "fieldA",
            message: "Problem",
            code: "badField",
            extra: true,
          }),
        ).to.deep.equal({
          field: "fieldA",
          message: "Problem",
          severity: "error",
          code: "badField",
          extra: true,
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

    describe("createValidationReport", function () {
      it("partitions warnings and errors and clones the issue list", function () {
        const issues = [
          { field: "fieldA", message: "Problem A", severity: "error" },
          { field: "fieldB", message: "Problem B", severity: "warning" },
          { field: "fieldC", message: "Problem C" },
        ];

        const report = ValidationUtilities.createValidationReport(issues);

        expect(report.valid).to.equal(false);
        expect(report.issues).to.deep.equal(issues);
        expect(report.issues).to.not.equal(issues);
        expect(report.errors.map((issue) => issue.field)).to.deep.equal([
          "fieldA",
          "fieldC",
        ]);
        expect(report.warnings.map((issue) => issue.field)).to.deep.equal([
          "fieldB",
        ]);
      });
    });

    describe("createValidationException", function () {
      it("attaches cloned validation errors and extra properties to the error", function () {
        const validationErrors = [{ field: "fieldA", message: "Problem A" }];
        const error = ValidationUtilities.createValidationException(
          "Validation failed",
          validationErrors,
          { status: 400 },
        );

        expect(error).to.be.instanceof(Error);
        expect(error.message).to.equal("Validation failed");
        expect(error.status).to.equal(400);
        expect(error.validationErrors).to.deep.equal(validationErrors);
        expect(error.validationErrors).to.not.equal(validationErrors);
        expect(error.validationErrors[0]).to.not.equal(validationErrors[0]);
      });
    });
  });
});
