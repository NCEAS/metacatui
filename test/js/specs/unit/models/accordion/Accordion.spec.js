"use strict";

define(["/test/js/specs/shared/clean-state.js", "models/accordion/Accordion"], (
  cleanState,
  Accordion,
) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("Accordion Test Suite", () => {
    const state = cleanState(() => {
      const accordion = new Accordion({
        items: [
          {
            title: "Title 1",
            content: "Content 1",
            itemId: "1",
          },
          {
            title: "Title 2",
            content: "Content 2",
            itemId: "2",
          },
          {
            title: "Title 1A",
            content: "Content 1A",
            parent: "1",
          },
        ],
      });
      return { accordion };
    }, beforeEach);

    it("creates an Accordion instance", () => {
      state.accordion.should.be.instanceof(Accordion);
    });

    it("creates a collection for the Accordion items", () => {
      state.accordion.get("items").should.be.instanceof(Backbone.Collection);
    });

    it("gets children of an item", () => {
      const children = state.accordion.getChildren("1");
      children.should.have.lengthOf(1);
      children[0].get("title").should.equal("Title 1A");
    });

    it("gets root items", () => {
      const rootItems = state.accordion.getRootItems();
      rootItems.should.have.lengthOf(2);
      rootItems[0].get("title").should.equal("Title 1");
      rootItems[1].get("title").should.equal("Title 2");
    });
  });
});
