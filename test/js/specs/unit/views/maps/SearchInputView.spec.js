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
        noMatchCallback: new Function(),
      });
      view.render();
      const harness = new SearchInputViewHarness(view);

      // Actually render the view to document to test focus events.
      const testContainer = document.createElement("div");
      testContainer.id = "test-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      return { harness, testContainer, view };
    }, beforeEach);

    afterEach(() => {
      sandbox.restore();
      spy.resetHistory();
      state.testContainer.remove();
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

      it("shows search button as active if there is input", () => {
        state.harness.typeQuery("123");
        state.harness.hitEnter();

        expect(state.harness.getSearchButton().hasClass("search-input__search-button--active")).to.be.true;

        state.harness.typeQuery("");
        state.harness.hitEnter();

        expect(state.harness.getSearchButton().hasClass("search-input__search-button--active")).to.be.false;
      });

      it("only shows cancel button if there is input", () => {
        state.harness.typeQuery("123");
        state.harness.hitEnter();

        expect(state.harness.getCancelButtonContainer().css("display")).to.not.equal("none");

        state.harness.typeQuery("");
        state.harness.hitEnter();

        expect(state.harness.getCancelButtonContainer().css("display")).to.equal("none");
      });

      it("clears error text", () => {
        const error = state.view.getError();
        error.css("display", "block");

        state.harness.clickSearch();

        expect(error.css("display")).to.equal("none");
      });

      it("calls noMatchCallback if there is no match", () => {
        state.view.noMatchCallback = spy;
        stub(state.view, "search").returns(false);

        state.harness.clickSearch();

        expect(spy.callCount).to.equal(1);
      });

      it("clears input error class after fixing input error and searching again", () => {
        stub(state.view, "search").returns(false);
        state.harness.clickSearch();

        sandbox.restore();
        stub(state.view, "search").returns(true);
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

    describe("setError", () => {
      it("shows error text if it exists", () => {
        const error = state.view.getError();
        expect(error.css("display")).to.equal("none");

        state.view.setError("ERR");

        expect(error.css("display")).to.not.equal("none");
      });

      it("hides error text if it doesn't exist", () => {
        const error = state.view.getError();
        error.css("display", "block");

        state.view.setError("");

        expect(error.css("display")).to.equal("none");
      });

      it("applies an error class to the input field if there is an error", () => {
        state.view.setError("ERR");

        expect(state.harness.hasErrorInput()).to.be.true;
      });

    });

    it('calls blurCallback on blur', () => {
      state.view.blurCallback = spy;

      state.harness.blurInput();

      expect(spy.callCount).to.equal(1);
    });

    it('calls focusCallback on focus', () => {
      state.view.focusCallback = spy;

      state.harness.focusInput();

      expect(spy.callCount).to.equal(1);
    });

    it('calls keyupCallback on keyup', () => {
      state.view.keyupCallback = spy;

      state.harness.keyup('a');

      expect(spy.callCount).to.equal(1);
    });

    it('calls keydownCallback on keydown', () => {
      state.view.keydownCallback = spy;

      state.harness.keydown('a');

      expect(spy.callCount).to.equal(1);
    });

    it('clears errors on keydown when input is empty', () => {
      state.view.setError("ERR");

      expect(state.harness.hasErrorInput()).to.be.true;

      state.harness.keydown('');

      expect(state.harness.hasErrorInput()).to.be.false;
    });

    it('focuses the input field on focus', () => {
      state.view.focus();

      expect(state.harness.getInput().is(':focus')).to.be.true;
    });

    it('blurs the input field on blur', () => {
      state.view.focus();
      state.view.blur();

      expect(state.harness.getInput().is(':focus')).to.be.false;
    });
  });
});
