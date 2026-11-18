define([
  "jquery",
  "models/portals/PortalModel",
  "views/portals/editor/PortalEditorView",
], ($, PortalModel, PortalEditorView) => {
  const expect = chai.expect;

  describe("PortalEditorView load errors", () => {
    let sandbox;
    let view;
    let ajax;
    let bodyClass;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      bodyClass = document.body.className;
      ajax = sandbox.stub($, "ajax");
      sandbox.stub(PortalModel.prototype, "fetchSystemMetadata");
      sandbox.stub(MetacatUI.appView, "listenForActivity");
      sandbox.stub(MetacatUI.appView, "listenForTimeout");
      sandbox.stub(MetacatUI.uiRouter, "navigate");
      view = new PortalEditorView({
        el: document.createElement("div"),
        portalIdentifier: "test-load-error",
      });
      sandbox.stub(view, "authorizeUser").callsFake(function authorize() {
        this.model.set("seriesId", "test-load-error");
        this.model.set("isAuthorized", true);
      });
      view.render();
    });

    afterEach(() => {
      view.model.stopListening();
      view.model.off();
      view.onClose();
      view.remove();
      document.body.className = bodyClass;
      delete window.baseUrl;
      sandbox.restore();
    });

    it("allows portal edits while disabling a map with invalid JSON", () => {
      const xml = new DOMParser().parseFromString(
        `<por:portal xmlns:por="https://purl.dataone.org/portals-1.1.0">
          <label>Broken portal</label>
          <section>
            <label>Map</label>
            <content><markdown>Visualization</markdown></content>
            <option><optionName>sectionType</optionName><optionValue>visualization</optionValue></option>
            <option><optionName>visualizationType</optionName><optionValue>cesium</optionValue></option>
            <option><optionName>mapConfig</optionName><optionValue>{invalid}</optionValue></option>
          </section>
        </por:portal>`,
        "application/xml",
      );
      expect(view.$el.text()).to.contain("Retrieving portal details");

      ajax.firstCall.args[0].success(xml);
      // Clear the global set by the editor before Mocha checks for leaks.
      delete window.baseUrl;

      expect(view.$el.text()).not.to.contain("Retrieving portal details");
      const section = view.model.get("sections")[0];
      const mapView = view.sectionsView.getSectionByModel(section);
      expect(mapView.$el.text()).to.match(/map configuration.*invalid JSON/i);
      expect(mapView.mapEditorView).to.equal(undefined);
      expect(view.$("#save-editor")).to.have.length(1);
      view
        .$("textarea.portal-title")
        .val("Updated portal title")
        .trigger("focusout");
      expect(view.model.get("name")).to.equal("Updated portal title");
    });
  });
});
