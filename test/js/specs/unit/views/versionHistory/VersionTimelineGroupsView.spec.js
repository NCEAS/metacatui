define([
  "backbone",
  "views/versionHistory/VersionTimelineGroupsView",
  "/test/js/specs/shared/clean-state.js",
], (Backbone, VersionTimelineGroupsView, cleanState) => {
  const { expect } = chai;

  describe("VersionTimelineGroupsView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const collection = new Backbone.Collection([
        {
          id: "segment:0:newer",
          sequence: 0,
          date: new Date("2024-02-02T00:00:00Z"),
          models: [],
        },
        {
          id: "segment:1:older",
          sequence: 1,
          date: new Date("2024-01-01T00:00:00Z"),
          models: [],
        },
      ]);
      const view = new VersionTimelineGroupsView({
        collection,
        referencePid: "ref.1",
      });
      document.body.appendChild(view.el);
      return { sandbox, collection, view };
    }, beforeEach);

    afterEach(() => {
      state.view?.remove();
      state.sandbox?.restore();
    });

    it("renders and reuses one child view per group model", () => {
      const returned = state.view.render();
      const firstModel = state.collection.at(0);
      const firstChild = state.view.childViews.get(firstModel.cid);

      expect(returned).to.equal(state.view);
      expect(state.view.childViews.size).to.equal(2);
      expect(firstChild.referencePid).to.equal("ref.1");
      expect(state.view.el.children.length).to.equal(2);

      state.view.render();

      expect(state.view.childViews.get(firstModel.cid)).to.equal(firstChild);
      expect(state.view.el.children.length).to.equal(2);
    });

    it("keeps child views in sync with collection changes", () => {
      state.view.render();
      const firstModel = state.collection.at(0);
      const firstChild = state.view.childViews.get(firstModel.cid);
      state.sandbox.spy(firstChild, "setModels");
      state.sandbox.spy(firstChild, "setDateAndLabel");

      const replacementModels = [];
      firstModel.set("models", replacementModels);
      firstModel.set("label", "Updated group");

      sinon.assert.calledOnceWithExactly(
        firstChild.setModels,
        replacementModels,
      );
      sinon.assert.calledOnceWithExactly(
        firstChild.setDateAndLabel,
        firstModel.get("date"),
        "Updated group",
      );

      state.sandbox.spy(firstChild, "remove");
      state.collection.remove(firstModel);

      sinon.assert.calledOnce(firstChild.remove);
      expect(state.view.childViews.has(firstModel.cid)).to.equal(false);
      expect(state.view.el.children.length).to.equal(1);

      const added = state.collection.add({
        id: "segment:2:newest",
        sequence: 2,
        date: new Date("2024-03-03T00:00:00Z"),
        models: [],
      });

      expect(state.view.childViews.has(added.cid)).to.equal(true);
      expect(state.view.el.children.length).to.equal(2);
    });

    it("delegates visual updates and cleanup to child views", () => {
      state.view.render();
      const children = [...state.view.childViews.values()];
      children.forEach((child) => {
        state.sandbox.spy(child, "updateVisualState");
        state.sandbox.spy(child, "addTooltips");
        state.sandbox.spy(child, "remove");
      });

      state.view.updateVisualState();
      state.view.addTooltips();
      state.view.onClose();

      children.forEach((child) => {
        sinon.assert.calledOnce(child.updateVisualState);
        sinon.assert.calledOnce(child.addTooltips);
        sinon.assert.calledOnce(child.remove);
      });
      expect(state.view.childViews.size).to.equal(0);
    });
  });
});
