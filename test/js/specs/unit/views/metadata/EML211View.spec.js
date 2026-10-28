define([
  "backbone",
  "views/metadata/EML211View",
  "models/AppModel",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLParty",
], function (Backbone, EML211View, AppModel, EML211, EMLParty) {
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

    it("shows and clears publication date errors, allowing an empty date", function () {
      view.setElement(document.createElement("div"));
      view.$el.html(
        '<div class="pubDate"><input><span class="notification"></span></div>',
      );
      const input = view.$("input");
      const message = view.$(".notification");

      ["2024", ""].forEach((date) => {
        input.val("2023-02-29");
        view.showPubDateValidation({ target: input[0] });
        chai.expect(input.hasClass("error")).to.equal(true);
        chai.expect(message.text()).to.contain("not a valid value");

        input.val(date);
        view.showPubDateValidation({ target: input[0] });
        chai.expect(input.hasClass("error"), date).to.equal(false);
        chai.expect(message.text(), date).to.equal("");
      });
    });

    describe("required People fields", function () {
      let originalMetacatUI;

      beforeEach(function () {
        originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...originalMetacatUI,
          appModel: new AppModel({
            emlEditorRequiredFields_EMLParty: { contact: ["email"] },
          }),
        };
        view.setElement(document.createElement("div"));
        view.model = new EML211({
          creator: [new EMLParty({ type: "creator", organizationName: "Lab" })],
          contact: [new EMLParty({ type: "contact", organizationName: "Lab" })],
        });
        view.$el.html(
          view.template({ activeSection: "people", visibleSection: "people" }),
        );
        view.renderPeople();
      });

      afterEach(function () {
        globalThis.MetacatUI = originalMetacatUI;
      });

      it("marks the contact name group and configured email as required", function () {
        const contact = view.$("[data-attribute='contact'] .eml-party").first();
        const email = contact.find("[data-attribute='email']");
        const label = contact.find(`label[for='${email.attr("id")}']`);

        chai
          .expect(
            contact.find(".party-details .span4").first().find(".required-icon")
              .length,
          )
          .to.equal(1);
        chai.expect(label.hasClass("hidden")).to.equal(false);
        chai.expect(label.find(".required-icon").length).to.equal(1);
        chai.expect(email.attr("aria-required")).to.equal("true");
        chai.expect(contact.data("model").validate()).to.have.property("email");
      });

      it("keeps email optional for creators and themes without required email", function () {
        const creator = view.$("[data-attribute='creator'] .eml-party").first();
        chai
          .expect(
            creator.find("[data-attribute='email']").attr("aria-required"),
          )
          .not.to.equal("true");
        chai
          .expect(creator.find("label[for$='-email'] .required-icon").length)
          .to.equal(0);

        MetacatUI.appModel.set("emlEditorRequiredFields_EMLParty", {});
        view.renderPeople();
        const contact = view.$("[data-attribute='contact'] .eml-party").first();
        chai
          .expect(
            contact.find("[data-attribute='email']").attr("aria-required"),
          )
          .not.to.equal("true");
        chai
          .expect(contact.find("label[for$='-email'] .required-icon").length)
          .to.equal(0);
      });
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
