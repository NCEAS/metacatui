define(["backbone", "views/metadata/EML211View"], function (
  Backbone,
  EML211View,
) {
  describe("EML211View", function () {
    let view;

    beforeEach(function () {
      // initialize() only reads options.model/id/edit, so a plain model keeps
      // the view cheap to construct without rendering any EML sections.
      const model = new Backbone.Model();
      model.cleanXMLText = (value) => value;
      model.trickleUpChange = sinon.spy();
      view = new EML211View({ model, edit: true });
    });

    afterEach(function () {
      view.remove();
    });

    describe("data package events", function () {
      it("refreshes an entity descriptor when the new package changes", function () {
        const events = { ...Backbone.Events };
        const member = { pid: "data.1" };
        view.model.set("collections", [{ type: "DataPackage", events }]);
        view.model.getEntity = sinon.spy();
        sinon.stub(view, "renderAllSections");

        view.render();
        events.trigger("change", { event: "member:rename", member });

        sinon.assert.calledOnceWithExactly(view.model.getEntity, member);
      });

      it("rerenders after new and legacy package saves", function () {
        const events = { ...Backbone.Events };
        const packageModel = { ...Backbone.Events };
        view.model.set("collections", [
          { type: "DataPackage", events },
          { type: "DataPackage", packageModel },
        ]);
        sinon.stub(view, "renderAllSections");

        view.render();
        view.renderAllSections.resetHistory();
        events.trigger("upload:success");
        packageModel.trigger("successSaving");

        sinon.assert.calledTwice(view.renderAllSections);
      });
    });
  });
});
