define(["backbone", "models/ObjectNotification"], (
  Backbone,
  ObjectNotification,
) => {
  const expect = chai.expect;

  describe("ObjectNotification Test Suite", () => {
    let appModel;
    let userModel;
    let client;
    let model;
    let OriginalMetacatUI;

    const defer = () => {
      const deferred = {};
      deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
      });
      return deferred;
    };

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

    const createModel = (attrs = {}) => {
      function NotificationClient(options) {
        this.options = options;
        return client;
      }

      model = new ObjectNotification(
        {
          pid: "test-pid",
          ...attrs,
        },
        {
          appModel,
          userModel,
          NotificationClient,
        },
      );

      return model;
    };

    beforeEach(() => {
      OriginalMetacatUI = window.MetacatUI;
      appModel = new Backbone.Model({
        enableNotificationService: true,
        notificationServiceApiVersion: "v1",
        notificationServiceResourceTypes: resourceTypes,
        notificationServiceUrl: "https://notifications.example.com",
      });
      userModel = new Backbone.Model({
        email: "user@example.com",
        loggedIn: true,
        username: "http://orcid.org/0000-0002-1615-3963",
      });
      userModel.getTokenPromise = sinon.stub().resolves("token");
      client = {
        getResourceTypesByPid: sinon.stub().resolves(["citations", "other"]),
        subscribe: sinon.stub().resolves(),
        unsubscribe: sinon.stub().resolves(),
      };

      window.MetacatUI = {
        appModel,
        appUserModel: userModel,
        root: "http://localhost:3000",
      };
    });

    afterEach(() => {
      model?.stopListening();
      model = null;
      window.MetacatUI = OriginalMetacatUI;
      sinon.restore();
    });

    it("returns setup errors when required user state is missing", () => {
      userModel.set("email", "");
      createModel();

      expect(model.getSetupError()).to.equal(
        ObjectNotification.ERROR_CODES.MISSING_EMAIL,
      );
    });

    it("loads and filters saved subscriptions in configured order", async () => {
      createModel();

      const savedResourceTypes = await model.loadSubscriptions();

      expect(client.getResourceTypesByPid.calledOnce).to.be.true;
      expect(client.getResourceTypesByPid.firstCall.args[0]).to.deep.equal({
        pid: "test-pid",
      });
      expect(savedResourceTypes).to.deep.equal(["citations"]);
      expect(model.get("savedResourceTypes")).to.deep.equal(["citations"]);
      expect(model.get("loadedSubscriptions")).to.equal(true);
    });

    it("saves only changed subscriptions", async () => {
      createModel();
      model.set({
        loadedSubscriptions: true,
        savedResourceTypes: ["citations"],
      });
      const savedSpy = sinon.spy();
      model.on("subscriptions:saved", savedSpy);

      const result = await model.saveSubscriptions(["datasetChanges"]);

      expect(client.subscribe.calledOnce).to.be.true;
      expect(client.subscribe.firstCall.args[0]).to.deep.equal({
        pid: "test-pid",
        resourceType: "datasetChanges",
      });
      expect(client.unsubscribe.calledOnce).to.be.true;
      expect(client.unsubscribe.firstCall.args[0]).to.deep.equal({
        pid: "test-pid",
        resourceType: "citations",
      });
      expect(result.changed).to.equal(true);
      expect(result.resourceTypes).to.deep.equal(["datasetChanges"]);
      expect(savedSpy.calledOnce).to.be.true;
    });

    it("does not call the service when selected subscriptions are unchanged", async () => {
      createModel();
      model.set({
        loadedSubscriptions: true,
        savedResourceTypes: ["citations"],
      });

      const result = await model.saveSubscriptions(["citations"]);

      expect(result.changed).to.equal(false);
      expect(client.subscribe.notCalled).to.be.true;
      expect(client.unsubscribe.notCalled).to.be.true;
    });

    it("resets client and saved state when configuration changes", () => {
      createModel();
      model.set({
        client,
        loadedSubscriptions: true,
        savedResourceTypes: ["citations"],
      });

      appModel.set("notificationServiceUrl", "https://new.example.com");

      expect(model.get("client")).to.equal(null);
      expect(model.get("loadedSubscriptions")).to.equal(false);
      expect(model.get("savedResourceTypes")).to.deep.equal([]);
    });

    it("ignores save completions after the client is reset", async () => {
      const subscribeDeferred = defer();
      client.subscribe = sinon.stub().returns(subscribeDeferred.promise);
      createModel();
      model.set({
        loadedSubscriptions: true,
        savedResourceTypes: ["citations"],
      });
      const savedSpy = sinon.spy();
      model.on("subscriptions:saved", savedSpy);

      const savePromise = model.saveSubscriptions(["datasetChanges"]);
      await Promise.resolve();
      appModel.set("notificationServiceUrl", "https://new.example.com");
      subscribeDeferred.resolve();

      const result = await savePromise;

      expect(result.stale).to.equal(true);
      expect(model.get("savedResourceTypes")).to.deep.equal([]);
      expect(savedSpy.notCalled).to.equal(true);
      expect(model.get("savingSubscriptions")).to.equal(false);
    });

    it("ignores save failures after the client is reset", async () => {
      const subscribeDeferred = defer();
      client.subscribe = sinon.stub().returns(subscribeDeferred.promise);
      createModel();
      model.set({
        loadedSubscriptions: true,
        savedResourceTypes: ["citations"],
      });
      const savedSpy = sinon.spy();
      model.on("subscriptions:saved", savedSpy);

      const savePromise = model.saveSubscriptions(["datasetChanges"]);
      await Promise.resolve();
      appModel.set("notificationServiceUrl", "https://new.example.com");
      subscribeDeferred.reject(new Error("service failed"));

      const result = await savePromise;

      expect(result.stale).to.equal(true);
      expect(model.get("savedResourceTypes")).to.deep.equal([]);
      expect(savedSpy.notCalled).to.equal(true);
      expect(model.get("savingSubscriptions")).to.equal(false);
    });
  });
});
