define(["models/dataPackage/DataPackageMembers"], (DataPackageMembers) => {
  const { expect } = chai;

  describe("DataPackageMembers", () => {
    it("atomically re-keys a member PID", () => {
      const members = new DataPackageMembers();
      members.add({ pid: "data.1" });

      const member = members.replacePid("data.1", "data.2");

      expect(member.pid).to.equal("data.2");
      expect(member.remotePid).to.equal(null);
      expect(members.get("data.1")).to.equal(null);
      expect(members.get("data.2")).to.equal(member);
    });

    it("rejects a PID re-key that would create a duplicate", () => {
      const members = new DataPackageMembers();
      members.add([{ pid: "data.1" }, { pid: "data.2" }]);

      expect(() => members.replacePid("data.1", "data.2")).to.throw(
        "already exists",
      );

      expect(members.get("data.1").pid).to.equal("data.1");
      expect(members.get("data.2").pid).to.equal("data.2");
    });

    it("filters, purges, and retains members", () => {
      const members = new DataPackageMembers();
      members.add([{ pid: "data.1" }, { pid: "data.2" }, { pid: "meta.1" }]);
      members.get("data.2").markRemoved();

      expect(
        members.getActiveMembers().map((member) => member.pid),
      ).to.deep.equal(["data.1", "meta.1"]);
      expect(members.get("data.2").removed).to.equal(true);

      members.purgeRemoved().retain(["meta.1"]);
      expect(members.toArray().map((member) => member.pid)).to.deep.equal([
        "meta.1",
      ]);
    });
  });
});
