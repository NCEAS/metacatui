define(["models/sysmeta/AccessRule"], (AccessRule) => {
  const expect = chai.expect;

  const parseElement = (xml) =>
    new DOMParser().parseFromString(xml, "application/xml").documentElement;

  const createDoc = () =>
    new DOMParser().parseFromString("<root />", "application/xml");

  const summarizeIssues = (issues) =>
    issues.map(({ field, message }) => ({ field, message }));

  describe("AccessRule", () => {
    describe("construction", () => {
      it("normalizes subjects and deduplicates canonical permissions", () => {
        const rule = new AccessRule({
          subjects: [" public ", null, "userA"],
          permissions: [" READ ", "changepermission", "write", "READ"],
        });

        expect(rule.subjects).to.deep.equal(["public", "userA"]);
        expect(rule.permissions).to.deep.equal([
          "read",
          "changePermission",
          "write",
        ]);
      });
    });

    describe("fromElement()", () => {
      it("parses allow elements and exposes legacy permission getters", () => {
        const element = parseElement(`
          <allow>
            <subject>public</subject>
            <subject>CN=editors,DC=dataone,DC=org</subject>
            <permission>read</permission>
            <permission>changePermission</permission>
          </allow>
        `);

        const rule = AccessRule.fromElement(element);

        expect(rule.subject).to.equal("public");
        expect(rule.subjects).to.deep.equal([
          "public",
          "CN=editors,DC=dataone,DC=org",
        ]);
        expect(rule.permissions).to.deep.equal(["read", "changePermission"]);
        expect(rule.read).to.equal(true);
        expect(rule.write).to.equal(false);
        expect(rule.changePermission).to.equal(true);
      });

      it("rejects unexpected or out-of-order child elements", () => {
        expect(() =>
          AccessRule.fromElement(
            parseElement(`
              <allow>
                <permission>read</permission>
                <subject>public</subject>
              </allow>
            `),
          ),
        ).to.throw(/out of order/i);

        expect(() =>
          AccessRule.fromElement(
            parseElement(`
              <allow>
                <subject>public</subject>
                <role>editor</role>
                <permission>read</permission>
              </allow>
            `),
          ),
        ).to.throw(/unexpected <role>/i);
      });
    });

    describe("validate()", () => {
      it("reports missing subjects and permissions", () => {
        expect(summarizeIssues(new AccessRule().validate())).to.deep.equal([
          {
            field: "accessPolicy.subjects",
            message: "At least one subject is required.",
          },
          {
            field: "accessPolicy.permissions",
            message: "At least one permission is required.",
          },
        ]);
      });

      it("reports invalid subject and permission values with indexed paths", () => {
        const errors = new AccessRule({
          subjects: [""],
          permissions: ["bogus"],
        }).validate("accessPolicy[1]");

        expect(summarizeIssues(errors)).to.deep.equal([
          {
            field: "accessPolicy[1].subjects[0]",
            message: "Subjects must be non-empty strings.",
          },
          {
            field: "accessPolicy[1].permissions[0]",
            message: "Permissions must be one of: read, write, changePermission.",
          },
        ]);
      });
    });

    describe("toElement()", () => {
      it("returns null when the rule has no serializable values", () => {
        expect(new AccessRule().toElement(createDoc())).to.equal(null);
      });

      it("serializes subjects and permissions to allow XML", () => {
        const element = new AccessRule({
          subjects: ["public", "userA"],
          permissions: ["read", "write"],
        }).toElement(createDoc());

        const serialized = new XMLSerializer().serializeToString(element);

        expect(serialized).to.equal(
          "<allow><subject>public</subject><subject>userA</subject><permission>read</permission><permission>write</permission></allow>",
        );
      });
    });

    describe("toJSON()", () => {
      it("returns cloned plain data", () => {
        const rule = new AccessRule({
          subjects: ["public"],
          permissions: ["read"],
        });

        const json = rule.toJSON();
        json.subjects.push("userA");
        json.permissions.push("write");

        expect(rule.subjects).to.deep.equal(["public"]);
        expect(rule.permissions).to.deep.equal(["read"]);
      });
    });
  });
});
