"use strict";

define(["/test/js/specs/shared/clean-state.js", "models/accordion/AccordionItem"], (
  cleanState,
  AccordionItem,
) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("AccordionItem Test Suite", () => {
    const state = cleanState(() => {
      const accordionItem = new AccordionItem({
        title: "Title 1",
        content: "Content 1",
      });
      return { accordionItem };
    }, beforeEach);

    it("creates an AccordionItem instance", () => {
      state.accordionItem.should.be.instanceof(AccordionItem);
    });


    it("automatically sets an itemId based on the title", () => {
      state.accordionItem.get("itemId").should.equal("title-1");
    });

    it("doesn't replace an itemId if one is provided", () => {
      const accordionItem = new AccordionItem({
        title: "Title 2",
        itemId: "custom-id",
      });
      accordionItem.get("itemId").should.equal("custom-id");
      // Clean up
      accordionItem.destroy();
    });
  });
});
