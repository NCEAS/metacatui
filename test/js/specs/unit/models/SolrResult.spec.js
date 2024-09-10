define(["../../../../../../../../src/js/models/SolrResult"], function (
  SolrResult,
) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;
  let solrResult;

  describe("Search Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      solrResult = new SolrResult();
    });

    /* Tear down */
    after(function () {
      solrResult = undefined;
    });

    describe("The SolrResult model", function () {
      it("should be created", function () {
        solrResult.should.be.instanceof(SolrResult);
      });
    });
  });
});
