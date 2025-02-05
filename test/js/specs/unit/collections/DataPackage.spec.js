define([
  "../../../../../../../../src/js/collections/DataPackage",
  "../../../../../../../../src/js/models/DataONEObject",
], function (DataPackage, DataONEObject) {
  var expect = chai.expect;

  describe("DataPackage Test Suite", function () {
    let dataPackage;
    let originalFetch,
      originalTriggerComplete,
      originalFetchFromIndex,
      originalCreateAjaxSettings;
    let fetchCallCount,
      triggerCompleteCallCount,
      fetchFromIndexCallCount,
      createAjaxSettingsCallCount;

    beforeEach(function () {
      dataPackage = new DataPackage();
      originalFetch = dataPackage.packageModel.fetch;
      originalTriggerComplete = dataPackage.triggerComplete;
      originalFetchFromIndex = dataPackage.fetchFromIndex;
      originalCreateAjaxSettings = MetacatUI.appUserModel.createAjaxSettings;

      fetchCallCount = 0;
      triggerCompleteCallCount = 0;
      fetchFromIndexCallCount = 0;
      createAjaxSettingsCallCount = 0;

      dataPackage.triggerComplete = function () {
        triggerCompleteCallCount++;
      };
      dataPackage.fetchFromIndex = function () {
        fetchFromIndexCallCount++;
      };
      MetacatUI.appUserModel.createAjaxSettings = function () {
        createAjaxSettingsCallCount++;
      };
    });

    afterEach(function () {
      dataPackage.triggerComplete = originalTriggerComplete;
      dataPackage.fetchFromIndex = originalFetchFromIndex;
      MetacatUI.appUserModel.createAjaxSettings = originalCreateAjaxSettings;
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
          console.log(
            "[should retry fetching member models on failure] " +
              fetchCallCount +
              " fetch calls",
          );
          expect(fetchCallCount).to.equal(models.length * (maxRetries + 1)); // 2 models * 3 retries
          DataONEObject.prototype.fetch = originalFetch;
          done();
        }, 100);
      });

      it("should trigger complete event after fetching all models", function (done) {
        const models = [
          new DataONEObject({ identifier: "1" }),
          new DataONEObject({ identifier: "2" }),
        ];
        const originalFetch = DataONEObject.prototype.fetch;
        let fetchCallCount = 0;
        let completeEventTriggered = false;
        let maxRetries = 3;

        DataONEObject.prototype.fetch = function (options) {
          console.log(
            "[should trigger complete event after fetching all models] fetching model: " +
              this.get("identifier"),
          );
          fetchCallCount++;
          options.success();
        };

        dataPackage.triggerComplete = function () {
          completeEventTriggered = true;
          console.log(
            "[should trigger complete event after fetching all models] complete event triggered",
          );
        };

        dataPackage.fetchMemberModels(models, 0, 2, 100, maxRetries);

        setTimeout(function () {
          console.log(
            "[should trigger complete event after fetching all models] " +
              fetchCallCount +
              " fetch calls",
          );
          console.log(
            "[should trigger complete event after fetching all models] " +
              completeEventTriggered,
          );
          expect(fetchCallCount).to.equal(models.length * (maxRetries + 1));
          expect(completeEventTriggered).to.be.true;
          DataONEObject.prototype.fetch = originalFetch;
          done();
        }, 1000);
      });
    });

    describe("fetch", function () {
      let originalFetch;

      // Save the original fetch method and mock it to return a resolved promise before each test
      beforeEach(function () {
        originalFetch = Backbone.Collection.prototype.fetch;
        Backbone.Collection.prototype.fetch = function (options) {
          // Mocked fetch method that returns a resolved promise
          var deferred = $.Deferred();
          deferred.resolve();
          return deferred.promise();
        };
      });

      // Restore the original fetch method after each test
      afterEach(function () {
        Backbone.Collection.prototype.fetch = originalFetch;
      });

      // Test that packageModel.fetch is called with no options
      it("should call packageModel.fetch with no options", function (done) {
        dataPackage.packageModel.fetch = function () {
          // Mocked fetch method that increments fetchCallCount and returns a resolved promise
          fetchCallCount++;
          return Promise.resolve();
        };

        dataPackage
          .fetch()
          .then(function () {
            expect(fetchCallCount).to.equal(1);
            done(); // Call done() to finish the test
          })
          .catch(function () {
            done(new Error("Expected fetch to succeed"));
          });
      });

      // Test that packageModel.fetch is called with fetchModels: false
      it("should call packageModel.fetch with fetchModels: false", function (done) {
        dataPackage.packageModel.fetch = function () {
          // Mocked fetch method that increments fetchCallCount and returns a resolved promise
          fetchCallCount++;
          return Promise.resolve();
        };

        dataPackage
          .fetch({ fetchModels: false })
          .then(function () {
            expect(fetchCallCount).to.equal(1);
            expect(fetchFromIndexCallCount).to.equal(0);
            done(); // Call done() to finish the test
          })
          .catch(function () {
            done(new Error("Expected fetch to succeed"));
          });
      });

      // Test that fetchFromIndex is called with fromIndex: true
      it("should call fetchFromIndex with fromIndex: true", function (done) {
        dataPackage
          .fetch({ fromIndex: true })
          .then(function () {
            expect(fetchFromIndexCallCount).to.equal(1);
            done(); // Call done() to finish the test
          })
          .catch(function () {
            done(new Error("Expected fetch to succeed"));
          });
      });

      // Test that createAjaxSettings is called
      it("should call createAjaxSettings", function (done) {
        dataPackage
          .fetch()
          .then(function () {
            expect(createAjaxSettingsCallCount).to.equal(1);
            done(); // Call done() to finish the test
          })
          .catch(function () {
            done(new Error("Expected fetch to succeed"));
          });
      });

      // Test that the fetch method handles done and fail callbacks correctly
      it("should handle done and fail callbacks", function (done) {
        dataPackage.packageModel.fetch = function () {
          // Mocked fetch method that increments fetchCallCount and returns a rejected promise
          fetchCallCount++;
          return Promise.reject();
        };
        Backbone.Collection.prototype.fetch = function (options) {
          // Mocked fetch method that returns a rejected promise
          var deferred = $.Deferred();
          deferred.reject();
          return deferred.promise();
        };
        dataPackage
          .fetch()
          .then(function () {
            done(new Error("Expected fetch to fail"));
          })
          .catch(function () {
            expect(fetchCallCount).to.equal(1);
            expect(fetchFromIndexCallCount).to.equal(0);
            done();
          });
      });
    });
  });
});
