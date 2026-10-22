define(["backbone", "views/portals/PortalListView"], (
  Backbone,
  PortalListView,
) => {
  const expect = chai.expect;

  describe("PortalListView", () => {
    let config;
    let authorization;
    let view;
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      config = MetacatUI.appModel.toJSON();
      authorization = MetacatUI.appUserModel.get("isAuthorizedCreatePortal");
      MetacatUI.appModel.set("portalLimit", false);
      MetacatUI.appModel.set("showMyPortals", true);
    });

    afterEach(() => {
      view?.remove();
      sandbox.restore();
      MetacatUI.appModel.clear({ silent: true });
      MetacatUI.appModel.set(config, { silent: true });
      MetacatUI.appUserModel.set("isAuthorizedCreatePortal", authorization, {
        silent: true,
      });
    });

    it("queries the catalog when an alternate repository is selected", () => {
      MetacatUI.appModel.set({
        showMyPortals: true,
        disableQueryPOSTs: true,
        queryServiceUrl: "https://catalog.example/query/solr/?",
        defaultAlternateRepositoryId: "urn:node:storage",
        alternateRepositories: [
          {
            identifier: "urn:node:storage",
            queryServiceUrl: "https://storage.example/query/solr/?",
          },
        ],
      });
      const ajax = sandbox.stub(Backbone, "ajax").returns({ abort() {} });
      view = new PortalListView();

      view.render();

      expect(new URL(ajax.firstCall.args[0].url).origin).to.equal(
        "https://catalog.example",
      );
    });

    it("shows the editor link only while portal creation is authorized", () => {
      sandbox.stub(Backbone, "ajax").returns({ abort() {} });
      view = new PortalListView();
      view.render();
      MetacatUI.appUserModel.set("isAuthorizedCreatePortal", true);
      view.renderCreateButton();

      expect(view.$(`${view.createBtnContainer} a`).attr("href")).to.equal(
        `${MetacatUI.root}/edit/${MetacatUI.appModel.get("portalTermPlural")}`,
      );

      MetacatUI.appUserModel.set("isAuthorizedCreatePortal", false);
      view.renderCreateButton();

      expect(view.$(view.createBtnContainer).children()).to.have.length(0);
    });

    it("renders the creation link once authorization completes", () => {
      sandbox.stub(Backbone, "ajax").returns({ abort() {} });
      view = new PortalListView();
      view.render();
      MetacatUI.appUserModel.set("isAuthorizedCreatePortal", null);
      const check = sandbox.stub(
        MetacatUI.appUserModel,
        "isAuthorizedCreatePortal",
      );

      view.renderList();
      view.renderList();
      expect(view.$(view.createBtnContainer).children()).to.have.length(0);

      MetacatUI.appUserModel.set("isAuthorizedCreatePortal", true);
      expect(view.$(`${view.createBtnContainer} a`)).to.have.length(1);
      expect(check.calledTwice).to.equal(true);

      MetacatUI.appUserModel.set("isAuthorizedCreatePortal", false);
      expect(view.$(view.createBtnContainer).children()).to.have.length(0);
    });
  });
});
