"use strict";

define([
  "jquery",
  "/test/js/specs/shared/clean-state.js",
  "models/metadata/eml211/EMLAttributeList",
], ($, cleanState, EMLAttributeList) => {
  // Configure the Chai assertion library
  const should = chai.should();
  const expect = chai.expect;

  // Example EML
  const attrList1xml = `<attributeList id="attrList1">
    <attribute id="attr1">
      <attributeName>Attribute 1</attributeName>
      <attributeDefinition>Definition of attribute 1</attributeDefinition>
      <measurementscale>
        <nominal>
          <nonnumericdomain>
            <textdomain>
              <definition>Any text</definition>
              <pattern>*</pattern>
            </textdomain>
          </nonnumericdomain>
        </nominal>
      </measurementscale>
    </attribute>
    <attribute id="attr2">
      <attributeName>Attribute 2</attributeName>
      <attributeDefinition>Definition of attribute 2</attributeDefinition>
      <measurementscale>
        <nominal>
          <nonnumericdomain>
            <textdomain>
              <definition>Any text</definition>
              <pattern>*</pattern>
            </textdomain>
          </nonnumericdomain>
        </nominal>
      </measurementscale>
    </attribute>
  </attributeList>`;

  const attrList2xml = `<attributeList id="attrList2">
    <references>attrList1</references>
  </attributeList>`;

  // Mimic the way that EML211 parses EML docs
  const emlParse = (str) => {
    return $($.parseHTML(str.trim()));
  };

  describe("EMLAttributeList Test Suite", function () {
    const state = cleanState(() => {
      const attrList1DOM = emlParse(attrList1xml);
      const attrList2DOM = emlParse(attrList2xml);

      const attrListWithAttrs = new EMLAttributeList(attrList1DOM, {
        parse: true,
      });
      const attrListWithRef = new EMLAttributeList(attrList2DOM, {
        parse: true,
      });
      const attrListEmpty = new EMLAttributeList();
      return {
        attrListWithAttrs,
        attrListWithRef,
        attrListEmpty,
      };
    }, beforeEach);

    describe("Parse", () => {
      it("should parse the XML and populate the attributes collection", () => {
        const { attrListWithAttrs } = state;
        const attributes = attrListWithAttrs.get("emlAttributes");
        expect(attributes.length).to.equal(2);
        expect(attributes.at(0).get("xmlID")).to.equal("attr1");
        expect(attributes.at(1).get("xmlID")).to.equal("attr2");
      });

      it("should parse the XML and populate the references model", () => {
        const { attrListWithRef } = state;
        const references = attrListWithRef.get("references");
        references.get("references").should.equal("attrList1");
      });
    });

    describe("updateDOM", () => {
      it("should update the DOM with the current model", () => {
        const { attrListWithAttrs } = state;
        attrListWithAttrs.set("xmlID", "newID");
        const newDOM = attrListWithAttrs.updateDOM();
        // TODO: why uppercase?
        const nodeName = newDOM.nodeName.toLowerCase();
        expect(nodeName).to.equal("attributelist");
        expect(newDOM.getAttribute("id")).to.equal("newID");
        const attributes = newDOM.getElementsByTagName("attribute");
        expect(attributes.length).to.equal(2);
        expect(attributes[0].getAttribute("id")).to.equal("attr1");
        expect(attributes[1].getAttribute("id")).to.equal("attr2");
      });

      it("should update the DOM with the current model and references", () => {
        const { attrListWithRef } = state;
        attrListWithRef.get("references").set("references", "newReferenceID");
        const newDOM = attrListWithRef.updateDOM();
        const nodeName = newDOM.nodeName.toLowerCase();
        expect(nodeName).to.equal("attributelist");
        // ID should get removed because attrLists with references are not allowed to have IDs
        expect(newDOM.getAttribute("id")).to.equal(null);
        const references = newDOM.getElementsByTagName("references");
        expect(references.length).to.equal(1);
        expect(references[0].textContent).to.equal("newReferenceID");
      });

      it("should return null when the model is empty", () => {
        const { attrListEmpty } = state;
        const newDOM = attrListEmpty.updateDOM();
        expect(newDOM).to.equal(null);
      });
    });

    describe("validate", () => {
      it("should validate the model", () => {
        const { attrListWithAttrs } = state;
        const errors = attrListWithAttrs.validate();
        expect(errors).to.equal(false);
      });

      it("should invalidate the model when there are both attributes and references", () => {
        const { attrListWithAttrs, attrListWithRef } = state;
        attrListWithAttrs.set("references", attrListWithRef.get("references"));
        const errors = attrListWithAttrs.validate();
        expect(errors).to.not.equal(false);
        expect(errors).to.have.property("references");
        expect(errors).to.have.property("attributes");
      });

      it("should pass on errors from the attribute models", () => {
        const { attrListWithAttrs } = state;
        const attributes = attrListWithAttrs.get("emlAttributes");
        attributes.at(0).set("attributeName", null);
        const errors = attrListWithAttrs.validate();
        expect(errors).to.not.equal(false);
        expect(errors).to.have.property("attributes");
        expect(errors.attributes[0]).to.have.property("attributeName");
      });
    });

    describe("Miscellaneous", () => {
      it("should detect when a the model is empty", () => {
        const { attrListWithAttrs, attrListWithRef, attrListEmpty } = state;
        expect(attrListWithAttrs.isEmpty()).to.equal(false);
        expect(attrListWithRef.isEmpty()).to.equal(false);
        expect(attrListEmpty.isEmpty()).to.equal(true);
      });
    });
  });
});
