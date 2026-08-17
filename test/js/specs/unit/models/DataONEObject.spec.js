define([
  "../../../../../../../../src/js/models/DataONEObject",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLEntity",
], function (DataONEObject, EML211, EMLEntity) {
  var expect = chai.expect;

  describe("DataONEObject Test Suite", function () {
    let dataONEObject;

    beforeEach(function () {
      dataONEObject = new DataONEObject();
    });

    afterEach(function () {
      dataONEObject = undefined;
    });

    describe("getFormat function", function () {
      it("should return the human-readable format when formatId is in the formatMap", function () {
        // Mock data
        const formatId = "application/pdf";
        const expectedFormat = "PDF";

        // Set mock data
        dataONEObject.set("formatId", formatId);

        const result = dataONEObject.getFormat();
        expect(result).to.equal(expectedFormat);
      });

      it("should return formatId when formatId is not in the formatMap", function () {
        // Mock data
        const formatId = "unknownFormatId";

        // Set mock data
        dataONEObject.set("formatId", formatId);

        const result = dataONEObject.getFormat();
        expect(result).to.equal(formatId);
      });
    });

    describe("metadata entity descriptors", function () {
      it("keeps a linked entity current without retaining this model", function () {
        dataONEObject.set({
          id: "urn:uuid:data.1",
          fileName: "old.csv",
          formatId: "text/csv",
        });
        const entity = new EMLEntity({
          entityName: "old.csv",
          entityType: "text/csv",
        });
        dataONEObject.set("metadataEntity", entity);

        dataONEObject.set({
          id: "urn:uuid:data.2",
          fileName: "new.csv",
          formatId: "application/json",
        });

        expect(entity.get("downloadID")).to.equal("urn:uuid:data.2");
        expect(entity.get("xmlID")).to.equal("urn-uuid-data.2");
        expect(entity.get("entityName")).to.equal("new.csv");
        expect(entity.get("entityType")).to.equal("application/json");
        expect(Object.values(entity.attributes)).not.to.include(dataONEObject);
      });

      it("does not replace a custom EML entity name on file rename", function () {
        dataONEObject.set({
          id: "data.1",
          fileName: "old.csv",
          formatId: "text/csv",
        });
        const entity = new EMLEntity({
          xmlID: "custom-table-id",
          entityName: "Custom table name",
          entityType: "text/csv",
        });
        dataONEObject.set("metadataEntity", entity);

        dataONEObject.set({
          id: "data.2",
          fileName: "new.csv",
        });

        expect(entity.get("downloadID")).to.equal("data.2");
        expect(entity.get("xmlID")).to.equal("custom-table-id");
        expect(entity.get("entityName")).to.equal("Custom table name");
      });

      it("restores the linked entity descriptor when an ID update is reset", function () {
        dataONEObject.set({
          id: "data.1",
          documents: [],
          isDocumentedBy: [],
        });
        const entity = new EMLEntity();
        dataONEObject.set("metadataEntity", entity);

        dataONEObject.updateID("data.2");
        dataONEObject.resetID();

        expect(dataONEObject.get("id")).to.equal("data.1");
        expect(entity.get("downloadID")).to.equal("data.1");
        expect(entity.get("xmlID")).to.equal("data.1");
      });

      it("uses the parent EML collision policy for ID changes", function () {
        const eml = new EML211();
        const existing = eml.createEntity({
          id: "doi-example",
          fileName: "existing.csv",
        });
        const entity = eml.createEntity({
          id: "data.1",
          fileName: "data.csv",
        });
        dataONEObject.set("id", "data.1");
        dataONEObject.set("metadataEntity", entity);

        dataONEObject.set("id", "doi:example");

        expect(entity.get("downloadID")).to.equal("doi:example");
        expect(entity.get("xmlID")).to.equal("data.1");
        expect(entity.get("xmlID")).not.to.equal(existing.get("xmlID"));
      });
    });
  });
});
