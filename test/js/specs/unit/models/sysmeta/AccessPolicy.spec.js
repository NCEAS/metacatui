define(["models/sysmeta/AccessPolicy", "models/sysmeta/AccessRule"], (
  AccessPolicy,
  AccessRule,
) => {
  const expect = chai.expect;

  const parseElement = (xml) =>
    new DOMParser().parseFromString(xml, "application/xml").documentElement;

  const createDoc = () =>
    new DOMParser().parseFromString("<root />", "application/xml");

  const summarizeIssues = (issues) =>
    issues.map(({ field, message }) => ({ field, message }));

  describe("AccessPolicy", () => {
    describe("construction and mutation", () => {
      it("clones AccessRule instances and normalizes plain objects", () => {
        const sourceRule = new AccessRule({
          subjects: ["public"],
          permissions: ["read"],
        });

        const policy = new AccessPolicy([
          sourceRule,
          { subjects: ["userA"], permissions: ["write"] },
        ]);

        expect(policy).to.have.length(2);
        expect(policy[0]).to.be.instanceof(AccessRule);
        expect(policy[0]).to.not.equal(sourceRule);
        expect(policy[0].toJSON()).to.deep.equal(sourceRule.toJSON());
        expect(policy[1].toJSON()).to.deep.equal({
          subjects: ["userA"],
          permissions: ["write"],
        });
      });

      it("pushes normalized access rules", () => {
        const policy = new AccessPolicy();

        policy.push({ subjects: ["public"], permissions: ["read"] });

        expect(policy[0]).to.be.instanceof(AccessRule);
        expect(policy[0].permissions).to.deep.equal(["read"]);
      });

      it("supports add, replace, remove, and clear", () => {
        const policy = new AccessPolicy();

        policy
          .add({ subjects: ["public"], permissions: ["read"] })
          .add({ subjects: ["userA"], permissions: ["write"] })
          .replace(1, {
            subjects: ["userB"],
            permissions: ["changePermission"],
          })
          .remove(0);

        expect(policy).to.have.length(1);
        expect(policy[0].toJSON()).to.deep.equal({
          subjects: ["userB"],
          permissions: ["changePermission"],
        });

        policy.clear();
        expect(policy).to.have.length(0);
      });
    });

    describe("fromElement()", () => {
      it("parses allow children", () => {
        const element = parseElement(`
          <accessPolicy>
            <allow>
              <subject>public</subject>
              <permission>read</permission>
            </allow>
          </accessPolicy>
        `);

        const policy = AccessPolicy.fromElement(element);

        expect(policy).to.have.length(1);
        expect(policy[0].toJSON()).to.deep.equal({
          subjects: ["public"],
          permissions: ["read"],
        });
      });

      it("rejects non-allow child elements", () => {
        expect(() =>
          AccessPolicy.fromElement(
            parseElement(`
              <accessPolicy>
                <allow>
                  <subject>public</subject>
                  <permission>read</permission>
                </allow>
                <deny>
                  <subject>ignored</subject>
                </deny>
              </accessPolicy>
            `),
          ),
        ).to.throw(/unexpected <deny>/i);
      });
    });

    describe("fromValue()", () => {
      it("coerces single plain objects and clones existing policies", () => {
        const source = new AccessPolicy([
          { subjects: ["userA"], permissions: ["write"] },
        ]);

        const fromObject = AccessPolicy.fromValue({
          subjects: ["public"],
          permissions: ["read"],
        });
        const fromPolicy = AccessPolicy.fromValue(source);

        expect(fromObject).to.be.instanceof(AccessPolicy);
        expect(fromObject).to.have.length(1);
        expect(fromObject[0].toJSON()).to.deep.equal({
          subjects: ["public"],
          permissions: ["read"],
        });
        expect(fromPolicy).to.be.instanceof(AccessPolicy);
        expect(fromPolicy).to.not.equal(source);
        expect(fromPolicy.toJSON()).to.deep.equal(source.toJSON());
      });

      it("converts a legacy collections/AccessPolicy (Backbone collection)", () => {
        // Mimic the legacy collection: a Backbone-style collection whose
        // toJSON() yields per-subject boolean-permission rules.
        const legacyCollection = {
          models: [{}, {}],
          toJSON: () => [
            { subject: "public", read: true, write: false },
            {
              subject: "uid=editor",
              read: true,
              write: true,
              changePermission: true,
            },
          ],
        };

        const policy = AccessPolicy.fromValue(legacyCollection);

        expect(policy).to.be.instanceof(AccessPolicy);
        expect(policy.toJSON()).to.deep.equal([
          { subjects: ["public"], permissions: ["read"] },
          {
            subjects: ["uid=editor"],
            permissions: ["read", "write", "changePermission"],
          },
        ]);
      });
    });

    describe("validate()", () => {
      it("prefixes nested access rule errors with rule indexes", () => {
        const errors = new AccessPolicy([
          { subjects: [""], permissions: ["bogus"] },
        ]).validate();

        expect(summarizeIssues(errors)).to.deep.equal([
          {
            field: "accessPolicy[0].subjects[0]",
            message: "Subjects must be non-empty strings.",
          },
          {
            field: "accessPolicy[0].permissions[0]",
            message:
              "Permissions must be one of: read, write, changePermission.",
          },
        ]);
      });
    });

    describe("toElement()", () => {
      it("returns null when the policy is empty or contains only empty rules", () => {
        expect(new AccessPolicy().toElement(createDoc())).to.equal(null);
        expect(
          new AccessPolicy([new AccessRule()]).toElement(createDoc()),
        ).to.equal(null);
      });

      it("serializes populated rules to accessPolicy XML", () => {
        const element = new AccessPolicy([
          { subjects: ["public"], permissions: ["read"] },
          { subjects: ["userA"], permissions: ["write"] },
        ]).toElement(createDoc());

        const serialized = new XMLSerializer().serializeToString(element);

        expect(serialized).to.equal(
          "<accessPolicy><allow><subject>public</subject><permission>read</permission></allow><allow><subject>userA</subject><permission>write</permission></allow></accessPolicy>",
        );
      });
    });

    describe("toJSON()", () => {
      it("returns cloned nested rule data", () => {
        const policy = new AccessPolicy([
          { subjects: ["public"], permissions: ["read"] },
        ]);

        const json = policy.toJSON();
        json[0].subjects.push("userA");

        expect(policy[0].subjects).to.deep.equal(["public"]);
      });
    });

    describe("isAuthorized()", () => {
      it("checks the requested subject instead of defaulting to public", () => {
        const policy = new AccessPolicy([
          { subjects: ["public"], permissions: ["read"] },
          { subjects: ["uid=editor"], permissions: ["write"] },
        ]);

        expect(policy.isAuthorized("write", "uid=editor")).to.equal(true);
        expect(policy.isAuthorized("write", "public")).to.equal(false);
      });

      it("uses the DataONE permission hierarchy", () => {
        const policy = new AccessPolicy([
          { subjects: ["uid=manager"], permissions: ["changePermission"] },
        ]);

        expect(policy.isAuthorized("read", "uid=manager")).to.equal(true);
        expect(policy.isAuthorized("write", "uid=manager")).to.equal(true);
        expect(policy.isAuthorized("changePermission", "uid=manager")).to.equal(
          true,
        );
      });

      it("checks any subject in a provided subject list", () => {
        const policy = new AccessPolicy([
          {
            subjects: ["CN=editors,DC=dataone,DC=org"],
            permissions: ["write"],
          },
        ]);

        expect(
          policy.isAuthorized("write", [
            "uid=editor",
            "CN=editors,DC=dataone,DC=org",
          ]),
        ).to.equal(true);
      });
    });

    describe("isPublic()", () => {
      it("only treats public grants as public", () => {
        const privatePolicy = new AccessPolicy([
          { subjects: ["uid=editor"], permissions: ["read"] },
        ]);
        const publicPolicy = new AccessPolicy([
          { subjects: ["public"], permissions: ["read"] },
        ]);

        expect(privatePolicy.isPublic()).to.equal(false);
        expect(publicPolicy.isPublic()).to.equal(true);
      });
    });
  });
});
