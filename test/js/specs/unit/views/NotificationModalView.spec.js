define([
  "jquery",
  "backbone",
  "models/ObjectNotification",
  "views/NotificationModalView",
], ($, Backbone, ObjectNotification, NotificationModalView) => {
  const expect = chai.expect;

  describe("NotificationModalView Test Suite", () => {
    let appModel;
    let userModel;
    let model;
    let view;
    let OriginalMetacatUI;
    let originalModal;

    const resourceTypes = [
      {
        type: "datasetChanges",
        label: "Dataset Changes",
        description: "Dataset changes description",
      },
      {
        type: "citations",
        label: "Citations",
        description: "Citations description",
      },
    ];

    beforeEach(() => {
      OriginalMetacatUI = window.MetacatUI;
      appModel = new Backbone.Model({
        enableNotificationService: true,
        notificationServiceApiVersion: "v1",
        notificationServiceResourceTypes: resourceTypes,
        notificationServiceUrl: "https://notifications.example.com",
      });
      appModel.addCSS = sinon.stub();
      userModel = new Backbone.Model({
        email: "user@example.com",
        loggedIn: true,
        username: "http://orcid.org/0000-0002-1615-3963",
      });
      userModel.getTokenPromise = sinon.stub().resolves("token");

      window.MetacatUI = {
        appModel,
        appUserModel: userModel,
        root: "http://localhost:3000",
      };

      originalModal = $.fn.modal;
      $.fn.modal = sinon.stub().returnsThis();

      model = new ObjectNotification(
        {
          loadedSubscriptions: true,
          pid: "test-pid",
          savedResourceTypes: ["citations"],
        },
        {
          appModel,
          userModel,
          NotificationClient: function NotificationClient() {
            return {};
          },
        },
      );
      view = new NotificationModalView({ model });
    });

    afterEach(() => {
      view?.remove();
      model?.stopListening();
      $.fn.modal = originalModal;
      window.MetacatUI = OriginalMetacatUI;
      sinon.restore();
    });

    it("renders configured resource type checkboxes", () => {
      view.render();

      expect(
        view.el.querySelectorAll("input[name='notification-resource-type']")
          .length,
      ).to.equal(2);
      expect(view.checkboxes.citations.checked).to.equal(true);
      expect(view.checkboxes.datasetChanges.checked).to.equal(false);
    });

    it("renders setup error codes as view-owned messages", () => {
      userModel.set("email", "");

      view.render();

      expect(view.el.textContent).to.contain(
        "Enter an email address on your account settings page before managing notifications.",
      );
    });

    it("restores saved checkbox state when cancelled", () => {
      view.render();
      view.checkboxes.citations.checked = false;
      view.checkboxes.datasetChanges.checked = true;

      view.cancelChanges({ preventDefault: sinon.spy() });

      expect(view.checkboxes.citations.checked).to.equal(true);
      expect(view.checkboxes.datasetChanges.checked).to.equal(false);
    });

    it("saves selected resource types through the model", async () => {
      view.render();
      const saveStub = sinon
        .stub(model, "saveSubscriptions")
        .resolves({ changed: true, resourceTypes: ["datasetChanges"] });
      model.set("savedResourceTypes", ["datasetChanges"]);
      view.checkboxes.citations.checked = false;
      view.checkboxes.datasetChanges.checked = true;

      await view.saveChanges({ preventDefault: sinon.spy() });

      expect(saveStub.calledOnce).to.be.true;
      expect(saveStub.firstCall.args[0]).to.deep.equal(["datasetChanges"]);
      expect(view.checkboxes.datasetChanges.checked).to.equal(true);
      expect(view.checkboxes.citations.checked).to.equal(false);
    });

    it("re-emits subscriptions:saved from the model", () => {
      const savedSpy = sinon.spy();
      const payload = {
        pid: "test-pid",
        resourceTypes: ["citations"],
      };
      view.on("subscriptions:saved", savedSpy);

      model.trigger("subscriptions:saved", payload);

      expect(savedSpy.calledOnceWith(payload)).to.be.true;
    });
  });
});
