"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "collections/metadata/eml/EMLAttributes",
], (cleanState, EMLAttributes) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("EMLAttributes Test Suite", () => {
    const state = cleanState(() => {
      const dummyParentModel = { id: "parent1" };
      const dummyAttributeXML = `
        <attributelist>
          <attribute>
            <attributename>Attr Name</attributename>
            <attributelabel>Attr Label</attributelabel>
            <attributedefinition>Definition</attributedefinition>
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
            <missingvaluecode>
              <code>Missing Code</code>
              <codeexplanation>Missing Explanation</codeexplanation>
            </missingvaluecode>
          </attribute>
        </attributelist>`;
      const dummyAttributeAttrs = {
        attributeName: "Attr Name",
        attributeLabel: "Attr Label",
        attributeDefinition: "Definition",
        measurementScale: {
          nominal: {
            nonNumericDomain: {
              textDomain: {
                definition: "Any text",
                pattern: "*",
              },
            },
          },
        },
        missingValueCode: [
          {
            code: "Missing Code",
            codeExplanation: "Missing Explanation",
          },
        ],
        parentModel: dummyParentModel,
      };
      const emlAttributes = new EMLAttributes();
      return {
        emlAttributes,
        dummyParentModel,
        dummyAttributeXML,
        dummyAttributeAttrs,
      };
    }, beforeEach);

    describe("parse", () => {
      it("should correctly parse a response with attribute nodes", () => {
        const response = new DOMParser().parseFromString(
          state.dummyAttributeXML,
          "application/xml",
        );
        const parsed = state.emlAttributes.parse(response, {
          parentModel: state.dummyParentModel,
        });
        expect(parsed).to.be.an("array").that.has.lengthOf(1);
        const parsedAttr = parsed[0];
        expect(parsedAttr.objectDOM.tagName.toLowerCase()).to.equal(
          "attribute",
        );
      });
    });

    describe("getParentModel", () => {
      it("should return the parent model if any attribute has it", () => {
        // Create two dummy models (Backbone Models are used here)
        const modelWithParent = new Backbone.Model({
          parentModel: state.dummyParentModel,
        });
        const modelWithout = new Backbone.Model({});
        state.emlAttributes.reset([modelWithout, modelWithParent]);
        expect(state.emlAttributes.getParentModel()).to.equal(
          state.dummyParentModel,
        );
      });

      it("should return null if no attribute has a parent model", () => {
        const model = new Backbone.Model({});
        state.emlAttributes.reset([model]);
        expect(state.emlAttributes.getParentModel()).to.be.null;
      });
    });

    describe("addAttribute", () => {
      it("should add an attribute with the provided properties", () => {
        const newAttr = state.emlAttributes.addAttribute({
          attributeName: "testAttribute",
          parentModel: state.dummyParentModel,
        });
        expect(newAttr.get("attributeName")).to.equal("testAttribute");
        expect(newAttr.get("parentModel")).to.equal(state.dummyParentModel);
      });

      it("should assign parent model from the collection when not provided", () => {
        // First, add a model that contains a parentModel
        const modelWithParent = new Backbone.Model({
          parentModel: state.dummyParentModel,
        });
        state.emlAttributes.reset([modelWithParent]);

        const newAttr = state.emlAttributes.addAttribute({
          attributeName: "noParentProvided",
        });
        expect(newAttr.get("parentModel")).to.equal(state.dummyParentModel);
      });
    });

    describe("getNewAttribute", () => {
      it("should return the new attribute if one exists", () => {
        const newAttr = new Backbone.Model({ isNew: true });
        state.emlAttributes.reset([newAttr]);
        expect(state.emlAttributes.getNewAttribute()).to.equal(newAttr);
      });

      it("should return undefined when there is no new attribute", () => {
        const regularModel = new Backbone.Model({ isNew: false });
        state.emlAttributes.reset([regularModel]);
        expect(state.emlAttributes.getNewAttribute()).to.be.undefined;
      });
    });

    describe("addNewAttribute", () => {
      it("should add and return a new attribute if none exists", () => {
        const newAttr = state.emlAttributes.addNewAttribute(
          state.dummyParentModel,
        );
        expect(newAttr.get("isNew")).to.be.true;
        expect(newAttr.get("parentModel")).to.equal(state.dummyParentModel);
      });

      it("should return the existing new attribute if one is already present", () => {
        const existingNewAttr = new Backbone.Model({
          isNew: true,
          parentModel: state.dummyParentModel,
        });
        state.emlAttributes.reset([existingNewAttr]);
        // Passing a different parentModel here should not create a new new attribute.
        const result = state.emlAttributes.addNewAttribute({
          id: "differentParent",
        });
        expect(result).to.equal(existingNewAttr);
      });
    });

    describe("hasNonEmptyAttributes", () => {
      it("should return true if at least one attribute is not empty", () => {
        // Create a non-empty model by stubbing isEmpty
        const nonEmptyModel = new Backbone.Model();
        nonEmptyModel.isEmpty = () => false;
        const emptyModel = new Backbone.Model();
        emptyModel.isEmpty = () => true;
        state.emlAttributes.reset([emptyModel, nonEmptyModel]);
        expect(state.emlAttributes.hasNonEmptyAttributes()).to.be.true;
      });

      it("should return false if all attributes are empty", () => {
        const emptyModel1 = new Backbone.Model();
        emptyModel1.isEmpty = () => true;
        const emptyModel2 = new Backbone.Model();
        emptyModel2.isEmpty = () => true;
        state.emlAttributes.reset([emptyModel1, emptyModel2]);
        expect(state.emlAttributes.hasNonEmptyAttributes()).to.be.false;
      });
    });

    describe("validate", () => {
      it("should return an empty array when all attributes are valid", () => {
        const validModel = new Backbone.Model();
        validModel.isValid = () => true;
        state.emlAttributes.reset([validModel]);
        const errors = state.emlAttributes.validate();
        expect(errors).to.be.an("array").that.is.empty;
      });

      it("should collect validation errors from invalid attributes", () => {
        const invalidModel = {
          attributeName: "A model missing required fields",
        };
        state.emlAttributes.reset([invalidModel]);
        const errors = state.emlAttributes.validate();
        expect(errors).to.be.an("array").that.has.lengthOf(1);
      });
    });

    describe("comparator", () => {
      it("should sort new models to the end of the collection", () => {
        const newModel = new Backbone.Model({ isNew: true });
        const existingModel = new Backbone.Model({ isNew: false });
        state.emlAttributes.reset([newModel, existingModel]);
        state.emlAttributes.sort();
        expect(state.emlAttributes.at(0)).to.equal(existingModel);
        expect(state.emlAttributes.at(1)).to.equal(newModel);
      });
    });

    describe("removeEmptyAttributes", () => {
      it("should remove all empty attributes from the collection", () => {
        const emptyModel = new Backbone.Model();
        emptyModel.isEmpty = () => true;
        const nonEmptyModel = new Backbone.Model();
        nonEmptyModel.isEmpty = () => false;
        state.emlAttributes.reset([emptyModel, nonEmptyModel]);
        const removed = state.emlAttributes.removeEmptyAttributes();
        expect(removed).to.include(emptyModel);
        expect(state.emlAttributes.models).to.not.include(emptyModel);
        expect(state.emlAttributes.models).to.include(nonEmptyModel);
      });
    });

    describe("isValid", () => {
      it("should return true if all attributes are valid", () => {
        const validModel = new Backbone.Model();
        validModel.isValid = () => true;
        state.emlAttributes.reset([validModel]);
        expect(state.emlAttributes.isValid()).to.be.true;
      });

      it("should return false if any attribute is invalid", () => {
        const invalidModel = new Backbone.Model();
        invalidModel.isValid = () => false;
        state.emlAttributes.reset([invalidModel]);
        expect(state.emlAttributes.isValid()).to.be.false;
      });
    });
  });
});
