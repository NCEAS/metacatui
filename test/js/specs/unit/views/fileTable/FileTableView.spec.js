define([
  "jquery",
  "views/fileTable/FileTableView",
  "views/fileTable/FileTableViewUtilities",
], ($, FileTableView, ViewUtilities) => {
  describe("FileTableView", () => {
    chai.should();

    let view, sandbox, originalPopup;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      originalPopup = $.fn.popup;
      $.fn.popup = sandbox.stub().returnsThis();
      view = new FileTableView({
        showTitle: false,
        showIconColumn: true,
        showActions: true,
        rows: [
          {
            id: "data.1",
            label: "data.csv",
            title: "data.csv",
            isRenamable: true,
            showIconColumn: true,
            showActions: true,
            actions: [
              {
                id: "describe",
                label: "Describe",
                title: "Describe file",
                className: "btn edit",
                menuItems: [
                  {
                    id: "replace",
                    label: "Replace",
                    title: "Replace file",
                  },
                ],
              },
            ],
          },
        ],
      }).render();
      document.body.appendChild(view.el);
    });

    afterEach(() => {
      view.remove();
      $(".dropdown-backdrop").remove();
      $.fn.popup = originalPopup;
      sandbox.restore();
    });

    it("disables dropdowns, editable names, and delegated tooltips", () => {
      const dropdown = view.$("[data-toggle='dropdown']");
      const menuItem = view.$(".dropdown-menu a");
      const fileTitle = view.$(".fileTitle");
      view.$(".btn-group").addClass("open");

      view.setDisabled(true);

      view.$el.hasClass("file-table-disabled").should.equal(true);
      dropdown.prop("disabled").should.equal(true);
      view.$(".btn-group").hasClass("open").should.equal(false);
      menuItem.hasClass("disabled").should.equal(true);
      fileTitle.attr("contenteditable").should.equal("false");

      $.fn.popup.resetHistory();
      view.showLazyTooltip({
        currentTarget: view.$("[data-tt-content]").first()[0],
      });

      sinon.assert.notCalled($.fn.popup);

      view.setDisabled(false);

      dropdown.prop("disabled").should.equal(false);
      menuItem.hasClass("disabled").should.equal(false);
      fileTitle.attr("contenteditable").should.equal("true");
    });

    it("does not reapply an unchanged disabled state", () => {
      sandbox.spy(view, "applyDisabledState");

      view.setDisabled(true);
      view.setDisabled(true);

      sinon.assert.calledOnce(view.applyDisabledState);
    });

    it("keeps replacement row controls disabled after a row rerender", () => {
      view.setDisabled(true);
      const oldDropdown = view.$("[data-toggle='dropdown']")[0];

      view.viewModel.updateRow("data.1", {
        status: { label: "Uploading", progress: 30 },
      });

      const dropdown = view.$("[data-toggle='dropdown']");
      const menuItem = view.$(".dropdown-menu a");
      const fileTitle = view.$(".fileTitle");

      chai.expect(dropdown[0]).not.to.equal(oldDropdown);
      view.$el.attr("aria-disabled").should.equal("true");
      dropdown.prop("disabled").should.equal(true);
      menuItem.hasClass("disabled").should.equal(true);
      fileTitle.attr("contenteditable").should.equal("false");

      view.setDisabled(false);

      dropdown.prop("disabled").should.equal(false);
      menuItem.hasClass("disabled").should.equal(false);
      fileTitle.attr("contenteditable").should.equal("true");
    });

    it("closes only its grouped menu backdrop after a menu action", () => {
      const actionClick = sandbox.stub();
      const group = view.$(".btn-group").addClass("open");
      const backdrop = $("<div class='dropdown-backdrop'></div>").insertBefore(
        view.$("[data-toggle='dropdown']"),
      );
      const unrelatedBackdrop = $(
        "<div class='dropdown-backdrop'></div>",
      ).appendTo(document.body);
      view.on("action:click", actionClick);

      chai.expect(view.$(".dropdown-menu").attr("role")).to.equal("menu");
      view.$(".dropdown-menu a").trigger("click");

      sinon.assert.calledOnce(actionClick);
      actionClick.firstCall.args[1].get("id").should.equal("replace");
      group.hasClass("open").should.equal(false);
      backdrop.parent().length.should.equal(0);
      unrelatedBackdrop.parent().length.should.equal(1);
    });

    it("renders configured package filtering and sorting affordances as disabled UI", () => {
      view.remove();
      view = new FileTableView({
        showTitle: false,
        showFilteringControl: true,
        showSortingControl: true,
      }).render();
      document.body.appendChild(view.el);

      view.$("#data-package-table-files .icon-filter").length.should.equal(1);
      view
        .$("#data-package-table-files .data-package-filter-control")
        .prop("disabled")
        .should.equal(true);
      view.$(".file-header .icon-arrow-up").length.should.equal(3);
    });

    it("renders a table-level notice and bubbles its action", () => {
      const noticeAction = sandbox.stub();
      view.remove();
      view = new FileTableView({
        showTitle: false,
        noticeMessage: "Only the metadata document is available here.",
        noticeActionId: "finish-interrupted-save",
        noticeActionLabel: "Finish interrupted save",
      }).render();
      document.body.appendChild(view.el);
      view.on("notice:action", noticeAction);

      view.$("tbody + tfoot .file-listing-note").length.should.equal(1);
      view
        .$(".file-listing-note")
        .children()
        .first()
        .is(".icon")
        .should.equal(true);
      view
        .$(".file-listing-note span")
        .first()
        .text()
        .should.equal("Only the metadata document is available here.");
      view.$(".file-listing-note-action").trigger("click");

      sinon.assert.calledOnce(noticeAction);
      noticeAction.firstCall.args[0].should.equal("finish-interrupted-save");
    });

    it("indents nested editor row controls when the icon column is shown", () => {
      view.remove();
      view = new FileTableView({
        showTitle: false,
        showIconColumn: true,
        rows: [
          {
            id: "folder:data",
            label: "data",
            isContainer: true,
            showIconColumn: true,
            level: 1,
          },
          {
            id: "data.1",
            label: "data.csv",
            showIconColumn: true,
            level: 2,
          },
        ],
      }).render();
      document.body.appendChild(view.el);

      view
        .$("[data-id='folder:data'] .type-icon span")
        .attr("style")
        .should.contain("padding-left:40px");
      view
        .$("[data-id='data.1'] .type-icon span")
        .attr("style")
        .should.contain("padding-left:60px");
      chai
        .expect(view.$("[data-id='data.1'] .fileTitle").attr("style"))
        .to.equal(undefined);
    });

    it("toggles folder rows when the folder icon is clicked", () => {
      view.remove();
      view = new FileTableView({
        showTitle: false,
        rows: [
          {
            id: "folder:data",
            label: "data",
            iconClass: "icon icon-folder-open",
            isContainer: true,
            isExpanded: false,
          },
          {
            id: "data.1",
            label: "data.csv",
            parentId: "folder:data",
          },
        ],
      }).render();
      document.body.appendChild(view.el);

      const folder = view.viewModel.getRows().get("folder:data");
      const child = view.viewModel.getRows().get("data.1");
      const childView = view.subviews[child.cid];
      sandbox.spy(childView, "render");

      view.$("[data-id='folder:data'] .icon-folder-open").trigger("click");
      folder.get("isExpanded").should.equal(true);
      child.get("isVisible").should.equal(true);
      childView.$el.css("display").should.not.equal("none");

      view.$("[data-id='folder:data'] .icon-folder-open").trigger("click");
      folder.get("isExpanded").should.equal(false);
      child.get("isVisible").should.equal(false);
      childView.$el.css("display").should.equal("none");
      sinon.assert.notCalled(childView.render);
    });

    it("waits for the configured delay before showing lazy tooltips", () => {
      const clock = sandbox.useFakeTimers();
      const target = view.$("[data-tt-content], [data-tt-html]").first();
      const showDelay = ViewUtilities.TOOLTIP_SETTINGS.delay.show;

      $.fn.popup.resetHistory();
      view.showLazyTooltip({ currentTarget: target[0] });

      sinon.assert.calledOnce($.fn.popup);
      $.fn.popup.firstCall.args[0].delay.show.should.equal(showDelay);

      clock.tick(showDelay - 1);
      sinon.assert.calledOnce($.fn.popup);

      clock.tick(1);
      sinon.assert.calledTwice($.fn.popup);
      $.fn.popup.secondCall.args[0].should.equal("show");
    });

    it("cancels a pending lazy tooltip show when hover ends", () => {
      const clock = sandbox.useFakeTimers();
      const target = view.$("[data-tt-content], [data-tt-html]").first();
      const showDelay = ViewUtilities.TOOLTIP_SETTINGS.delay.show;

      $.fn.popup.resetHistory();
      view.showLazyTooltip({ currentTarget: target[0] });
      view.hideLazyTooltip({ currentTarget: target[0] });
      clock.tick(showDelay);

      $.fn.popup
        .getCalls()
        .some((call) => call.args[0] === "show")
        .should.equal(false);
    });
  });
});
