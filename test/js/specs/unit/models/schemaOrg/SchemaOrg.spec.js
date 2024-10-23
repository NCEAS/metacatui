"use strict";

define(["/test/js/specs/shared/clean-state.js", "models/schemaOrg/SchemaOrg"], (
  cleanState,
  SchemaOrg,
) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("SchemaOrg Test Suite", () => {
    const state = cleanState(() => {
      const schemaOrg = new SchemaOrg();
      return { schemaOrg };
    }, beforeEach);

    it("creates a SchemaOrg instance", () => {
      state.schemaOrg.should.be.instanceof(SchemaOrg);
    });

    it("creates a default context", () => {
      state.schemaOrg.get("@context").should.deep.equal({
        "@vocab": "https://schema.org/",
      });
    });

    it("serializes the model", () => {
      const json = state.schemaOrg.serialize();
      json.should.be.a("string");
    });

    it("adjusts description length", () => {
      const str = "This is a description.";
      const adjusted = state.schemaOrg.adjustDescriptionLength(str);
      adjusted.should.be.a("string");
      adjusted.should.not.equal(str);
      adjusted.length.should.be.at.least(50);
    });

    it("truncates a description", () => {
      // Make a 5000+ character string
      const str = "a".repeat(5001);
      const descEnd = "This is the end.";
      const truncated = state.schemaOrg.truncateDescription(str, descEnd);
      truncated.should.be.a("string");
      truncated.should.not.equal(str);
      truncated.length.should.be.at.most(5000);
      truncated.should.include(descEnd);
    });

    it("pads a description", () => {
      const str = "This is a description.";
      const descEnd =
        "This is the ending and it is at least 50 characters long.";
      const padded = state.schemaOrg.padDescription(str, descEnd);
      padded.should.be.a("string");
      padded.should.not.equal(str);
      padded.length.should.be.at.least(50);
    });

    it("sets a schema", () => {
      state.schemaOrg.setSchema("Dataset");
      state.schemaOrg.get("@type").should.equal("Dataset");
    });

    it("sets a schema from a template", () => {
      const template = JSON.stringify({
        "@type": "Dataset",
        name: "Name",
      });
      state.schemaOrg.setSchemaFromTemplate(template);
      state.schemaOrg.get("name").should.equal("Name");
    });

    it("resets the model", () => {
      state.schemaOrg.set("name", "Name");
      state.schemaOrg.reset();
      should.not.exist(state.schemaOrg.get("name"));
    });

    it("sets a data catalog schema", () => {
      state.schemaOrg.setDataCatalogSchema();
      state.schemaOrg.get("@type").should.equal("DataCatalog");
    });

    it("sets a dataset schema", () => {
      const model = new Backbone.Model({
        datasource: "DataONE",
        id: "id",
        seriesId: "seriesId",
        northBoundCoord: 90,
        eastBoundCoord: 180,
        southBoundCoord: -90,
        westBoundCoord: -180,
        beginDate: "2021-01-01",
        endDate: "2021-12-31",
        title: "Title",
        origin: ["Origin"],
        attributeName: "Attribute",
        abstract: "Abstract",
        keywords: ["Keyword"],
      });
      state.schemaOrg.setDatasetSchema(model);
      state.schemaOrg.get("@type").should.equal("Dataset");
      state.schemaOrg.get("name").should.equal("Title");
      state.schemaOrg.get("variableMeasured").should.equal("Attribute");
      state.schemaOrg.get("description").should.equal("Abstract");
    });

    it("gets a DOI URL", () => {
      const doiURL = state.schemaOrg.getDOIURL("id", "seriesId");
      doiURL.should.equal("");
    });

    it("generates an identifier", () => {
      const identifier = state.schemaOrg.generateIdentifier("id", "seriesId");
      identifier.should.be.a("string");
    });

    it("generates spatial coverage", () => {
      const spatial = state.schemaOrg.generateSpatialCoverage(
        90,
        180,
        -90,
        -180,
      );
      spatial.should.be.an("object");
    });

    it("generates a GeoJSON string", () => {
      const geoJSON = state.schemaOrg.generateGeoJSONString(90, 180, -90, -180);
      geoJSON.should.be.a("string");
    });

    it("generates a GeoJSON Point", () => {
      const geoJSON = state.schemaOrg.generateGeoJSONPoint(90, 180);
      geoJSON.should.be.a("string");
      geoJSON.should.include("Point");
      geoJSON.should.include("coordinates");
    });

    it("generates a GeoJSON Polygon", () => {
      const geoJSON = state.schemaOrg.generateGeoJSONPolygon(
        90,
        180,
        -90,
        -180,
      );
      geoJSON.should.be.a("string");
      geoJSON.should.include("Polygon");
      geoJSON.should.include("Feature");
    });
  });
});
