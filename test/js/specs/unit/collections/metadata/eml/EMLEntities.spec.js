"use strict";

define([
  "jquery",
  "/test/js/specs/shared/clean-state.js",
  "collections/metadata/eml/EMLEntities",
  "models/DataONEObject",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLEntity",
  "models/metadata/eml211/EMLDataTable",
  "models/metadata/eml211/EMLOtherEntity",
], (
  $,
  cleanState,
  EMLEntities,
  DataONEObject,
  EML211,
  EMLEntity,
  EMLDataTable,
  EMLOtherEntity,
) => {
  const should = chai.should();
  const expect = chai.expect;

  // We need to replicate parsing the way that it's done in the EML211 model,
  // since it's using $.parseHTML to parse the XML string instead of the
  // DOMParser. This results in all node names being lowercase, which is what
  // the various EML models expect.
  const emlParse = (xmlString) => {
    const xml = $.parseHTML(xmlString.trim());
    return xml[0];
  };

  describe("EMLEntities Test Suite", () => {
    const state = cleanState(() => {
      const dummyParentModel = new EML211({
        id: "abc",
      });
      const dummyDatasetXML = `
        <dataset id="my-dataset">
          <dataTable id="123">
            <entityName>DataTable</entityName>
          </dataTable>
          <otherEntity id="456">
            <entityName>OtherEntity</entityName>
            <entityType>application/pdf</entityType>
          </otherEntity>
          <otherEntity id="789">
            <entityName>DefaultEntity</entityName>
            <entityType>Other</entityType>
          </otherEntity>
        </dataset>`;
      const dummyDatasetDOM = emlParse(dummyDatasetXML);
      const dummyEntities = [
        {
          xmlID: "123",
          entityName: "DataTable",
        },
        {
          xmlID: "456",
          entityName: "OtherEntity",
          entityType: "application/pdf",
        },
        {
          xmlID: "789",
          entityName: "DefaultEntity",
          entityType: "Other",
        },
      ];
      const entities = new EMLEntities([], {
        parentModel: dummyParentModel,
      });
      return {
        dummyParentModel,
        dummyDatasetDOM,
        dummyEntities,
        entities,
      };
    }, beforeEach);

    describe("model", () => {
      it("should return an EMLEntity model for unknown entity types", () => {
        const { entities } = state;
        const entity = entities.model({ type: "unknown" });
        entity.should.be.an.instanceof(EMLEntity);
        entity.get("entityType").should.equal("application/octet-stream");
      });

      it("should return an EMLOtherEntity model for otherEntity nodes", () => {
        const { entities } = state;
        const entity = entities.model({
          objectDOM: document.createElement("otherEntity"),
        });
        entity.should.be.an.instanceof(EMLOtherEntity);
      });

      it("should return an EMLDataTable model for dataTable nodes", () => {
        const { entities } = state;
        const entity = entities.model({
          objectDOM: document.createElement("dataTable"),
        });
        entity.should.be.an.instanceof(EMLDataTable);
      });

      it("should set the parentModel from the options if not already set", () => {
        const { entities } = state;
        const entity = entities.model(
          { type: "unknown" },
          { parentModel: state.dummyParentModel },
        );
        entity.get("parentModel").should.equal(state.dummyParentModel);
      });

      it("should not overwrite the parentModel if it is already set", () => {
        const { entities } = state;
        const parentModel = new EML211({ id: "def" });
        const entity = entities.model({
          type: "unknown",
          parentModel,
        });
        entity.get("parentModel").should.equal(parentModel);
      });

      it("should should ignore case when determining the model type", () => {
        const { entities } = state;
        const entity = entities.model({
          objectDOM: document.createElement("OTHERENTITY"),
        });
        entity.should.be.an.instanceof(EMLOtherEntity);
      });
    });

    describe("parse", () => {
      it("should parse the entities from the dataset node", () => {
        const { dummyDatasetDOM } = state;
        const entities = new EMLEntities(
          { datasetNode: dummyDatasetDOM },
          { parse: true },
        );
        entities.length.should.equal(3);
        entities.at(0).get("xmlID").should.equal("123");
        entities.at(0).get("entityName").should.equal("DataTable");
        entities.at(1).get("xmlID").should.equal("456");
        entities.at(1).get("entityName").should.equal("OtherEntity");
        entities.at(1).get("entityType").should.equal("application/pdf");
        entities.at(2).get("xmlID").should.equal("789");
        entities.at(2).get("entityName").should.equal("DefaultEntity");
      });

      it("should return an empty array if no dataset node is provided", () => {
        const entities = new EMLEntities([], { parse: true });
        entities.length.should.equal(0);
      });

      it("should return an empty array if the dataset node has no children", () => {
        const entities = new EMLEntities(
          {
            datasetNode: document.createElement("dataset"),
          },
          { parse: true },
        );
        entities.length.should.equal(0);
      });

      it("should not identify non-entity nodes as entities", () => {
        const dummyXML = `
          <dataset>
            <notAnEntity id="123">
              <entityName>NotAnEntity</entityName>
            </notAnEntity>
          </dataset>`;
        const dummyDOM = emlParse(dummyXML);
        const entities = new EMLEntities(
          { datasetNode: dummyDOM },
          { parse: true },
        );
        entities.length.should.equal(0);
      });

      it("should return objectDOMs for each entity", () => {
        const { entities, dummyDatasetDOM } = state;
        const parseOutput = entities.parse({ datasetNode: dummyDatasetDOM });
        parseOutput.length.should.equal(3);
        parseOutput[0].objectDOM.should.equal(dummyDatasetDOM.children[0]);
        parseOutput[1].objectDOM.should.equal(dummyDatasetDOM.children[1]);
        parseOutput[2].objectDOM.should.equal(dummyDatasetDOM.children[2]);
      });
    });

    describe("updateDatasetDOM", () => {
      it("should sync the dataset node with the entities in the collection", () => {
        const { entities, dummyDatasetDOM, dummyParentModel } = state;
        entities.add([
          {
            entityName: "NewEntity",
            entityType: "application/octet-stream",
            parentModel: dummyParentModel,
          },
          {
            entityName: "AnotherEntity",
            entityType: "application/pdf",
            parentModel: dummyParentModel,
          },
        ]);
        entities.updateDatasetDOM(dummyDatasetDOM, dummyParentModel);
        dummyDatasetDOM.children[0].localName.should.equal("otherentity");
        dummyDatasetDOM.children[0]
          .querySelector("entityname")
          .textContent.should.equal("NewEntity");
        dummyDatasetDOM.children[1].localName.should.equal("otherentity");
        dummyDatasetDOM.children[1]
          .querySelector("entityname")
          .textContent.should.equal("AnotherEntity");
      });

      it("should add new entities to the dataset node", () => {
        const { dummyDatasetDOM, dummyParentModel } = state;
        const entities = new EMLEntities(
          { datasetNode: dummyDatasetDOM, parentModel: dummyParentModel },
          { parse: true },
        );
        entities.length.should.equal(3);
        entities.add([
          {
            entityName: "NewEntity",
            entityType: "application/octet-stream",
            parentModel: dummyParentModel,
          },
          {
            entityName: "AnotherEntity",
            entityType: "application/pdf",
            parentModel: dummyParentModel,
          },
        ]);
        entities.updateDatasetDOM(dummyDatasetDOM, dummyParentModel);
        dummyDatasetDOM.children.length.should.equal(5);
        dummyDatasetDOM.children[3].localName.should.equal("otherentity");
        dummyDatasetDOM.children[3]
          .querySelector("entityname")
          .textContent.should.equal("NewEntity");
        dummyDatasetDOM.children[4].localName.should.equal("otherentity");
        dummyDatasetDOM.children[4]
          .querySelector("entityname")
          .textContent.should.equal("AnotherEntity");
      });

      it("should not modify other nodes in the dataset", () => {
        const { dummyParentModel } = state;
        const dummyDatasetXML = `<dataset>
          <title>My Dataset</title>
          <dataTable id="123">
            <entityName>DataTable</entityName>
          </dataTable>
          </dataset>
        `;
        const dummyDatasetDOM = emlParse(dummyDatasetXML);
        const entities = new EMLEntities(
          { datasetNode: dummyDatasetDOM, parentModel: dummyParentModel },
          { parse: true },
        );
        entities.length.should.equal(1);
        entities.reset();
        entities.updateDatasetDOM(dummyDatasetDOM, dummyParentModel);
        dummyDatasetDOM.children.length.should.equal(1);
        dummyDatasetDOM.children[0].localName.should.equal("title");
        dummyDatasetDOM.children[0].textContent.should.equal("My Dataset");
      });

      it("should update existing entities in the dataset node in order", () => {
        const { dummyDatasetDOM, dummyParentModel } = state;
        const entities = new EMLEntities(
          { datasetNode: dummyDatasetDOM, parentModel: dummyParentModel },
          { parse: true },
        );
        entities.at(1).set("entityName", "UpdatedEntity");
        entities.updateDatasetDOM(dummyDatasetDOM, dummyParentModel);
        dummyDatasetDOM.children[1]
          .querySelector("entityName")
          .textContent.should.equal("UpdatedEntity");
      });
    });

    describe("addFromDataONEObject", () => {
      it("should add a new entity from a DataONEObject", () => {
        const { entities, dummyParentModel } = state;
        const dataONEObj = new DataONEObject({
          fileName: "MyData.csv",
          formatId: "text/csv",
          mediaType: "text/csv",
        });
        const entity = entities.addFromDataONEObject(dataONEObj, {
          parentModel: dummyParentModel,
        });
        entity.should.be.an.instanceof(EMLEntity);
        entity.get("entityName").should.equal("MyData.csv");
        entity.get("entityType").should.equal("text/csv");
        entity.get("dataONEObject").should.equal(dataONEObj);
        entity.get("parentModel").should.equal(dummyParentModel);
      });

      it("should remove the entity if the DataONEObject fails to save", () => {
        const { entities } = state;
        const dataONEObj = new DataONEObject();
        const entity = entities.addFromDataONEObject(dataONEObj);
        entities.length.should.equal(1);
        dataONEObj.trigger("errorSaving");
        entities.length.should.equal(0);
      });

      it("should add the entity back if the DataONEObject later saves successfully", () => {
        const { entities } = state;
        const dataONEObj = new DataONEObject();
        const entity = entities.addFromDataONEObject(dataONEObj);
        // simulate multiple save attempts with successes and failures
        entities.length.should.equal(1);
        dataONEObj.trigger("errorSaving");
        entities.length.should.equal(0);
        dataONEObj.trigger("errorSaving");
        entities.length.should.equal(0);
        dataONEObj.trigger("successSaving");
        entities.length.should.equal(1);
        dataONEObj.trigger("errorSaving");
        entities.length.should.equal(0);
        dataONEObj.trigger("successSaving");
        entities.length.should.equal(1);
      });
    });

    describe("getByDataONEObject", () => {
      it("should return the entity that matches the DataONEObject", () => {
        const { entities } = state;
        const dataONEObj = new DataONEObject({
          id: "123",
          fileName: "MyData.csv",
          formatId: "text/csv",
          mediaType: "text/csv",
        });
        const entity = entities.addFromDataONEObject(dataONEObj);
        entities.getByDataONEObject(dataONEObj).should.equal(entity);
      });

      it("should return false if no matching entity is found", () => {
        const { entities } = state;
        const dataONEObj = new DataONEObject({
          id: "123",
          fileName: "MyData.csv",
          formatId: "text/csv",
          mediaType: "text/csv",
        });
        entities.getByDataONEObject(dataONEObj).should.be.false;
      });

      it("should match entities by checksum", () => {
        const { entities } = state;
        const newEntity = entities.add({
          xmlID: "123",
          physicalMD5Checksum: "abc123",
        });
        const dataONEObj = new DataONEObject({
          id: "456",
          checksum: "abc123",
          checksumAlgorithm: "MD5",
        });
        entities.getByDataONEObject(dataONEObj).should.equal(newEntity);
      });

      it("should match entities by identifier", () => {
        const { entities } = state;
        const newEntity = entities.add({
          xmlID: "123",
          downloadID: "abc123",
        });
        const dataONEObj = new DataONEObject({
          id: "abc123",
        });
        entities.getByDataONEObject(dataONEObj).should.equal(newEntity);
      });

      it("should match entities by file name", () => {
        const { entities } = state;
        const newEntity = entities.add({
          xmlID: "123",
          entityName: "MyData.csv",
        });
        const dataONEObj = new DataONEObject({
          id: "456",
          fileName: "MyData.csv",
        });
        entities.getByDataONEObject(dataONEObj).should.equal(newEntity);
      });

      it("should match entities by format type", () => {
        const { entities } = state;
        const newEntity = entities.add({
          xmlID: "123",
          entityType: "text/csv",
        });
        const dataONEObj = new DataONEObject({
          id: "456",
          formatId: "text/csv",
        });
        entities.getByDataONEObject(dataONEObj).should.equal(newEntity);
      });

      it("should match entities by format type case-insensitively", () => {
        const { entities } = state;
        const newEntity = entities.add({
          xmlID: "123",
          entityType: "text/csv",
        });
        const dataONEObj = new DataONEObject({
          id: "456",
          formatId: "TEXT/CSV",
        });
        entities.getByDataONEObject(dataONEObj).should.equal(newEntity);
      });

      it("should match entities by file name case-insensitively", () => {
        const { entities } = state;
        const newEntity = entities.add({
          xmlID: "123",
          entityName: "MyData.csv",
        });
        const dataONEObj = new DataONEObject({
          id: "456",
          fileName: "MYDATA.CSV",
        });
        entities.getByDataONEObject(dataONEObj).should.equal(newEntity);
      });

      it("should match entities by file name with spaces", () => {
        const { entities } = state;
        const newEntity = entities.add({
          xmlID: "123",
          entityName: "My Data.csv",
        });
        const dataONEObj = new DataONEObject({
          id: "456",
          fileName: "My Data.csv",
        });
        entities.getByDataONEObject(dataONEObj).should.equal(newEntity);
      });

      it("should not replace existing entity<->DataONEObject pairings", () => {
        const { entities } = state;
        const dataONEObj = new DataONEObject({
          id: "123",
          fileName: "MyData.csv",
          formatId: "text/csv",
          mediaType: "text/csv",
        });
        const entity = entities.addFromDataONEObject(dataONEObj);
        const otherDataONEObj = new DataONEObject({
          id: "456",
          fileName: "OtherData.csv",
          formatId: "text/csv",
          mediaType: "text/csv",
        });
        entities.getByDataONEObject(otherDataONEObj).should.be.false;
        entities.getByDataONEObject(dataONEObj).should.equal(entity);
      });

      it("should set the entity<->DataONEObject pair if a match is found", () => {
        const { entities } = state;
        const dataONEObj = new DataONEObject({
          id: "123",
          fileName: "MyData.csv",
          formatId: "text/csv",
          mediaType: "text/csv",
        });
        const entity = entities.addFromDataONEObject(dataONEObj);
        entities.getByDataONEObject(dataONEObj).should.equal(entity);
        dataONEObj.get("metadataEntity").should.equal(entity);
      });
    });

    describe("getParentModel", () => {
      it("should return the parent model of the entities", () => {
        const { entities, dummyParentModel } = state;
        entities.add({ parentModel: dummyParentModel });
        entities.add({ entityName: "AnotherEntity no parent" });
        entities.getParentModel().should.equal(dummyParentModel);
      });

      it("should return null if no parent model is found", () => {
        const entities = new EMLEntities();
        expect(entities.getParentModel()).to.be.null;
      });
    });

    describe("hasNonEmptyEntity", () => {
      it("should return true if the collection has a non-empty entity", () => {
        const { entities } = state;
        entities.add({ entityName: "MyData.csv" });
        entities.hasNonEmptyEntity().should.be.true;
      });

      it("should return false if the collection has no non-empty entities", () => {
        const { entities } = state;
        entities.add({ entityName: "MyData.csv" });
        entities.reset();
        entities.hasNonEmptyEntity().should.be.false;
      });
    });

    describe("getByFormatName", () => {
      it("should return all entities with the given format name", () => {
        const { entities } = state;
        entities.add({ entityType: "text/csv" });
        entities.add({ entityType: "text/csv" });
        entities.add({ entityType: "application/pdf" });
        entities.getByFormatName("text/csv").length.should.equal(2);
      });

      it("should return an empty array if no entities match the format name", () => {
        const { entities } = state;
        entities.add({ entityType: "text/csv" });
        entities.add({ entityType: "text/csv" });
        entities.add({ entityType: "application/pdf" });
        entities.getByFormatName("image/png").length.should.equal(0);
      });

      it("should ignore case when matching format names", () => {
        const { entities } = state;
        entities.add({ entityType: "text/csv" });
        entities.add({ entityType: "text/csv" });
        entities.add({ entityType: "application/pdf" });
        entities.getByFormatName("TEXT/CSV").length.should.equal(2);
      });
    });

    describe("getByFileName", () => {
      it("should return all entities with the given file name", () => {
        const { entities } = state;
        entities.add({ entityName: "MyData.csv" });
        entities.add({ entityName: "MyData.csv" });
        entities.add({ entityName: "OtherData.csv" });
        entities.getByFileName("MyData.csv").length.should.equal(2);
      });

      it("should return an empty array if no entities match the file name", () => {
        const { entities } = state;
        entities.add({ entityName: "MyData.csv" });
        entities.add({ entityName: "MyData.csv" });
        entities.add({ entityName: "OtherData.csv" });
        entities.getByFileName("MyData.xml").length.should.equal(0);
      });

      it("should ignore case when matching file names", () => {
        const { entities } = state;
        entities.add({ entityName: "MyData.csv" });
        entities.add({ entityName: "MyData.csv" });
        entities.add({ entityName: "OtherData.csv" });
        entities.getByFileName("MYDATA.CSV").length.should.equal(2);
      });

      it("should match file names with spaces", () => {
        const { entities } = state;
        entities.add({ entityName: "My Data.csv" });
        entities.add({ entityName: "My Data.csv" });
        entities.add({ entityName: "OtherData.csv" });
        entities.getByFileName("My Data.csv").length.should.equal(2);
      });
    });
  });
});
