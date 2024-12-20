define([
  "../../../../../../../../src/js/collections/DataPackage",
  "../../../../../../../../src/js/models/DataONEObject",
], function (DataPackage, DataONEObject) {
  var expect = chai.expect;

  describe("DataPackage Test Suite", function () {
    let dataPackage;

    beforeEach(function () {
      dataPackage = new DataPackage();
    });

    afterEach(function () {
      dataPackage = undefined;
    });

    describe("Resolving relative paths", function () {
      it("should resolve a relative path with '..', '.', and '~'", function () {
        const relativePath = "./q/../w.csv";
        const result = dataPackage.getAbsolutePath(relativePath);
        expect(result).to.equal("w.csv");
      });

      it("should handle empty relative path", function () {
        const relativePath = "";
        const result = dataPackage.getAbsolutePath(relativePath);
        expect(result).to.equal("/");
      });

      it("should handle relative path with '~' (ignoring '~')", function () {
        const relativePath = "~/q/w.csv";
        const result = dataPackage.getAbsolutePath(relativePath);
        expect(result).to.equal("q/w.csv");
      });

      it("should handle relative path with multiple consecutive '/'", function () {
        const relativePath = "folder1///folder2/file.txt";
        const result = dataPackage.getAbsolutePath(relativePath);
        expect(result).to.equal("folder1/folder2/file.txt");
      });
    });

    describe("fetchMemberModels", function () {
      this.timeout(30000); // Increase timeout to 30 seconds

      it("should fetch member models successfully", function (done) {
        const models = [new DataONEObject(), new DataONEObject()];
        const originalFetch = DataONEObject.prototype.fetch;
        let fetchCallCount = 0;

        DataONEObject.prototype.fetch = function (options) {
          fetchCallCount++;
          options.success();
        };

        dataPackage.fetchMemberModels.call(dataPackage, models, 0, 2, 5000, 3);

        setTimeout(function () {
          expect(fetchCallCount).to.equal(2);
          DataONEObject.prototype.fetch = originalFetch;
          done();
        }, 100);
      });

      it("should retry fetching member models on failure", function (done) {
        const models = [new DataONEObject(), new DataONEObject()];
        const originalFetch = DataONEObject.prototype.fetch;
        let fetchCallCount = 0;
        let maxRetries = 3;

        DataONEObject.prototype.fetch = function (options) {
          fetchCallCount++;
          options.error({ statusText: "Internal Server Error" });
        };

        dataPackage.fetchMemberModels(models, 0, 2, 5000, maxRetries);

        setTimeout(function () {
          console.log("[should retry fetching member models on failure] "+ fetchCallCount + " fetch calls");
          expect(fetchCallCount).to.equal(models.length * (maxRetries + 1)); // 2 models * 3 retries
          DataONEObject.prototype.fetch = originalFetch;
          done();
        }, 100);
      });

      it("should trigger complete event after fetching all models", function (done) {
        const models = [new DataONEObject({identifier: "1"}), new DataONEObject({identifier: "2"})];
        const originalFetch = DataONEObject.prototype.fetch;
        let fetchCallCount = 0;
        let completeEventTriggered = false;
        let maxRetries = 3;

        DataONEObject.prototype.fetch = function (options) {
          console.log("[should trigger complete event after fetching all models] fetching model: " + this.get("identifier"));
          fetchCallCount++;
          options.success();
        };

        dataPackage.triggerComplete = function () {
          completeEventTriggered = true;
          console.log("[should trigger complete event after fetching all models] complete event triggered");
        };

        dataPackage.fetchMemberModels(models, 0, 2, 100, maxRetries);

        setTimeout(function () {
          console.log("[should trigger complete event after fetching all models] "+ fetchCallCount + " fetch calls");
          console.log("[should trigger complete event after fetching all models] "+ completeEventTriggered);
          expect(fetchCallCount).to.equal(models.length * (maxRetries + 1));
          expect(completeEventTriggered).to.be.true;
          DataONEObject.prototype.fetch = originalFetch;
          done();
        }, 1000);
      });
    });
  });
});