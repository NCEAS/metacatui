"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "text!/test/data/eml-attribute-reference.xml",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLReferences",
], function (cleanState, testEML, EML, EMLReferences) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLReferences Test Suite", function () {
    const state = cleanState(() => {
      const refs = new EMLReferences();
      const eml = new EML(testEML, { parse: true });

      const datasetNode = $($.parseHTML(testEML))
        .filter("eml\\:eml")
        .find("dataset");
      return { refs, eml, datasetNode };
    }, beforeEach);

    it("should parse references eml", function () {
      const { refs, eml, datasetNode } = state;
      const refXML = `<references system="refSystem">refId</references>`;
      const refDOM = $(refXML)[0];
      const attrs = refs.parse(refDOM);
      expect(attrs.references).to.equal("refId");
      expect(attrs.system).to.equal("refSystem");
    });

    it("should parse references eml with no system", function () {
      const { refs } = state;
      const refXML = `<references>refId</references>`;
      const refDOM = $(refXML)[0];
      const attrs = refs.parse(refDOM);
      expect(attrs.references).to.equal("refId");
      expect(attrs.system).to.be.null;
    });

    it("should find linked model", function () {
      const { eml } = state;
      const attrLists = eml.get("entities").getAllAttributeLists();
      const attrList1 = attrLists[0];
      const attrList2 = attrLists[1];
      const refs = attrList1.get("references");
      const linkedModel = refs.getLinkedModel();
      expect(linkedModel).to.equal(attrList2);
    });
  });
});
