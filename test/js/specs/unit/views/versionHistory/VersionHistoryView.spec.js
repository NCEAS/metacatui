define([
  "backbone",
  "views/versionHistory/VersionHistoryView",
  "/test/js/specs/shared/clean-state.js",
], (Backbone, VersionHistoryView, cleanState) => {
  const expect = chai.expect;

  describe("VersionHistoryView", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const originalMetacatUI = globalThis.MetacatUI;
        const appModel = {
          addCSS: sandbox.stub(),
          get: sandbox.stub().callsFake((key) => {
            if (key === "alternateRepositories") return [];
            return null;
          }),
          getActiveAltRepo: sandbox.stub().returns(null),
          isDOI: sandbox.stub().returns(false),
        };
        const appUserModel = {
          get: sandbox.stub().returns(false),
        };
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          root: (originalMetacatUI && originalMetacatUI.root) || "",
          appModel,
          appUserModel,
          nodeModel: { get: sandbox.stub(), length: 0 },
        };

        const view = new VersionHistoryView({ pid: "ref.1" });
        view.statusEl = document.createElement("div");
        view.statusEl.className = "alert alert-info";
        document.body.appendChild(view.statusEl);

        return {
          sandbox,
          originalMetacatUI,
          view,
        };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      const statusEl = state.view?.statusEl;
      state.view?.remove();
      statusEl?.remove?.();
      globalThis.MetacatUI = state.originalMetacatUI;
      state.sandbox?.restore();
    });

    it("applies row-level date notes and marks the out-of-order previous model", () => {
      state.view.collection = new Backbone.Collection([
        {
          id: "older.1",
          identifier: "older.1",
        },
        {
          id: "newer.1",
          identifier: "newer.1",
        },
      ]);

      const conflict = {
        prevPid: "older.1",
        nextPid: "newer.1",
        prevDate: new Date("2024-01-02T00:00:00Z"),
        nextDate: new Date("2024-01-01T00:00:00Z"),
        timeDiffMs: 24 * 60 * 60 * 1000,
      };

      state.view.applyDateNotes([conflict]);

      expect(
        state.view.collection.get("older.1").get("versionDateNote"),
      ).to.equal(conflict);
      expect(
        state.view.collection.get("newer.1").get("versionDateNote"),
      ).to.equal(undefined);
    });

    it("clears transient date note flags", () => {
      state.view.collection = new Backbone.Collection([
        {
          id: "older.1",
          identifier: "older.1",
          versionDateNote: { prevPid: "older.1" },
        },
        {
          id: "newer.1",
          identifier: "newer.1",
        },
      ]);

      state.view.clearDateNotes();

      expect(
        state.view.collection.get("older.1").get("versionDateNote"),
      ).to.equal(undefined);
    });

    it("removes alert-warning when updating the status to a different type", () => {
      state.view.showWarning("Something happened");
      expect(state.view.statusEl.classList.contains("alert-warning")).to.equal(
        true,
      );

      state.view.updateStatus("Done", "success");

      expect(state.view.statusEl.classList.contains("alert-success")).to.equal(
        true,
      );
      expect(state.view.statusEl.classList.contains("alert-warning")).to.equal(
        false,
      );
    });

    it("batches DOI filter visibility changes and refreshes the timeline once", () => {
      const doiModel = new Backbone.Model({
        id: "doi.1",
        identifier: "doi.1",
        hiddenByUI: false,
      });
      doiModel.isDOI = () => true;
      const nonDoiModel = new Backbone.Model({
        id: "pid.1",
        identifier: "pid.1",
        hiddenByUI: false,
      });
      nonDoiModel.isDOI = () => false;

      state.view.collection = new Backbone.Collection([doiModel, nonDoiModel]);
      state.view.timelineGroupsView = {
        updateVisualState: state.sandbox.stub(),
        remove: state.sandbox.stub(),
      };

      const hiddenChangeSpy = state.sandbox.spy();
      nonDoiModel.on("change:hiddenByUI", hiddenChangeSpy);

      state.view.onToggle("doi");

      expect(doiModel.get("hiddenByUI")).to.equal(false);
      expect(nonDoiModel.get("hiddenByUI")).to.equal(true);
      expect(hiddenChangeSpy.called).to.equal(false);
      expect(
        state.view.timelineGroupsView.updateVisualState.calledOnce,
      ).to.equal(true);
    });
  });
});
