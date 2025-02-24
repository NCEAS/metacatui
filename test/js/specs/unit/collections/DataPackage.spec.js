"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "collections/DataPackage",
  "models/DataONEObject",
], (cleanState, DataPackage, DataONEObject) => {
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

      dataPackage.packageModel.fetch = sinon.stub().callsFake(fakeFetchSuccess);
      dataPackage.createAjaxSettings = sinon.spy();

      return {
        dataPackage,
        dataObject,
        fakeFetchSuccess,
        fakeFetchFail,
      };
    }, beforeEach);

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
  });
});
