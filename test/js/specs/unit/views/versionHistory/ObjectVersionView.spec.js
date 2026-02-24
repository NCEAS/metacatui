define([
  "jquery",
  "collections/DataONEObjects",
  "views/versionHistory/ObjectVersionView",
  "/test/js/specs/shared/clean-state.js",
], ($, DataONEObjects, ObjectVersionView, cleanState) => {
  const expect = chai.expect;

  describe("ObjectVersionView", () => {
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

        const referencePid = "ref.1";
        const collection = new DataONEObjects(
          [
            {
              identifier: referencePid,
              dateUploaded: "2021-01-01T00:00:00Z",
              versionHistory: { [referencePid]: 0 },
            },
            {
              identifier: "target.1",
              dateUploaded: "2022-01-01T00:00:00Z",
              obsoletedBy: "next.1",
              versionHistory: { [referencePid]: 1 },
            },
          ],
          { sort: false },
        );

        const model = collection.findWhere({ identifier: "target.1" });
        const view = new ObjectVersionView({
          model,
          referencePid,
        });
        document.body.appendChild(view.el);

        return {
          sandbox,
          originalPopup,
          originalMetacatUI,
          collection,
          model,
          view,
          referencePid,
        };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.view?.remove();
      $.fn.popup = state.originalPopup;
      globalThis.MetacatUI = state.originalMetacatUI;
      state.sandbox?.restore();
    });

    it("renders a date conflict note only when versionDateConflict is present", () => {
      state.view.render();
      expect(
        state.view.el.querySelector(".object-version__date-conflict-note"),
      ).to.equal(null);

      state.model.set("versionDateConflict", {
        prevPid: "target.1",
        nextPid: "<next.1>",
        prevDate: new Date("2022-01-01T00:00:00Z"),
        nextDate: new Date("2021-01-01T00:00:00Z"),
        timeDiffMs: 24 * 60 * 60 * 1000,
      });

      const noteEl = state.view.el.querySelector(
        ".object-version__date-conflict-note",
      );
      expect(noteEl).to.exist;
      expect(noteEl.textContent).to.contain("Date Conflict");
      expect(noteEl.textContent).to.contain("successor in the version chain");
      expect(noteEl.innerHTML).to.contain("&lt;next.1&gt;");
      expect(noteEl.innerHTML).to.not.contain("<next.1>");
    });

    it("still renders badges and initializes tooltips when a date conflict note is present", () => {
      state.model.set("versionDateConflict", {
        prevPid: "target.1",
        nextPid: "next.1",
        prevDate: new Date("2022-01-01T00:00:00Z"),
        nextDate: new Date("2021-01-01T00:00:00Z"),
        timeDiffMs: 24 * 60 * 60 * 1000,
      });

      state.view.render();

      const badges = state.view.el.querySelectorAll(".object-version__badge");
      expect(badges.length).to.be.greaterThan(0);
      expect($.fn.popup.called).to.equal(true);
    });
  });
});
