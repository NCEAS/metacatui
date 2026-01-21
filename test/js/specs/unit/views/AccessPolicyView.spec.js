define([
  "jquery",
  "underscore", 
  "backbone",
  "models/DataONEObject",
  "collections/AccessPolicy",
  "models/AccessRule",
  "views/AccessPolicyView",
  "/test/js/specs/shared/clean-state.js"
], function ($, _, Backbone, DataONEObject, AccessPolicy, AccessRule, AccessPolicyView, cleanState) {
  var expect = chai.expect;

  describe("AccessPolicyView Test Suite", function () {
    
    // Use clean state helper to prevent global leaks
    var state = cleanState(function() {
      return {
        dataONEObject: new DataONEObject({ 
          id: "test-id-" + Date.now(), // Unique ID to prevent conflicts
          fileName: "test-file.csv",
          type: "Data"
        }),
        collection: null,
        view: null
      };
    }, beforeEach);

    // Clean up after each test
    afterEach(function() {
      if (state.view) {
        try {
          state.view.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        state.view = null;
      }
      
      if (state.collection) {
        try {
          state.collection.off(); // Remove all listeners
          state.collection.reset([], {silent: true}); // Clear collection
        } catch (e) {
          // Ignore cleanup errors
        }
        state.collection = null;
      }
      
      // Force garbage collection of any hanging references
      if (state.dataONEObject) {
        try {
          state.dataONEObject.off();
          state.dataONEObject.clear({silent: true});
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    describe("Module Loading", function () {
      it("should load AccessPolicyView as a constructor function", function () {
        expect(AccessPolicyView).to.exist;
        expect(typeof AccessPolicyView).to.equal('function');
        expect(AccessPolicyView.prototype).to.exist;
      });

      it("should be able to create instances", function () {
        // Create collection within the test to avoid global scope issues
        var localCollection = new AccessPolicy();
        localCollection.dataONEObject = state.dataONEObject;
        
        var view;
        expect(function() {
          view = new AccessPolicyView({
            collection: localCollection
          });
        }).to.not.throw();
        
        expect(view).to.exist;
        expect(view).to.be.instanceOf(AccessPolicyView);
        
        // Clean up immediately
        if (view && view.remove) {
          view.remove();
        }
        if (localCollection) {
          localCollection.off();
          localCollection.reset([], {silent: true});
        }
      });
    });

    describe("Serialization Round-trip Issues", function() {
      beforeEach(function() {
        state.collection = new AccessPolicy();
        state.collection.dataONEObject = state.dataONEObject;
        state.view = new AccessPolicyView({
          collection: state.collection
        });
      });

      it.skip("EXPECTED FAILURE: AccessPolicy rules are lost during JSON serialization", function() {
        // Create some access rules
        var rules = [
          new AccessRule({
            subject: "uid=alice,dc=example",
            read: true,
            write: true,
            dataONEObject: state.dataONEObject
          }),
          new AccessRule({
            subject: "uid=bob,dc=example", 
            read: true,
            write: false,
            dataONEObject: state.dataONEObject
          }),
          new AccessRule({
            subject: "public",
            read: true,
            write: false,
            dataONEObject: state.dataONEObject
          })
        ];

        // Add rules to the collection
        state.collection.add(rules);
        expect(state.collection.length).to.equal(3);

        // Store the collection on the DataONEObject
        state.dataONEObject.set("accessPolicy", state.collection);

        console.log("=== BEFORE SERIALIZATION ===");
        console.log("Collection type:", state.collection.constructor.name);
        console.log("Collection length:", state.collection.length);
        console.log("Has serialize method:", typeof state.collection.serialize === 'function');

        // Simulate what happens during save/sync - JSON serialization
        var jsonData = state.dataONEObject.toJSON();
        console.log("=== AFTER JSON SERIALIZATION ===");
        console.log("accessPolicy type:", typeof jsonData.accessPolicy);
        console.log("accessPolicy length:", Array.isArray(jsonData.accessPolicy) ? jsonData.accessPolicy.length : 'Not an array');

        // This is what happens when the data comes back from server
        var reconstructedObject = new DataONEObject(jsonData);
        console.log("=== AFTER RECONSTRUCTION ===");
        console.log("Reconstructed accessPolicy type:", typeof reconstructedObject.get("accessPolicy"));
        
        var reconstructedPolicy = reconstructedObject.get("accessPolicy");
        if (reconstructedPolicy && typeof reconstructedPolicy.length !== 'undefined') {
          console.log("Reconstructed policy length:", reconstructedPolicy.length);
        }

        // THIS IS THE BUG: The reconstructed policy is likely raw JSON, not an AccessPolicy collection
        expect(reconstructedPolicy).to.be.instanceOf(AccessPolicy, 
          "EXPECTED FAILURE: AccessPolicy should be reconstructed as AccessPolicy instance, but it's likely just raw JSON");
        
        // THIS WILL ALSO FAIL: Rules are lost
        expect(reconstructedPolicy.length).to.equal(3, 
          "EXPECTED FAILURE: All 3 rules should survive serialization round-trip");
      });

      it.skip("EXPECTED FAILURE: User scenario - Professor shares dataset, students lose access after reload", function() {
        console.log("=== USER SCENARIO: Professor shares dataset with students ===");
        
        // Professor configures access for 5 students + public
        var students = ['alice', 'bob', 'charlie', 'diana', 'eve'];
        var rules = students.map(function(student) {
          return new AccessRule({
            subject: "uid=" + student + ",dc=example",
            read: true,
            write: false,
            dataONEObject: state.dataONEObject
          });
        });
        
        // Add public read
        rules.push(new AccessRule({
          subject: "public",
          read: true,
          write: false,
          dataONEObject: state.dataONEObject
        }));

        state.collection.add(rules);
        state.dataONEObject.set("accessPolicy", state.collection);
        
        console.log("Professor grants access to", students.length, "students + public");
        console.log("Initial policy length:", state.collection.length);

        // Simulate save/reload cycle (what happens when user refreshes browser)
        var savedJson = state.dataONEObject.toJSON();
        var reloadedObject = new DataONEObject(savedJson);
        
        // Check how many students retained access
        var reloadedPolicy = reloadedObject.get("accessPolicy");
        var survivingRulesCount = 0;
        var lostStudents = [];
        
        if (reloadedPolicy && typeof reloadedPolicy.length !== 'undefined') {
          survivingRulesCount = reloadedPolicy.length;
        }
        
        // If it's raw JSON, we need to check differently
        if (Array.isArray(reloadedPolicy)) {
          survivingRulesCount = reloadedPolicy.length;
        }
        
        students.forEach(function(student) {
          var hasAccess = false;
          if (reloadedPolicy && Array.isArray(reloadedPolicy)) {
            hasAccess = reloadedPolicy.some(function(rule) {
              return rule.subject === "uid=" + student + ",dc=example";
            });
          } else if (reloadedPolicy && reloadedPolicy.where) {
            hasAccess = reloadedPolicy.where({subject: "uid=" + student + ",dc=example"}).length > 0;
          }
          
          if (!hasAccess) {
            lostStudents.push(student);
          }
        });

        console.log("Students who retained access:", students.length - lostStudents.length + "/" + students.length);
        if (lostStudents.length > 0) {
          console.log("❌ Students who lost access:", lostStudents.join(', '));
        }

        expect(survivingRulesCount).to.equal(6, 
          "EXPECTED FAILURE: All " + students.length + " students + public should retain access to the dataset");
      });

      it.skip("EXPECTED FAILURE: Multiple edit sessions cause cumulative rule loss", function() {
        console.log("=== SCENARIO: Multiple editing sessions cause cumulative rule loss ===");
        
        // Session 1: User configures 3 rules
        console.log("Session 1: User configures 3 rules");
        var session1Rules = [
          new AccessRule({subject: "uid=user1,dc=example", read: true, dataONEObject: state.dataONEObject}),
          new AccessRule({subject: "uid=user2,dc=example", read: true, dataONEObject: state.dataONEObject}),
          new AccessRule({subject: "public", read: true, dataONEObject: state.dataONEObject})
        ];
        
        state.collection.add(session1Rules);
        state.dataONEObject.set("accessPolicy", state.collection);
        
        // Simulate save and reload (like browser refresh between sessions)
        var json1 = state.dataONEObject.toJSON();
        var reloaded1 = new DataONEObject(json1);
        
        // Session 2: User adds 1 more rule
        console.log("Session 2: User adds 1 more rule, total should be 4");
        var session2Policy = reloaded1.get("accessPolicy");
        
        // This is where the bug manifests - session2Policy might not be an AccessPolicy
        var newRule = new AccessRule({
          subject: "uid=user4,dc=example", 
          read: true, 
          dataONEObject: reloaded1
        });
        
        var finalRuleCount = 0;
        if (session2Policy && session2Policy.add) {
          // If it's still an AccessPolicy
          session2Policy.add(newRule);
          finalRuleCount = session2Policy.length;
        } else if (Array.isArray(session2Policy)) {
          // If it became raw JSON
          session2Policy.push(newRule.toJSON());
          finalRuleCount = session2Policy.length;
          reloaded1.set("accessPolicy", session2Policy);
        }
        
        console.log("Final result:", finalRuleCount, "rules (should be 4)");
        
        // Final save/reload
        var json2 = reloaded1.toJSON();
        var final = new DataONEObject(json2);
        var finalPolicy = final.get("accessPolicy");
        
        var actualFinalCount = 0;
        if (finalPolicy) {
          if (typeof finalPolicy.length !== 'undefined') {
            actualFinalCount = finalPolicy.length;
          }
        }

        expect(actualFinalCount).to.equal(4, 
          "EXPECTED FAILURE: After two editing sessions, all 4 access rules should be preserved");
      });

      it.skip("EXPECTED FAILURE: Technical demonstration of serialization mismatch", function() {
        console.log("=== TECHNICAL DEMONSTRATION: Serialization Mismatch ===");
        
        // Create AccessPolicy with rules
        var rules = [
          new AccessRule({subject: "uid=test1,dc=example", read: true, dataONEObject: state.dataONEObject}),
          new AccessRule({subject: "uid=test2,dc=example", write: true, dataONEObject: state.dataONEObject})
        ];
        
        state.collection.add(rules);
        state.dataONEObject.set("accessPolicy", state.collection);
        
        console.log("1. Original AccessPolicy:");
        console.log("   Type:", state.collection.constructor.name);
        console.log("   Length:", state.collection.length);
        console.log("   Has serialize method:", typeof state.collection.serialize === 'function');
        console.log("   Has collection methods:", typeof state.collection.add === 'function');
        
        // Serialize to JSON (what happens during save)
        var jsonData = state.dataONEObject.toJSON();
        console.log("\n2. After JSON serialization:");
        console.log("   accessPolicy type:", typeof jsonData.accessPolicy);
        console.log("   accessPolicy length:", Array.isArray(jsonData.accessPolicy) ? jsonData.accessPolicy.length : 'N/A');
        if (Array.isArray(jsonData.accessPolicy) && jsonData.accessPolicy[0]) {
          console.log("   Sample rule:", JSON.stringify(jsonData.accessPolicy[0]));
        }
        
        // Deserialize (what happens during load)
        var reconstructed = new DataONEObject(jsonData);
        var reconstructedPolicy = reconstructed.get("accessPolicy");
        
        console.log("\n3. After deserialization:");
        console.log("   Type:", reconstructedPolicy ? reconstructedPolicy.constructor.name : 'null');
        console.log("   Length:", reconstructedPolicy ? reconstructedPolicy.length : 0);
        console.log("   Has serialize method:", reconstructedPolicy ? typeof reconstructedPolicy.serialize === 'function' : false);
        console.log("   Has collection methods:", reconstructedPolicy ? typeof reconstructedPolicy.add === 'function' : false);
        
        // THE BUG: This should be an AccessPolicy but is likely raw JSON
        expect(reconstructedPolicy).to.be.instanceOf(AccessPolicy, 
          "EXPECTED FAILURE: Deserialized policy should be AccessPolicy instance");
          
        expect(reconstructedPolicy.length).to.equal(2,
          "EXPECTED FAILURE: All rules should survive round-trip");
      });
    });

    describe("View Integration with Serialization Issues", function() {
      beforeEach(function() {
        state.collection = new AccessPolicy();
        state.collection.dataONEObject = state.dataONEObject;
        state.view = new AccessPolicyView({
          collection: state.collection
        });
      });

      it.skip("EXPECTED FAILURE: View breaks when AccessPolicy becomes raw JSON after reload", function() {
        // Setup: Create rules and simulate save/reload
        var rule = new AccessRule({
          subject: "uid=test,dc=example",
          read: true,
          dataONEObject: state.dataONEObject
        });
        
        state.collection.add(rule);
        state.dataONEObject.set("accessPolicy", state.collection);
        
        // Simulate save/reload cycle
        var jsonData = state.dataONEObject.toJSON();
        var reloadedObject = new DataONEObject(jsonData);
        var reloadedPolicy = reloadedObject.get("accessPolicy");
        
        // Try to create a view with the reloaded policy
        // This should fail if reloadedPolicy is raw JSON instead of AccessPolicy
        expect(function() {
          var brokenView = new AccessPolicyView({
            collection: reloadedPolicy
          });
          
          // If it doesn't throw during construction, it might throw during render
          if (brokenView.render) {
            brokenView.render();
          }
          
          // Clean up
          if (brokenView && brokenView.remove) {
            brokenView.remove();
          }
        }).to.not.throw("EXPECTED FAILURE: View should work with reloaded policy, but fails because it's raw JSON");
      });
    });
  });
});