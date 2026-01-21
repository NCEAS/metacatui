define([
  "jquery",
  "underscore",
  "backbone",
  "models/DataONEObject",
  "collections/AccessPolicy",
  "models/AccessRule",
  "views/EditorView",
  "/test/js/specs/shared/clean-state.js"
], function ($, _, Backbone, DataONEObject, AccessPolicy, AccessRule, EditorView, cleanState) {
  var expect = chai.expect;

  describe("EditorView Test Suite", function () {
    
    // Use clean state helper to prevent global leaks
    var state = cleanState(function() {
      return {
        dataObject: new DataONEObject({ 
          id: "test-dataset-" + Date.now(),
          fileName: "test-dataset.xml",
          type: "Metadata",
          formatId: "eml://ecoinformatics.org/eml-2.1.1"
        }),
        editorView: null,
        accessPolicy: null
      };
    }, beforeEach);

    // Clean up after each test
    afterEach(function() {
      if (state.editorView) {
        try {
          state.editorView.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        state.editorView = null;
      }
      
      if (state.accessPolicy) {
        try {
          state.accessPolicy.off();
          state.accessPolicy.reset([], {silent: true});
        } catch (e) {
          // Ignore cleanup errors
        }
        state.accessPolicy = null;
      }
      
      if (state.dataObject) {
        try {
          state.dataObject.off();
          state.dataObject.clear({silent: true});
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    describe("Module Loading", function () {
      it("should load EditorView as a constructor function", function () {
        expect(EditorView).to.exist;
        expect(typeof EditorView).to.equal('function');
        expect(EditorView.prototype).to.exist;
      });

      it("should be able to create instances", function () {
        expect(function() {
          state.editorView = new EditorView({
            model: state.dataObject
          });
        }).to.not.throw();
        
        expect(state.editorView).to.exist;
        expect(state.editorView).to.be.instanceOf(EditorView);
      });
    });

    describe("AccessPolicy Integration", function() {
      beforeEach(function() {
        state.editorView = new EditorView({
          model: state.dataObject
        });

        // Create and attach the AccessPolicy properly
        state.accessPolicy = state.dataObject.createAccessPolicy();
        
        // Add some test access rules and verify they're actually added
        var testRules = [
          new AccessRule({
            subject: "uid=testuser,dc=example",
            read: true,
            write: false,
            dataONEObject: state.dataObject
          }),
          new AccessRule({
            subject: "public", 
            read: true,
            write: false,
            dataONEObject: state.dataObject
          })
        ];
        
        state.accessPolicy.add(testRules);
        
        // Verify the rules were actually added
        expect(state.accessPolicy.length).to.equal(2);
        
        // Ensure the AccessPolicy is set on the data object
        state.dataObject.set("accessPolicy", state.accessPolicy);
        expect(state.dataObject.get("accessPolicy")).to.equal(state.accessPolicy);
      });

      it("should have renderAccessPolicy method", function() {
        expect(state.editorView.renderAccessPolicy).to.exist;
        expect(typeof state.editorView.renderAccessPolicy).to.equal('function');
      });

      it("should handle AccessPolicy modal opening request", function() {
        // Mock MetacatUI.appModel to prevent early exit
        if (typeof MetacatUI === 'undefined') {
          global.MetacatUI = {};
        }
        if (!MetacatUI.appModel) {
          MetacatUI.appModel = { get: sinon.stub() };
        }
        
        var appModelStub = sinon.stub(MetacatUI.appModel, 'get');
        appModelStub.withArgs("allowAccessPolicyChanges").returns(true);
        appModelStub.callThrough();

        // Mock DOM elements to prevent early exit
        var mockAccessPolicyControl = {
          attr: sinon.stub().returns(null) // Not disabled
        };
        
        sinon.stub(state.editorView, "$")
          .withArgs(".access-policy-control")
          .returns(mockAccessPolicyControl);

        // Test that showAccessPolicyModal exists and can be called
        expect(state.editorView.showAccessPolicyModal).to.exist;
        expect(typeof state.editorView.showAccessPolicyModal).to.equal('function');
        
        // Call the method - it should not throw even if RequireJS fails
        expect(function() {
          state.editorView.showAccessPolicyModal(null, state.dataObject);
        }).to.not.throw();

        // Clean up
        appModelStub.restore();
        state.editorView.$.restore();
      });

      it("should handle AccessPolicy changes from modal", function() {
        // Verify initial state
        expect(state.accessPolicy.length).to.equal(2);
        
        // Set up change handler
        var changeHandler = sinon.spy();
        state.editorView.listenTo(state.accessPolicy, "change add remove", changeHandler);

        // Simulate adding a new rule (would normally happen through AccessPolicyView)
        var newRule = new AccessRule({
          subject: "uid=newuser,dc=example", 
          read: true,
          write: false,
          dataONEObject: state.dataObject
        });

        state.accessPolicy.add(newRule);

        // Verify the change was detected
        expect(changeHandler.called).to.be.true;
        expect(state.accessPolicy.length).to.equal(3); // 2 initial + 1 new

        // Verify the data object's access policy is updated
        var dataObjectPolicy = state.dataObject.get("accessPolicy");
        expect(dataObjectPolicy).to.equal(state.accessPolicy);
        expect(dataObjectPolicy.length).to.equal(3);

        // Verify the subjects are correct
        var subjects = state.accessPolicy.pluck("subject");
        expect(subjects).to.include("uid=testuser,dc=example");
        expect(subjects).to.include("public");
        expect(subjects).to.include("uid=newuser,dc=example");
      });

      it("should preserve AccessPolicy when editor saves data", function() {
        // Verify initial state
        expect(state.accessPolicy.length).to.equal(2);
        
        // Add additional test rule
        var additionalRule = new AccessRule({
          subject: "uid=collaborator,dc=example",
          read: true,
          write: false,
          dataONEObject: state.dataObject  
        });

        state.accessPolicy.add(additionalRule);
        expect(state.accessPolicy.length).to.equal(3); // 2 initial + 1 additional

        // Mock the save functionality
        var saveSpy = sinon.spy();
        state.dataObject.save = saveSpy;

        // Simulate save (would normally be triggered by UI)
        if (state.editorView.save) {
          state.editorView.save();
        } else {
          // Directly call save on the model
          state.dataObject.save();
        }

        // Verify access policy is preserved
        var policyAfterSave = state.dataObject.get("accessPolicy");
        expect(policyAfterSave).to.exist;
        expect(policyAfterSave).to.equal(state.accessPolicy);
        expect(policyAfterSave.length).to.equal(3);

        // Verify all subjects are preserved
        var subjects = policyAfterSave.pluck("subject").sort();
        expect(subjects).to.deep.equal([
          "public",
          "uid=collaborator,dc=example", 
          "uid=testuser,dc=example"
        ]);
      });
    });

    describe("AccessPolicy Error Handling", function() {
      beforeEach(function() {
        state.editorView = new EditorView({
          model: state.dataObject
        });
      });

      it("should handle missing AccessPolicy gracefully", function() {
        // Create a DataONEObject without explicitly setting an accessPolicy
        var testObject = new DataONEObject({
          id: "test-no-policy",
          type: "Data"
        });
        
        var policy = testObject.get("accessPolicy");
        
        // The policy might be undefined or an empty collection
        if (policy) {
          expect(policy.length).to.equal(0);
        } else {
          expect(policy).to.be.undefined;
        }

        // The editor should handle this gracefully
        expect(function() {
          var editorView = new EditorView({ model: testObject });
          if (editorView.renderAccessPolicy) {
            // This should not throw even with missing policy
            // (it will exit early due to no allowAccessPolicyChanges)
          }
        }).to.not.throw();
      });

      it.skip("EXPECTED FAILURE: should handle roundtrip AccessPolicy data", function() {
        // Create AccessPolicy with sample data
        var policyData = new AccessPolicy();
        policyData.add([
          { subject: "uid=test,dc=example", read: true },
          { subject: "public", read: true }
        ]);
        const rawPolicyData = policyData.toJSON();
        
        state.dataObject.set("accessPolicy", rawPolicyData);

        // Verify it's raw data (this is the serialization bug)
        var policy = state.dataObject.get("accessPolicy");
        expect(Array.isArray(policy)).to.be.true;

        // Now simulate what happens during normal reload - let automatic deserialization fail
        var jsonData = state.dataObject.toJSON();
        var reloadedObject = new DataONEObject(jsonData);
        
        // This is where the bug manifests - the accessPolicy becomes raw JSON instead of AccessPolicy
        var reloadedPolicy = reloadedObject.get("accessPolicy");
        
        // THE BUG: This should be an AccessPolicy instance but will be raw array
        expect(reloadedPolicy).to.be.instanceOf(AccessPolicy, 
          "EXPECTED FAILURE: AccessPolicy should be reconstructed as AccessPolicy instance after reload");
        
        // THE BUG: Even if it's an array, we should be able to access the data
        expect(reloadedPolicy.length).to.equal(2,
          "EXPECTED FAILURE: All access rules should survive serialization round-trip");
        
        // If we got this far (which we shouldn't), verify the subjects were preserved
        if (reloadedPolicy && typeof reloadedPolicy.pluck === 'function') {
          var subjects = reloadedPolicy.pluck("subject");
          expect(subjects).to.include("uid=test,dc=example");
          expect(subjects).to.include("public");
        } else if (Array.isArray(reloadedPolicy)) {
          // If it's raw JSON, check differently
          var subjects = reloadedPolicy.map(function(rule) { return rule.subject; });
          expect(subjects).to.include("uid=test,dc=example");
          expect(subjects).to.include("public");
        }
      });

      it("should handle corrupted AccessPolicy data", function() {
        // Set raw array instead of AccessPolicy collection (simulating serialization bug)
        var rawPolicyData = [
          { subject: "uid=test,dc=example", read: true },
          { subject: "public", read: true }
        ];
        
        state.dataObject.set("accessPolicy", rawPolicyData);

        // Verify it's raw data
        var policy = state.dataObject.get("accessPolicy");
        expect(Array.isArray(policy)).to.be.true;

        // EditorView does NOT handle this case - it would fail when trying to render
        // because it passes the raw array directly to AccessPolicyView expecting a collection
        
        // Mock MetacatUI.appModel to allow the method to run
        if (typeof MetacatUI === 'undefined') {
          global.MetacatUI = {};
        }
        if (!MetacatUI.appModel) {
          MetacatUI.appModel = { get: sinon.stub() };
        }
        
        var appModelStub = sinon.stub(MetacatUI.appModel, 'get');
        appModelStub.withArgs("allowAccessPolicyChanges").returns(true);
        appModelStub.callThrough();

        // Mock require to avoid async issues but show that AccessPolicyView would fail
        var originalRequire = window.require;
        var requireError = null;
        window.require = function(deps, callback) {
          if (deps[0] === "views/AccessPolicyView") {
            var MockAccessPolicyView = function(options) {
              // This would fail in real AccessPolicyView because options.collection is an array
              if (Array.isArray(options.collection)) {
                throw new Error("AccessPolicyView expects a Collection, not an array");
              }
              this.collection = options.collection;
            };
            
            try {
              callback(MockAccessPolicyView);
            } catch (e) {
              requireError = e;
            }
          }
        };

        // EditorView's renderAccessPolicy would fail with raw array data
        state.editorView.renderAccessPolicy(state.dataObject);
        
        // Verify that the error occurred (EditorView doesn't handle raw arrays)
        expect(requireError).to.exist;
        expect(requireError.message).to.include("expects a Collection, not an array");

        // Clean up
        window.require = originalRequire;
        appModelStub.restore();
      });
    });
  });
});