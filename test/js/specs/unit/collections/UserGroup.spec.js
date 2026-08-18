define([
  "jquery",
  "backbone",
  "collections/UserGroup",
  "models/UserModel",
  "/test/js/specs/shared/clean-state.js",
], ($, Backbone, UserGroup, UserModel, cleanState) => {
  "use strict";

  const expect = chai.expect;

  describe("UserGroup", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const fetchDeferred = $.Deferred();
      const fetchRequests = [];

      sandbox
        .stub(Backbone, "sync")
        .callsFake((method, _collection, options) => {
          expect(method).to.equal("read");
          fetchRequests.push(options);
          return fetchDeferred.promise();
        });

      const saveRequests = [];
      sandbox.stub($, "ajax").callsFake((options) => {
        saveRequests.push(options);
        return $.Deferred().promise();
      });

      return {
        fetchDeferred,
        fetchRequests,
        sandbox,
        saveRequests,
      };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
    });

    it("prevents a partial update until the group finishes loading", async () => {
      const groupId = "CN=large-group,DC=dataone,DC=org";
      const group = new UserGroup([new UserModel({ username: "member-000" })], {
        groupId,
        name: "Large Group",
      });

      group.getGroup();
      group.add(new UserModel({ username: "new-member" }));

      expect(group.save()).to.be.false;
      expect(state.saveRequests).to.be.empty;

      const memberNodes = Array.from({ length: 263 }, (_, index) => {
        const username = `member-${String(index).padStart(3, "0")}`;
        return (
          `<person><subject>${username}</subject>` +
          `<givenName>Member</givenName><familyName>${index}</familyName>` +
          `<isMemberOf>${groupId}</isMemberOf></person>`
        );
      }).join("");
      const response = $.parseXML(
        `<accounts>${memberNodes}<group><subject>${groupId}</subject>` +
          "<groupName>Large Group</groupName></group></accounts>",
      );

      state.fetchRequests[0].success(response);
      state.fetchDeferred.resolve(response);

      expect(group.save()).to.be.true;
      expect(state.saveRequests).to.have.length(1);
      const savedGroupBlob = state.saveRequests[0].data.get("group");
      const savedGroupXML = await savedGroupBlob.text();
      const savedMembers = Array.from(
        $.parseXML(savedGroupXML).querySelectorAll("hasMember"),
        (member) => member.textContent,
      );

      expect(savedMembers).to.have.length(264);
      expect(savedMembers).to.include("member-262");
      expect(savedMembers).to.include("new-member");
    });
  });
});
