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

    describe("file drops", () => {
      let transfer, received, root;

      beforeEach(() => {
        view.viewModel.setRows([
          {
            id: "dataset:root",
            kind: "dataset",
            className: "root-dataset",
            acceptsFiles: true,
            label: "Dataset",
          },
          ...view.viewModel.getRows().toJSON(),
        ]);
        root = view.viewModel.getRows().get("dataset:root");
        transfer = new DataTransfer();
        transfer.items.add(new File(["x"], "added.txt"));
        received = sandbox.spy();
        view.on("files:drop", received);
      });

      function drag(type, target, relatedTarget = null) {
        const event = new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          relatedTarget,
        });
        target.dispatchEvent(event);
        return event;
      }

      [
        "thead th",
        "tr[data-id='dataset:root'] td",
        "tr[data-id='data.1'] td",
        "tr[data-id='data.1'] .file-actions button",
        ".message-row td",
        "tfoot td",
      ].forEach((selector) => {
        it(`accepts a root drop over ${selector} in a folderless table`, () => {
          view
            .$("tbody")
            .append('<tr class="message-row"><td>Add files</td></tr>');
          view.$el.append("<tfoot><tr><td>Notice</td></tr></tfoot>");
          const target = view.$(selector)[0];

          drag("dragover", target).defaultPrevented.should.equal(true);
          view.$el.hasClass("data-package-drop-target").should.equal(true);
          drag("drop", target).defaultPrevented.should.equal(true);

          sinon.assert.calledOnce(received);
          chai.expect(received.firstCall.args[0]).to.equal(root);
          chai.expect(received.firstCall.args[1]).to.equal(transfer.files);
          view.$el.hasClass("data-package-drop-target").should.equal(false);
        });
      });

      it("keeps the table highlighted between cells and clears it on exit", () => {
        const cells = view.$("tr[data-id='data.1'] td");
        drag("dragover", cells[0]);
        drag("dragleave", cells[0], cells[1]);
        view.$el.hasClass("data-package-drop-target").should.equal(true);
        drag("dragleave", cells[1], document.body);
        view.$el.hasClass("data-package-drop-target").should.equal(false);
      });

      it("uses explicit row destinations while folders exist, even when collapsed", () => {
        view.viewModel.setRows([
          ...view.viewModel.getRows().toJSON(),
          {
            id: "folder:measurements/qc",
            kind: "folder",
            label: "QC",
            atLocation: "measurements/qc",
            acceptsFiles: true,
            isExpanded: false,
          },
        ]);
        const rows = view.viewModel.getRows();
        const folder = view.$("tr[data-id='folder:measurements/qc']");
        const rootElement = view.$("tr[data-id='dataset:root']");

        drag("dragover", folder.find("td")[0]);
        folder.hasClass("data-package-drop-target").should.equal(true);
        view.$el.hasClass("data-package-drop-target").should.equal(false);
        drag("drop", folder.find("td")[0]);
        chai
          .expect(received.firstCall.args[0])
          .to.equal(rows.get("folder:measurements/qc"));
        drag("dragover", folder.find("td")[0]);
        drag("dragover", rootElement.find("td")[0]);
        folder.hasClass("data-package-drop-target").should.equal(false);
        rootElement.hasClass("data-package-drop-target").should.equal(true);
        drag("drop", rootElement.find("td")[0]);
        chai
          .expect(received.secondCall.args[0])
          .to.equal(rows.get("dataset:root"));

        const fileCell = view.$("tr[data-id='data.1'] td")[0];
        drag("dragover", fileCell).defaultPrevented.should.equal(false);
        drag("drop", fileCell).defaultPrevented.should.equal(true);
        drag("drop", view.$("thead th")[0]);
        sinon.assert.calledTwice(received);

        view.viewModel.removeRow("folder:measurements/qc");
        drag("drop", view.$("tr[data-id='data.1'] td")[0]);
        sinon.assert.calledThrice(received);
        chai
          .expect(received.thirdCall.args[0])
          .to.equal(rows.get("dataset:root"));
      });

      ["disabled", "loading", "viewer"].forEach((state) => {
        it(`does not accept drops when ${state}`, () => {
          drag("dragover", view.$("tr[data-id='dataset:root'] td")[0]);
          if (state === "disabled") view.setDisabled(true);
          if (state === "loading") view.viewModel.set("isLoading", true);
          if (state === "viewer") root.set("acceptsFiles", false);
          if (state !== "viewer") {
            view.$el.hasClass("data-package-drop-target").should.equal(false);
          }

          drag("dragover", view.$("tbody td")[0]);
          drag("drop", view.$("tbody td")[0]);
          sinon.assert.notCalled(received);
          view.$el.hasClass("data-package-drop-target").should.equal(false);
          view.$(".data-package-drop-target").length.should.equal(0);
        });
      });

      it("ignores text drags and empty drops", () => {
        transfer.items.clear();
        transfer.setData("text/plain", "text");
        const cell = view.$("tr[data-id='dataset:root'] td")[0];
        drag("dragover", cell).defaultPrevented.should.equal(false);
        view.$el.hasClass("data-package-drop-target").should.equal(false);
        drag("drop", cell);
        sinon.assert.notCalled(received);
      });

      it("recognizes file drags before the FileList is available", () => {
        view
          .$("tr[data-id='data.1'] td")
          .first()
          .trigger(
            $.Event("dragover", {
              dataTransfer: { types: ["Files"], files: [] },
            }),
          );
        view.$el.hasClass("data-package-drop-target").should.equal(true);
      });

      it("clears the highlight when the rows are rebuilt", () => {
        drag("dragover", view.$("tr[data-id='data.1'] td")[0]);
        view.viewModel.setRows(view.viewModel.getRows().toJSON());
        view.$el.hasClass("data-package-drop-target").should.equal(false);
      });
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
