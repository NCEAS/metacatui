define(["common/DateUtilities"], function (DateUtilities) {
  var expect = chai.expect;

  const pad2 = (value) => String(value).padStart(2, "0");

  describe("DateUtilities", function () {
    describe("isValidDate", function () {
      it("returns true for valid Date instances", function () {
        DateUtilities.isValidDate(new Date()).should.equal(true);
      });

      it("returns false for invalid dates and non-date values", function () {
        DateUtilities.isValidDate(new Date("not-a-date")).should.equal(false);
        DateUtilities.isValidDate("2024-01-01").should.equal(false);
      });
    });

    describe("toDate", function () {
      it("returns null for missing or invalid values", function () {
        expect(DateUtilities.toDate(null)).to.equal(null);
        expect(DateUtilities.toDate(undefined)).to.equal(null);
        expect(DateUtilities.toDate("")).to.equal(null);
        expect(DateUtilities.toDate("not-a-date")).to.equal(null);
      });

      it("returns a cloned Date for Date input", function () {
        const source = new Date("2024-01-02T03:04:05.000Z");
        const parsed = DateUtilities.toDate(source);

        expect(parsed).to.be.instanceof(Date);
        expect(parsed).to.not.equal(source);
        expect(parsed.getTime()).to.equal(source.getTime());
      });

      it("accepts numeric timestamps including zero", function () {
        const parsed = DateUtilities.toDate(0);

        expect(parsed).to.be.instanceof(Date);
        expect(parsed.getTime()).to.equal(0);
      });
    });

    describe("toMidnightDate", function () {
      it("returns local midnight when groupingTimeZone is local", function () {
        const source = new Date(2024, 4, 10, 16, 45, 22);
        const midnight = DateUtilities.toMidnightDate(source);

        expect(midnight).to.be.instanceof(Date);
        expect(midnight.getFullYear()).to.equal(source.getFullYear());
        expect(midnight.getMonth()).to.equal(source.getMonth());
        expect(midnight.getDate()).to.equal(source.getDate());
        expect(midnight.getHours()).to.equal(0);
        expect(midnight.getMinutes()).to.equal(0);
        expect(midnight.getSeconds()).to.equal(0);
      });

      it("returns UTC midnight when groupingTimeZone is UTC", function () {
        const midnight = DateUtilities.toMidnightDate(
          "2024-05-10T16:45:22.000Z",
          "UTC",
        );

        expect(midnight.toISOString()).to.equal("2024-05-10T00:00:00.000Z");
      });

      it("falls back to local grouping for invalid timezone values", function () {
        const source = new Date(2024, 4, 10, 16, 45, 22);

        expect(
          DateUtilities.toMidnightDate(source, "invalid").getTime(),
        ).to.equal(DateUtilities.toMidnightDate(source, "local").getTime());
      });

      it("returns null for invalid input", function () {
        expect(DateUtilities.toMidnightDate("bad-date")).to.equal(null);
      });
    });

    describe("toISODateOnly", function () {
      it("returns local date-only strings by default", function () {
        const source = new Date(2024, 1, 3, 12, 34, 56);
        const expected = `${source.getFullYear()}-${pad2(
          source.getMonth() + 1,
        )}-${pad2(source.getDate())}`;

        expect(DateUtilities.toISODateOnly(source)).to.equal(expected);
      });

      it("returns UTC date-only strings when requested", function () {
        expect(
          DateUtilities.toISODateOnly("2024-05-10T23:30:00-05:00", "UTC"),
        ).to.equal("2024-05-11");
      });

      it("returns empty string for invalid values", function () {
        expect(DateUtilities.toISODateOnly("bad-date")).to.equal("");
      });
    });

    describe("toDayId", function () {
      it("returns stable day identifiers", function () {
        expect(
          DateUtilities.toDayId("2024-01-02T03:04:05.000Z", "UTC"),
        ).to.equal("date:2024-01-02");
      });

      it("supports custom prefixes, trims them, and marks invalid dates", function () {
        expect(
          DateUtilities.toDayId("2024-01-02T03:04:05.000Z", "UTC", " group "),
        ).to.equal("group:2024-01-02");
        expect(DateUtilities.toDayId("bad-date", "UTC", "group")).to.equal(
          "group:invalid",
        );
      });
    });

    describe("toLocaleDateString", function () {
      it("returns locale-formatted dates for valid values", function () {
        const date = new Date(2024, 0, 2, 12, 0, 0);
        const options = {
          year: "numeric",
          month: "short",
          day: "numeric",
        };

        expect(
          DateUtilities.toLocaleDateString(date, {
            locale: "en-US",
            formatOptions: options,
          }),
        ).to.equal(date.toLocaleDateString("en-US", options));
      });

      it("returns empty string for invalid values", function () {
        expect(DateUtilities.toLocaleDateString("bad-date")).to.equal("");
      });
    });

    describe("toLocalTimestampWithZone", function () {
      it("returns a local timestamp with zero-padded hours and a zone token", function () {
        const date = new Date(2024, 0, 2, 5, 7, 0);
        const prefix = `${date.getFullYear()}-${pad2(
          date.getMonth() + 1,
        )}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(
          date.getMinutes(),
        )}`;
        const zone = new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          timeZoneName: "short",
        })
          .formatToParts(date)
          .find(({ type }) => type === "timeZoneName")?.value;

        expect(DateUtilities.toLocalTimestampWithZone(date)).to.equal(
          zone ? `${prefix} ${zone}` : prefix,
        );
      });

      it("returns empty string for invalid values", function () {
        expect(DateUtilities.toLocalTimestampWithZone("bad-date")).to.equal("");
      });
    });

    describe("toISOString", function () {
      it("returns ISO timestamps for valid values", function () {
        expect(DateUtilities.toISOString("2024-01-02T03:04:05.678Z")).to.equal(
          "2024-01-02T03:04:05.678Z",
        );
      });

      it("returns empty string for invalid values", function () {
        expect(DateUtilities.toISOString("bad-date")).to.equal("");
      });

      it("returns empty string when Date#toISOString throws", function () {
        const isoStub = sinon
          .stub(Date.prototype, "toISOString")
          .throws(new Error("boom"));

        try {
          expect(DateUtilities.toISOString("2024-01-02T03:04:05.678Z")).to.equal(
            "",
          );
        } finally {
          isoStub.restore();
        }
      });
    });

    describe("toXmlDateTimeString", function () {
      it("returns XML timestamps with an explicit UTC offset", function () {
        expect(
          DateUtilities.toXmlDateTimeString("2024-01-02T03:04:05.678Z"),
        ).to.equal("2024-01-02T03:04:05.678+00:00");
      });

      it("returns empty string for invalid values", function () {
        expect(DateUtilities.toXmlDateTimeString("bad-date")).to.equal("");
      });
    });

    describe("getRelativeDateString", function () {
      const reference = "2024-01-01T00:00:00.000Z";

      it("returns empty string when either value is invalid", function () {
        expect(
          DateUtilities.getRelativeDateString("bad-date", reference),
        ).to.equal("");
        expect(
          DateUtilities.getRelativeDateString(reference, "bad-date"),
        ).to.equal("");
      });

      it("returns current when the values are the same", function () {
        expect(
          DateUtilities.getRelativeDateString(reference, reference),
        ).to.equal("current");
      });

      it("returns relative newer and older strings", function () {
        expect(
          DateUtilities.getRelativeDateString(
            "2024-01-01T00:00:01.000Z",
            reference,
          ),
        ).to.equal("1 second newer");
        expect(
          DateUtilities.getRelativeDateString(
            "2023-12-31T23:58:00.000Z",
            reference,
          ),
        ).to.equal("2 minutes older");
      });

      it("supports custom labels and sub-second differences", function () {
        expect(
          DateUtilities.getRelativeDateString(1704067200400, 1704067200000, {
            newerWord: "after",
            olderWord: "before",
            currentWord: "same time",
          }),
        ).to.equal("less than 1 second after");

        expect(
          DateUtilities.getRelativeDateString(reference, reference, {
            currentWord: "same time",
          }),
        ).to.equal("same time");
      });
    });
  });
});
