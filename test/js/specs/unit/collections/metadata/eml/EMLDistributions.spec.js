define([
  "../../../../../../../../src/js/collections/metadata/eml/EMLDistributions",
], function (EMLDistributions) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLDistributions Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.EMLDistributions = new EMLDistributions();
    });

    /* Tear down */
    afterEach(function () {
      delete this.EMLDistributions;
    });

    describe("Initialization", function () {
      it("should create a EMLDistributions instance", function () {
        new EMLDistributions().should.be.instanceof(EMLDistributions);
      });
    });

    describe("Finding distributions", function () {
      it("should find a distribution by attributes", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com" });
        this.EMLDistributions.findByAttributes({ url: "http://example.com" }).should.equal(dist);
      });

      it("should find a distribution by partial attributes", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com" });
        this.EMLDistributions.findByAttributes({ url: "example.com" }, true).should.equal(dist);
      });

      it("should not find a distribution by attributes", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com" });
        expect(this.EMLDistributions.findByAttributes({ url: "http://example.org" })).to.be.undefined;
      });

      it("should not find a distribution by partial attributes", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com" });
        expect(this.EMLDistributions.findByAttributes({ url: "example.org" }, true)).to.be.undefined;
      });

      it("should find a distribution by attributes with multiple matches", function () {
        let dist1 = this.EMLDistributions.add({ url: "http://example.com" });
        let dist2 = this.EMLDistributions.add({ url: "http://example.com" });
        this.EMLDistributions.findByAttributes({ url: "http://example.com" }).should.equal(dist1);
      });

      it("should find a distribution by partial attributes with multiple matches", function () {
        let dist1 = this.EMLDistributions.add({ url: "http://example.com" });
        let dist2 = this.EMLDistributions.add({ url: "http://example.com" });
        this.EMLDistributions.findByAttributes({ url: "example.com" }, true).should.equal(dist1);
      });

    });

    describe("Adding and removing distributions", function () {
      it("should add a distribution", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com" });
        this.EMLDistributions.length.should.equal(1);
        this.EMLDistributions.at(0).should.equal(dist);
      });

      it("should parse a distribution that is added with a DOM", function () {
        let dom = jQuery("<distribution><online><url>http://example.com</url></online></distribution>");
        let dist = this.EMLDistributions.add({ objectDOM: dom }, { parse: true });
        this.EMLDistributions.length.should.equal(1);
        this.EMLDistributions.at(0).should.equal(dist);
        this.EMLDistributions.at(0).get("url").should.equal("http://example.com");
      });

      it("should remove a distribution", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com" });
        this.EMLDistributions.remove(dist);
        this.EMLDistributions.length.should.equal(0);
      });

      it("should remove a distribution by attributes", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com" });
        this.EMLDistributions.removeByAttributes({ url: "http://example.com" });
        this.EMLDistributions.length.should.equal(0);
      });

      it("should remove a distribution by partial attributes", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com" });
        this.EMLDistributions.removeByAttributes({ url: "example.com" }, true);
        this.EMLDistributions.length.should.equal(0);
      });

    });

    describe("Updating DOMs", function () {
      it("should update DOMs", function () {
        let dist = this.EMLDistributions.add({ url: "http://example.com", urlFunction: "information" });
        let doms = this.EMLDistributions.updateDOMs();
        doms.length.should.equal(1);
        doms[0].tagName.should.equal("DISTRIBUTION");
        // Immediate child should be <online>
        doms[0].children[0].tagName.should.equal("ONLINE");
        // <online> should have 1 child: <url>
        doms[0].children[0].children.length.should.equal(1);
        // <url> should have the correct text
        doms[0].children[0].children[0].textContent.should.equal("http://example.com");
        // <url> should have the correct attribute: function="information"
        doms[0].children[0].children[0].getAttribute("function").should.equal("information");
      });
    });

    

  });
});
