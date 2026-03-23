define([
  "models/sysmeta/ReplicaList",
  "models/sysmeta/Replica",
], (ReplicaList, Replica) => {
  const expect = chai.expect;

  describe("ReplicaList", () => {
    describe("construction and mutation", () => {
      it("clones Replica instances and normalizes plain objects", () => {
        const sourceReplica = new Replica({
          replicaMemberNode: "urn:node:mnA",
          replicationStatus: "completed",
          replicaVerified: "2025-06-25T00:00:00Z",
        });

        const replicas = new ReplicaList([
          sourceReplica,
          {
            replicaMemberNode: "urn:node:mnB",
            replicationStatus: "requested",
            replicaVerified: "2025-06-26T00:00:00Z",
          },
        ]);

        expect(replicas).to.have.length(2);
        expect(replicas[0]).to.be.instanceof(Replica);
        expect(replicas[0]).to.not.equal(sourceReplica);
        expect(replicas[0].toJSON()).to.deep.equal(sourceReplica.toJSON());
        expect(replicas[1].replicationStatus).to.equal("requested");
      });

      it("pushes normalized replicas", () => {
        const replicas = new ReplicaList();

        replicas.push({
          replicaMemberNode: "urn:node:mnA",
          replicationStatus: "completed",
          replicaVerified: "2025-06-25T00:00:00Z",
        });

        expect(replicas[0]).to.be.instanceof(Replica);
        expect(replicas[0].replicaMemberNode).to.equal("urn:node:mnA");
      });
    });

    describe("validate()", () => {
      it("prefixes nested replica validation paths with indexes", () => {
        const errors = new ReplicaList([
          {
            replicaMemberNode: "",
            replicationStatus: "bogus",
            replicaVerified: "not-a-date",
          },
        ]).validate();

        expect(errors).to.deep.equal([
          {
            field: "replica[0].replicaMemberNode",
            message:
              "replicaMemberNode is required and must be a non-empty string.",
          },
          {
            field: "replica[0].replicationStatus",
            message:
              "replicationStatus must be one of: queued, requested, completed, failed, invalidated.",
          },
          {
            field: "replica[0].replicaVerified",
            message: "replicaVerified must be a valid date.",
          },
        ]);
      });
    });

    describe("fromValue()", () => {
      it("coerces single replica objects and clones existing lists", () => {
        const source = new ReplicaList([
          {
            replicaMemberNode: "urn:node:mnA",
            replicationStatus: "completed",
            replicaVerified: "2025-06-25T00:00:00Z",
          },
        ]);

        const fromObject = ReplicaList.fromValue({
          replicaMemberNode: "urn:node:mnB",
          replicationStatus: "requested",
          replicaVerified: "2025-06-26T00:00:00Z",
        });
        const fromList = ReplicaList.fromValue(source);

        expect(fromObject).to.be.instanceof(ReplicaList);
        expect(fromObject).to.have.length(1);
        expect(fromObject[0].replicaMemberNode).to.equal("urn:node:mnB");
        expect(fromList).to.be.instanceof(ReplicaList);
        expect(fromList).to.not.equal(source);
        expect(fromList.toJSON()).to.deep.equal(source.toJSON());
      });
    });

    describe("toJSON()", () => {
      it("returns cloned nested replica data", () => {
        const replicas = new ReplicaList([
          {
            replicaMemberNode: "urn:node:mnA",
            replicationStatus: "completed",
            replicaVerified: "2025-06-25T00:00:00Z",
          },
        ]);

        const json = replicas.toJSON();
        json[0].replicaMemberNode = "changed";

        expect(replicas[0].replicaMemberNode).to.equal("urn:node:mnA");
      });
    });
  });
});
