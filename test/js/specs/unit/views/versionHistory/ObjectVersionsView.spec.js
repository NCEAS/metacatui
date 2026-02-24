define([
  "jquery",
  "collections/DataONEObjects",
  "views/versionHistory/ObjectVersionsView",
  "/test/js/specs/shared/clean-state.js",
], ($, DataONEObjects, ObjectVersionsView, cleanState) => {
  const expect = chai.expect;

  describe("ObjectVersionsView", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const originalPopup = $.fn.popup;
        $.fn.popup = sandbox.stub().callsFake(function popupStub() {
          return this;
        });

        const originalMetacatUI = globalThis.MetacatUI;
        const appModel = {
          get: sandbox.stub().callsFake((key) => {
            if (key === "alternateRepositories") return [];
            return null;
          }),
          getActiveAltRepo: sandbox.stub().returns(null),
          isDOI: sandbox.stub().returns(false),
        };
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          root: (originalMetacatUI && originalMetacatUI.root) || "",
          appModel,
          appUserModel: { get: sandbox.stub().returns(false) },
          nodeModel: { get: sandbox.stub(), length: 0 },
        };

        const collection = new DataONEObjects(
          [
            { identifier: "first" },
            { identifier: "second" },
            { identifier: "third" },
          ],
          { sort: false },
        );
        const el = document.createElement("ul");
        document.body.appendChild(el);
        const view = new ObjectVersionsView({
          el,
          collection,
        });

        return {
          sandbox,
          originalPopup,
          originalMetacatUI,
          collection,
          view,
          el,
        };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.view?.remove();
      state.el?.remove();
      $.fn.popup = state.originalPopup;
      globalThis.MetacatUI = state.originalMetacatUI;
      state.sandbox?.restore();
    });

    it("renders rows in the same order as the collection", () => {
      state.view.render();

      const ids = Array.from(
        state.el.querySelectorAll(".object-version__title"),
      ).map((node) => node.textContent.trim());

      expect(ids).to.deep.equal(["first", "second", "third"]);
    });
  });
});
