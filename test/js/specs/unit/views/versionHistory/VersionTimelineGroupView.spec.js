define([
  "jquery",
  "backbone",
  "collections/DataONEObjects",
  "views/versionHistory/VersionTimelineGroupView",
  "/test/js/specs/shared/clean-state.js",
], ($, Backbone, DataONEObjects, VersionTimelineGroupView, cleanState) => {
  const expect = chai.expect;

  describe("VersionTimelineGroupView", () => {
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

        const models = new DataONEObjects(
          [
            {
              identifier: "p1",
              dateUploaded: "2022-08-08T00:00:00Z",
              versionDateNote: {
                prevPid: "p1",
                nextPid: "p2",
                timeDiffMs: 1000,
              },
            },
            {
              identifier: "p2",
              dateUploaded: "2022-08-08T00:10:00Z",
            },
          ],
          { sort: false },
        );

        const groupModel = new Backbone.Model({
          id: "segment:0:p1",
          sequence: 0,
          date: new Date("2022-08-08T00:00:00Z"),
          label: null,
          models,
        });

        const view = new VersionTimelineGroupView({
          model: groupModel,
          referencePid: "ref.1",
        });
        document.body.appendChild(view.el);

        return {
          sandbox,
          originalPopup,
          originalMetacatUI,
          models,
          view,
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

    it("toggles the group date note class when versionDateNote flags change", () => {
      state.models.at(0).unset("versionDateNote");
      state.view.render();
      expect(
        state.view.el.classList.contains("version-history-group--date-note"),
      ).to.equal(false);

      state.models.at(1).set("versionDateNote", {
        prevPid: "p2",
        nextPid: "p3",
        timeDiffMs: 2000,
      });
      expect(
        state.view.el.classList.contains("version-history-group--date-note"),
      ).to.equal(true);

      const iconEl = state.view.el.querySelector(
        ".version-history-group__point-note-icon",
      );
      expect(iconEl).to.exist;
      expect(iconEl.getAttribute("aria-label")).to.contain("Note on dates");
    });

    it("does not mark the group if only hidden rows in the group have date notes", () => {
      state.models.at(0).set("hiddenByUI", true);
      state.models.at(1).unset("versionDateNote");
      state.view.render();

      expect(
        state.view.el.classList.contains("version-history-group--date-note"),
      ).to.equal(false);
    });

    it("updates rows when same-length model lists change order", () => {
      state.view.render();

      state.view.setModels([state.models.at(1), state.models.at(0)]);

      expect(
        state.view.collection.map((model) => model.get("identifier")),
      ).to.deep.equal(["p2", "p1"]);
      const titles = Array.from(
        state.view.el.querySelectorAll(".object-version__title"),
      ).map((node) => node.textContent.trim());
      expect(titles).to.deep.equal(["p2", "p1"]);
    });
  });
});
