define(["models/sysmeta/Replica"], (Replica) => {
  const expect = chai.expect;

  const parseElement = (xml) =>
    new DOMParser().parseFromString(xml, "application/xml").documentElement;

  const createDoc = () =>
    new DOMParser().parseFromString("<root />", "application/xml");

  describe("Replica", () => {
    describe("construction", () => {
      it("normalizes member node, status, and verified dates", () => {
        const replica = new Replica({
          replicaMemberNode: " urn:node:mnA ",
          replicationStatus: " COMPLETED ",
          replicaVerified: "2025-06-25T00:00:00Z",
        });

        expect(replica.replicaMemberNode).to.equal("urn:node:mnA");
        expect(replica.replicationStatus).to.equal("completed");
        expect(replica.replicaVerified).to.be.instanceof(Date);
      });

      it("preserves invalid verified values for later validation", () => {
        const replica = new Replica({ replicaVerified: "not-a-date" });

        expect(replica.replicaVerified).to.equal("not-a-date");
      });
    });

    describe("fromElement()", () => {
      it("parses replica elements", () => {
        const replica = Replica.fromElement(
          parseElement(`
            <replica>
              <replicaMemberNode>urn:node:mnA</replicaMemberNode>
              <replicationStatus>requested</replicationStatus>
              <replicaVerified>2025-06-25T00:00:00Z</replicaVerified>
            </replica>
          `),
        );

        expect(replica.replicaMemberNode).to.equal("urn:node:mnA");
        expect(replica.replicationStatus).to.equal("requested");
        expect(replica.replicaVerified).to.be.instanceof(Date);
      });

      it("rejects missing or out-of-order child elements", () => {
        expect(() =>
          Replica.fromElement(
            parseElement(`
              <replica>
                <replicationStatus>requested</replicationStatus>
                <replicaMemberNode>urn:node:mnA</replicaMemberNode>
                <replicaVerified>2025-06-25T00:00:00Z</replicaVerified>
              </replica>
            `),
          ),
        ).to.throw(/out of order/i);
      });
    });

    describe("validate()", () => {
      it("requires the core replica fields", () => {
        expect(new Replica().validate()).to.deep.equal([
          {
            field: "replica.replicaMemberNode",
            message:
              "replicaMemberNode is required and must be a non-empty string.",
          },
          {
            field: "replica.replicationStatus",
            message: "replicationStatus is required.",
          },
          {
            field: "replica.replicaVerified",
            message: "replicaVerified is required.",
          },
        ]);
      });

      it("reports invalid status and verification dates", () => {
        const errors = new Replica({
          replicaMemberNode: "urn:node:mnA",
          replicationStatus: "bogus",
          replicaVerified: "not-a-date",
        }).validate("replica[1]");

        expect(errors).to.deep.equal([
          {
            field: "replica[1].replicationStatus",
            message:
              "replicationStatus must be one of: queued, requested, completed, failed, invalidated.",
          },
          {
            field: "replica[1].replicaVerified",
            message: "replicaVerified must be a valid date.",
          },
        ]);
      });
    });

    describe("toElement()", () => {
      it("returns null when no replica fields are populated", () => {
        expect(new Replica().toElement(createDoc())).to.equal(null);
      });

      it("serializes replica values to XML", () => {
        const element = new Replica({
          replicaMemberNode: "urn:node:mnA",
          replicationStatus: "completed",
          replicaVerified: new Date("2025-06-25T00:00:00Z"),
        }).toElement(createDoc());

        const serialized = new XMLSerializer().serializeToString(element);

        expect(serialized).to.equal(
          "<replica><replicaMemberNode>urn:node:mnA</replicaMemberNode><replicationStatus>completed</replicationStatus><replicaVerified>2025-06-25T00:00:00.000+00:00</replicaVerified></replica>",
        );
      });
    });

    describe("toJSON()", () => {
      it("returns plain replica data", () => {
        const verified = new Date("2025-06-25T00:00:00Z");
        const json = new Replica({
          replicaMemberNode: "urn:node:mnA",
          replicationStatus: "completed",
          replicaVerified: verified,
        }).toJSON();

        expect(json.replicaMemberNode).to.equal("urn:node:mnA");
        expect(json.replicationStatus).to.equal("completed");
        expect(json.replicaVerified).to.be.instanceof(Date);
        expect(json.replicaVerified.getTime()).to.equal(verified.getTime());
      });
    });
  });
});
