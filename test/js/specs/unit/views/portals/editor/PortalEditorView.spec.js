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
      ajax = sandbox.stub($, "ajax").returns({});
      sandbox.stub(PortalModel.prototype, "fetchSystemMetadata");
      sandbox.stub(MetacatUI.appView, "listenForActivity");
      sandbox.stub(MetacatUI.appView, "listenForTimeout");
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
      view.remove();
      document.body.className = bodyClass;
      delete window.filterXML;
      sandbox.restore();
    });

    it("replaces loading with a map JSON error without opening the editor", () => {
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
      expect(view.$el.html()).to.contain("Retrieving portal details");

      // Simulate a successful XML response; invalid map JSON must be reported
      // through the error event rather than escape the request callback.
      expect(() => ajax.firstCall.args[0].success(xml)).not.to.throw();

      expect(view.$(".loading")).to.have.length(0);
      expect(view.$(".alert-error").text()).to.match(
        /map configuration.*invalid JSON/i,
      );
      expect(view.sectionsView).to.equal(null);
      expect(view.$("#save-editor")).to.have.length(0);
      expect(view.model.get("sections")).to.deep.equal([]);
    });
  });
});
