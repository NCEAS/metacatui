"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/metadata/eml211/EMLParty",
], function (cleanState, EMLParty) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLParty Test Suite", function () {
    const state = cleanState(() => {
      const party = new EMLParty();
      return { party };
    }, beforeEach);

    describe("Creating", function () {
      it("should be created from the logged in user");
    });
    describe("Parsing", function () {
      it("should parse the individual name");
      it("should parse the organization name");
      it("should parse the position name");
      it("should parse the address");
      it("should parse the individual name");
      it("should parse the phone, fax, email, and online URL");
      it("should parse the associated party role");
      it("should parse the XML ID");
    });

    describe("Serializing", function () {
      it("should update the individual name");
      it("should update the organization name");
      it("should update the position name");
      it("should update the address");
      it("should update the individual name");
      it("should update the phone, fax, email, and online URL");
      it("should update the associated party role");
      it("should update the XML ID");
    });

    describe("Validation", function () {
      it("requires a name");
      it("can require an email");
      it("can require a country");
      it("can require a user id (ORCID)");

      it("should require a valid email", function () {
        state.party.set("email", ["not an email"]);
        state.party.isValid().should.be.false;
      });
    });
  });
});
