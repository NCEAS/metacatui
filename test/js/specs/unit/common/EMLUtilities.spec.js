define(["jquery", "common/EMLUtilities"], ($, EMLUtilities) => {
  const expect = chai.expect;

  describe("EMLUtilities", () => {
    describe("isDateFormatValid", () => {
      it("accepts years with four digits and valid calendar dates", () => {
        [
          "2024",
          "0001",
          "2024-02-29",
          "2000-02-29",
          "2024-04-30",
          "2024-12-31",
        ].forEach((date) => {
          expect(EMLUtilities.isDateFormatValid(date), date).to.equal(true);
        });
      });

      it("rejects malformed dates and days outside the month", () => {
        [
          "",
          "abcd",
          "2024-aa-01",
          "2024-01-aa",
          "2024-1-01",
          "2024-01-1",
          " 2024",
          "2023-02-29",
          "1900-02-29",
          "2024-02-30",
          "2024-04-31",
          "2024-00-01",
          "2024-13-01",
          "2024-01-00",
          "2024-01-32",
        ].forEach((date) => {
          expect(EMLUtilities.isDateFormatValid(date), date).to.equal(false);
        });
      });
    });

    describe("parseTime", () => {
      it("parses EML time examples and preserves an unspecified time zone", () => {
        const cases = [
          ["08:31:22Z", 30682, 0],
          ["14:06:09-08:00", 50769, -28800],
          ["13:20:00+05:30", 48000, 19800],
          ["13:20:00", 48000, null],
          ["13:20:00+00:00", 48000, 0],
          ["13:20:00-00:00", 48000, -0],
        ];
        cases.forEach(([time, seconds, offset]) => {
          expect(EMLUtilities.parseTime(time), time).to.deep.equal({
            seconds,
            fraction: "",
            offset,
          });
        });
      });

      it("retains fractional digits without floating-point rounding", () => {
        expect(
          EMLUtilities.parseTime("23:15:00.0010000000000000001-01:00"),
        ).to.deep.equal({
          seconds: 83700,
          fraction: "0010000000000000001",
          offset: -3600,
        });
      });

      it("accepts end-of-day midnight and the maximum time zone offsets", () => {
        expect(EMLUtilities.parseTime("24:00:00.000+14:00")).to.deep.equal({
          seconds: 86400,
          fraction: "000",
          offset: 50400,
        });
        expect(EMLUtilities.parseTime("00:00:00-14:00")).to.deep.equal({
          seconds: 0,
          fraction: "",
          offset: -50400,
        });
      });

      it("allows surrounding whitespace", () => {
        [" \t08:31:22Z\r\n", "\u00a008:31:22Z\u2028"].forEach((time) => {
          expect(EMLUtilities.parseTime(time), time).to.deep.equal({
            seconds: 30682,
            fraction: "",
            offset: 0,
          });
        });
      });

      it("rejects values outside the XML Schema time syntax and ranges", () => {
        [
          "",
          "08:31",
          "8:31:22",
          "08:31:22.Z",
          "08:31:22z",
          "08:31:22+0800",
          "08:31:22+14:01",
          "08:31:22-15:00",
          "08:31:22+01:60",
          "25:00:00",
          "24:01:00",
          "24:00:01",
          "24:00:00.001",
          "08:60:00",
          "08:31:60",
          "08:3x:00",
          "08:31:22 Z",
          "08:31:22Zextra",
        ].forEach((time) => {
          expect(EMLUtilities.parseTime(time), time).to.equal(null);
        });
      });
    });

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
