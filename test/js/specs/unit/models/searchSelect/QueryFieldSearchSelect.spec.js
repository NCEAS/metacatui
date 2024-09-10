"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/searchSelect/QueryFieldSearchSelect",
], (cleanState, QueryFieldSearchSelect) => {
  const should = chai.should();
  const expect = chai.expect;

  const state = cleanState(() => {
    const queryFieldSearchSelect = new QueryFieldSearchSelect();
    return { queryFieldSearchSelect };
  }, beforeEach);

  describe("QueryFieldSearchSelect Test Suite", () => {
    it("creates a QueryFieldSearchSelect instance", () => {
      state.queryFieldSearchSelect.should.be.instanceof(QueryFieldSearchSelect);
    });

    it("has default properties", () => {
      const defaults = state.queryFieldSearchSelect.defaults();
      expect(defaults).to.have.property("addFields");
      expect(defaults).to.have.property("commonFields");
      expect(defaults).to.have.property("categoriesToAlphabetize");
      expect(defaults).to.have.property("excludeNonSearchable");
      expect(defaults).to.have.property("submenuStyle");
      expect(defaults).to.have.property("excludeFields");
    });

    it("fetches query fields", () => {
      const queryFields = state.queryFieldSearchSelect.fetchQueryFields();
      queryFields.should.be.instanceof(Promise);
    });

    // check that the promise resolves with a QueryFields collection
    it("fetches query fields", async () => {
      const queryFields = await state.queryFieldSearchSelect.fetchQueryFields();
      queryFields.models.should.have.lengthOf.above(0);
      queryFields.models[0].get("name").should.be.a("string");
    });

    it("excludes fields", () => {
      const fieldsJSON = [
        { name: "field1" },
        { name: "field2", searchable: false },
      ];
      state.queryFieldSearchSelect.set("excludeFields", ["field2"]);
      const excludedFields =
        state.queryFieldSearchSelect.excludeFields(fieldsJSON);
      excludedFields.should.have.lengthOf(1);
      excludedFields[0].name.should.equal("field1");
    });

    it("adds fields", () => {
      const fieldsJSON = [{ name: "field1" }, { name: "field2" }];
      state.queryFieldSearchSelect.set("addFields", [
        { name: "field3", fields: ["field1", "field2"] },
      ]);
      const addedFields = state.queryFieldSearchSelect.addFields(fieldsJSON);
      addedFields.should.have.lengthOf(3);
      addedFields[2].name.should.equal("field3");
    });

    it("converts field to option", () => {
      const field = {
        name: "field1",
        label: "Field 1",
        description: "Description",
        icon: "icon",
        category: "Category",
        categoryOrder: 1,
        type: "Type",
      };
      const option = state.queryFieldSearchSelect.fieldToOption(field);
      option.label.should.equal("Field 1");
      option.value.should.equal("field1");
      option.description.should.equal("Description");
      option.icon.should.equal("icon");
      option.category.should.equal("Category");
      option.categoryOrder.should.equal(1);
      option.type.should.equal("Type");
    });

    it("sorts fields", () => {
      const unsortedOptions = [
        {
          label: "Zebra",
          category: "Category 1",
          categoryOrder: 1,
          value: "field2",
        },
        {
          label: "CommonField",
          category: "Category 1",
          categoryOrder: 1,
          value: "field0",
        },
        {
          label: "Banana",
          category: "Category 2",
          categoryOrder: 2,
          value: "field3",
        },
        {
          label: "Apple",
          category: "Category 1",
          categoryOrder: 1,
          value: "field1",
        },
      ];
      state.queryFieldSearchSelect.set("commonFields", ["field0"]);
      state.queryFieldSearchSelect.set("categoriesToAlphabetize", [
        "Category 1",
      ]);
      const sortedOptions =
        state.queryFieldSearchSelect.sortFields(unsortedOptions);
      sortedOptions[0].value.should.equal("field0");
      sortedOptions[1].value.should.equal("field1");
      sortedOptions[2].value.should.equal("field2");
      sortedOptions[3].value.should.equal("field3");
    });

    it("adds extra fields to the query field options", () => {
      state.queryFieldSearchSelect.set("addFields", [
        {
          name: "specialField",
          fields: ["field1", "field2"],
          label: "Special Field",
          description: "Description",
          category: "Category",
        },
      ]);
      const updatedJSON = state.queryFieldSearchSelect.addFields([]);
      updatedJSON.should.have.lengthOf(1);
    });

    it("checks if a value is valid", async () => {
      // Make sure the query field options are fetched before testing
      state.queryFieldSearchSelect.listenToOnce(
        state.queryFieldSearchSelect,
        "change:options",
        () => {
          state.queryFieldSearchSelect.isValidValue("text").should.be.true;
        },
      );
    });
  });
});
