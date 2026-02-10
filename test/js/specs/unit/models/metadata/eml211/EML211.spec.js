"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLParty",
  "models/metadata/eml211/EMLTaxonCoverage",
], function (cleanState, EML, EMLParty, EMLTaxonCoverage) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EML211 Test Suite", function () {
    const state = cleanState(() => {
      const eml = new EML();
      return { eml };
    }, beforeEach);

    describe("Taxonomic Coverage", function () {
      it("should detect when there is not a taxonomic coverage model", function () {
        state.eml.set("taxonCoverage", []);
        state.eml.hasTaxonomicCoverage().should.be.false;
        state.eml.set("taxonCoverage", null);
        state.eml.hasTaxonomicCoverage().should.be.false;
        state.eml.set("taxonCoverage", ["not a taxon coverage model"]);
        state.eml.hasTaxonomicCoverage().should.be.false;
      });

      it("should detect when there is a taxonomic coverage model", function () {
        state.eml.set("taxonCoverage", [
          new EMLTaxonCoverage({
            parentModel: state.eml,
          }),
        ]);
        state.eml.hasTaxonomicCoverage().should.be.true;
      });

      it("should add a taxonomic coverage model", function () {
        state.eml.addTaxonomicCoverage();
        state.eml.hasTaxonomicCoverage().should.be.true;
        state.eml.get("taxonCoverage").should.have.lengthOf(1);
        state.eml
          .get("taxonCoverage")[0]
          .should.be.instanceof(EMLTaxonCoverage);
      });
    });

    describe("setSchemaLocation", function () {
      const schemaLocation =
        "https://example.org/eml-2.2.0 https://example.org/eml-2.2.0/eml.xsd";
      const serializationFormat = "https://example.org/eml-2.2.0";
      let originalMetacatUI;

      function mockMetacatUI(overrides = {}) {
        window.MetacatUI = {
          appModel: {
            get: (attr) => {
              if (overrides[attr]) {
                return overrides[attr];
              }
              if (attr === "editorSchemaLocation") return schemaLocation;
              if (attr === "editorSerializationFormat")
                return serializationFormat;
              return undefined;
            },
          },
        };
      }

      function createEmlElement(initialLocation) {
        const element = document.createElement("eml");
        if (initialLocation) {
          $(element).attr("xsi:schemaLocation", initialLocation);
        }
        return element;
      }

      beforeEach(function () {
        originalMetacatUI = window.MetacatUI;
        mockMetacatUI();
      });

      afterEach(function () {
        window.MetacatUI = originalMetacatUI;
      });

      it("sets the schema location when missing", function () {
        const emlElement = createEmlElement();
        const updated = state.eml.setSchemaLocation(emlElement);

        expect(updated).to.equal(emlElement);
        expect($(emlElement).attr("xsi:schemaLocation")).to.equal(
          schemaLocation,
        );
      });

      it("appends the configured schema location when other valid entries exist", function () {
        const existing =
          "http://existing.org/ns http://existing.org/schema.xsd";
        const emlElement = createEmlElement(existing);

        state.eml.setSchemaLocation(emlElement);

        expect($(emlElement).attr("xsi:schemaLocation")).to.equal(
          `${existing} ${schemaLocation}`,
        );
      });

      it("does not modify the schema location when the format is already present", function () {
        const emlElement = createEmlElement(schemaLocation);

        state.eml.setSchemaLocation(emlElement);

        expect($(emlElement).attr("xsi:schemaLocation")).to.equal(
          schemaLocation,
        );
      });

      it("overwrites the schema location when existing is invalid", function () {
        const invalidLocation = "invalid-schema-location";
        const emlElement = createEmlElement(invalidLocation);

        state.eml.setSchemaLocation(emlElement);

        expect($(emlElement).attr("xsi:schemaLocation")).to.equal(
          schemaLocation,
        );
      });
    });

    describe("XML clean up helpers", function () {
      const sourceXML =
        "<dataset><source>One</source><source>Two</source></dataset>";
      const sourcedXML =
        "<dataset><sourced>One</sourced><sourced>Two</sourced></dataset>";

      it("cleanUpXML converts source elements to sourced", function () {
        state.eml.cleanUpXML(sourceXML).should.equal(sourcedXML);
      });

      it("revertSourcedToSource converts sourced elements back to source", function () {
        state.eml.revertSourcedToSource(sourcedXML).should.equal(sourceXML);
      });

      it("round trips source elements through cleanUpXML and revertSourcedToSource", function () {
        state.eml
          .revertSourcedToSource(state.eml.cleanUpXML(sourceXML))
          .should.equal(sourceXML);
      });
    });
  });
});
