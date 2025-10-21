define([
  "jquery",
  "underscore",
  "backbone",
  "models/DataONEObject",
  "views/DataItemView",
], function ($, _, Backbone, DataONEObject, DataItemView) {
  var expect = chai.expect;

  describe("DataItemView Test Suite", function () {
    let dataItemView, model, collection;

    // Set up the test environment before each test
    beforeEach(function () {
      // Create a new DataONEObject model with a test identifier
      model = new DataONEObject({ identifier: "test-id" });
      // Create a new Backbone collection
      collection = new Backbone.Collection();
      // Initialize the DataItemView with the model and collection
      dataItemView = new DataItemView({
        model: model,
        collection: collection,
      });

      // Stub the getParentScienceMetadata function to return a mock object
      sinon.stub(dataItemView, "getParentScienceMetadata").returns({
        id: "mock-sci-meta-id",
      });

      // Stub the getParentDataPackage function to return a mock object with a spy on the add method
      sinon.stub(dataItemView, "getParentDataPackage").returns({
        packageModel: { id: "mock-package-id" },
        add: sinon.spy(),
      });
    });

    // Clean up the test environment after each test
    afterEach(function () {
      // Restore the stubbed methods to their original implementations
      dataItemView.getParentScienceMetadata.restore();
      dataItemView.getParentDataPackage.restore();
      dataItemView.remove();
    });

    describe("uploadFilesInBatch", function () {
      it("should upload files in batches", function (done) {
        // Create a list of DataONEObject models with initial upload status
        const fileList = [
          new DataONEObject({ uploadFile: true, uploadStatus: "l" }),
          new DataONEObject({ uploadFile: true, uploadStatus: "l" }),
          new DataONEObject({ uploadFile: true, uploadStatus: "l" }),
        ];

        // Define the batch size for the upload
        const batchSize = 2;
        // Spy on the uploadFilesInBatch method to verify its call
        const uploadSpy = sinon.spy(dataItemView, "uploadFilesInBatch");
        // Stub the save method to simulate setting the upload status to "p"
        const saveStub = sinon
          .stub(DataONEObject.prototype, "save")
          .callsFake(function () {
            this.set("uploadStatus", "p");
          });
        // Stub the calculateChecksum method to simulate setting checksum attributes
        const checksumStub = sinon
          .stub(DataONEObject.prototype, "calculateChecksum")
          .callsFake(function () {
            this.set("checksum", "fakeChecksum");
            this.set("checksumAlgorithm", "fakeAlgorithm");
            this.trigger("checksumCalculated", this.attributes);
          });

        // Call the method to be tested
        dataItemView.uploadFilesInBatch(fileList, batchSize);

        // Simulate the completion of the upload by setting the upload status to "c"
        fileList.forEach(function (file) {
          file.set("uploadStatus", "c");
        });

        // Use setTimeout to allow asynchronous operations to complete
        setTimeout(function () {
          // Log the call counts for debugging purposes
          console.log(
            "[should upload files in batches] uploadSpy.callCount: ",
            uploadSpy.callCount,
          );
          console.log(
            "[should upload files in batches] checksumSpy.callCount: ",
            checksumStub.callCount,
          );

          // Verify that the method was called once with the correct arguments
          expect(uploadSpy.calledOnce).to.be.true;
          expect(uploadSpy.calledWith(fileList, batchSize)).to.be.true;
          // Verify that the calculateChecksum method was called the expected number of times
          console.log(
            "[should upload files in batches] fileList.length: ",
            fileList.length,
          );
          console.log(
            "[should upload files in batches] saveSpy.callCount: ",
            saveStub.callCount,
          );
          expect(checksumStub.callCount).to.equal(fileList.length);
          expect(saveStub.callCount).to.equal(fileList.length);
          // Restore the spies and stubs
          uploadSpy.restore();
          checksumStub.restore();
          saveStub.restore();
          // Indicate that the test is complete
          done();
        }, 0);
      });
    });

    describe("addFiles", function () {
      it("should add files to the collection", function (done) {
        // Create a fake file object to simulate a file upload
        const fakeFile = new Blob(["fake file content"], {
          type: "text/plain",
        });
        fakeFile.name = "fakeFile.txt";

        // Create a mock event object with the necessary properties
        const event = {
          stopPropagation: sinon.spy(),
          preventDefault: sinon.spy(),
          target: { files: [fakeFile] },
          originalEvent: { dataTransfer: { files: [fakeFile] } },
          delegateTarget: { dataset: { id: "test-id" } },
        };

        // Stub the methods to simulate their behavior
        const uploadStub = sinon
          .stub(dataItemView, "uploadFilesInBatch")
          .returns(true);
        const d1ObjectStub = sinon
          .stub(DataONEObject.prototype, "initialize")
          .returns(true);

        // Call the method to be tested
        dataItemView.addFiles.call(dataItemView, event);

        // Use setTimeout to allow asynchronous operations to complete
        setTimeout(function () {
          // Verify that the event methods were called
          expect(event.stopPropagation.calledOnce).to.be.true;
          expect(event.preventDefault.calledOnce).to.be.true;
          // Verify that the DataONEObject initialize method was called
          console.log(
            "[should add files to the collection] d1ObjectStub.callCount: ",
            d1ObjectStub.callCount,
          );
          expect(d1ObjectStub.calledOnce).to.be.true;
          // Verify that the uploadFilesInBatch method was called
          console.log(
            "[should add files to the collection] uploadStub.callCount: ",
            uploadStub.callCount,
          );
          expect(uploadStub.calledOnce).to.be.true;
          // Restore the stubs
          uploadStub.restore();
          d1ObjectStub.restore();
          // Indicate that the test is complete
          done();
        }, 0);
      });
    });

    describe("Access Policy Management", function () {
      it("should handle public/private toggle", function() {
        // First verify the method exists
        expect(dataItemView.changeAccessPolicy).to.not.be.undefined;
        expect(typeof dataItemView.changeAccessPolicy).to.equal('function');
        
        // Create a mock checkbox event for making the object public
        const publicEvent = {
          target: { checked: true }
        };
        
        // Create a mock checkbox event for making the object private  
        const privateEvent = {
          target: { checked: false }
        };

        // Test making the object public when no access policy exists
        expect(function() {
          dataItemView.changeAccessPolicy(publicEvent);
        }).to.not.throw("changeAccessPolicy should handle public toggle without throwing");
        
        // Verify createAccessPolicy was called on the model
        const accessPolicy = model.get("accessPolicy");
        expect(accessPolicy).to.not.be.undefined;
        expect(accessPolicy).to.not.be.null;
        expect(accessPolicy.makePublic).to.not.be.undefined;
        expect(typeof accessPolicy.makePublic).to.equal('function');
        
        // Test making the object public when access policy already exists
        const makePublicSpy = sinon.spy(accessPolicy, "makePublic");
        
        expect(function() {
          dataItemView.changeAccessPolicy(publicEvent);
        }).to.not.throw("changeAccessPolicy should handle public toggle on existing policy");
        
        expect(makePublicSpy.calledOnce).to.be.true;
        
        // Test making the object private
        expect(accessPolicy.makePrivate).to.not.be.undefined;
        expect(typeof accessPolicy.makePrivate).to.equal('function');
        
        const makePrivateSpy = sinon.spy(accessPolicy, "makePrivate");
        
        expect(function() {
          dataItemView.changeAccessPolicy(privateEvent);
        }).to.not.throw("changeAccessPolicy should handle private toggle");
        
        expect(makePrivateSpy.calledOnce).to.be.true;
        
        // Test that the method handles null event gracefully
        expect(function() {
          dataItemView.changeAccessPolicy(null);
        }).to.not.throw("changeAccessPolicy should handle null event gracefully");
        
        // Clean up spies
        makePublicSpy.restore();
        makePrivateSpy.restore();
      });

      it.skip("EXPECTED FAILURE: should update UI when AccessPolicy changes", function() {
        // Create an access policy for the model
        const accessPolicy = model.createAccessPolicy();
        model.set("accessPolicy", accessPolicy);
        
        // First verify that the required AccessPolicy methods exist
        expect(accessPolicy.makePrivate).to.not.be.undefined;
        expect(typeof accessPolicy.makePrivate).to.equal('function');
        expect(accessPolicy.makePublic).to.not.be.undefined;
        expect(typeof accessPolicy.makePublic).to.equal('function');
        
        // Test that AccessPolicy state methods exist and work
        if (accessPolicy.isPublic) {
          expect(typeof accessPolicy.isPublic).to.equal('function');
        }
        if (accessPolicy.isPrivate) {
          expect(typeof accessPolicy.isPrivate).to.equal('function');
        }
        
        // Verify the DataItemView has UI update capabilities
        expect(dataItemView.$).to.not.be.undefined;
        expect(typeof dataItemView.$).to.equal('function');
        
        // Test that the view responds to AccessPolicy changes
        let makePrivateEventFired = false;
        let makePublicEventFired = false;
        
        // Listen for change events on the access policy with specific tracking
        accessPolicy.on('change', function() {
          console.log("AccessPolicy change event fired");
        });
        
        // Track makePrivate change events specifically
        accessPolicy.on('change', function() {
          if (!makePrivateEventFired) {
            makePrivateEventFired = true;
            console.log("makePrivate change event detected");
          }
        });
        
        // Test making the policy private
        console.log("Testing makePrivate()...");
        expect(function() {
          accessPolicy.makePrivate();
        }).to.not.throw("makePrivate should not throw errors");
        
        // Verify that change events are fired when policy changes
        expect(makePrivateEventFired).to.be.true;
        console.log("makePrivate change event verification: PASSED");
        
        // Setup listener for public change events 
        accessPolicy.on('change', function() {
          if (makePrivateEventFired && !makePublicEventFired) {
            makePublicEventFired = true;
            console.log("makePublic change event detected");
          }
        });
        
        // Test making the policy public
        console.log("Testing makePublic()...");
        expect(function() {
          accessPolicy.makePublic();
        }).to.not.throw("makePublic should not throw errors");
        
        // This assertion will fail if makePublic doesn't fire change events
        console.log("makePublic event fired?", makePublicEventFired);
        expect(makePublicEventFired).to.be.true;
        console.log("makePublic change event verification: PASSED");
        
        // Test that the DataItemView has methods to handle UI updates
        const uiUpdateMethods = ['updateAccessPolicyUI', 'renderAccessPolicy', 'showAccessPolicyIndicators'];
        const existingMethods = uiUpdateMethods.filter(method => typeof dataItemView[method] === 'function');
        
        console.log("Available UI update methods:", existingMethods);
        expect(existingMethods.length).to.be.at.least(1, 
          "DataItemView should have at least one method to handle UI updates for AccessPolicy changes. " +
          "Expected one of: " + uiUpdateMethods.join(', '));
        
        // Test calling the existing UI update method(s) if they exist
        existingMethods.forEach(methodName => {
          expect(function() {
            dataItemView[methodName]();
          }).to.not.throw(`${methodName} should not throw when called`);
        });
        
        // Clean up event listeners
        accessPolicy.off('change');
      });
    });
  });
});