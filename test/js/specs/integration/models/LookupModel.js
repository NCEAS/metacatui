define(["models/LookupModel"], function (LookupModel) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("Lookup Model", function () {
    beforeEach(function () {
      MetacatUI.appModel.set(
        "grantsUrl",
        "https://arcticdata.io/research.gov/awardapi-service/v1/awards.json",
      );
      MetacatUI.appModel.set("orcidBaseUrl", "https://pub.orcid.org");
      MetacatUI.appModel.set(
        "orcidSearchUrl",
        "https://pub.orcid.org/v3.0/search/?q=",
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

    describe("ORCID Search", function () {
      let fetchStub;

      beforeEach(function () {
        fetchStub = sinon.stub(window, "fetch");
      });

      afterEach(function () {
        if (fetchStub && fetchStub.restore) {
          fetchStub.restore();
        }
      });

      it("formats ORCID v3 search results and respects the ignore list", async function () {
        const lookup = new LookupModel();
        const request = { term: "Example" };
        const moreResults = [{ value: "existing-user" }];
        const ignore = [
          "https://orcid.org/0000-0000-0000-0001",
          "0000-0000-0000-0002",
        ];
        const numResults = 5;

        const apiResponse = {
          "num-found": 1,
          "expanded-result": [
            {
              "orcid-id": "0000-0001-7648-6754",
              "given-names": "Test",
              "family-names": "User",
              "institution-name": ["Org A", "Org B"],
            },
          ],
        };

        fetchStub.resolves({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve(apiResponse),
        });

        const responseSpy = sinon.spy();

        await lookup.orcidSearch(
          request,
          responseSpy,
          moreResults,
          ignore,
          numResults,
        );

        fetchStub.calledOnce.should.equal(true);
        const callArgs = fetchStub.firstCall.args;
        expect(callArgs[0]).to.equal(
          "https://pub.orcid.org/v3.0/search/?q=Example+-orcid:(0000-0000-0000-0001+0000-0000-0000-0002)&rows=5&start=0",
        );
        expect(callArgs[1]).to.have.property("headers");
        expect(callArgs[1].headers).to.deep.equal({
          "Content-Type": "application/json",
        });

        responseSpy.calledOnce.should.equal(true);
        const results = responseSpy.firstCall.args[0];
        expect(results).to.be.an("array").with.lengthOf(2);
        expect(results[0]).to.deep.equal(moreResults[0]);

        const newPerson = results[1];
        expect(newPerson.value).to.equal(
          "https://orcid.org/0000-0001-7648-6754",
        );
        expect(newPerson.label).to.equal("Test User");
        expect(newPerson.fullName).to.equal("Test User");
        expect(newPerson.desc).to.equal("Org A, Org B");
      });
    });
  });
});
