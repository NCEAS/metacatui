define([
  "../../../../../../../../src/js/models/metadata/eml211/EMLDistribution",
], function (EMLDistribution) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLDistribution Test Suite", function () {
    describe("Initialization", function () {
      it("should create a EMLDistribution instance", function () {
        new EMLDistribution().should.be.instanceof(EMLDistribution);
      });
    });

    describe("Parse", function () {
      it("should parse online URL from EMLDistribution model", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution>" +
            "  <online>" +
            "    <url>http://www.dataone.org</url>" +
            "  </online>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.get("url").should.equal("http://www.dataone.org");
      });

      it("should parse offline elements from EMLDistribution model", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution>" +
            "  <offline>" +
            "    <mediumName>CD-ROM</mediumName>" +
            "    <mediumVolume>1</mediumVolume>" +
            "    <mediumFormat>ISO9660</mediumFormat>" +
            "    <mediumNote>Some notes</mediumNote>" +
            "  </offline>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.get("mediumName").should.equal("CD-ROM");
        emlDistribution.get("mediumVolume").should.equal("1");
        emlDistribution.get("mediumFormat").should.equal("ISO9660");
        emlDistribution.get("mediumNote").should.equal("Some notes");
      });

      it("should parse the url function attribute", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution>" +
            "  <online>" +
            "    <url function='information'>http://www.dataone.org</url>" +
            "  </online>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.get("urlFunction").should.equal("information");
      });
    });

    describe("Update DOM", function () {
      it("should update the DOM with the new values", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution>" +
            "  <online>" +
            "    <url>http://www.dataone.org</url>" +
            "  </online>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.set("url", "http://www.dataone.org/updated");

        var updatedDOM = emlDistribution.updateDOM();

        updatedDOM
          .querySelector("url")
          .textContent.should.equal("http://www.dataone.org/updated");
      });

      it("should create a new node if one does not exist", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution>" +
            "  <offline>" +
            "    <mediumName>CD-ROM</mediumName>" +
            "  </offline>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.set("mediumName", "CD-ROM");

        var updatedDOM = emlDistribution.updateDOM();

        updatedDOM
          .querySelector("mediumName")
          .textContent.should.equal("CD-ROM");
      });

      it("should create a DOM if one doesn't exist", function () {
        var emlDistribution = new EMLDistribution({
          mediumName: "CD-ROM",
        });

        var updatedDOM = emlDistribution.updateDOM();

        updatedDOM
          .querySelector("mediumName")
          .textContent.should.equal("CD-ROM");
        // check that mediumName is within the offline node
        updatedDOM.querySelector("offline > mediumName").should.not.equal(null);
      });

      it("should remove nodes if the value is empty", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution>" +
            "  <online>" +
            "    <url>http://www.dataone.org</url>" +
            "  </online>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.set("url", "");

        var updatedDOM = emlDistribution.updateDOM();
        expect(updatedDOM.querySelector("url")).to.equal(null);
      });

      it("should not remove id, system, nor scope attributes from the distribution node", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution id='123' system='eml' scope='system'>" +
            "  <online>" +
            "    <url>http://www.dataone.org</url>" +
            "  </online>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.set("url", "");

        var updatedDOM = emlDistribution.updateDOM();
        expect(updatedDOM.getAttribute("id")).to.equal("123");
        expect(updatedDOM.getAttribute("system")).to.equal("eml");
        expect(updatedDOM.getAttribute("scope")).to.equal("system");
      });

      it("should add the url function attribute", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution>" +
            "  <online>" +
            "    <url>http://www.dataone.org</url>" +
            "  </online>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.set("urlFunction", "information");

        var updatedDOM = emlDistribution.updateDOM();
        updatedDOM
          .querySelector("url")
          .getAttribute("function")
          .should.equal("information");
      });

      it("should remove the url function attribute if the value is empty", function () {
        var objectDOM = new DOMParser().parseFromString(
          "<distribution>" +
            "  <online>" +
            "    <url function='information'>http://www.dataone.org</url>" +
            "  </online>" +
            "</distribution>",
          "text/xml",
        ).documentElement;

        var emlDistribution = new EMLDistribution(
          {
            objectDOM: objectDOM,
          },
          { parse: true },
        );

        emlDistribution.set("urlFunction", "");

        var updatedDOM = emlDistribution.updateDOM();
        expect(
          updatedDOM.querySelector("url").getAttribute("function"),
        ).to.equal(null);
      });
    });
  });
});
