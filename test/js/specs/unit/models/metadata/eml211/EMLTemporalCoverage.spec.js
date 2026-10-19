define([
  "../../../../../../../../src/js/models/metadata/eml211/EMLTemporalCoverage",
], function (EMLTemporalCoverage) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLTemporalCoverage Test Suite", function () {
    describe("parsing", function () {
      it("should correctly parse a range of dates", function () {
        var m = new EMLTemporalCoverage({
          objectDOM: $(
            "<temporalcoverage><rangeofdates><begindate><calendardate>2015</calendardate><time>2000</time></begindate><endDate><calendardate>2016</calendardate></endDate></rangeofdates></temporalcoverage>",
          ).get(0),
        });

        expect(m.get("beginDate")).to.equal("2015");
        expect(m.get("beginTime")).to.equal("2000");
        expect(m.get("endDate")).to.equal("2016");
        should.not.exist(m.get("time"));
      });

      it("should correctly parse a single date time", function () {
        var m = new EMLTemporalCoverage({
          objectDOM: $(
            "<temporalcoverage><singledatetime><calendarDate>2015</calendarDate></singledatetime></temporalcoverage>",
          ).get(0),
        });

        expect(m.get("beginDate")).to.equal("2015");
      });
    });

    describe("serializing", function () {
      it("should serialize a singleDateTime when endDate is not set on rangeOfDates", function () {
        var m = new EMLTemporalCoverage({
          objectDOM: $(
            "<temporalcoverage><rangeofdates><begindate><calendardate>2015</calendardate></begindate></rangeofdates></temporalcoverage>",
          ).get(0),
        });

        expect(m.serialize()).to.equal(
          "<temporalCoverage><singleDateTime><calendarDate>2015</calendarDate></singleDateTime></temporalCoverage>",
        );
      });

      it("should not serialize beginTime if beginDate is null", function () {
        var m = new EMLTemporalCoverage({});
        m.set("beginTime", "12345", { silent: true });

        expect(m.serialize()).to.equal("");
      });

      it("should be invalid when all fields are null", function () {
        expect(new EMLTemporalCoverage().isValid()).to.equal(false);
      });

      it("requires a begin date even when the other fields are filled", function () {
        var m = new EMLTemporalCoverage({
          beginTime: "11:00:00",
          endDate: "2020-01-01",
          endTime: "12:00:00",
        });
        expect(m.isValid()).to.equal(false);
        expect(m.validationError.beginDate).to.be.a("string");
      });
    });

    it("reports a validation error on an invalid date field", function () {
      var m = new EMLTemporalCoverage({ beginDate: "abcd" });
      expect(m.isValid()).to.equal(false);
      expect(m.validationError.beginDate).to.be.a("string");
    });

    describe("validating times", function () {
      it("reports format guidance on an invalid time field", function () {
        var m = new EMLTemporalCoverage({
          beginDate: "2020-01-01",
          beginTime: "11:3x:00+02:00",
        });

        expect(m.isValid()).to.equal(false);
        expect(m.validationError.beginTime).to.equal(
          "Enter a time like 12:44:55 or 12:44:55.34. You can add Z for UTC or a time zone offset, such as +02:00 or -08:00.",
        );
      });

      it("should order times on the same day by their UTC time", function () {
        var range = function (beginTime, endTime) {
          var m = new EMLTemporalCoverage();
          m.set({
            beginDate: "2020-01-01",
            endDate: "2020-01-01",
            beginTime: beginTime,
            endTime: endTime,
          });
          return m.isValid();
        };
        expect(range("11:50:00+02:00", "11:00:00+01:00")).to.equal(true);
        expect(range("11:00:00+01:00", "11:50:00+02:00")).to.equal(false);
        expect(range("11:50:00.1Z", "11:50:00.12Z")).to.equal(true);
        expect(range("11:50:00.12Z", "11:50:00.1Z")).to.equal(false);
        expect(range("11:50:00.1Z", "11:50:00.12")).to.equal(true);
        expect(range("11:50:00.12", "11:50:00.1Z")).to.equal(false);
        expect(range("11:00:00", "12:00:00")).to.equal(true);
        expect(range("12:00:00", "11:00:00")).to.equal(false);
      });

      it("rejects a reversed UTC range whose local dates increase", function () {
        var m = new EMLTemporalCoverage({
          beginDate: "2020-01-01",
          beginTime: "23:30:00-01:00",
          endDate: "2020-01-02",
          endTime: "00:15:00Z",
        });

        expect(m.isValid()).to.equal(false);
      });

      it("accepts a UTC range whose local dates decrease", function () {
        var m = new EMLTemporalCoverage({
          beginDate: "2020-01-02",
          beginTime: "00:15:00Z",
          endDate: "2020-01-01",
          endTime: "23:30:00-01:00",
        });

        expect(m.isValid()).to.equal(true);
      });

      it("accepts equal fractional timestamps across date boundaries", function () {
        ["00:15:00.001Z", "00:15:00.0010Z"].forEach(function (endTime) {
          var m = new EMLTemporalCoverage({
            beginDate: "2020-01-01",
            beginTime: "23:15:00.001-01:00",
            endDate: "2020-01-02",
            endTime: endTime,
          });

          expect(m.isValid(), endTime).to.equal(true);
        });
      });

      it("parses a time with an offset and trims whitespace when saving it", function () {
        var m = new EMLTemporalCoverage({
          objectDOM: $(
            "<temporalcoverage><singledatetime><calendardate>2020</calendardate><time>\u00a011:50:00-09:00\u2028</time></singledatetime></temporalcoverage>",
          ).get(0),
        });

        expect(m.get("beginTime")).to.equal("\u00a011:50:00-09:00\u2028");
        expect(m.validateTimeFormat(m.get("beginTime"))).to.equal(true);
        expect(m.isValid()).to.equal(true);
        expect($(m.serialize()).find("time").text()).to.equal("11:50:00-09:00");
      });
    });
  });
});
