define([
  "jquery",
  "backbone",
  "models/portals/PortalSectionModel",
  "models/portals/PortalVizSectionModel",
  "views/portals/editor/PortEditorMdSectionView",
  "views/portals/editor/PortEditorSectionsView",
  "/test/js/specs/shared/clean-state.js",
], (
  $,
  Backbone,
  PortalSectionModel,
  PortalVizSectionModel,
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
        let section = null;
        if (sectionType === "freeform") {
          section = new PortalSectionModel();
          model.set("sections", [...model.get("sections"), section]);
        }
        return section;
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
      expect(state.view.updatePageOrder.calledOnce).to.equal(true);
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

      state.view.removeSection(
        { currentTarget: $('<a class="disabled"></a>')[0] },
        sectionLink,
      );
      expect(state.model.get("sections")).to.deep.equal([section]);

      state.view.removeSection(null, sectionLink);

      expect(state.model.get("sections")).to.deep.equal([]);
      expect(state.view.sectionLabels).not.to.include("About");
      expect(state.view.subviews).not.to.include(sectionView);
      expect(state.view.el.contains(sectionView.el)).to.equal(false);
      expect(state.view.removeSectionLink.calledWith(sectionView)).to.equal(
        true,
      );
    });

    it("places a Cesium section before non-content pages by default", () => {
      state.view.addSectionLink.restore();
      state.view.$el.html(`
        <ul class="section-links-container">
          <li class="section-link-container" data-section-name="Data"></li>
          <li class="section-link-container" data-section-name="AddPage"></li>
        </ul>
      `);

      const sectionView = new Backbone.View({
        model: new PortalVizSectionModel({
          label: "Map",
          visualizationType: "cesium",
        }),
      });
      sectionView.type = "PortEditorMapSection";
      sectionView.sectionType = "cesium";
      sectionView.uniqueSectionLabel = "Map";

      state.view.addSectionLink(sectionView, [], false);

      const sectionNames = state.view
        .$(state.view.sectionLinksContainer)
        .children()
        .map((index, link) => $(link).data("section-name"))
        .get();
      expect(sectionNames).to.deep.equal(["Map", "Data", "AddPage"]);

      sectionView.remove();
    });
  });
});
