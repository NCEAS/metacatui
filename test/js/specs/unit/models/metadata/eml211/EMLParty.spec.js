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

    describe("ORCID Validation", function () {
      it("should validate a valid ORCID", function () {
        state.party
          .validateOrcid("0000-0000-0000-0000")
          .should.equal("0000-0000-0000-0000");
        state.party
          .validateOrcid("https://orcid.org/0000-0000-0000-0000")
          .should.equal("https://orcid.org/0000-0000-0000-0000");
        state.party
          .validateOrcid("http://orcid.org/0000-0000-0000-0000")
          .should.be.equal("http://orcid.org/0000-0000-0000-0000");
        state.party
          .validateOrcid("0000-0000-0000-000X")
          .should.equal("0000-0000-0000-000X");
      });

      it("should standardize a valid ORCID", function () {
        state.party
          .validateOrcid("0000-0000-0000-0000", true)
          .should.equal("https://orcid.org/0000-0000-0000-0000");
        state.party
          .validateOrcid("https://orcid.org/0000-0000-0000-0000", true)
          .should.equal("https://orcid.org/0000-0000-0000-0000");
        state.party
          .validateOrcid("http://orcid.org/0000-0000-0000-0000", true)
          .should.equal("https://orcid.org/0000-0000-0000-0000");
      });

      it("should invalidate an invalid ORCID", function () {
        state.party.validateOrcid("0000-0000-0000-000").should.be.false;
        state.party.validateOrcid("0000-0000-0000-0000X").should.be.false;
        state.party.validateOrcid("0000-0000-0000-0000-").should.be.false;
        state.party.validateOrcid("0000-0000-0000-0000-0000").should.be.false;
        state.party.validateOrcid("0000-0000-0000-0000-0000X").should.be.false;
        state.party.validateOrcid("https://orcid.org/0000-0000-0000-0000-0000")
          .should.be.false;
        state.party.validateOrcid("http://orcid.org/0000-0000-0000-0000-0000")
          .should.be.false;
      });
    });

    describe("Miscellaneous", function () {
      it("The getUserIdArray method should return an array if the userId is not set", function () {
        state.party.getUserIdArray().should.deep.equal([]);
      });

      it("The getUserIdArray method should return an array for a single user ID", function () {
        state.party.set("userId", "0000-0000-0000-0000");
        state.party.getUserIdArray().should.deep.equal(["0000-0000-0000-0000"]);
      });

      it("The getUserIdArray method should return an array for multiple user IDs", function () {
        state.party.set("userId", [
          "0000-0000-0000-0000",
          "0000-0000-0000-0001",
        ]);
        state.party
          .getUserIdArray()
          .should.deep.equal(["0000-0000-0000-0000", "0000-0000-0000-0001"]);
      });
    });
  });
});
