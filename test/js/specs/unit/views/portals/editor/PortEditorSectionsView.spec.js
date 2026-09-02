define([
  "jquery",
  "backbone",
  "models/portals/PortalSectionModel",
  "views/portals/editor/PortEditorMdSectionView",
  "views/portals/editor/PortEditorSectionsView",
  "/test/js/specs/shared/clean-state.js",
], (
  $,
  Backbone,
  PortalSectionModel,
  PortEditorMdSectionView,
  PortEditorSectionsView,
  cleanState,
) => {
  const expect = chai.expect;

  describe("PortEditorSectionsView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const model = new Backbone.Model({
        pageOrder: null,
        sections: [],
      });
      model.addSection = (sectionType) => {
        if (sectionType === "freeform") {
          model.set("sections", [
            ...model.get("sections"),
            new PortalSectionModel(),
          ]);
        }
      };
      model.removeSection = (section) => {
        model.set(
          "sections",
          model.get("sections").filter((candidate) => candidate !== section),
        );
      };

      const editorView = { showControls() {} };
      const view = new PortEditorSectionsView({ model, editorView });
      view.sectionLabels = [];
      view.$el.html('<div class="sections-container"></div>');

      sandbox.stub(PortEditorMdSectionView.prototype, "render");
      sandbox.stub(view, "addSectionLink");
      sandbox.stub(view, "removeSectionLink");
      sandbox.stub(view, "switchSection");
      sandbox.stub(view, "toggleRemoveSectionOption");
      sandbox.stub(view, "updatePageOrder");

      return { model, sandbox, view };
    }, beforeEach);

    afterEach(() => {
      state.view.subviews.forEach((subview) => subview.remove());
      state.view.remove();
      state.sandbox.restore();
    });

    it("adds and selects a freeform section", () => {
      state.view.addSection("freeform");

      const section = state.model.get("sections")[0];
      const sectionView = state.view.getSectionByModel(section);

      expect(sectionView).to.be.instanceof(PortEditorMdSectionView);
      expect(sectionView.model).to.equal(section);
      expect(state.view.el.contains(sectionView.el)).to.equal(true);
      expect(state.view.switchSection.calledWith(sectionView)).to.equal(true);
    });

    it("removes a freeform section", () => {
      const section = new PortalSectionModel({ label: "About" });
      const sectionView = new Backbone.View();
      sectionView.uniqueSectionLabel = "About";
      state.model.set("sections", [section]);
      state.view.sectionLabels = ["About"];
      state.view.subviews.push(sectionView);
      state.view.$(state.view.sectionsContainer).append(sectionView.el);

      const sectionLink = $("<li></li>")
        .data("model", section)
        .data("view", sectionView)
        .data("section-type", "freeform");

      state.view.removeSection(null, sectionLink);

      expect(state.model.get("sections")).to.deep.equal([]);
      expect(state.view.sectionLabels).not.to.include("About");
      expect(state.view.subviews).not.to.include(sectionView);
      expect(state.view.el.contains(sectionView.el)).to.equal(false);
      expect(state.view.removeSectionLink.calledWith(sectionView)).to.equal(
        true,
      );
    });
  });
});
