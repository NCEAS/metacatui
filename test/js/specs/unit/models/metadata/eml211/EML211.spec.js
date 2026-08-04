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

    describe("editable loading", function () {
      let originalMetacatUI;

      beforeEach(function () {
        originalMetacatUI = globalThis.MetacatUI;
      });

      afterEach(function () {
        globalThis.MetacatUI = originalMetacatUI;
      });

      it("does not mark entity population as a user edit before sync", function () {
        const recordUserEdit = sinon.spy();
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage: { recordUserEdit },
        };
        const eml = state.eml;
        eml.set("synced", false, { silent: true });

        eml.set("entities", eml.get("entities").clone());

        sinon.assert.notCalled(recordUserEdit);

        eml.set("synced", true, { silent: true });
        eml.set("entities", eml.get("entities").clone());

        sinon.assert.calledOnce(recordUserEdit);
      });

      it("marks natural entity add and remove as user edits after sync", function () {
        const recordUserEdit = sinon.spy();
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage: { recordUserEdit },
        };
        const eml = state.eml;
        eml.set("synced", true, { silent: true });
        const entities = eml.get("entities");

        const entity = entities.add({
          type: "otherEntity",
          entityName: "data.csv",
          parentModel: eml,
        });
        entities.remove(entity);

        sinon.assert.calledTwice(recordUserEdit);
      });

      it("rebinds entity update tracking when entities are replaced", function () {
        const recordUserEdit = sinon.spy();
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage: { recordUserEdit },
        };
        const eml = state.eml;
        eml.set("synced", true, { silent: true });
        const firstEntities = eml.get("entities").clone();
        const secondEntities = eml.get("entities").clone();

        eml.set("entities", firstEntities);
        eml.set("entities", secondEntities);
        recordUserEdit.resetHistory();

        firstEntities.add({
          type: "otherEntity",
          entityName: "stale.csv",
          parentModel: eml,
        });
        sinon.assert.notCalled(recordUserEdit);

        secondEntities.add({
          type: "otherEntity",
          entityName: "active.csv",
          parentModel: eml,
        });
        sinon.assert.calledOnce(recordUserEdit);
      });

      it("does not treat attribute content edits as attribute-list structure changes", function () {
        const recordUserEdit = sinon.spy();
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage: { recordUserEdit },
        };
        const eml = state.eml;
        const entities = eml.get("entities");
        const entity = entities.add({
          type: "otherEntity",
          entityName: "data.csv",
          parentModel: eml,
        });
        const attrList = entity.get("attributeList");
        const attr = attrList.get("emlAttributes").addAttribute({
          attributeName: "temperature",
          parentModel: entity,
        });
        recordUserEdit.resetHistory();
        const entityUpdateSpy = sinon.spy();
        const entityChangeSpy = sinon.spy();
        const attributeListChangeSpy = sinon.spy();
        entities.on("update", entityUpdateSpy);
        entities.on("change", entityChangeSpy);
        entity.on("change:attributeList", attributeListChangeSpy);

        attr.set("attributeDefinition", "Measured water temperature");

        sinon.assert.notCalled(entityUpdateSpy);
        sinon.assert.calledOnce(entityChangeSpy);
        sinon.assert.notCalled(attributeListChangeSpy);
        sinon.assert.calledOnce(recordUserEdit);
      });

      it("marks missing-value code typing dirty once", function () {
        const recordUserEdit = sinon.spy();
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage: { recordUserEdit },
        };
        const eml = state.eml;
        const entities = eml.get("entities");
        const entity = entities.add({
          type: "otherEntity",
          entityName: "data.csv",
          parentModel: eml,
        });
        const attr = entity
          .get("attributeList")
          .get("emlAttributes")
          .add({
            attributeName: "quality_flag",
            parentModel: entity.get("attributeList"),
          });
        const code = attr.get("missingValueCodes").add({
          code: "",
          codeExplanation: "",
        });
        recordUserEdit.resetHistory();

        code.set("code", "NA");

        sinon.assert.calledOnce(recordUserEdit);
      });

      it("treats attribute add and remove as attribute-list structure changes", function () {
        const recordUserEdit = sinon.spy();
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage: { recordUserEdit },
        };
        const eml = state.eml;
        const entities = eml.get("entities");
        const entity = entities.add({
          type: "otherEntity",
          entityName: "data.csv",
          parentModel: eml,
        });
        const attrs = entity.get("attributeList").get("emlAttributes");
        const entityUpdateSpy = sinon.spy();
        const entityChangeSpy = sinon.spy();
        const attributeListChangeSpy = sinon.spy();
        entities.on("update", entityUpdateSpy);
        entities.on("change", entityChangeSpy);
        entity.on("change:attributeList", attributeListChangeSpy);

        const attr = attrs.addAttribute({
          attributeName: "temperature",
          parentModel: entity,
        });
        attrs.remove(attr);

        sinon.assert.notCalled(entityUpdateSpy);
        sinon.assert.calledTwice(entityChangeSpy);
        sinon.assert.calledTwice(attributeListChangeSpy);
        sinon.assert.calledTwice(recordUserEdit);
      });
    });

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

    describe("replaceMemberPid", function () {
      it("creates entity ids from plain data descriptors", function () {
        const entity = state.eml.createEntity({
          id: "urn:uuid:data.1",
          fileName: "data.csv",
          formatId: "text/csv",
        });

        entity.get("entityName").should.equal("data.csv");
        entity.get("entityType").should.equal("text/csv");
        entity.get("downloadID").should.equal("urn:uuid:data.1");
        entity.get("xmlID").should.equal("urn-uuid-data.1");
      });

      it("updates entity identifiers and embedded download URLs", function () {
        const entityDom = new DOMParser().parseFromString(
          `<otherEntity id="urn-uuid-data.1">
            <physical>
              <distribution>
                <online>
                  <url function="download">https://cn.test/resolve/urn%3Auuid%3Adata.1</url>
                </online>
              </distribution>
            </physical>
          </otherEntity>`,
          "text/xml",
        ).documentElement;
        const entity = state.eml.get("entities").add({
          type: "otherEntity",
          xmlID: "urn-uuid-data.1",
          downloadID: "urn:uuid:data.1",
          objectDOM: entityDom,
        });

        const updated = state.eml.replaceMemberPid(
          "urn:uuid:data.1",
          "urn:uuid:data.2",
        );

        updated.should.equal(1);
        entity.get("xmlID").should.equal("urn-uuid-data.2");
        entity.get("downloadID").should.equal("urn:uuid:data.2");
        entity.updateDOM().outerHTML.should.contain("urn%3Auuid%3Adata.2");
      });

      it("preserves a custom entity id when replacing its member PID", function () {
        const entity = state.eml.get("entities").add({
          type: "otherEntity",
          xmlID: "custom-table-id",
          downloadID: "urn:uuid:data.1",
        });

        state.eml.replaceMemberPid("urn:uuid:data.1", "urn:uuid:data.2");

        entity.get("downloadID").should.equal("urn:uuid:data.2");
        entity.get("xmlID").should.equal("custom-table-id");
      });

      it("keeps a derived XML id when both PIDs have the same safe form", function () {
        const entity = state.eml.createEntity({
          id: "doi:example",
          fileName: "data.csv",
        });

        state.eml.replaceMemberPid("doi:example", "doi-example");

        entity.get("downloadID").should.equal("doi-example");
        entity.get("xmlID").should.equal("doi-example");
      });

      it("does not match a custom XML id when another data PID is known", function () {
        const entityDom = new DOMParser().parseFromString(
          `<otherEntity id="data.1">
            <physical>
              <distribution>
                <online>
                  <url function="download">https://cn.test/resolve/other.1</url>
                </online>
              </distribution>
            </physical>
          </otherEntity>`,
          "text/xml",
        ).documentElement;
        const entity = state.eml.get("entities").add({
          type: "otherEntity",
          xmlID: "data.1",
          downloadID: "other.1",
          objectDOM: entityDom,
        });

        state.eml.replaceMemberPid("data.1", "data.2").should.equal(0);

        entity.get("downloadID").should.equal("other.1");
        entity
          .updateDOM()
          .querySelector("url")
          .textContent.should.equal("https://cn.test/resolve/other.1");
      });

      it("does not rewrite a different PID that shares the old prefix", function () {
        const entityDom = new DOMParser().parseFromString(
          `<otherEntity id="data.1">
            <physical>
              <distribution>
                <online>
                  <url function="download">https://cn.test/resolve/data.1</url>
                  <url>https://cn.test/resolve/data.10</url>
                  <url>https://cn.test/resolve/mydata.1</url>
                  <url>https://example.test/information/data.1</url>
                </online>
              </distribution>
            </physical>
          </otherEntity>`,
          "text/xml",
        ).documentElement;
        const entity = state.eml.get("entities").add({
          type: "otherEntity",
          xmlID: "data.1",
          downloadID: "data.1",
          objectDOM: entityDom,
        });

        state.eml.replaceMemberPid("data.1", "data.2");

        const urls = entity.updateDOM().querySelectorAll("url");
        urls[0].textContent.should.equal("https://cn.test/resolve/data.2");
        urls[1].textContent.should.equal("https://cn.test/resolve/data.10");
        urls[2].textContent.should.equal("https://cn.test/resolve/mydata.1");
        urls[3].textContent.should.equal(
          "https://example.test/information/data.1",
        );
      });

      it("keeps ids unique across entities created before serialization", function () {
        const first = state.eml.createEntity({
          id: "doi:example",
          fileName: "first.csv",
        });
        const second = state.eml.createEntity({
          id: "doi-example",
          fileName: "second.csv",
        });

        first.get("xmlID").should.not.equal(second.get("xmlID"));
      });

      it("keeps a derived XML id unique when a member PID is replaced", function () {
        const existing = state.eml.createEntity({
          id: "doi-example",
          fileName: "existing.csv",
        });
        const replaced = state.eml.createEntity({
          id: "data.1",
          fileName: "replaced.csv",
        });

        state.eml.replaceMemberPid("data.1", "doi:example");

        replaced.get("downloadID").should.equal("doi:example");
        replaced.get("xmlID").should.not.equal(existing.get("xmlID"));

        state.eml.replaceMemberPid("doi:example", "data.1");

        replaced.get("downloadID").should.equal("data.1");
        replaced.get("xmlID").should.equal("data.1");
      });

      it("assigns a unique XML id when the matched entity has none", function () {
        const existing = state.eml.createEntity({
          id: "doi-example",
          fileName: "existing.csv",
        });
        const replaced = state.eml.get("entities").add({
          type: "otherEntity",
          downloadID: "data.1",
        });

        state.eml.replaceMemberPid("data.1", "doi:example");

        replaced.get("downloadID").should.equal("doi:example");
        replaced.get("xmlID").should.not.equal(existing.get("xmlID"));
      });

      it("restores a derived XML id when a PID replacement is reversed", function () {
        const entityDom = new DOMParser().parseFromString(
          `<otherEntity id="data.1">
            <physical>
              <distribution>
                <online>
                  <url function="download">https://cn.test/resolve/data.1</url>
                </online>
              </distribution>
            </physical>
          </otherEntity>`,
          "text/xml",
        ).documentElement;
        state.eml.set(
          "objectXML",
          `<eml:eml><dataset>${entityDom.outerHTML}</dataset></eml:eml>`,
        );
        const entity = state.eml.get("entities").add({
          type: "otherEntity",
          xmlID: "data.1",
          downloadID: "data.1",
          objectDOM: entityDom,
        });

        state.eml.replaceMemberPid("data.1", "urn:uuid:data.2");
        state.eml.replaceMemberPid("urn:uuid:data.2", "data.1");

        entity.get("downloadID").should.equal("data.1");
        entity.get("xmlID").should.equal("data.1");
      });
    });
  });
});
