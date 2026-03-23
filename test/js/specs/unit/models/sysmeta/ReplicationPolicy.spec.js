define(["models/sysmeta/ReplicationPolicy"], (ReplicationPolicy) => {
  const expect = chai.expect;

  const parseElement = (xml) =>
    new DOMParser().parseFromString(xml, "application/xml").documentElement;

  const createDoc = () =>
    new DOMParser().parseFromString("<root />", "application/xml");

  describe("ReplicationPolicy", () => {
    describe("construction", () => {
      it("normalizes booleans, integers, and node lists", () => {
        const policy = new ReplicationPolicy({
          replicationAllowed: "true",
          numberReplicas: "2",
          preferredNodes: [" urn:node:mnA ", null, "urn:node:mnB"],
          blockedNodes: " urn:node:mnZ ",
        });

        expect(policy.replicationAllowed).to.equal(true);
        expect(policy.numberReplicas).to.equal(2);
        expect(policy.preferredNodes).to.deep.equal([
          "urn:node:mnA",
          "urn:node:mnB",
        ]);
        expect(policy.blockedNodes).to.deep.equal(["urn:node:mnZ"]);
      });
    });

    describe("fromElement()", () => {
      it("parses replicationPolicy elements", () => {
        const policy = ReplicationPolicy.fromElement(
          parseElement(`
            <replicationPolicy replicationAllowed="true" numberReplicas="2">
              <preferredMemberNode>urn:node:mnA</preferredMemberNode>
              <blockedMemberNode>urn:node:mnZ</blockedMemberNode>
            </replicationPolicy>
          `),
        );

        expect(policy.toJSON()).to.deep.equal({
          replicationAllowed: true,
          numberReplicas: 2,
          preferredNodes: ["urn:node:mnA"],
          blockedNodes: ["urn:node:mnZ"],
        });
      });

      it("rejects unexpected attributes or out-of-order child elements", () => {
        expect(() =>
          ReplicationPolicy.fromElement(
            parseElement(`
              <replicationPolicy unexpected="1" />
            `),
          ),
        ).to.throw(/unexpected attribute "unexpected"/i);

        expect(() =>
          ReplicationPolicy.fromElement(
            parseElement(`
              <replicationPolicy>
                <blockedMemberNode>urn:node:mnZ</blockedMemberNode>
                <preferredMemberNode>urn:node:mnA</preferredMemberNode>
              </replicationPolicy>
            `),
          ),
        ).to.throw(/out of order/i);
      });
    });

    describe("hasValues()", () => {
      it("reports whether the policy has any serializable values", () => {
        expect(new ReplicationPolicy().hasValues()).to.equal(false);
        expect(
          new ReplicationPolicy({ replicationAllowed: false }).hasValues(),
        ).to.equal(true);
      });
    });

    describe("fromValue()", () => {
      it("coerces plain input and returns null for empty policies", () => {
        const source = new ReplicationPolicy({
          replicationAllowed: true,
          numberReplicas: 2,
          preferredNodes: ["urn:node:mnA"],
        });

        const fromObject = ReplicationPolicy.fromValue({
          replicationAllowed: "false",
          blockedNodes: ["urn:node:mnZ"],
        });
        const fromPolicy = ReplicationPolicy.fromValue(source);

        expect(fromObject).to.be.instanceof(ReplicationPolicy);
        expect(fromObject.replicationAllowed).to.equal(false);
        expect(fromObject.blockedNodes).to.deep.equal(["urn:node:mnZ"]);
        expect(fromPolicy).to.be.instanceof(ReplicationPolicy);
        expect(fromPolicy).to.not.equal(source);
        expect(fromPolicy.toJSON()).to.deep.equal(source.toJSON());
        expect(ReplicationPolicy.fromValue({})).to.equal(null);
      });
    });

    describe("validate()", () => {
      it("reports invalid booleans, replica counts, and node values", () => {
        const errors = new ReplicationPolicy({
          replicationAllowed: "maybe",
          numberReplicas: -1,
          preferredNodes: [""],
          blockedNodes: [""],
        }).validate();

        expect(errors).to.deep.equal([
          {
            field: "replicationPolicy.replicationAllowed",
            message: "replicationAllowed must be a boolean when present.",
          },
          {
            field: "replicationPolicy.numberReplicas",
            message: "numberReplicas must be an unsigned integer when present.",
          },
          {
            field: "replicationPolicy.preferredNodes[0]",
            message: "preferredMemberNode values must be non-empty strings.",
          },
          {
            field: "replicationPolicy.blockedNodes[0]",
            message: "blockedMemberNode values must be non-empty strings.",
          },
        ]);
      });
    });

    describe("toElement()", () => {
      it("returns null when the policy is empty", () => {
        expect(new ReplicationPolicy().toElement(createDoc())).to.equal(null);
      });

      it("serializes policy attributes and node lists", () => {
        const element = new ReplicationPolicy({
          replicationAllowed: true,
          numberReplicas: 2,
          preferredNodes: ["urn:node:mnA"],
          blockedNodes: ["urn:node:mnZ"],
        }).toElement(createDoc());

        const serialized = new XMLSerializer().serializeToString(element);

        expect(serialized).to.equal(
          '<replicationPolicy replicationAllowed="true" numberReplicas="2"><preferredMemberNode>urn:node:mnA</preferredMemberNode><blockedMemberNode>urn:node:mnZ</blockedMemberNode></replicationPolicy>',
        );
      });
    });

    describe("toJSON()", () => {
      it("returns cloned plain policy data", () => {
        const policy = new ReplicationPolicy({
          preferredNodes: ["urn:node:mnA"],
          blockedNodes: ["urn:node:mnZ"],
        });

        const json = policy.toJSON();
        json.preferredNodes.push("urn:node:mnB");
        json.blockedNodes.push("urn:node:mnY");

        expect(policy.preferredNodes).to.deep.equal(["urn:node:mnA"]);
        expect(policy.blockedNodes).to.deep.equal(["urn:node:mnZ"]);
      });
    });
  });
});
