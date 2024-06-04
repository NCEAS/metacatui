define(["../../../../../../../../src/js/models/LookupModel"], function (
  LookupModel,
) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("Lookup Model", function () {
    beforeEach(function () {
      MetacatUI.appModel.set(
        "grantsUrl",
        "https://arcticdata.io/research.gov/awardapi-service/v1/awards.json",
      );
    });

    afterEach(function () {
      var lookup = null;
    });

    describe("NSF Awards API Lookup", function () {
      it("should return results for a valid term", async function () {
        let lookup = new LookupModel();
        const awards = await lookup.findGrants("alaska");
        expect(awards).to.be.an("array");
        expect(awards.length).to.be.greaterThan(0);
        expect(awards[0]).to.have.property("id");
        expect(awards[0]).to.have.property("title");
      });
    });
  });
});
