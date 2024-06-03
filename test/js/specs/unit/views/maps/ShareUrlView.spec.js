"use strict";

define([
  "jquery",
  "underscore",
  "views/maps/ShareUrlView",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/unit/views/maps/ShareUrlViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
], ($, _, ShareUrlView, ShareUrlViewHarness, cleanState) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("ShareUrlView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const linkTitle = document.createElement("div");
      const linkTitleHiddenClassName = "hidden";
      linkTitle.classList.add(linkTitleHiddenClassName);
      const view = new ShareUrlView({
        left: 1,
        top: 2,
        linkTitle,
        linkTitleHiddenClassName,
      });
      const harness = new ShareUrlViewHarness(view);

      // Actually render the view to document to test focus events.
      const testContainer = document.createElement("div");
      testContainer.id = "test-container";
      testContainer.append(view.el);
      document.body.append(testContainer);
      document.body.append(linkTitle);

      return {
        harness,
        sandbox,
        testContainer,
        view,
      };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      state.view.triggerBodyClick();
      state.testContainer.remove();
    });

    it("creates a ShareUrlView instance", () => {
      state.view.render();

      state.view.should.be.instanceof(ShareUrlView);
    });

    it("sets the left attribute for absolute positioning", () => {
      state.view.render();

      expect(state.view.$el.css("left")).to.equal("1px");
    });

    it("sets the top attribute for absolute positioning", () => {
      state.view.render();

      expect(state.view.$el.css("top")).to.equal("2px");
    });

    it("hides itself upon clicking the document", () => {
      state.view.render();
      const removeSpy = sinon.spy(state.view, "remove");
      state.view.skipEvent = false;

      $("body").click();

      expect(removeSpy.callCount).to.equal(1);
    });

    it("saves a reference to a linkTitle element with a specific class name", () => {
      state.view.render();

      expect(
        state.view.linkTitle.classList.contains(
          state.view.linkTitleHiddenClassName,
        ),
      ).to.be.true;
    });

    it("removes class name from link title upon clicking the document", () => {
      state.view.render();
      state.view.skipEvent = false;

      $("body").click();

      expect(
        state.view.linkTitle.classList.contains(
          state.view.linkTitleHiddenClassName,
        ),
      ).to.be.false;
    });

    it("hides itself when clicking the remove button", () => {
      state.view.render();
      const removeSpy = sinon.spy(state.view, "remove");
      state.view.skipEvent = false;

      state.harness.clickRemove();

      expect(removeSpy.callCount).to.equal(1);
    });

    it("copies the text to clipboard after clicking the copy button", () => {
      state.view.render();
      state.sandbox
        .stub(navigator.clipboard, "writeText")
        .returns(Promise.resolve());

      state.harness.clickCopy();

      expect(navigator.clipboard.writeText.callCount).to.equal(1);
    });

    it("shows a hint after successfully copying", async () => {
      state.view.render();
      state.sandbox
        .stub(navigator.clipboard, "writeText")
        .returns(Promise.resolve());

      state.harness.clickCopy();
      // Wait for navigator.clipboard.writeText to resolve.
      await Promise.resolve();

      expect(state.harness.hasHint()).to.be.true;
      expect(state.harness.hasError()).to.be.false;
    });

    it("shows an error after failing to copy to clipboard", async () => {
      state.view.render();
      state.sandbox
        .stub(navigator.clipboard, "writeText")
        .returns(Promise.reject());

      state.harness.clickCopy();
      // Wait for navigator.clipboard.writeText to resolve.
      await Promise.resolve();

      expect(state.harness.hasError()).to.be.true;
      expect(state.harness.hasHint()).to.be.false;
    });
  });
});
