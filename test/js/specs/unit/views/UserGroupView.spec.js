define([
  "backbone",
  "collections/UserGroup",
  "views/UserGroupView",
  "/test/js/specs/shared/clean-state.js",
], (Backbone, UserGroup, UserGroupView, cleanState) => {
  "use strict";

  const expect = chai.expect;

  describe("UserGroupView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const model = new Backbone.Model({
        username: "owner",
        usernameReadable: "owner",
        isOwnerOf: [],
        isMemberOf: [{ groupId: "large-group", name: "Large Group" }],
      });
      const view = new UserGroupView({ model });
      view.$el.html('<div id="group-list-container"></div>');
      const getGroup = sandbox
        .stub(UserGroup.prototype, "getGroup")
        .returnsThis();

      return { getGroup, sandbox, view };
    }, beforeEach);

    afterEach(() => {
      state.view.remove();
      state.sandbox.restore();
    });

    it("shows that group information is loading without edit controls", () => {
      state.view.getGroups();

      expect(state.view.$("#group-list-container").text()).to.contain(
        "Loading group information...",
      );
      expect(state.view.$("#group-list-container .add-member")).to.have.length(
        0,
      );
      expect(state.view.$("#group-list-container .member-list")).to.have.length(
        0,
      );
    });

    it("replaces the loading message with the group list after loading", () => {
      state.view.getGroups();
      state.getGroup.firstCall.thisValue.trigger("sync");

      expect(
        state.view.$("#group-list-container .notification.loading"),
      ).to.have.length(0);
      expect(state.view.$("#group-list-container .member-list")).to.have.length(
        1,
      );
    });

    it("replaces the loading message with a refresh instruction on error", () => {
      state.view.getGroups();
      state.getGroup.firstCall.thisValue.trigger("error");

      expect(state.view.$("#group-list-container").text()).to.contain(
        "Group information could not be loaded. Refresh the page to try again.",
      );
      expect(state.view.$("#group-list-container .add-member")).to.have.length(
        0,
      );
      expect(
        state.view.$("#group-list-container .notification.error"),
      ).to.have.length(1);
    });
  });
});
