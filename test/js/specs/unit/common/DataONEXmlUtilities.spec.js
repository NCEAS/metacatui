define(["common/DataONEXmlUtilities"], (DataONEXmlUtilities) => {
  const expect = chai.expect;

  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> READ not allowed </description>
    </error>
  `;
  const ERROR_XML_NO_DESC = `
    <error errorCode="500"></error>
  `;
  const ERROR_XML_NO_CODE = `
    <error><description>Oops</description></error>
  `;
  const XML_NO_ERROR = `
    <identifier>urn:uuid:test.1</identifier>
  `;

  describe("DataONEXmlUtilities", () => {
    describe("parseErrorXml", () => {
      it("returns null for empty input or non-error XML", () => {
        expect(DataONEXmlUtilities.parseErrorXml("")).to.equal(null);
        expect(DataONEXmlUtilities.parseErrorXml(null)).to.equal(null);
        expect(DataONEXmlUtilities.parseErrorXml(XML_NO_ERROR)).to.equal(null);
      });

      it("parses structured error details from DataONE error XML", () => {
        expect(DataONEXmlUtilities.parseErrorXml(ERROR_XML)).to.deep.equal({
          name: "NotAuthorized",
          message: "READ not allowed",
          status: "401",
          detailCode: "1040",
        });
      });

      it("uses fallback values when error fields are missing", () => {
        expect(
          DataONEXmlUtilities.parseErrorXml(ERROR_XML_NO_DESC),
        ).to.deep.equal({
          name: "DataONEError",
          message: "Unknown error",
          status: "500",
          detailCode: null,
        });

        expect(
          DataONEXmlUtilities.parseErrorXml(ERROR_XML_NO_CODE),
        ).to.deep.equal({
          name: "DataONEError",
          message: "Oops",
          status: "unknown",
          detailCode: null,
        });
      });

      it("returns an invalid_xml parse error object for malformed XML", () => {
        const error = DataONEXmlUtilities.parseErrorXml("<error>");

        expect(error.name).to.equal("ParseError");
        expect(error.status).to.equal("invalid_xml");
        expect(error.message).to.match(/failed to parse/i);
      });
    });

    describe("parseXmlStringForRequiredElementText", () => {
      it("returns the extracted value and parsed XML document", () => {
        const result = DataONEXmlUtilities.parseXmlStringForRequiredElementText(
          "<identifier>urn:uuid:test.3</identifier>",
          "identifier",
          "create",
        );

        expect(result.value).to.equal("urn:uuid:test.3");
        expect(result.xml).to.be.instanceof(Document);
      });

      it("throws parsed DataONE service errors", () => {
        let caught = null;

        try {
          DataONEXmlUtilities.parseXmlStringForRequiredElementText(
            ERROR_XML,
            "identifier",
            "reserve",
          );
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("NotAuthorized");
        expect(caught.message).to.equal("READ not allowed");
        expect(caught.status).to.equal("401");
      });
    });

    describe("toPlainError", () => {
      it("serializes Error instances to JSON-safe plain objects", () => {
        const error = new Error("SystemMetadata validation failed");
        error.name = "ValidationError";
        error.status = "400";
        error.detailCode = "1234";
        error.validationErrors = [
          { field: "identifier", message: "identifier is required." },
        ];

        expect(DataONEXmlUtilities.toPlainError(error)).to.deep.equal({
          name: "ValidationError",
          message: "SystemMetadata validation failed",
          status: "400",
          detailCode: "1234",
          validationErrors: [
            { field: "identifier", message: "identifier is required." },
          ],
        });
      });
    });
  });
});
