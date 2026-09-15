define(["jquery", "common/EMLUtilities"], ($, EMLUtilities) => {
  const expect = chai.expect;

  describe("EMLUtilities", () => {
    describe("markRootDataPackageChanged", () => {
      let originalMetacatUI;

      beforeEach(() => {
        originalMetacatUI = globalThis.MetacatUI;
      });

      afterEach(() => {
        globalThis.MetacatUI = originalMetacatUI;
      });

      it("records a metadata change on the active root package", () => {
        const recordUserEdit = sinon.spy();
        const isEditLocked = sinon.stub().returns(false);
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage: {
            isEditLocked,
            recordUserEdit,
          },
        };

        EMLUtilities.markRootDataPackageChanged();

        sinon.assert.calledOnce(isEditLocked);
        sinon.assert.calledOnceWithExactly(
          recordUserEdit,
          "metadata:changed",
          {},
        );
      });

      it("skips dirty tracking while the active package is edit-locked", () => {
        const recordUserEdit = sinon.spy();
        const isEditLocked = sinon.stub().returns(true);
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage: {
            isEditLocked,
            recordUserEdit,
          },
        };

        EMLUtilities.markRootDataPackageChanged();

        sinon.assert.calledOnce(isEditLocked);
        sinon.assert.notCalled(recordUserEdit);
      });
    });

    describe("cleanXMLText", () => {
      it("escapes tag-like text and removes XML-invalid controls", () => {
        expect(
          EMLUtilities.cleanXMLText("  first <tag>\nsecond\u0001  "),
        ).to.equal("first &lt;tag&gt;\nsecond");
      });

      it("preserves valid XML Unicode beyond the BMP", () => {
        const text = "sensor’s • ° 𐐷 😀 􀀀 bad\u0001";

        expect(EMLUtilities.cleanXMLText(text)).to.equal(
          "sensor’s • ° 𐐷 😀 􀀀 bad",
        );
      });

      it("leaves non-string values unchanged", () => {
        const value = { text: "<tag>" };

        expect(EMLUtilities.cleanXMLText(value)).to.equal(value);
        expect(EMLUtilities.cleanXMLText(null)).to.equal(null);
      });

      it("stays XML-safe when legacy jQuery HTML parsing serializes EML text", () => {
        // Escaping/Unicode handling is covered above; this guards the distinct
        // regression: cleaned text survives the real jQuery append + serialize
        // path as valid XML, without the tag-like text becoming a real element.
        const cleaned = EMLUtilities.cleanXMLText("Tom & Jerry <cartoon>");
        const objectDOM = document.createElement("abstract");
        $(objectDOM).append(`<para>${cleaned}</para>`);

        const parsed = new DOMParser().parseFromString(
          objectDOM.outerHTML,
          "application/xml",
        );

        expect(parsed.querySelector("parsererror")).to.equal(null);
        expect(parsed.querySelector("cartoon")).to.equal(null);
      });
    });
  });
});
