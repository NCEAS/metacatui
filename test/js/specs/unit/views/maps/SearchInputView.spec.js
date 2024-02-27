define([
  "views/maps/SearchInputView",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/unit/views/maps/SearchInputViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
], (SearchInputView, SearchInputViewHarness, cleanState) => {
  const expect = chai.expect;
  const sandbox = sinon.createSandbox();
  const stub = sandbox.stub;
  const spy = sinon.spy();

  describe("SearchInputView Test Suite", () => {
    const state = cleanState(() => {
      const view = new SearchInputView({
        search: new Function(),
      });
      view.render();
      const harness = new SearchInputViewHarness(view);

      return { harness, view };
    }, beforeEach);

    afterEach(() => {
      sandbox.restore();
      spy.resetHistory();
    });

    describe("Initialization", () => {
      it("creates a SearchInputView instance", () => {
        state.view.should.be.instanceof(SearchInputView);
      });

      it("throws if search function is not defined", () => {
        expect(() => new SearchInputView({})).to.throw();
      });
    });

    it("has an input for the user's search query", () => {
      state.harness.typeQuery("123");

      expect(state.view.getInput().val()).to.equal("123");
    });

    describe("search", () => {
      it("calls the search function on hitting 'Enter' key", () => {
        state.view.search = spy;
  
        state.harness.clickSearch();
  
        expect(spy.callCount).to.equal(1);
      });
  
      it("calls the search function on clicking search button", () => {
        state.view.search = spy;
  
        state.harness.clickSearch();
  
        expect(spy.callCount).to.equal(1);
      });
  
      it("only shows search button if there is no input", () => {
        state.harness.typeQuery("123");
        state.harness.hitEnter();
  
        expect(state.harness.getSearchButton().css("display")).to.equal("none");
  
        state.harness.typeQuery("");
        state.harness.hitEnter();
  
        expect(state.harness.getSearchButton().css("display")).to.not.equal("none");
      });
  
      it("only shows cancel button if there is input", () => {
        state.harness.typeQuery("123");
        state.harness.hitEnter();
  
        expect(state.harness.getCancelButton().css("display")).to.not.equal("none");
  
        state.harness.typeQuery("");
        state.harness.hitEnter();
  
        expect(state.harness.getCancelButton().css("display")).to.equal("none");
      });
  
      it("hides error text if it's not returned", () => {
        const error = state.harness.getError();
        expect(error.css("display")).to.equal("none");
        stub(state.view, "search").returns({});
  
        state.harness.clickSearch();
  
        expect(error.css("display")).to.equal("none");
      });
  
      it("shows error text if it's returned", () => {
        const error = state.harness.getError();
        expect(error.css("display")).to.equal("none");
        stub(state.view, "search").returns({ errorText: "ERR" });
  
        state.harness.clickSearch();
  
        expect(error.css("display")).to.not.equal("none");
      });
  
      it("clears errors text after fixing input error and searching again", () => {
        const error = state.harness.getError();
        stub(state.view, "search").returns({ errorText: "ERR" });
        state.harness.clickSearch();
  
        sandbox.restore();
        stub(state.view, "search").returns({});
        state.harness.clickSearch();
  
        expect(error.css("display")).to.equal("none");
      });
  
      it("applies an error class to the input box if there is no match", () => {
        stub(state.view, "search").returns({ matched: false });
  
        state.harness.clickSearch();
  
        expect(state.harness.hasErrorInput()).to.be.true;
      });
  
      it("clears input error class after fixing input error and searching again", () => {
        stub(state.view, "search").returns({ matched: false });
        state.harness.clickSearch();
  
        sandbox.restore();
        stub(state.view, "search").returns({ matched: true });
        state.harness.clickSearch();
  
        expect(state.harness.hasErrorInput()).to.be.false;
      });
    });

    describe("cancel", () => {
      it("clears input value", () => {
        state.harness.typeQuery("123");
        state.harness.clickCancel();

        expect(state.view.getInput().val()).to.equal("");
      });

      it("performs search on empty string", () => {
        state.view.search = spy;
        state.harness.clickCancel();

        expect(spy.withArgs("").callCount).to.equal(1);
      });
    });
  });
});
