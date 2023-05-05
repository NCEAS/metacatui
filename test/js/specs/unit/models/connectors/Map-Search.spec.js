define([
  "../../../../../../../../src/js/models/connectors/Map-Search",
], function (MapSearch) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("MapSearch Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a MapSearch instance", function () {
        new MapSearch().should.be.instanceof(MapSearch);
      });
    });
  });
});