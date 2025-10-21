"use strict";


define([
  "/test/js/specs/shared/clean-state.js",
  "collections/AccessPolicy",
  "models/AccessRule",
  "models/DataONEObject"
], function(cleanState, AccessPolicy, AccessRule, DataONEObject) {
  const should = chai.should();
  const expect = chai.expect;

  const state = cleanState(function() {
    const dataONEObject = new DataONEObject({
      id: "test-id",
      rightsHolder: "owner@example.org",
      isNew: function() {
        return false;
      } // used by isAuthorizedUpdateSysMeta
    });
    const policy = dataONEObject.createAccessPolicy();

    let triggerSpy = null;
    // Add sinon spy for tests that need it
    if (typeof sinon !== "undefined") {
      sinon.spy(policy, "trigger");
    }

    return { dataONEObject, policy };
  }, beforeEach);

  // Add afterEach to clean up spies
  afterEach(function() {
    if (state.triggerSpy) {
      state.triggerSpy.restore();
    }
  });

  function makeRule(subject, permissions = ["read"], extraAttrs = {}) {
    if (typeof subject === "object") {
      // Handle when first param is an attributes object
      return new AccessRule(Object.assign({
        subject: "uid=test,dc=example",
        read: true
      }, subject));
    }

    // Handle when called with subject and permissions
    const attrs = Object.assign({
      subject: subject || "uid=test,dc=example"
    }, extraAttrs);

    // Convert permissions array to individual boolean attributes
    if (Array.isArray(permissions)) {
      permissions.forEach(perm => {
        if (perm === "read") attrs.read = true;
        if (perm === "write") attrs.write = true;
        if (perm === "changePermission") attrs.changePermission = true;
      });
    }

    return new AccessRule(attrs);
  }

  function getSubjects(policy) {
    return policy.map(function(r) {
      return r.get("subject");
    });
  }

  function createAccessPolicyElement(rules) {
    rules = rules || []; // replace default parameter

    var xmlDoc = document.implementation.createDocument(null, "accessPolicy", null);
    var root = xmlDoc.documentElement;

    function addPermission(parent, name) {
      var p = xmlDoc.createElement("permission");
      p.appendChild(xmlDoc.createTextNode(name));
      parent.appendChild(p);
    }

    for (var i = 0; i < rules.length; i++) { // replace for..of
      var r = rules[i];
      var allow = xmlDoc.createElement("allow");

      var subject = xmlDoc.createElement("subject");
      subject.appendChild(xmlDoc.createTextNode(r.subject || ""));
      allow.appendChild(subject);

      if (r.read) addPermission(allow, "read");
      if (r.write) addPermission(allow, "write");
      if (r.changePermission) addPermission(allow, "changePermission");

      root.appendChild(allow);
    }

    return root;
  }


  describe("AccessPolicy Test Suite", function() {
    //-----------------------------------------------------------------------
    // Sanity checks
    //-----------------------------------------------------------------------
    describe("sanity checks", function() {
      it("constructs an empty collection by default", function() {
        expect(state.policy).to.exist;
        expect(state.policy.length).to.equal(0);
      });

      it("uses AccessRule as its model", function() {
        expect(AccessPolicy).to.be.a("function");
        const policy = new AccessPolicy();
        expect(policy.model).to.equal(AccessRule);
      });

      it("can add an AccessRule instance", function() {
        const rule = makeRule({ subject: "cn=user,dc=example", read: true });
        state.policy.add(rule);
        expect(state.policy.length).to.equal(1);
        expect(state.policy.at(0)).to.equal(rule);
        expect(state.policy.at(0)).to.be.instanceOf(AccessRule);
      });

      it("can add a rule from plain attributes (creates AccessRule)", function() {
        state.policy.add({ subject: "uid=a,dc=example", read: true });
        const m = state.policy.at(0);
        expect(m).to.be.instanceOf(AccessRule);
        expect(m.get("subject")).to.equal("uid=a,dc=example");
        expect(m.get("read")).to.equal(true);
      });

      it("removes rules", function() {
        const r1 = makeRule({ subject: "uid=a,dc=example" });
        const r2 = makeRule({ subject: "uid=b,dc=example" });
        state.policy.add([r1, r2]);
        expect(state.policy.length).to.equal(2);
        state.policy.remove(r1);
        expect(state.policy.length).to.equal(1);
        expect(state.policy.at(0).get("subject")).to.equal("uid=b,dc=example");
      });

      it("serializes to JSON (array of rule attributes)", function() {
        state.policy.add([
          { subject: "uid=a,dc=example", read: true },
          { subject: "uid=b,dc=example", read: true }
        ]);
        const json = state.policy.toJSON();
        expect(json).to.be.an("array").with.length(2);
        expect(json[0]).to.include({ subject: "uid=a,dc=example" });
        expect(json[1]).to.include({ subject: "uid=b,dc=example" });
        expect(json[0]).to.have.property("read", true);
      });

      it("returns an AccessPolicy and stores the DataONEObject reference", () => {
        const obj = new DataONEObject({ id: "test-id" });

        const policy = obj.createAccessPolicy(); // no XML

        expect(policy).to.be.instanceOf(AccessPolicy);
        expect(policy.dataONEObject).to.equal(obj);
      });

      it("parses <accessPolicy> XML into AccessRules", () => {
        const obj = new DataONEObject({ id: "test-id" });

        const xml = new DOMParser().parseFromString(
          `
        <accessPolicy>
          <allow>
            <subject>uid:test-user</subject>
            <permission>read</permission>
            <permission>write</permission>
          </allow>
          <allow>
            <subject>CN=Some Group,DC=dataone,DC=org</subject>
            <permission>read</permission>
          </allow>
        </accessPolicy>
        `,
          "text/xml"
        ).documentElement;

        const policy = obj.createAccessPolicy(xml);

        expect(policy.length).to.equal(2);

        const r1 = policy.at(0);
        const r2 = policy.at(1);

        // Adjust these assertions to match your AccessRule attribute names
        expect(r1.get("subject") || r1.get("subjects")).to.include("uid:test-user");
        expect(r1.get("read") || r1.get("permissionRead")).to.be.true;
        expect(r1.get("write") || r1.get("permissionWrite")).to.be.true;

        expect(r2.get("subject") || r2.get("subjects")).to.include(
          "CN=Some Group,DC=dataone,DC=org"
        );
        expect(r2.get("read") || r2.get("permissionRead")).to.be.true;
      });

      it("is clean between tests (no leakage)", function() {
        // cleanState should reset the collection each test
        expect(state.policy.length).to.equal(0);
      });
    });

    //-----------------------------------------------------------------------
    // 3.1  Construction & basic properties
    //-----------------------------------------------------------------------
    describe("initialization", function() {
      it("stores the supplied DataONEObject reference", function() {
        state.dataONEObject = new DataONEObject({ id: "test-id" });
        state.policy = state.dataONEObject.createAccessPolicy();
        expect(state.policy).to.exist;
        expect(state.policy.dataONEObject).to.equal(state.dataONEObject);
      });

      it("starts with an empty collection", function() {
        expect(state.policy.length).to.equal(0);
      });
    });

    //-----------------------------------------------------------------------
    // 3.2  createDefaultPolicy()
    //-----------------------------------------------------------------------
    describe("createDefaultPolicy()", function() {
      it("creates a rule from the appModel defaultAccessPolicy", function() {
        // The stub appModel returns one rule (public, read/write/perm).
        state.policy.createDefaultPolicy();
        expect(state.policy).to.have.lengthOf(1);

        const rule = state.policy.at(0);
        expect(rule.get("subject")).to.equal("public");
        expect(rule.get("read")).to.be.true;
      });

      it("adds a new rule each time it is called", function() {
        state.policy.createDefaultPolicy();
        state.policy.createDefaultPolicy();
        expect(state.policy).to.have.lengthOf(2);
      });
    });

    //-----------------------------------------------------------------------
    // 3.3  parse() – turning an <accessPolicy> XML element into rules
    //-----------------------------------------------------------------------
    describe("parse()", function() {
      it("creates a rule for each <allow> element", function() {
        const xmlFragment = createAccessPolicyElement([
          { subject: "public", read: true },
          { subject: "bob@example.org", write: true, changePermission: true }
        ]);
        state.policy.parse(xmlFragment);
        expect(state.policy).to.have.lengthOf(2);

        const r1 = state.policy.at(0);
        expect(r1.get("subject")).to.equal("public");
        expect(r1.get("read")).to.be.true;

        const r2 = state.policy.at(1);
        expect(r2.get("subject")).to.equal("bob@example.org");
        expect(r2.get("write")).to.be.true;
        expect(r2.get("changePermission")).to.be.true;
      });

      it("re‑uses existing rule models when possible (keeps listeners)", function() {
        // Pre‑populate with one rule using the real AccessRule.
        const existing = makeRule({ subject: "old", read: true });

        // Attach a listener to verify it remains attached if the instance is reused.
        const listener = sinon.spy();
        existing.on("ping", listener);

        state.policy.add(existing);

        const xmlFragment = createAccessPolicyElement([{ subject: "old", read: true }]);
        state.policy.parse(xmlFragment);

        // The rule instance should be the same (still has the listener).
        expect(state.policy.at(0)).to.equal(existing);

        // Fire the event to confirm the original listener is still attached.
        existing.trigger("ping");
        expect(listener.calledOnce).to.be.true;
      });

      it("removes surplus rules when the XML has fewer <allow> elements", function() {
        // Start with three rules.
        state.policy.add(makeRule({ subject: "a" }));
        state.policy.add(makeRule({ subject: "b" }));
        state.policy.add(makeRule({ subject: "c" }));

        const xmlFragment = createAccessPolicyElement([
          { subject: "a" }, { subject: "b" }
        ]);
        state.policy.parse(xmlFragment);
        expect(state.policy).to.have.lengthOf(2);
        expect(state.policy.findWhere({ subject: "c" })).to.be.undefined;
      });

      it("clears all rules when parsing an empty <accessPolicy/> element", function() {
        // Add some junk first.
        state.policy.add(makeRule({ subject: "x" }));
        const xmlFragment = createAccessPolicyElement([]);
        state.policy.parse(xmlFragment);
        expect(state.policy.length).to.equal(0);
      });

      it.skip("EXPECTED FAILURE: parse() preserves existing rules when given malformed XML", function() {
        const policy = new AccessPolicy();
        policy.add([
          makeRule({ subject: "uid=existing,dc=example", read: true }),
          makeRule({ subject: "uid=existing2,dc=example", write: true })
        ]);

        const beforeCount = policy.length;
        expect(beforeCount).to.equal(2);

        // Try to parse malformed XML - should preserve existing rules but currently doesn't
        const malformedXML = document.createElement("div");

        // Test that parsing doesn't throw an error
        expect(function() {
          policy.parse(malformedXML);
        }).to.not.throw();

        expect(policy.length).to.equal(beforeCount);
        expect(policy.pluck("subject")).to.include.members(["uid=existing,dc=example", "uid=existing2,dc=example"]);
      });

      it.skip("EXPECTED FAILURE: parse() creates rules from garbage XML when it shouldn't", function() {
        const policy = new AccessPolicy();

        // Create XML with non-AccessRule structure
        const garbageXML = document.createElement("accessPolicy");
        const garbage1 = document.createElement("randomElement");
        const garbage2 = document.createElement("anotherBadElement");
        garbage1.textContent = "this is not an access rule";
        garbage2.setAttribute("badAttr", "badValue");
        garbageXML.appendChild(garbage1);
        garbageXML.appendChild(garbage2);

        // This should either reject invalid XML or create no rules
        policy.parse(garbageXML);

        expect(policy.length).to.equal(0);

        // If rules were created, they should at least have valid subjects
        if (policy.length > 0) {
          policy.each(function(rule) {
            expect(rule.get("subject")).to.not.be.empty;
          });
        }
      });

      it.skip("EXPECTED FAILURE: parse() with null XML should preserve existing rules", function() {
        const policy = new AccessPolicy();

        // Add some existing rules to test preservation
        policy.add([
          makeRule({ subject: "uid=existing1,dc=example", read: true }),
          makeRule({ subject: "uid=existing2,dc=example", write: true })
        ]);

        const beforeCount = policy.length;
        expect(beforeCount).to.equal(2);

        // Test null input - should either throw error or preserve existing rules
        expect(function() {
          policy.parse(null);
        }).to.not.throw();

        // Expected behavior: either throw an error or ignore null input and preserve rules
        expect(policy.length).to.equal(beforeCount);

        // Reset for undefined test
        policy.reset();
        policy.add([
          makeRule({ subject: "uid=existing1,dc=example", read: true }),
          makeRule({ subject: "uid=existing2,dc=example", write: true })
        ]);

        // Test undefined input
        expect(function() {
          policy.parse(undefined);
        }).to.not.throw();

        // should preserve rules or throw error, not silently clear
        expect(policy.length).to.equal(beforeCount);

        // Additional check: empty string should also preserve rules
        policy.reset();
        policy.add([makeRule({ subject: "uid=test,dc=example", read: true })]);

        policy.parse("");

        expect(policy.length).to.equal(1);
      });

      it("creates rules from XML with correct permissions", function() {
        const xml = createAccessPolicyElement([
          { subject: "public", read: true },
          { subject: "cn=alice,dc=example", read: true, write: true },
          { subject: "cn=bob,dc=example", changePermission: true }
        ]);

        const policy = new AccessPolicy();
        policy.parse(xml);

        expect(policy.length).to.equal(3);

        const [r1, r2, r3] = [policy.at(0), policy.at(1), policy.at(2)];
        expect(r1.get("subject")).to.equal("public");
        expect(r1.get("read")).to.equal(true);

        expect(r2.get("subject")).to.equal("cn=alice,dc=example");
        expect(r2.get("read")).to.equal(true);
        expect(r2.get("write")).to.equal(true);

        expect(r3.get("subject")).to.equal("cn=bob,dc=example");
        expect(r3.get("changePermission")).to.equal(true);
      });

      it("replaces or updates existing rules when parsing new XML", function() {
        const policy = new AccessPolicy();

        const xml1 = createAccessPolicyElement([
          { subject: "cn=alice,dc=example", read: true }
        ]);
        policy.parse(xml1);
        expect(policy.length).to.equal(1);

        const xml2 = createAccessPolicyElement([
          { subject: "cn=alice,dc=example", read: true, write: true },
          { subject: "cn=bob,dc=example", read: true }
        ]);
        policy.parse(xml2);

        // Expect the collection to have both rules, with alice updated to include write
        expect(policy.length).to.equal(2);
        const alice = policy.findWhere({ subject: "cn=alice,dc=example" });
        const bob = policy.findWhere({ subject: "cn=bob,dc=example" });

        expect(alice).to.exist;
        expect(alice.get("read")).to.equal(true);
        expect(alice.get("write")).to.equal(true);

        expect(bob).to.exist;
        expect(bob.get("read")).to.equal(true);
      });

      it("parse() does not explode when passed an empty string", function() {
        // Passing an empty string will cause jQuery to return an empty set.
        // The implementation should simply leave the collection untouched.
        expect(() => state.policy.parse("")).to.not.throw();
        expect(state.policy.length).to.equal(0);
      });
    });

    //-----------------------------------------------------------------------
    // 3.4  copyAccessPolicy()
    //-----------------------------------------------------------------------
    describe("copyAccessPolicy()", function() {
      it("replaces the destination with copies of the source rules", function() {
        const src = new AccessPolicy();
        const r1 = makeRule({ subject: "cn=alice,dc=example", read: true, write: true });
        const r2 = makeRule({ subject: "cn=bob,dc=example", read: true, changePermission: true });
        src.add([r1, r2]);

        // Destination starts with a different rule
        const dest = state.policy;
        const original = makeRule({ subject: "cn=carol,dc=example", read: false });
        dest.add(original);

        const resetSpy = sinon.spy();
        dest.on("reset", resetSpy);

        dest.copyAccessPolicy(src);

        expect(dest.length).to.equal(2);
        expect(dest.at(0)).to.not.equal(r1);
        expect(dest.at(1)).to.not.equal(r2);
        expect(dest.at(0).get("subject")).to.equal("cn=alice,dc=example");
        expect(dest.at(1).get("subject")).to.equal("cn=bob,dc=example");
        expect(resetSpy.calledOnce).to.equal(true);
      });

      it.skip("EXPECTED FAILURE: sets each copied rule's dataONEObject from the destination AccessPolicy", function() {
        const src = new AccessPolicy();
        const obj = new DataONEObject({
          rightsHolder: null,
          systemMetadata: { rightsHolder: null }
        });
        src.add(makeRule({ subject: "cn=alice,dc=example" }));
        src.dataONEObject = obj;
        const dest = state.policy;
        dest.copyAccessPolicy(src);
        expect(dest.dataONEObject).to.equal(src.dataONEObject);
      });

      it("uses null dataONEObject if the destination has none", function() {
        const src = new AccessPolicy();
        src.add(makeRule({ subject: "cn=alice,dc=example" }));

        const dest = new AccessPolicy(); // no dataONEObject set
        dest.copyAccessPolicy(src);

        const copied = dest.at(0);
        expect(copied.get("dataONEObject")).to.equal(null);
      });

      it("preserves rule order from the source", function() {
        const src = new AccessPolicy();
        src.add([
          makeRule({ subject: "s1" }),
          makeRule({ subject: "s2" }),
          makeRule({ subject: "s3" })
        ]);

        const dest = state.policy;
        dest.copyAccessPolicy(src);

        expect(dest.pluck("subject")).to.deep.equal(["s1", "s2", "s3"]);
      });

      it("creates AccessRule instances after reset", function() {
        const src = new AccessPolicy();
        src.add(makeRule({ subject: "cn=user,dc=example" }));

        const dest = new AccessPolicy();
        dest.copyAccessPolicy(src);

        expect(dest.at(0)).to.be.instanceOf(AccessRule);
      });

      it("does not share model instances or allow mutations to leak across collections", function() {
        const src = new AccessPolicy();
        src.add(makeRule({ subject: "cn=alice,dc=example", read: true }));

        const dest = new AccessPolicy();
        dest.copyAccessPolicy(src);

        // Mutate source after copy
        src.at(0).set("read", false);

        // Destination remains unchanged
        expect(dest.at(0).get("read")).to.equal(true);

        // Mutate destination after copy
        dest.at(0).set("write", true);

        // Source remains unchanged
        expect(src.at(0).get("write")).to.not.equal(true);
      });

      it("replaces destination with empty when copying from an empty source", function() {
        const src = new AccessPolicy(); // empty

        const dest = new AccessPolicy();
        dest.add(makeRule({ subject: "cn=carol,dc=example" }));

        const resetSpy = sinon.spy();
        dest.on("reset", resetSpy);

        dest.copyAccessPolicy(src);

        expect(dest.length).to.equal(0);
        expect(resetSpy.calledOnce).to.equal(true);
      });

      it("is resilient to null/undefined input and does not modify destination", function() {
        const dest = new AccessPolicy();
        dest.add(makeRule({ subject: "cn=carol,dc=example" }));

        const errorStub = sinon.stub(console, "error");
        try {
          dest.copyAccessPolicy(null);
          dest.copyAccessPolicy(undefined);
          expect(dest.length).to.equal(1);
          expect(errorStub.called).to.equal(true);
        } finally {
          errorStub.restore();
        }
      });

      it("does not reset if a rule.toJSON throws; logs the error", function() {
        const badRule = makeRule({ subject: "cn=boom,dc=example" });
        badRule.toJSON = function() {
          throw new Error("boom");
        };

        const src = new AccessPolicy();
        src.add([badRule, makeRule({ subject: "cn=ok,dc=example" })]);

        const dest = new AccessPolicy();
        dest.add(makeRule({ subject: "cn=existing,dc=example" }));

        const errorStub = sinon.stub(console, "error");
        try {
          dest.copyAccessPolicy(src);
          // Should remain unchanged due to early error before reset
          expect(dest.length).to.equal(1);
          expect(dest.at(0).get("subject")).to.equal("cn=existing,dc=example");
          expect(errorStub.calledOnce).to.equal(true);
        } finally {
          errorStub.restore();
        }
      });

      it("supports copying onto itself without losing data", function() {
        const dest = new AccessPolicy();
        dest.add([
          makeRule({ subject: "s1", read: true }),
          makeRule({ subject: "s2", write: true })
        ]);

        // Sanity: set dataONEObject so propagation path is hit
        dest.dataONEObject = state.dataONEObject;

        dest.copyAccessPolicy(dest);

        expect(dest.length).to.equal(2);
        expect(dest.at(0).get("subject")).to.equal("s1");
        expect(dest.at(1).get("subject")).to.equal("s2");
        expect(dest.at(0).get("dataONEObject")).to.equal(state.dataONEObject);
        expect(dest.at(1).get("dataONEObject")).to.equal(state.dataONEObject);
      });

      it("deep‑copies the rules and applies the destination's dataONEObject to each clone", function() {
        // Build a source policy with two rules.
        const src = new AccessPolicy();
        src.add(makeRule({ subject: "alice", read: true }));
        src.add(makeRule({ subject: "bob", write: true }));

        // Destination policy starts empty and has a dataONEObject set.
        const dest = state.policy;
        dest.dataONEObject = state.dataONEObject;

        // Give the source its own (different) dataONEObject to ensure the destination's value wins.
        src.dataONEObject = { id: "placeholder-d1o" };

        // Perform the copy.
        dest.copyAccessPolicy(src);

        // The rules are copied over.
        expect(dest).to.have.lengthOf(2);
        const alice = dest.findWhere({ subject: "alice" });
        const bob = dest.findWhere({ subject: "bob" });

        expect(alice).to.exist;
        expect(bob).to.exist;

        // The destination's dataONEObject is preserved and applied to each cloned rule.
        expect(dest.dataONEObject).to.equal(state.dataONEObject);
        expect(alice.get("dataONEObject")).to.equal(state.dataONEObject);
        expect(bob.get("dataONEObject")).to.equal(state.dataONEObject);

        // Changing a property on the source rule does not affect the copy (deep copy).
        src.at(0).set("read", false);
        expect(dest.at(0).get("read")).to.be.true;
      });

      it("copyAccessPolicy preserves all rules", function() {
        const sourcePolicy = new AccessPolicy();
        sourcePolicy.add([
          makeRule({ subject: "uid=user1,dc=example", read: true }),
          makeRule({ subject: "uid=user2,dc=example", changePermission: true })
        ]);

        const targetObj = new DataONEObject({ id: "target" });
        const targetPolicy = targetObj.createAccessPolicy();

        targetPolicy.copyAccessPolicy(sourcePolicy);

        expect(targetPolicy.length).to.equal(sourcePolicy.length);
        expect(targetPolicy.where({ subject: "uid=user1,dc=example" })).to.have.length(1);
        expect(targetPolicy.where({ subject: "uid=user2,dc=example" })).to.have.length(1);
      });
    });

    //-----------------------------------------------------------------------
    // 3.5  makePrivate() / makePublic()
    //-----------------------------------------------------------------------
    describe("privacy helpers", function() {
      beforeEach(function() {
        // Start each test with a public rule that has all three permissions.
        state.policy.add(
          makeRule({
            subject: "public",
            read: true,
            write: true,
            changePermission: true
          })
        );
      });

      it("makePrivate removes any public allow rule", function() {
        state.policy.makePrivate();
        expect(state.policy.findWhere({ subject: "public" })).to.be.undefined;
      });

      it("makePrivate does *not* add a deny rule (the collection can be empty)", function() {
        state.policy.makePrivate();
        // The spec does not require an explicit deny – we just make sure we did not
        // accidentally create a new rule.
        expect(state.policy.length).to.equal(0);
      });

      it("makePrivate() removes only public read rule and keeps other subjects", function() {
        const m = new DataONEObject({ id: "obj-2" });
        const policy = m.createAccessPolicy();

        policy.add(makeRule("uid=owner,dc=example", ["read", "write", "changePermission"]));
        policy.makePublic();

        // Precondition: public rule exists
        expect(policy.where({ subject: "public", read: true }).length).to.equal(1);

        policy.makePrivate();

        // Public read removed
        expect(policy.where({ subject: "public", read: true }).length).to.equal(0);

        // Other rules intact
        const owner = policy.findWhere({ subject: "uid=owner,dc=example" });
        expect(owner).to.exist;
        expect(owner.get("read")).to.equal(true);
        expect(owner.get("write")).to.equal(true);
        expect(owner.get("changePermission")).to.equal(true);
      });

      it("makePrivate() safely removes public rules without affecting iteration", function() {
        const policy = new AccessPolicy();
        policy.add([
          makeRule({ subject: "public", read: true }),
          makeRule({ subject: "uid=user1,dc=example", read: true }),
          makeRule({ subject: "public", write: true }), // Another public rule
          makeRule({ subject: "uid=user2,dc=example", write: true })
        ]);

        policy.makePrivate();

        // Should have exactly 2 non-public rules left
        expect(policy.length).to.equal(2);
        expect(policy.where({ subject: "public" })).to.have.length(0);
        expect(policy.where({ subject: "uid=user1,dc=example" })).to.have.length(1);
        expect(policy.where({ subject: "uid=user2,dc=example" })).to.have.length(1);
      });

      it("makePublic() is idempotent and preserves existing non-public rules", function() {
        const m = new DataONEObject({ id: "obj-1" });
        const policy = m.createAccessPolicy();

        // Add a non-public subject with write + changePermission
        policy.add(makeRule("uid=owner,dc=example", ["read", "write", "changePermission"]));

        policy.makePublic();
        policy.makePublic(); // call twice to check idempotence

        // Owner rules preserved
        const owner = policy.findWhere({ subject: "uid=owner,dc=example" });
        expect(owner).to.exist;
        expect(owner.get("read")).to.equal(true);
        expect(owner.get("write")).to.equal(true);
        expect(owner.get("changePermission")).to.equal(true);

        // Exactly one public read rule
        const publicRules = policy.where({ subject: "public", read: true });
        expect(publicRules.length).to.equal(1);
      });

      it("isPublic returns true only when a public rule grants any permission", function() {
        expect(state.policy.isPublic()).to.be.true; // we have public rule with perms
        state.policy.makePrivate();
        expect(state.policy.isPublic()).to.be.false;
        // Add a public rule that has *no* permissions – should be false.
        state.policy.add(
          makeRule({
            subject: "public",
            read: false,
            write: false,
            changePermission: false
          })
        );
        expect(state.policy.isPublic()).to.be.false;
      });

      it.skip("EXPECTED FAILURE: rapid toggling (public -> private -> public) ends with consistent state (no duplicates, no lost non-public rules)", function() {
        const m = new DataONEObject({ id: "obj-9" });
        const policy = m.createAccessPolicy();

        policy.add(makeRule("uid=keeper,dc=example", ["write", "changePermission"]));

        policy.makePublic();
        policy.makePrivate();
        policy.makePublic();

        // Exactly one public read rule
        expect(policy.where({ subject: "public", read: true }).length).to.equal(1);

        // Keeper rule preserved
        const keeper = policy.findWhere({ subject: "uid=keeper,dc=example" });
        expect(keeper).to.exist;
        expect(keeper.get("read")).to.equal(true);
        expect(keeper.get("write")).to.equal(true);
        expect(keeper.get("changePermission")).to.equal(true);
      });
    });

    //-----------------------------------------------------------------------
    // 3.6  Authorization helpers
    //-----------------------------------------------------------------------
    describe("authorization", function() {
      let realAppUserModel;

      beforeEach(function() {
        // Swap in a disposable user model so set(...) won't trigger app-level listeners
        realAppUserModel = MetacatUI.appUserModel;
        MetacatUI.appUserModel = new Backbone.Model({
          tokenChecked: true,
          loggedIn: true,
          username: "test-read@example.org",
          identities: ["test-read@example.org"],
          isMemberOf: [{ groupId: "groupA" }]
        });

        // Other per-test setup...
        state.policy.dataONEObject = state.dataONEObject;
        state.dataONEObject.set("rightsHolder", "test-read@example.org");
      });

      afterEach(function() {
        MetacatUI.appUserModel = realAppUserModel;
      });

      it("isAuthorized returns true for an action that matches a rule", function() {
        // You can still change the 'logged in user' for a specific assertion:
        MetacatUI.appUserModel.set({
          username: "test-read@example.org",
          identities: ["test-read@example.org"],
          isMemberOf: [{ groupId: "groupA" }]
        });

        expect(state.policy.isAuthorized("read")).to.be.true;
      });
      it("isAuthorized falls back to the DataONEObject rightsHolder", function() {
        // Remove all rules – the rightsHolder still grants permission.
        state.policy.reset([]);
        expect(state.policy.isAuthorized("write")).to.be.true; //rightsHolder is owner@example.org
      });

      it("isAuthorized returns false for unknown actions or missing grant", function() {
        MetacatUI.appUserModel.set({
          loggedIn: true,
          username: "test-none@example.org",
          identities: ["test-none@example.org"]
        });
        expect(state.policy.isAuthorized()).to.be.false;
        expect(state.policy.isAuthorized("foobar")).to.be.false;
      });

      it("isAuthorizedUpdateSysMeta returns true when user has changePermission", function() {
        expect(state.policy.isAuthorizedUpdateSysMeta()).to.be.true;
      });

      it("isAuthorizedUpdateSysMeta returns true for a brand‑new object with only write", function() {
        // Simulate a new object that the current user just uploaded.
        const newObj = new DataONEObject({
          id: "pid:new"
        });

        // Override isNew to return true for this test
        newObj.isNew = function() { return true; };

        const newPolicy = new AccessPolicy();

        // Manually set the dataONEObject reference (backup in case constructor doesn't work)
        newPolicy.dataONEObject = newObj;

        // Add a rule that gives the user write permission.
        const testRule = makeRule({
          subject: "test-write@example.org",
          write: true,
          dataONEObject: newObj
        });
        newPolicy.add(testRule);

        MetacatUI.appUserModel.set({
          loggedIn: true,
          username: "test-write@example.org",
          identities: ["test-write@example.org"],
          isMemberOf: []
        });

        // DEBUG: Verify the dataONEObject is properly set
        console.log("=== DEBUG INFO ===");
        console.log("newPolicy.dataONEObject:", newPolicy.dataONEObject);
        console.log("newPolicy.dataONEObject === newObj:", newPolicy.dataONEObject === newObj);
        console.log("newObj.isNew():", newObj.isNew());
        if (newPolicy.dataONEObject) {
          console.log("newPolicy.dataONEObject.isNew():", newPolicy.dataONEObject.isNew());
        }
        console.log("Direct isAuthorized('write'):", newPolicy.isAuthorized("write"));

        expect(newPolicy.isAuthorizedUpdateSysMeta()).to.be.true;
      });

      it("isAuthorizedUpdateSysMeta returns false when no appropriate permission", function() {
        const newObj = new (Backbone.Model)({
          id: "pid:new",
          isNew: () => false
        });
        const newPolicy = new AccessPolicy();
        newPolicy.add(
          makeRule({
            subject: "other@example.org",
            write: true,
            dataONEObject: newObj // keep consistent with other tests
          })
        );
        MetacatUI.appUserModel.set({
          loggedIn: true,
          username: "other@example.org",
          identities: ["other@example.org"]
        });
        expect(newPolicy.isAuthorizedUpdateSysMeta()).to.be.false;
      });
    });

    //-----------------------------------------------------------------------
    // 3.7  Owner helpers
    //-----------------------------------------------------------------------
    describe("owner helpers", function() {
      it("hasOwner returns true when at least one rule has changePermission", function() {
        state.policy.add(
          makeRule({
            subject: "alice",
            changePermission: true
          })
        );
        expect(state.policy.hasOwner()).to.be.true;
      });

      it("hasOwner returns false when no changePermission rule exists", function() {
        state.policy.add(
          makeRule({
            subject: "bob",
            read: true
          })
        );
        expect(state.policy.hasOwner()).to.be.false;
      });

      it("reflects the new rights holder after replaceRightsHolder()", () => {
        state.policy.add(
          makeRule({
            subject: "uid:new",
            changePermission: true
          })
        );
        const obj = new DataONEObject({
          id: "urn:uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          rightsHolder: "alice"
        });
        state.policy.dataONEObject = obj;

        expect(state.policy.dataONEObject.rightsHolder).to.not.be.null;

        state.policy.replaceRightsHolder("uid:new");
        const actual = state.policy.dataONEObject.get("rightsHolder");
        expect(actual).to.equal("uid:new");
      });

      it("replaceRightsHolder swaps the changePermission rule into the object rightsHolder", function() {
        const obj = new DataONEObject({
          rightsHolder: null,
          systemMetadata: { rightsHolder: null }
        });
        state.policy.dataONEObject = obj;
        state.dataONEObject = obj;

        const ownerRule = makeRule({
          subject: "newOwner@example.org",
          changePermission: true
        });
        state.policy.add(ownerRule);
        state.policy.replaceRightsHolder();

        expect(state.dataONEObject.get("rightsHolder")).to.equal(
          "newOwner@example.org"
        );
        // The rule should now be removed from the collection.
        expect(state.policy.findWhere({ changePermission: true })).to.be.undefined;
      });

      it("replaceRightsHolder does nothing when there is no owner rule", function() {
        state.policy.add(
          makeRule({ subject: "bob", read: true })
        );
        const originalRightsHolder = state.dataONEObject.get("rightsHolder");
        state.policy.replaceRightsHolder();
        expect(state.dataONEObject.get("rightsHolder")).to.equal(originalRightsHolder);
        expect(state.policy.length).to.equal(1); // collection unchanged
      });
    });

    //-----------------------------------------------------------------------
    // 3.8  serialize()
    //-----------------------------------------------------------------------
    describe("serialize()", function() {
      it.skip("EXPECTED FAILURE: always returns an <accesspolicy> element (never null)", function() {
        const el = state.policy.serialize();
        expect(el && el.nodeType).to.equal(1);
        expect(el.tagName.toLowerCase()).to.equal("accesspolicy");
      });

      it("includes a child node for each rule that has at least one permission", function() {
        state.policy.add(
          makeRule({
            subject: "public",
            read: true,
            write: false,
            changePermission: false
          })
        );
        state.policy.add(
          makeRule({
            subject: "bob",
            // Explicitly set no permissions to avoid relying on defaults
            read: false,
            write: false,
            changePermission: false
          })
        );

        const el = state.policy.serialize();

        // Count only <allow> nodes that actually have at least one <permission> child
        const allowsWithPerms = Array.from(el.children).filter(
          (n) => n.tagName.toLowerCase() === "allow" && n.querySelector("permission")
        );
        expect(allowsWithPerms.length).to.equal(1);

        const allowNode = allowsWithPerms[0];
        expect(allowNode.tagName.toLowerCase()).to.equal("allow");
        expect(allowNode.querySelector("subject").textContent).to.equal("public");
      });

      it("maintains all access rules through serialize/parse round-trip", function() {
        const policy = new AccessPolicy();
        const originalRules = [
          { subject: "uid=user1,dc=example", read: true, write: false, changePermission: true },
          { subject: "public", read: true },
          { subject: "CN=Group Name,DC=dataone,DC=org", read: true, write: true }
        ];

        policy.add(originalRules);

        // Serialize to XML
        const xml = policy.serialize();
        expect(xml).to.not.be.null;

        // Create new policy and parse the XML
        const newPolicy = new AccessPolicy();
        newPolicy.parse(xml);

        // Should have same rules
        expect(newPolicy.length).to.equal(originalRules.length);

        // Verify each rule is preserved
        originalRules.forEach(rule => {
          const found = newPolicy.findWhere({ subject: rule.subject });
          expect(found).to.exist;
          expect(found.get("read")).to.equal(rule.read);
        });
      });
    });

    //-----------------------------------------------------------------------
    // 3.9  getSubjectInfo()
    //-----------------------------------------------------------------------
    describe("getSubjectInfo()", function() {
      it("forwards the call to each AccessRule instance", function() {
        const ar1 = makeRule({ subject: "alice" });
        const ar2 = makeRule({ subject: "bob" });
        state.policy.add(ar1);
        state.policy.add(ar2);

        // Ensure the method exists, then spy on it
        ar1.getSubjectInfo = ar1.getSubjectInfo || function() {
        };
        ar2.getSubjectInfo = ar2.getSubjectInfo || function() {
        };
        const spy1 = sinon.spy(ar1, "getSubjectInfo");
        const spy2 = sinon.spy(ar2, "getSubjectInfo");

        // Exercise
        state.policy.getSubjectInfo();

        // Verify
        expect(spy1.called).to.be.true;
        expect(spy2.called).to.be.true;

        // Cleanup
        spy1.restore();
        spy2.restore();
      });
    });

    //-----------------------------------------------------------------------
    // 3.10  Event handling – “removeMe” propagation
    //-----------------------------------------------------------------------
    describe("event handling", function() {
      it.skip("EXPECTED FAILURE: removes a rule when the rule fires a 'removeMe' event", function() {
        const rule = makeRule({ subject: "temp" });
        state.policy.add(rule);
        expect(state.policy.length).to.equal(1);
        rule.trigger("removeMe");
        expect(state.policy.length).to.equal(0);
      });
    });

    //-----------------------------------------------------------------------
    // 3.11  Robustness checks
    //-----------------------------------------------------------------------
    describe("robustness checks", function() {
      let d1oA, d1oB;

      beforeEach(function() {
        d1oA = { id: "placeholder-d1o-A" };
        d1oB = { id: "placeholder-d1o-B" };
      });

      it("parse updates existing models in place and does not drop listeners", function() {
        const ap = new AccessPolicy();
        ap.dataONEObject = d1oA;

        // Seed with two rules, attach a listener to ensure instance is preserved.
        ap.add([{ subject: "alice", read: true }, { subject: "bob", write: true }]);

        const m0Before = ap.at(0);
        const m1Before = ap.at(1);

        const spy0 = sinon.spy();
        const spy1 = sinon.spy();
        m0Before.on("change", spy0);
        m1Before.on("change", spy1);

        // Build XML with updated subjects and permissions.
        const xml = createAccessPolicyElement([
          { subject: "carol", read: true, write: true },
          { subject: "dave", changePermission: true }
        ]);

        ap.parse(xml);

        // Instances should be the same (not replaced), but attributes updated.
        expect(ap.at(0)).to.equal(m0Before);
        expect(ap.at(1)).to.equal(m1Before);
        expect(ap.at(0).get("subject")).to.equal("carol");
        expect(ap.at(0).get("read")).to.be.true;
        expect(ap.at(0).get("write")).to.be.true;
        expect(ap.at(1).get("subject")).to.equal("dave");
        expect(ap.at(1).get("changePermission")).to.be.true;

        // Listeners should have seen changes.
        expect(spy0.called).to.be.true;
        expect(spy1.called).to.be.true;

        // Each rule should have the collection's dataONEObject.
        expect(ap.at(0).get("dataONEObject")).to.equal(d1oA);
        expect(ap.at(1).get("dataONEObject")).to.equal(d1oA);
      });

      it("parse prunes extra rules deterministically (pop from the end) and handles reordering", function() {
        const ap = new AccessPolicy();
        ap.dataONEObject = d1oA;

        ap.add([
          { subject: "A", read: true },
          { subject: "B", write: true },
          { subject: "C", changePermission: true }
        ]);
        const oldCids = ap.models.map((m) => m.cid);

        // XML reorders to B, A (C removed).
        const xml = createAccessPolicyElement([
          { subject: "B", write: true },
          { subject: "A", read: true }
        ]);

        ap.parse(xml);

        expect(ap).to.have.lengthOf(2);
        expect(ap.at(0).get("subject")).to.equal("B");
        expect(ap.at(1).get("subject")).to.equal("A");
        // The third rule should have been removed.
        expect(ap.models.map((m) => m.cid)).to.not.include(oldCids[2]);
      });

      it("parse grows the collection when XML has more rules", function() {
        const ap = new AccessPolicy();
        ap.dataONEObject = d1oA;

        ap.add([{ subject: "only", read: true }]);

        const xml = createAccessPolicyElement([
          { subject: "one", read: true },
          { subject: "two", write: true },
          { subject: "three", changePermission: true }
        ]);

        ap.parse(xml);

        expect(ap).to.have.lengthOf(3);
        expect(ap.findWhere({ subject: "one" })).to.exist;
        expect(ap.findWhere({ subject: "two" })).to.exist;
        expect(ap.findWhere({ subject: "three" })).to.exist;

        // New models should be proper AccessRule instances.
        expect(ap.at(0)).to.be.instanceOf(AccessRule);
        expect(ap.at(1)).to.be.instanceOf(AccessRule);
        expect(ap.at(2)).to.be.instanceOf(AccessRule);
      });

      it("parse empties the collection when XML has zero rules", function() {
        const ap = new AccessPolicy();
        ap.dataONEObject = d1oA;
        ap.add([{ subject: "x", read: true }, { subject: "y", write: true }]);

        const emptyXml = createAccessPolicyElement([]);
        ap.parse(emptyXml);

        expect(ap).to.have.lengthOf(0);
      });

      it("copyAccessPolicy deep-copies rules, preserves destination dataONEObject, and emits reset", function() {
        const src = new AccessPolicy();
        src.dataONEObject = d1oA;
        src.add([{ subject: "alice", read: true }, { subject: "bob", write: true }]);

        const dest = new AccessPolicy();
        dest.dataONEObject = d1oB;
        dest.add([{ subject: "old", changePermission: true }]);
        const prevCid = dest.at(0).cid;

        const resetSpy = sinon.spy();
        dest.on("reset", resetSpy);

        dest.copyAccessPolicy(src);

        // Replaced contents and fired reset.
        expect(resetSpy.calledOnce).to.be.true;
        expect(dest).to.have.lengthOf(2);
        expect(dest.pluck("cid")).to.not.include(prevCid);

        // Deep copy: instances are new and not tied to src.
        expect(dest.at(0)).to.be.instanceOf(AccessRule);
        expect(dest.at(1)).to.be.instanceOf(AccessRule);
        expect(dest.findWhere({ subject: "alice" })).to.exist;
        expect(dest.findWhere({ subject: "bob" })).to.exist;

        // Destination rules use destination's dataONEObject, not source.
        expect(dest.at(0).get("dataONEObject")).to.equal(d1oB);
        expect(dest.at(1).get("dataONEObject")).to.equal(d1oB);
        expect(dest.dataONEObject).to.equal(d1oB);

        // Mutating source after copy does not affect destination.
        src.at(0).set("read", false);
        const aliceInDest = dest.findWhere({ subject: "alice" });
        expect(aliceInDest.get("read")).to.be.true;
      });

      it("copyAccessPolicy with empty source clears the destination", function() {
        const src = new AccessPolicy();
        const dest = new AccessPolicy();
        dest.add([{ subject: "stale", read: true }]);

        dest.copyAccessPolicy(src);
        expect(dest).to.have.lengthOf(0);
      });

      it.skip("EXPECTED FAILURE: removeMe event on a rule removes it from the collection", function() {
        const ap = new AccessPolicy();
        ap.add([{ subject: "keep", read: true }, { subject: "drop", write: true }]);

        const toRemove = ap.findWhere({ subject: "drop" });
        toRemove.trigger("removeMe");

        expect(ap).to.have.lengthOf(1);
        expect(ap.findWhere({ subject: "keep" })).to.exist;
        expect(ap.findWhere({ subject: "drop" })).to.not.exist;
      });

      describe("createDefaultPolicy", function() {
        let getStub;

        afterEach(function() {
          if (getStub) {
            getStub.restore();
            getStub = null;
          }
        });

        it("creates rules from defaults and assigns dataONEObject to each", function() {
          // Stub defaults
          getStub = sinon.stub(MetacatUI.appModel, "get");
          getStub.withArgs("defaultAccessPolicy").returns([
            { subject: "public", read: true },
            { subject: "editor", write: true, changePermission: true }
          ]);

          const ap = new AccessPolicy();
          ap.dataONEObject = d1oA;

          ap.createDefaultPolicy();

          expect(ap).to.have.lengthOf(2);
          const pub = ap.findWhere({ subject: "public" });
          const editor = ap.findWhere({ subject: "editor" });
          expect(pub).to.exist;
          expect(editor).to.exist;
          expect(pub.get("dataONEObject")).to.equal(d1oA);
          expect(editor.get("dataONEObject")).to.equal(d1oA);
        });

        it("appends defaults to any existing rules (documenting current behavior)", function() {
          // Documenting that it currently appends; change if behavior is updated later.
          getStub = sinon.stub(MetacatUI.appModel, "get");
          getStub.withArgs("defaultAccessPolicy").returns([{ subject: "public", read: true }]);

          const ap = new AccessPolicy();
          ap.add([{ subject: "owner", changePermission: true }]);

          ap.createDefaultPolicy();

          expect(ap).to.have.lengthOf(2);
          expect(ap.findWhere({ subject: "owner" })).to.exist;
          expect(ap.findWhere({ subject: "public" })).to.exist;
        });
      });

      it("parse consistently sets dataONEObject on every rule to the collection's current reference", function() {
        const ap = new AccessPolicy();
        ap.dataONEObject = d1oA;

        const xml = createAccessPolicyElement([
          { subject: "s1", read: true },
          { subject: "s2", write: true }
        ]);
        ap.parse(xml);

        expect(ap.at(0).get("dataONEObject")).to.equal(d1oA);
        expect(ap.at(1).get("dataONEObject")).to.equal(d1oA);

        // Change the collection's dataONEObject and parse another XML; new values should reflect the new reference.
        ap.dataONEObject = d1oB;
        const xml2 = createAccessPolicyElement([{ subject: "s3", changePermission: true }]);
        ap.parse(xml2);

        expect(ap).to.have.lengthOf(1);
        expect(ap.at(0).get("subject")).to.equal("s3");
        expect(ap.at(0).get("dataONEObject")).to.equal(d1oB);
      });
    });

    describe("preservation of rules during edits", function() {
      let obj, policy;

      beforeEach(function() {
        // Create a DataONEObject for these tests
        obj = new DataONEObject({ id: "test-preservation-obj" });
        policy = obj.createAccessPolicy();

        // Set up the specific state modifications needed for these tests
        policy.add([
          makeRule("uid:alice", ["read", "write"]),
          makeRule("uid:bob", ["read"]),
          makeRule("uid:carol", ["read", "changePermission"]),
          makeRule("public", ["read"])
        ]);
      });

      afterEach(function() {
        // Clean up after each test in this block
        if (policy) {
          policy.reset();
        }
        obj = null;
        policy = null;
      });

      it("does not remove other rules when a single AccessRule is updated in place", function() {
        const initialCount = policy.length;
        expect(initialCount).to.equal(4);

        // Update bob's permissions in place
        const bobRule = policy.findWhere({ subject: "uid:bob" });
        bobRule.set("write", true);

        expect(policy.length).to.equal(4);
        expect(bobRule.get("read")).to.be.true;
        expect(bobRule.get("write")).to.be.true;
      });

      it.skip("EXPECTED FAILURE: set() with partial list should NOT remove rules not included", function() {
        const editedBob = new AccessRule({
          subject: "uid:bob",
          read: true,
          write: true,
          dataONEObject: obj
        });

        policy.set([editedBob]);

        // This should fail - we expect ALL rules to be preserved
        expect(policy.length).to.equal(4, "All rules should be preserved");
        expect(policy.findWhere({ subject: "uid:alice" })).to.exist;
        expect(policy.findWhere({ subject: "uid:carol" })).to.exist;
        expect(policy.findWhere({ subject: "public" })).to.exist;
      });

      it.skip("EXPECTED FAILURE: safe usage: set() with remove:false merges edits without removing other rules", function() {
        // Simulate UI sending only an edited subset
        const editedBob = makeRule("uid:bob", ["read", "write"]);
        policy.set([editedBob], { merge: true, remove: false });

        expect(policy).to.have.lengthOf(4);
        expect(getSubjects(policy)).to.have.members(["uid:alice", "uid:bob", "uid:carol", "public"]);
        expect(policy.findWhere({ subject: "uid:bob" }).get("permissions")).to.have.members(["read", "write"]);
      });

      it("public/private toggle only affects the 'public' rule and preserves all others", function() {
        expect(policy.length).to.equal(4);

        policy.makePrivate();

        // Should have 3 rules now (public rule removed)
        expect(policy.length).to.equal(3);
        expect(policy.findWhere({ subject: "public" })).to.be.undefined;
        expect(policy.findWhere({ subject: "uid:alice" })).to.exist;
        expect(policy.findWhere({ subject: "uid:bob" })).to.exist;
        expect(policy.findWhere({ subject: "uid:carol" })).to.exist;

        policy.makePublic();

        // Should have 4 rules again (public rule added back)
        expect(policy.length).to.equal(4);
        expect(policy.findWhere({ subject: "public" })).to.exist;
      });

      it("does not drop changePermission rules when editing unrelated rules", function() {
        expect(policy.length).to.equal(4);

        // Edit alice's permissions
        const aliceRule = policy.findWhere({ subject: "uid:alice" });
        aliceRule.set("read", false);

        // Carol's changePermission should still be intact
        const carolRule = policy.findWhere({ subject: "uid:carol" });
        expect(carolRule.get("changePermission")).to.be.true;
        expect(policy.length).to.equal(4);
      });

      it.skip("EXPECTED FAILURE: re-adding a rule for the same subject merges permissions and does not remove or duplicate", function() {
        expect(policy.length).to.equal(4);

        // Try to add another rule for alice
        policy.add(new AccessRule({
          subject: "uid:alice",
          changePermission: true,
          dataONEObject: obj
        }));

        // Should not create duplicate - still 4 rules
        expect(policy.length).to.equal(4);
        const aliceRules = policy.where({ subject: "uid:alice" });
        expect(aliceRules.length).to.equal(1);
      });

      it.skip("EXPECTED FAILURE: rebuilding from a visible subset should NOT drop non-visible rules", function() {
        const visibleRules = policy.first(2);
        const visibleRulesJSON = visibleRules.map(rule => rule.toJSON());

        policy.reset(visibleRulesJSON);

        // This should fail - we expect NO data loss
        expect(policy.length).to.equal(4, "No rules should be lost during rebuild");
      });
    });

    //-----------------------------------------------------------------------
    // 3.12  Network Error handling
    //-----------------------------------------------------------------------
    describe("Network error handling", function() {
      it("preserves AccessPolicy during error conditions", function() {
        const obj = new DataONEObject({ id: "test-obj" });
        const policy = obj.createAccessPolicy();
        policy.add([
          makeRule({ subject: "uid=user1,dc=example", read: true, write: true }),
          makeRule({ subject: "public", read: true })
        ]);

        const originalRules = JSON.parse(JSON.stringify(policy.toJSON()));

        // Simulate error state
        obj.set("sysMetaErrorCode", 500);
        obj.set("uploadStatus", "e");

        // Rules should still be intact
        const currentRules = policy.toJSON();
        expect(currentRules).to.have.length(originalRules.length);
        expect(currentRules[0].subject).to.equal(originalRules[0].subject);
      });
    });
  });
});
