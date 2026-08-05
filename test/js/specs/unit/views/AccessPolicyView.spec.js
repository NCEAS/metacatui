define([
  "jquery",
  "backbone",
  "collections/AccessPolicy",
  "views/AccessPolicyView",
  "views/EditorView",
], ($, Backbone, AccessPolicy, AccessPolicyView, EditorView) => {
  const expect = chai.expect;

  describe("AccessPolicyView", () => {
    let sandbox;
    let originalMetacatUI;
    let view;
    let rootDataPackage;
    let applyHandler;
    let originalPopup;

    function stubRendering() {
      sandbox.stub(view.collection, "getSubjectInfo");
      sandbox.stub(view, "showRightsholder");
      sandbox.stub(view, "addEmptyRow");
      sandbox.stub(view, "renderHelpText");
      sandbox.stub(view, "renderPublicToggle");
    }

    function createView(options = {}) {
      applyHandler = Object.prototype.hasOwnProperty.call(options, "onApply")
        ? options.onApply
        : sandbox.stub().resolves();
      view = new AccessPolicyView({
        policy: [
          {
            subjects: ["uid=collaborator"],
            permissions: ["read", "write", "changePermission"],
          },
        ],
        policyContext: {
          fileName: "data.csv",
          rightsHolder: "uid=owner",
          type: "DataONEObject",
          canChangePermission: true,
        },
        onApply: applyHandler,
        ...options,
      });
      stubRendering();
      return view;
    }

    function createLegacyView(dataONEObject) {
      const policy = new AccessPolicy();
      policy.dataONEObject = dataONEObject;
      view = new AccessPolicyView({ collection: policy });
      stubRendering();
      return view;
    }

    function configureHiddenSubjects(hiddenSubjects) {
      const groupId = "CN=arctic-data-admins,DC=dataone,DC=org";
      MetacatUI.appModel.get
        .withArgs("hiddenSubjectsInAccessPolicy")
        .returns(hiddenSubjects);
      MetacatUI.appModel.get
        .withArgs("accessRuleOptions")
        .returns({ read: true });
      MetacatUI.appModel.get
        .withArgs("accessRuleOptionNames")
        .returns({ read: "Can view" });
      MetacatUI.appUserModel.get
        .withArgs("allIdentitiesAndGroups")
        .returns([groupId]);
      MetacatUI.appUserModel.get.withArgs("isMemberOf").returns([{ groupId }]);
      MetacatUI.appUserModel.get
        .withArgs("username")
        .returns("uid=current-user");
    }

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      originalMetacatUI = globalThis.MetacatUI;
      rootDataPackage = {
        getNestedResourceMapMembers: sandbox.stub().returns([]),
        setPackageAccessPolicy: sandbox.stub(),
        setMemberAccessPolicy: sandbox.stub(),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "accessPolicyName") return "Sharing";
            if (key === "allowAccessPolicyChanges") return true;
            return false;
          }),
        },
        appView: {
          showAlert: sandbox.stub(),
        },
        appUserModel: {
          get: sandbox.stub().returns(null),
        },
      };
      sandbox.stub($.fn, "modal").returnsThis();
      originalPopup = $.fn.popup;
      if (!originalPopup) {
        $.fn.popup = function () {
          return this;
        };
      }
      sandbox.stub($.fn, "popup").returnsThis();
    });

    afterEach(() => {
      view?.remove();
      sandbox.restore();
      if (!originalPopup) {
        delete $.fn.popup;
      }
      globalThis.MetacatUI = originalMetacatUI;
    });

    it("shows Done, Cancel, and a default-off package propagation option", () => {
      createView();
      view.broadcast = true;

      view.render();

      expect(view.$(".done").text().trim()).to.equal("Done");
      expect(view.$(".cancel").text().trim()).to.equal("Cancel");
      expect(view.$(".apply-to-all-members").length).to.equal(1);
      expect(
        view.$(".apply-to-all-members").closest(".modal-footer").length,
      ).to.equal(1);
      expect(view.$(".apply-to-all-members").is(":checked")).to.equal(false);
    });

    it("disables package propagation with a Formantic tooltip for nested packages", () => {
      createView();
      rootDataPackage.getNestedResourceMapMembers.returns([
        { pid: "nested.1" },
      ]);
      view.broadcast = true;

      view.render();

      expect(view.$(".apply-to-all-members").is(":disabled")).to.equal(true);
      expect(
        $.fn.popup.calledWith(
          sinon.match({
            content:
              "Apply to all members is unavailable because this dataset contains a nested package, which is read-only in the editor.",
          }),
        ),
      ).to.equal(true);
    });

    it("removes rules from row-level x clicks", () => {
      createView();
      view.render();

      view.$(".access-rule .remove").trigger("click");

      expect(view.collection.length).to.equal(0);
      expect(view.$(".access-rule").length).to.equal(0);
    });

    it("hides configured subjects not matched by the current user", () => {
      createView({
        policy: [
          {
            subjects: ["CN=Matt Jones A729,O=Google,C=US,DC=cilogon,DC=org"],
            permissions: ["read"],
          },
        ],
      });
      configureHiddenSubjects([
        "CN=Matt Jones A729,O=Google,C=US,DC=cilogon,DC=org",
      ]);

      view.render();

      expect(view.$(".access-rule").length).to.equal(0);
    });

    it("does not let one hidden group reveal every hidden subject", () => {
      createView({
        policy: [
          {
            subjects: ["CN=arctic-data-admins,DC=dataone,DC=org"],
            permissions: ["read"],
          },
          {
            subjects: ["http://orcid.org/0000-0003-2192-431X"],
            permissions: ["read"],
          },
        ],
      });
      configureHiddenSubjects([
        "CN=arctic-data-admins,DC=dataone,DC=org",
        "http://orcid.org/0000-0003-2192-431X",
      ]);

      view.render();

      expect(view.$(".access-rule").length).to.equal(1);
      expect(view.$(".access-rule").text()).to.not.contain(
        "http://orcid.org/0000-0003-2192-431X",
      );
    });

    it("replaces the previous view without removing unrelated editor listeners", async () => {
      sandbox.stub(AccessPolicyView.prototype, "render").returnsThis();
      const editor = new EditorView({
        el: $('<div><div class="access-policy-view-container"></div></div>'),
      });
      const firstPolicy = new AccessPolicy([
        { subject: "uid=file", read: true },
      ]);
      const secondPolicy = new AccessPolicy([
        { subject: "uid=root", read: true },
      ]);

      await new Promise((resolve) => {
        editor.once("accessPolicyViewRendered", resolve);
        editor.renderAccessPolicy(
          new Backbone.Model({ accessPolicy: firstPolicy }),
        );
      });
      const firstView = editor.accessPolicyView;
      const unrelatedListener = sandbox.spy();
      editor.listenTo(firstPolicy, "unrelated", unrelatedListener);

      await new Promise((resolve) => {
        editor.once("accessPolicyViewRendered", resolve);
        editor.renderAccessPolicy(
          new Backbone.Model({ accessPolicy: secondPolicy }),
        );
      });

      firstPolicy.trigger("unrelated");
      expect(unrelatedListener.calledOnce).to.equal(true);
      expect($.contains(editor.el, firstView.el)).to.equal(false);
      expect(editor.accessPolicyView).to.not.equal(firstView);
      expect(editor.accessPolicyView.collection).to.equal(secondPolicy);
      editor.remove();
    });

    it("removes the previous view before showing the loading modal", async () => {
      sandbox.stub(AccessPolicyView.prototype, "render").returnsThis();
      const editor = new EditorView({
        el: $('<div><div class="access-policy-view-container"></div></div>'),
      });
      const policy = new AccessPolicy([{ subject: "uid=file", read: true }]);

      await new Promise((resolve) => {
        editor.once("accessPolicyViewRendered", resolve);
        editor.renderAccessPolicy(new Backbone.Model({ accessPolicy: policy }));
      });
      const previousView = editor.accessPolicyView;
      const unrelatedListener = sandbox.spy();
      editor.listenTo(policy, "unrelated", unrelatedListener);

      const shown = editor.showAccessPolicyLoadingModal({
        currentTarget: $("<button>")[0],
      });
      policy.trigger("unrelated");

      expect(shown).to.equal(true);
      expect(editor.accessPolicyView).to.equal(null);
      expect($.contains(editor.el, previousView.el)).to.equal(false);
      expect(unrelatedListener.calledOnce).to.equal(true);
      editor.remove();
    });

    it("applies root sharing through the explicit apply handler", async () => {
      createView();
      view.broadcast = true;
      view.render();
      view.collection.add({ subject: "public", read: true });
      view
        .$(".public-toggle-container")
        .html('<input type="checkbox" class="toggle-checkbox">');
      view.$(".apply-to-all-members").prop("checked", true);

      await view.apply();

      expect(view.collection.isPublic()).to.equal(false);
      expect(
        applyHandler.calledOnceWith(
          view.collection,
          sinon.match({ propagate: true }),
        ),
      ).to.equal(true);
      expect(applyHandler.firstCall.args[1]).to.not.have.property(
        "rightsHolder",
      );
      expect(rootDataPackage.setPackageAccessPolicy.called).to.equal(false);
      expect(rootDataPackage.setMemberAccessPolicy.called).to.equal(false);
    });

    it("leaves explicit policy application to the caller", async () => {
      createView({ onApply: null });
      view.render();

      await view.apply();

      expect(rootDataPackage.setPackageAccessPolicy.called).to.equal(false);
      expect(rootDataPackage.setMemberAccessPolicy.called).to.equal(false);
    });

    it("applies per-file sharing through the explicit apply handler", async () => {
      createView();
      view.render();

      await view.apply();

      expect(
        applyHandler.calledOnceWith(
          view.collection,
          sinon.match({ propagate: false }),
        ),
      ).to.equal(true);
      expect(applyHandler.firstCall.args[1]).to.not.have.property(
        "rightsHolder",
      );
      expect(rootDataPackage.setMemberAccessPolicy.called).to.equal(false);
    });

    it("passes an explicitly changed rightsHolder to the apply handler", async () => {
      createView();
      view.render();
      view.setRightsHolder("uid=new-owner");

      await view.apply();

      expect(
        applyHandler.calledOnceWith(
          view.collection,
          sinon.match({
            propagate: false,
            rightsHolder: "uid=new-owner",
          }),
        ),
      ).to.equal(true);
    });

    it("disables the modal while applying changes", async () => {
      let resolveApply;
      const pendingApply = new Promise((resolve) => {
        resolveApply = resolve;
      });
      createView({ onApply: sandbox.stub().returns(pendingApply) });
      view.render();

      const applyPromise = view.apply();
      await Promise.resolve();
      view.apply();

      expect(applyHandler.calledOnce).to.equal(true);
      expect(view.$el.hasClass("applying")).to.equal(true);
      expect(view.$(".done").hasClass("disabled")).to.equal(true);
      expect(view.$(".done").text()).to.contain("Updating files...");
      expect(view.$(".cancel").hasClass("disabled")).to.equal(true);
      expect(
        view.$(".modal-header .close").attr("data-dismiss") === undefined,
      ).to.equal(true);

      resolveApply();
      await applyPromise;
      expect(view.$el.hasClass("applying")).to.equal(false);
    });

    it("shows package apply progress in the Done button", async () => {
      let resolveApply;
      const pendingApply = new Promise((resolve) => {
        resolveApply = resolve;
      });
      createView({
        onApply: sandbox.stub().callsFake((_policy, options) => {
          options.onProgress({ completed: 2, total: 3 });
          return pendingApply;
        }),
      });
      view.broadcast = true;
      view.render();
      view.$(".apply-to-all-members").prop("checked", true);

      const applyPromise = view.apply();
      await Promise.resolve();

      expect(view.$(".done").text()).to.contain("Updating 2/3 files...");

      resolveApply();
      await applyPromise;
    });

    it("keeps the modal open and restores controls when apply fails", async () => {
      createView({
        onApply: sandbox
          .stub()
          .rejects(new Error("The sharing update failed.")),
      });
      view.render();

      await view.apply();

      expect(view.isApplying).to.equal(false);
      expect(view.$(".apply").hasClass("disabled")).to.equal(false);
      expect($.fn.modal.calledWith("hide")).to.equal(false);
      expect(
        MetacatUI.appView.showAlert.calledWith(
          "The sharing update failed.",
          "alert-error",
        ),
      ).to.equal(true);
    });

    it("saves legacy portal sharing through the DataONEObject sysmeta path", async () => {
      const portal = new Backbone.Model({ uploadStatus: null });
      portal.isNew = sandbox.stub().returns(false);
      portal.updateSysMeta = sandbox.stub().callsFake(() => {
        portal.set("uploadStatus", "p");
        portal.set("uploadStatus", "c");
      });
      createLegacyView(portal);
      view.render();
      view
        .$(".public-toggle-container")
        .html('<input type="checkbox" class="toggle-checkbox" checked>');

      await view.apply();

      expect(portal.updateSysMeta.calledOnce).to.equal(true);
      expect(view.collection.isPublic()).to.equal(true);
      expect(rootDataPackage.setPackageAccessPolicy.called).to.equal(false);
      expect(rootDataPackage.setMemberAccessPolicy.called).to.equal(false);
      expect(
        MetacatUI.appView.showAlert.calledWith(
          "Sharing changes have been saved.",
          "alert-success",
        ),
      ).to.equal(true);
    });

    it("keeps the Save action for legacy policy views", () => {
      const portal = new Backbone.Model();
      createLegacyView(portal);

      view.render();

      expect(view.$(".save").text().trim()).to.equal("Save");
      expect(view.$(".done")).to.have.length(0);
    });

    it("does not show explicit propagation controls on legacy broadcast views", () => {
      const metadata = new Backbone.Model();
      createLegacyView(metadata);
      view.broadcast = true;

      view.render();

      expect(view.$(".apply-to-all-members")).to.have.length(0);
    });

    it("keeps legacy apply pending until the sysmeta save completes", async () => {
      const portal = new Backbone.Model({ uploadStatus: null });
      portal.isNew = sandbox.stub().returns(false);
      portal.updateSysMeta = sandbox.stub().callsFake(() => {
        portal.set("uploadStatus", "p");
      });
      createLegacyView(portal);
      view.render();

      let applySettled = false;
      const applyPromise = view.apply().then(() => {
        applySettled = true;
      });
      await Promise.resolve();

      expect(applySettled).to.equal(false);

      portal.set("uploadStatus", "c");
      await applyPromise;

      expect(applySettled).to.equal(true);
    });

    it("removes every public rule when the toggle is off", () => {
      createView({
        policy: [
          { subjects: ["public"], permissions: ["read"] },
          { subjects: ["public"], permissions: ["write"] },
        ],
      });
      view.$el.html(
        '<div class="public-toggle-container">' +
          '<input type="checkbox" class="toggle-checkbox">' +
          "</div>",
      );

      view.syncPublicToggle();

      expect(view.collection.where({ subject: "public" })).to.have.length(0);
      expect(view.collection.isPublic()).to.equal(false);
    });

    it("ignores child hide events while the modal stays open", () => {
      createView();
      view.render();
      const originalModel = view.collection.at(0);
      view.collection.add({ subject: "public", read: true });

      const childHideEvent = $.Event("hide", {
        target: view.$(".public-toggle-container")[0],
      });
      view.handleHide(childHideEvent);

      expect(view.collection.at(0)).to.equal(originalModel);
      expect(view.collection.isPublic()).to.equal(true);
    });

    it("restores access rules when cancelled", () => {
      createView();
      view.render();
      view.collection.at(0).set("write", false);

      view.reset();

      expect(view.collection.at(0).get("write")).to.equal(true);
    });

    it("rebuilds rule rows from the restored policy when cancelled", () => {
      createView();
      view.render();
      view.collection.remove(view.collection.at(0));

      view.reset();

      expect(view.$(".access-rule")).to.have.length(1);
      expect(view.$(".access-rule").data("model")).to.equal(
        view.collection.at(0),
      );
    });
  });
});
