"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "collections/DataPackage",
  "models/DataONEObject",
  "collections/AccessPolicy",
  "models/AccessRule"
], (cleanState, DataPackage, DataONEObject, AccessPolicy, AccessRule) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("DataPackage Test Suite", function () {
    const state = cleanState(() => {
      const dataObject = new DataONEObject({
        id: "test",
      });
      const dataPackage = new DataPackage([dataObject]);

      const fakeFetchSuccess = function (options) {
        if (options && typeof options.success === "function") {
          options.success(this);
        }
        setTimeout(() => {
          this.trigger("sync");
        }, 10);
        return Promise.resolve(this);
      };

      const fakeFetchFail = function (options) {
        if (options && typeof options.error === "function") {
          options.error(this, { statusText: "Fetch failed" });
        }
        return Promise.reject(new Error("Fetch failed"));
      };

      // Store original methods for proper restoration
      const originalFetch = dataPackage.packageModel.fetch;
      const originalCreateAjaxSettings = dataPackage.createAjaxSettings;

      dataPackage.packageModel.fetch = sinon.stub().callsFake(fakeFetchSuccess);
      dataPackage.createAjaxSettings = sinon.spy();

      return {
        dataPackage,
        dataObject,
        fakeFetchSuccess,
        fakeFetchFail,
        originalFetch,
        originalCreateAjaxSettings,
        stubs: []
      };
    }, beforeEach);

    afterEach(function() {
      // Restore original methods
      if (state.originalFetch) {
        state.dataPackage.packageModel.fetch = state.originalFetch;
      }
      if (state.originalCreateAjaxSettings) {
        state.dataPackage.createAjaxSettings = state.originalCreateAjaxSettings;
      }

      // Restore any additional stubs created in tests
      state.stubs.forEach(stub => {
        if (stub && typeof stub.restore === 'function') {
          stub.restore();
        }
      });
      state.stubs.length = 0;
    });

    describe("Resolving relative paths", function () {
      it("should resolve a relative path with '..', '.', and '~'", function () {
        const relativePath = "./q/../w.csv";
        const result = state.dataPackage.getAbsolutePath(relativePath);
        expect(result).to.equal("w.csv");
      });

      it("should handle empty relative path", function () {
        const relativePath = "";
        const result = state.dataPackage.getAbsolutePath(relativePath);
        expect(result).to.equal("/");
      });

      it("should handle relative path with '~' (ignoring '~')", function () {
        const relativePath = "~/q/w.csv";
        const result = state.dataPackage.getAbsolutePath(relativePath);
        expect(result).to.equal("q/w.csv");
      });

      it("should handle relative path with multiple consecutive '/'", function () {
        const relativePath = "folder1///folder2/file.txt";
        const result = state.dataPackage.getAbsolutePath(relativePath);
        expect(result).to.equal("folder1/folder2/file.txt");
      });
    });

    describe("fetchMemberModels", function () {
      it("should fetch member models", function () {
        state.dataObject.fetch = sinon.stub().callsFake(state.fakeFetchSuccess);
        state.dataPackage.fetchMemberModels([state.dataObject]);
        expect(state.dataObject.fetch.called).to.be.true;
      });
      it("should retry if the fetch fails", async function () {
        let callCount = 0;
        // Stub fetch so that it calls `options.error` and then triggers "sync".
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          if (callCount === 1) {
            return state.fakeFetchFail.call(state.dataObject, options);
          } else {
            return state.fakeFetchSuccess.call(state.dataObject, options);
          }
        });
        // Run the fetch with retry
        await state.dataPackage.fetchMemberModels(
          [state.dataObject],
          1,
          1000,
          2,
        );
        // We should see exactly two calls to `fetch`
        // (the initial one plus one retry)
        expect(callCount).to.equal(2);
      });
      it("should not retry if the fetch succeeds", async function () {
        let callCount = 0;
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          return state.fakeFetchSuccess.call(state.dataObject, options);
        });
        state.dataPackage.fetchMemberModels([state.dataObject], 1, 1000, 2);
        expect(callCount).to.equal(1);
      });
      it("should retry fetch the specified number of times", async function () {
        let callCount = 0;
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          return state.fakeFetchFail.call(state.dataObject, options);
        });
        await state.dataPackage.fetchMemberModels(
          [state.dataObject],
          1,
          1000,
          2,
        );
        expect(callCount).to.equal(2);
      });
      it("should trigger complete when all fetches are done", async function () {
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          return state.fakeFetchSuccess.call(state.dataObject, options);
        });
        state.dataPackage.triggerComplete = sinon.spy();
        await state.dataPackage.fetchMemberModels([state.dataObject]);
        expect(state.dataPackage.triggerComplete.called).to.be.true;
      });
    });

    describe("fetch", function () {
      it("should call packageModel.fetch when no options are provided", async function () {
        state.dataPackage.fetch();
        expect(state.dataPackage.packageModel.fetch.called).to.be.true;
      });

      it("should call packageModel.fetch with option fetchModels:false", async function () {
        state.dataPackage.fetchFromIndex = sinon.spy();
        state.dataPackage.fetch({ fetchModels: false });
        expect(state.dataPackage.packageModel.fetch.called).to.be.true;
        expect(state.dataPackage.fetchFromIndex.called).to.be.false;
      });

      it("should call fetchFromIndex with option fromIndex:true", async function () {
        state.dataPackage.fetchFromIndex = sinon.spy();
        state.dataPackage.fetch({ fromIndex: true });
        expect(state.dataPackage.packageModel.fetch.called).to.be.true;
        expect(state.dataPackage.fetchFromIndex.called).to.be.true;
      });

      it("should call fetchFromIndex with fromIndex: true", async function () {
        state.dataPackage.fetchFromIndex = sinon.spy();
        state.dataPackage.fetch({ fromIndex: true });
        expect(state.dataPackage.packageModel.fetch.called).to.be.true;
        expect(state.dataPackage.fetchFromIndex.called).to.be.true;
      });

      it("should call createAjaxSettings", async function () {
        state.dataPackage
          .fetch()
          .then()
          .catch()
          .finally(() => {
            expect(state.dataPackage.createAjaxSettings.called).to.be.true;
          });
      });

      it("should handle done and fail callbacks", async function () {
        state.dataPackage.fetchFromIndex = sinon.spy();
        state.dataPackage.fetch = sinon.stub().callsFake(() => {
          return Promise.reject(new Error("Fetch failed"));
        });
        state.dataPackage.fetch().catch((error) => {
          expect(state.dataPackage.fetchFromIndex.called).to.be.false;
          expect(state.dataPackage.packageModel.fetch.called).to.be.true;
        });
      });
    });

    describe("fetchMemberModel", function () {
      it("should fetch member model", async function () {
        state.dataObject.fetch = sinon.stub().callsFake(state.fakeFetchSuccess);
        await state.dataPackage.fetchMemberModel(state.dataObject, 2, 1000);
        expect(state.dataObject.fetch.called).to.be.true;
      });

      it("should retry if the fetch fails", async function () {
        let callCount = 0;
        // Stub fetch so that it calls `options.error` and then triggers "sync".
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          if (callCount === 1) {
            return state.fakeFetchFail.call(state.dataObject, options);
          } else {
            return state.fakeFetchSuccess.call(state.dataObject, options);
          }
        });
        // Run the fetch with retry
        await state.dataPackage.fetchMemberModel(state.dataObject, 2, 1000);
        expect(callCount).to.equal(2);
      });

      it("should not retry if the fetch succeeds", async function () {
        let callCount = 0;
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          return state.fakeFetchSuccess.call(state.dataObject, options);
        });
        await state.dataPackage.fetchMemberModel(state.dataObject, 1, 1000);
        expect(callCount).to.equal(1);
      });

      it("should retry fetch the specified number of times", async function () {
        let callCount = 0;
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          return state.fakeFetchFail.call(state.dataObject, options);
        });
        await state.dataPackage.fetchMemberModel(state.dataObject, 4, 1000);
        expect(callCount).to.equal(4);
      });

      it("should return a model", async function () {
        state.dataObject.fetch = sinon.stub().callsFake(state.fakeFetchSuccess);
        const model = await state.dataPackage.fetchMemberModel(
          state.dataObject,
          2,
          1000,
        );
        expect(model).to.equal(state.dataObject);
      });
    });

    describe("fetchWithRetryAndTimeout", function () {
      it("should fetch  ", async function () {
        state.dataObject.fetch = sinon.stub().callsFake(state.fakeFetchSuccess);
        await state.dataPackage.fetchWithRetryAndTimeout(
          state.dataObject,
          2,
          1000,
        );
        expect(state.dataObject.fetch.called).to.be.true;
      });

      it("should retry if the fetch fails", async function () {
        let callCount = 0;
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          if (callCount === 1) {
            return state.fakeFetchFail.call(state.dataObject, options);
          } else {
            return state.fakeFetchSuccess.call(state.dataObject, options);
          }
        });
        // Run the fetch with retry
        await state.dataPackage.fetchWithRetryAndTimeout(
          state.dataObject,
          2,
          1000,
        );
        // We should see exactly two calls to `fetch`
        // (the initial one plus one retry)
        expect(callCount).to.equal(2);
      });

      it("should not retry if the fetch succeeds", async function () {
        let callCount = 0;
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          return state.fakeFetchSuccess.call(state.dataObject, options);
        });
        await state.dataPackage.fetchWithRetryAndTimeout(
          state.dataObject,
          1,
          1000,
        );
        expect(callCount).to.equal(1);
      });

      it("should retry fetch the specified number of times", async function () {
        let callCount = 0;
        state.dataObject.fetch = sinon.stub().callsFake((options) => {
          callCount++;
          return state.fakeFetchFail.call(state.dataObject, options);
        });
        await state.dataPackage
          .fetchWithRetryAndTimeout(state.dataObject, 4, 1000)
          .catch(() => {
            // expected error
          });
        expect(callCount).to.equal(4);
      });

      it("should return a model", async function () {
        state.dataObject.fetch = sinon.stub().callsFake(state.fakeFetchSuccess);
        const model = await state.dataPackage.fetchWithRetryAndTimeout(
          state.dataObject,
          2,
          1000,
        );
        expect(model).to.equal(state.dataObject);
      });

      it("should timeout if fetch takes too long", async function () {
        state.dataObject.fetch = sinon.stub().callsFake(() => {
          return new Promise((resolve, reject) => {});
        });
        await state.dataPackage
          .fetchWithRetryAndTimeout(state.dataObject, 2, 10)
          .catch((err) => {
            expect(err.message).to.equal("Fetch timed out");
          });
      });

      it("should never timeout if a valid timeout is not provided", async function () {
        // Stub fetch to resolve after a short delay
        state.dataObject.fetch = sinon.stub().callsFake(state.fakeFetchSuccess);

        // Pass an invalid timeout (e.g., 0) so that the timeout branch is skipped
        const result = await state.dataPackage.fetchWithRetryAndTimeout(
          state.dataObject,
          1,
          0,
        );

        // The fetch should have completed successfully
        expect(result).to.equal(state.dataObject);
      });
    });

    describe("handleMemberFetchError", function () {
      it("should handle fetch errors", function () {
        const failedModels = [state.dataObject];
        const errors = ["Fetch failed"];
        state.dataPackage.handleMemberFetchError(failedModels, errors);
        expect(state.dataObject.get("synced")).to.be.false;
        expect(state.dataObject.get("errorMessage")).to.equal("Fetch failed");
      });

      it("should handle fetch errors with empty errors array", function () {
        const failedModels = [state.dataObject];
        const errors = [];
        state.dataPackage.handleMemberFetchError(failedModels, errors);
        expect(state.dataObject.get("synced")).to.be.false;
        expect(state.dataObject.get("errorMessage")).to.equal("Fetch failed");
      });
    });

    describe("updateMemberModelType", function () {
      it("should merge the new model if the type did NOT change", async function () {
        const newMemberModel = state.dataPackage.getMember(state.dataObject);
        state.dataObject.set("newProperty", "test");
        const result = await state.dataPackage.updateMemberModelType(
          state.dataObject,
          2,
          1000,
        );
        expect(result).to.equal(newMemberModel);
        expect(result.get("newProperty")).to.equal("test");
      });

      it("should trigger replace if the type changed to DataPackage", function (done) {
        state.dataObject.set(
          "formatId",
          "http://www.openarchives.org/ore/terms",
        );
        state.dataPackage.listenToOnce(state.dataObject, "replace", () =>
          done(),
        );
        state.dataPackage.updateMemberModelType(state.dataObject, 2, 1000);
      });

      it("should fetch the new model if the type changed but NOT to DataPackage", async function () {
        state.dataObject.set("formatId", "http://www.loc.gov/METS/");
        state.dataPackage.fetchWithRetryAndTimeout = sinon
          .stub()
          .callsFake(state.fakeFetchSuccess);
        const result = await state.dataPackage.updateMemberModelType(
          state.dataObject,
          2,
          1000,
        );
        expect(state.dataPackage.fetchWithRetryAndTimeout.called).to.be.true;
      });

      it("should trigger replace and add:EML if the type changed to EML", function (done) {
        state.dataObject.set("formatId", "eml://ecoinformatics.org/eml-2.1.1");
        state.dataPackage.fetchWithRetryAndTimeout = sinon
          .stub()
          .callsFake(state.fakeFetchSuccess);
        state.dataPackage.listenToOnce(state.dataObject, "replace", () => {
          state.dataPackage.listenToOnce(
            state.dataPackage,
            "add:EML",
            () =>
              expect(state.dataPackage.fetchWithRetryAndTimeout.called).to.be
                .true,
            done(),
          );
        });
        state.dataPackage.updateMemberModelType(state.dataObject, 2, 1000);
      });
    });

    describe("fetchPromise", function () {
      it("should return a promise and an XHR reference", function () {
        const result = state.dataPackage.fetchPromise(state.dataObject);
        expect(result.fetchPromise).to.be.a("promise");
        expect(result.xhrRef).to.be.an("object");
      });
    });

    describe("broadcastAccessPolicy()", function () {
      it("should preserve AccessPolicy collection type during broadcast", function() {
        // Setup: Create DataPackage with AccessPolicy
        const dataPackage = new DataPackage();
        const accessPolicy = dataPackage.packageModel.createAccessPolicy();
        accessPolicy.add([
          { subject: "public", read: true },
          { subject: "uid=user,dc=example", write: true }
        ]);

        // Action: Trigger broadcast
        dataPackage.broadcastAccessPolicy(accessPolicy);

        // Assert: AccessPolicy should remain a collection, not array
        const result = dataPackage.packageModel.get("accessPolicy");
        expect(result).to.be.instanceOf(AccessPolicy);
        expect(result.serialize).to.be.a("function");
        expect(result.length).to.equal(2);
      });

      it("should handle JSON roundtrip without losing collection type", function() {
        // Setup: Create object with AccessPolicy
        const obj = new DataONEObject();
        const policy = obj.createAccessPolicy();
        policy.add({ subject: "public", read: true });

        // Simulate JSON serialization/deserialization roundtrip
        const json = obj.toJSON();
        const newObj = new DataONEObject(json);

        // Action: Try to serialize system metadata
        expect(() => {
          newObj.serializeSysMeta();
        }).to.not.throw();

        // Assert: AccessPolicy should be restored as collection
        const restoredPolicy = newObj.get("accessPolicy");
        expect(restoredPolicy).to.be.instanceOf(AccessPolicy);
      });

      it("should survive multiple broadcast operations", function() {
        const dataPackage = new DataPackage();
        const policy1 = dataPackage.packageModel.createAccessPolicy();
        policy1.add({ subject: "uid=user1,dc=example", read: true });

        // First broadcast
        dataPackage.broadcastAccessPolicy(policy1);

        // Second broadcast with different policy
        const policy2 = dataPackage.packageModel.createAccessPolicy();
        policy2.add({ subject: "uid=user2,dc=example", write: true });

        expect(() => {
          dataPackage.broadcastAccessPolicy(policy2);
        }).to.not.throw();

        // Should still be able to serialize
        expect(() => {
          dataPackage.packageModel.serializeSysMeta();
        }).to.not.throw();
      });
    });

    it("sets an AccessPolicy instance on the package model and preserves its rules", function () {
        const { dataPackage } = state;

        const policy = new AccessPolicy();
        policy.add({ subject: "uid:test-user", permission: "read" });

        // Prevent persistence for this test
        const isNewStub = sinon.stub(dataPackage.packageModel, "isNew").returns(true);

        dataPackage.broadcastAccessPolicy(policy);

        const stored = dataPackage.packageModel.get("accessPolicy");

        // Expectations:
        // - stored is an AccessPolicy (not a plain object)
        // - it is not the same reference
        // - it has the same rule count
        expect(stored).to.be.instanceof(AccessPolicy);
        expect(stored).to.not.equal(policy);
        expect(stored.length).to.equal(1);

        isNewStub.restore();
      });

      it("does not mutate the stored policy when the original AccessPolicy is changed after broadcast", function () {
        const { dataPackage } = state;

        const original = new AccessPolicy();
        original.add({ subject: "uid:alpha", permission: "read" });

        const isNewStub = sinon.stub(dataPackage.packageModel, "isNew").returns(true);

        dataPackage.broadcastAccessPolicy(original);
        const stored = dataPackage.packageModel.get("accessPolicy");

        // Mutate the original after broadcasting
        original.add({ subject: "uid:beta", permission: "changePermission" });

        // Expect the stored policy to remain unchanged
        expect(stored.length).to.equal(1);

        isNewStub.restore();
      });

      it("does not mutate the original AccessPolicy when the stored policy is changed", function () {
        const { dataPackage } = state;

        const original = new AccessPolicy();
        original.add({ subject: "uid:alpha", permission: "read" });

        const isNewStub = sinon.stub(dataPackage.packageModel, "isNew").returns(true);

        dataPackage.broadcastAccessPolicy(original);
        const stored = dataPackage.packageModel.get("accessPolicy");

        // Mutate the stored policy
        stored.add({ subject: "uid:gamma", permission: "write" });

        // Original should remain unchanged
        expect(original.length).to.equal(1);

        isNewStub.restore();
      });

      it("replaces any previously set accessPolicy on subsequent broadcasts (no merge)", function () {
        const { dataPackage } = state;

        const first = new AccessPolicy();
        first.add({ subject: "uid:one", permission: "read" });

        const second = new AccessPolicy();
        second.add({ subject: "uid:two", permission: "read" });
        second.add({ subject: "uid:three", permission: "write" });

        const isNewStub = sinon.stub(dataPackage.packageModel, "isNew").returns(true);

        dataPackage.broadcastAccessPolicy(first);
        expect(dataPackage.packageModel.get("accessPolicy").length).to.equal(1);

        dataPackage.broadcastAccessPolicy(second);
        expect(dataPackage.packageModel.get("accessPolicy").length).to.equal(2);

        isNewStub.restore();
      });

      it("is a no-op for falsy accessPolicy and should not persist", function () {
        const { dataPackage } = state;

        const saveStub = sinon.stub(dataPackage.packageModel, "save").resolves(dataPackage.packageModel);
        const updateStub = sinon
          .stub(dataPackage.packageModel, "updateSysMeta")
          .resolves(dataPackage.packageModel);

        // Precondition: No accessPolicy set
        expect(dataPackage.packageModel.get("accessPolicy")).to.equal(undefined);

        dataPackage.broadcastAccessPolicy(undefined);
        dataPackage.broadcastAccessPolicy(null);

        // No change and no persistence
        expect(dataPackage.packageModel.get("accessPolicy")).to.equal(undefined);
        expect(saveStub.called).to.equal(false);
        expect(updateStub.called).to.equal(false);
      });

      it("does not persist when the package model is new", function () {
        const { dataPackage } = state;

        const policy = new AccessPolicy();
        policy.add({ subject: "uid:new", permission: "read" });

        const isNewStub = sinon.stub(dataPackage.packageModel, "isNew").returns(true);
        const saveStub = sinon.stub(dataPackage.packageModel, "save").resolves(dataPackage.packageModel);
        const updateStub = sinon
          .stub(dataPackage.packageModel, "updateSysMeta")
          .resolves(dataPackage.packageModel);

        dataPackage.broadcastAccessPolicy(policy);

        expect(saveStub.called).to.equal(false);
        expect(updateStub.called).to.equal(false);

        isNewStub.restore();
      });

      it("persists when the package model is not new (via updateSysMeta or save)", function () {
        const { dataPackage } = state;

        const policy = new AccessPolicy();
        policy.add({ subject: "uid:existing", permission: "read" });

        const isNewStub = sinon.stub(dataPackage.packageModel, "isNew").returns(false);
        const saveStub = sinon.stub(dataPackage.packageModel, "save").resolves(dataPackage.packageModel);
        const updateStub = sinon
          .stub(dataPackage.packageModel, "updateSysMeta")
          .resolves(dataPackage.packageModel);

        dataPackage.broadcastAccessPolicy(policy);

        // At least one persistence pathway should be exercised, but not both
        expect(saveStub.called || updateStub.called).to.equal(true);
        expect(saveStub.called && updateStub.called).to.equal(false);

        isNewStub.restore();
      });

      it("does not affect member objects' access policies", function () {
        const { dataPackage } = state;

        // Add a member object to the package
        const extraMember = new DataONEObject({ id: "extra-1" });
        dataPackage.add(extraMember);

        const policy = new AccessPolicy();
        policy.add({ subject: "uid:pkg-only", permission: "read" });

        const isNewStub = sinon.stub(dataPackage.packageModel, "isNew").returns(true);

        dataPackage.broadcastAccessPolicy(policy);

        // The package model gets the policy
        const storedPkgPolicy = dataPackage.packageModel.get("accessPolicy");
        expect(storedPkgPolicy).to.be.instanceof(AccessPolicy);
        expect(storedPkgPolicy.length).to.equal(1);

        // The member model should remain unchanged
        expect(extraMember.get("accessPolicy")).to.equal(undefined);

        isNewStub.restore();
      });

      it("should not register duplicate event listeners on repeated broadcasts", function () {
        const { dataPackage } = state;
        const policy = new AccessPolicy();

        const onSpy = sinon.spy(dataPackage.packageModel, "on");
        const isNewStub = sinon.stub(dataPackage.packageModel, "isNew").returns(false);
        const saveStub = sinon.stub(dataPackage.packageModel, "save").resolves(dataPackage.packageModel);
        const updateStub = sinon
          .stub(dataPackage.packageModel, "updateSysMeta")
          .resolves(dataPackage.packageModel);

        dataPackage.broadcastAccessPolicy(policy);
        dataPackage.broadcastAccessPolicy(policy);

        const errorBinds = onSpy.args.filter((a) => a[0] === "sysMetaUpdateError");
        expect(errorBinds.length).to.equal(1);

        onSpy.restore();
        isNewStub.restore();
        saveStub.restore();
        updateStub.restore();
      });

      it("should set a valid AccessPolicy on packageModel without aliasing, and not persist when new", function () {
        const policy = new AccessPolicy();

        const isNewStub = sinon.stub(state.dataPackage.packageModel, "isNew").returns(true);
        const setSpy = sinon.spy(state.dataPackage.packageModel, "set");
        const saveStub = sinon.stub(state.dataPackage.packageModel, "save");

        state.dataPackage.broadcastAccessPolicy(policy);

        // Ensure set was called with an AccessPolicy instance (not a plain object)
        expect(setSpy.called).to.equal(true);
        const args = setSpy.args.find((a) => a[0] === "accessPolicy");
        expect(args, "packageModel.set('accessPolicy', ...) not called").to.exist;

        const stored = state.dataPackage.packageModel.get("accessPolicy");
        console.log("state.dataPackage.packageModel.get('accessPolicy') = ", stored);
        expect(stored).to.be.instanceOf(AccessPolicy);
        expect(stored).to.not.equal(policy); // avoid aliasing

        // Because the package is new, no persistence should occur
        expect(saveStub.called).to.equal(false);

        isNewStub.restore();
        setSpy.restore();
        saveStub.restore();
      });

      it("should attempt persistence when the package is not new", function () {
        const policy = new AccessPolicy();

        const isNewStub = sinon.stub(state.dataPackage.packageModel, "isNew").returns(false);
        const saveStub = sinon.stub(state.dataPackage.packageModel, "save").callsFake(function (_attrs, options) {
          if (options && typeof options.success === "function") {
            options.success(this);
          }
          return Promise.resolve(this);
        });

        state.dataPackage.broadcastAccessPolicy(policy);

        expect(saveStub.called).to.equal(true);

        isNewStub.restore();
        saveStub.restore();
      });

      it("should ignore non-AccessPolicy inputs", function () {
        const setSpy = sinon.spy(state.dataPackage.packageModel, "set");

        // Intentionally pass a plain object
        const fakePolicy = { foo: "bar" };
        state.dataPackage.broadcastAccessPolicy(fakePolicy);

        // Expect no changes because only AccessPolicy instances should be accepted
        const calls = setSpy.args.filter((a) => a[0] === "accessPolicy");
        expect(calls.length).to.equal(0);

        setSpy.restore();
      });
    });

    describe("Access policy preservation across members and updates", function () {
      function makeRule(subject, permissions) {
        if (permissions == null) {
          permissions = ["read"];
        } else if (!Array.isArray(permissions)) {
          permissions = [permissions];
        }
        return new AccessRule({ subject: subject, permissions: permissions });
      }

      var state = cleanState(function () {
        var pkg = new DataPackage();
        var metadata = new DataONEObject({ id: "pkg-metadata" });
        var data1 = new DataONEObject({ id: "pkg-data-1" });
        var data2 = new DataONEObject({ id: "pkg-data-2" });

        var metaPolicy = metadata.createAccessPolicy();
        metaPolicy.add([
          makeRule("uid:owner", ["read", "write", "changePermission"]),
          makeRule("uid:collab", ["read", "write"]),
          makeRule("public", ["read"])
        ]);

        pkg.add([metadata, data1, data2]);

        // Avoid shorthand return object
        return {
          pkg: pkg,
          metadata: metadata,
          data1: data1,
          data2: data2,
          metaPolicy: metaPolicy
        };
      }, before);


      it("sharing the same AccessPolicy instance across objects causes edits to remove rules across members", function () {
        const { metadata, data1, metaPolicy } = state;

        // Simulate (risky) inheritance by aliasing the collection instance
        data1.set("accessPolicy", metaPolicy);

        // Remove 'public' from data1
        const policy1 = data1.get("accessPolicy");
        const publicRule = policy1.findWhere({ subject: "public" });
        policy1.remove(publicRule);

        // Because it's the same instance, metadata lost 'public' too
        const metadataPublic = metadata.get("accessPolicy").findWhere({ subject: "public" });
        expect(metadataPublic).to.not.exist;
      });

      it("cloned policy instances remain independent across objects", function () {
        var ap = state.metadata && state.metadata.get && state.metadata.get("accessPolicy");
        if (ap && !ap.findWhere({ subject: "public" })) {
          ap.add(new AccessRule({ subject: "public", permissions: ["read"] }));
        }

        const { metadata, data2 } = state;

        // Precondition: metadata must have a public rule
        var publicBefore = metadata.get("accessPolicy").findWhere({ subject: "public" });
        expect(publicBefore, "metadata must start with a public rule").to.exist;

        // Create a deep-ish clone (new AccessRule models)
        var cloned = new AccessPolicy(
          metadata.get("accessPolicy").map(function (r) {
            return new AccessRule(r.toJSON());
          })
        );

        data2.set("accessPolicy", cloned);

        // Sanity: ensure different collection instances
        expect(metadata.get("accessPolicy")).to.not.equal(cloned);

        // Remove 'public' from data2 only
        const policy2 = data2.get("accessPolicy");
        const publicRule2 = policy2.findWhere({ subject: "public" });
        if (publicRule2) {
          policy2.remove(publicRule2);
        }

        // Metadata retains its public rule
        const stillPublic = metadata.get("accessPolicy").findWhere({ subject: "public" });
        expect(stillPublic).to.exist;
      });

      it("adding a new member to the package does not mutate or drop existing members' access rules", function () {
        const { pkg, metadata } = state;

        // Precondition: ensure the metadata policy has the expected rules
        const metaPolicy = metadata.get("accessPolicy") || metadata.createAccessPolicy();
        const ensureRule = (subject, perms) => {
          if (!metaPolicy.findWhere({ subject })) {
            metaPolicy.add([makeRule(subject, perms)]);
          }
        };
        ensureRule("uid:owner", ["read"]);
        ensureRule("uid:collab", ["read"]);
        ensureRule("public", ["read"]);

        const newData = new DataONEObject({ id: "pkg-data-3" });
        // Give it its own simple policy
        const newPolicy = newData.createAccessPolicy();
        newPolicy.add([makeRule("uid:new-user", ["read"])]);

        pkg.add([newData]);

        // Verify existing metadata policy is untouched
        expect(metaPolicy.findWhere({ subject: "uid:owner" }), "owner rule missing on metadata").to.exist;
        expect(metaPolicy.findWhere({ subject: "uid:collab" }), "collab rule missing on metadata").to.exist;
        expect(metaPolicy.findWhere({ subject: "public" }), "public rule missing on metadata").to.exist;
      });
    });
  });
});
