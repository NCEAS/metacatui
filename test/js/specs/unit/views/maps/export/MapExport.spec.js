"use strict";

define([
  "views/maps/ToolbarView",
  "views/maps/export/ExportPanelView",
  "views/maps/export/ExportOverlayView",
  "views/maps/export/MapExportController",
  "models/maps/Map",
], (
  ToolbarView,
  ExportPanelView,
  ExportOverlayView,
  MapExportController,
  Map,
) => {
  const { expect } = chai;

  const makeWidget = (width = 1000, height = 600) => {
    const el = document.createElement("div");
    const canvas = {
      clientWidth: width,
      clientHeight: height,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height,
      }),
    };
    return {
      el,
      scene: {
        canvas,
        postRender: { addEventListener: () => () => {} },
        requestRender: sinon.spy(),
      },
      enterTopDownMode: sinon.spy(),
      exitTopDownMode: sinon.spy(),
      setCameraInputsEnabled: sinon.spy(),
      getPixelRatio: () => 1,
      getRenderLimits: () => ({}),
      getExportViewInfo: () => ({ metersPerPixel: 10, northRotation: 0 }),
    };
  };

  const pressEscape = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  };

  const tick = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

  describe("Map export Test Suite", () => {
    let host;
    let toolbar;
    let model;

    beforeEach(() => {
      host = document.createElement("div");
      document.body.appendChild(host);
      model = new Map({ showExportMap: true, showDownloadPanel: true });
      toolbar = new ToolbarView({ model, el: host });
      toolbar.render();
    });

    afterEach(() => {
      toolbar.remove();
      host.remove();
    });

    describe("Map model", () => {
      it("does not show the export tool by default", () => {
        expect(new Map().get("showExportMap")).to.equal(false);
      });
    });

    describe("ToolbarView", () => {
      it("has an export section, docked at the bottom", () => {
        const section = toolbar.getSectionByKey("export");
        expect(section).to.not.equal(undefined);
        expect(section.sectionView).to.be.instanceof(ExportPanelView);
        expect(section.contentEl.classList.contains("toolbar__content--dock-bottom"))
          .to.be.true;
      });

      it("has no export section when the tool is turned off", () => {
        const other = document.createElement("div");
        const off = new ToolbarView({ model: new Map(), el: other });
        off.render();
        expect(off.getSectionByKey("export")).to.equal(undefined);
        off.remove();
      });

      it("shows the layers panel and the export panel when the link is clicked", () => {
        toolbar.getSectionByKey("export").linkEl.click();
        expect(toolbar.getSectionByKey("layers").isActive).to.be.true;
        expect(toolbar.getSectionByKey("export").isActive).to.be.true;
        expect(toolbar.getSectionByKey("export").pinned).to.be.true;
        expect(toolbar.isOpen).to.be.true;
      });

      it("triggers events when the export section is pinned and released", () => {
        const pinned = sinon.spy();
        const released = sinon.spy();
        toolbar.on("toolbar:sectionPinned", pinned);
        toolbar.on("toolbar:sectionReleased", released);
        toolbar.getSectionByKey("export").linkEl.click();
        expect(pinned.callCount).to.equal(1);
        expect(pinned.firstCall.args[0]).to.equal("export");
        toolbar.releaseSection("export");
        expect(released.callCount).to.equal(1);
        expect(released.firstCall.args[0]).to.equal("export");
        expect(toolbar.getSectionByKey("export").isActive).to.be.false;
      });

      it("disables the download link while a section is pinned", () => {
        const { linkEl } = toolbar.getSectionByKey("download");
        toolbar.pinSection("export");
        expect(linkEl.classList.contains("toolbar__link--disabled")).to.be.true;
        toolbar.releaseSection("export");
        expect(linkEl.classList.contains("toolbar__link--disabled")).to.be.false;
      });

      it("ignores clicks on the pinned and disabled links", () => {
        toolbar.getSectionByKey("export").linkEl.click();
        toolbar.getSectionByKey("download").linkEl.click();
        toolbar.getSectionByKey("export").linkEl.click();
        expect(toolbar.getSectionByKey("download").isActive).to.be.false;
        expect(toolbar.getSectionByKey("export").isActive).to.be.true;
      });

      it("cannot be closed while a section is pinned", () => {
        toolbar.open();
        toolbar.pinSection("export");
        toolbar.close();
        expect(toolbar.isOpen).to.be.true;
        expect(toolbar.getSectionByKey("export").isActive).to.be.true;
      });

      it("hides the layers panel when its link is clicked during export", () => {
        toolbar.getSectionByKey("export").linkEl.click();
        toolbar.getSectionByKey("layers").linkEl.click();
        expect(toolbar.getSectionByKey("layers").isActive).to.be.false;
        expect(toolbar.getSectionByKey("export").isActive).to.be.true;
      });
    });

    describe("ExportPanelView", () => {
      let panel;

      beforeEach(() => {
        panel = new ExportPanelView();
        panel.render();
      });

      it("triggers save and cancel", () => {
        const save = sinon.spy();
        const cancel = sinon.spy();
        panel.on("save", save);
        panel.on("cancel", cancel);
        panel.el.querySelector("[data-action='save']").click();
        expect(save.callCount).to.equal(1);
        panel.el.querySelectorAll("[data-action='cancel']").forEach((button) => {
          button.click();
        });
        expect(cancel.callCount).to.equal(2);
      });

      it("shows the image size", () => {
        panel.setOutputSize({ width: 2000, height: 1000 });
        expect(panel.getPart("details").textContent).to.contain("2,000");
        panel.setOutputSize(null);
        expect(panel.getPart("details").textContent).to.equal("");
      });

      it("shows and hides notices", () => {
        panel.setNotices(["One", "Two"]);
        const list = panel.getPart("notices");
        expect(list.hidden).to.be.false;
        expect(list.children).to.have.lengthOf(2);
        panel.setNotices([]);
        expect(list.hidden).to.be.true;
      });

      it("shows errors as text, not HTML", () => {
        panel.setStatus("<b>Failed</b>", { isError: true });
        const status = panel.getPart("status");
        expect(status.textContent).to.equal("<b>Failed</b>");
        expect(status.querySelector("b")).to.equal(null);
        expect(status.classList.contains("export-panel__status--error")).to.be
          .true;
      });

      it("enables and disables the Save button", () => {
        panel.setSaveEnabled(false);
        expect(panel.getSaveButton().disabled).to.be.true;
        panel.setSaveEnabled(true);
        expect(panel.getSaveButton().disabled).to.be.false;
      });
    });

    describe("MapExportController", () => {
      let widget;
      let rootEl;
      let exporter;
      let download;
      let controller;

      const makeController = (options = {}) => {
        controller = new MapExportController({
          model,
          toolbar,
          widget,
          rootEl,
          exporter,
          downloadBlob: download,
          ...options,
        });
        return controller;
      };

      beforeEach(() => {
        widget = makeWidget();
        rootEl = document.createElement("div");
        document.body.appendChild(rootEl);
        document.body.appendChild(widget.el);
        exporter = {
          exportMap: sinon
            .stub()
            .resolves({ blob: new Blob(["png"]), settled: true }),
        };
        download = sinon.spy();
        makeController();
      });

      afterEach(() => {
        controller.onClose();
        rootEl.remove();
        widget.el.remove();
      });

      it("is idle until the export section is pinned", () => {
        expect(controller.isActive()).to.be.false;
        expect(widget.enterTopDownMode.callCount).to.equal(0);
      });

      it("enters export mode when the section is pinned", () => {
        toolbar.pinSection("export");
        expect(controller.state).to.equal("active");
        expect(rootEl.classList.contains("map-view--export-mode")).to.be.true;
        expect(widget.enterTopDownMode.callCount).to.equal(1);
        expect(widget.el.querySelector(".map-export-overlay")).to.not.equal(
          null,
        );
        expect(controller.getFrame().width).to.be.above(0);
      });

      it("leaves export mode on Escape", () => {
        toolbar.pinSection("export");
        pressEscape();
        expect(controller.state).to.equal("idle");
        expect(rootEl.classList.contains("map-view--export-mode")).to.be.false;
        expect(widget.exitTopDownMode.callCount).to.equal(1);
        expect(widget.el.querySelector(".map-export-overlay")).to.equal(null);
        expect(toolbar.getSectionByKey("export").pinned).to.be.false;
      });

      it("leaves export mode when the panel's Cancel button is clicked", () => {
        toolbar.pinSection("export");
        toolbar
          .getSectionByKey("export")
          .sectionView.el.querySelector("[data-action='cancel']")
          .click();
        expect(controller.state).to.equal("idle");
        expect(toolbar.getSectionByKey("export").pinned).to.be.false;
      });

      it("stops responding to Escape after it has exited", () => {
        toolbar.pinSection("export");
        pressEscape();
        toolbar.pinSection("export");
        expect(controller.state).to.equal("active");
        pressEscape();
        expect(widget.exitTopDownMode.callCount).to.equal(2);
      });

      it("does not save when the frame is too small", async () => {
        widget = makeWidget(300, 200);
        controller.onClose();
        makeController();
        toolbar.pinSection("export");
        const panel = toolbar.getSectionByKey("export").sectionView;
        expect(panel.getSaveButton().disabled).to.be.true;
        await controller.save();
        expect(exporter.exportMap.callCount).to.equal(0);
        expect(controller.state).to.equal("active");
      });

      it("downloads the image and leaves export mode after a successful save", async () => {
        toolbar.pinSection("export");
        await controller.save();
        expect(exporter.exportMap.callCount).to.equal(1);
        const args = exporter.exportMap.firstCall.args[0];
        expect(args.widget).to.equal(widget);
        expect(args.frame.width).to.be.above(0);
        expect(args.entries).to.be.an("array");
        expect(args.citations).to.be.an("array");
        expect(download.callCount).to.equal(1);
        expect(download.firstCall.args[0]).to.be.instanceof(Blob);
        expect(download.firstCall.args[1]).to.match(/^map-export-.*\.png$/);
        expect(controller.state).to.equal("idle");
        expect(toolbar.getSectionByKey("export").pinned).to.be.false;
      });

      it("locks the map and the toolbar while the image is created", async () => {
        let finish;
        exporter.exportMap.returns(
          new Promise((resolve) => {
            finish = resolve;
          }),
        );
        toolbar.pinSection("export");
        const saving = controller.save();
        expect(controller.state).to.equal("capturing");
        expect(widget.setCameraInputsEnabled.calledWith(false)).to.be.true;
        expect(toolbar.linksContainer.hasAttribute("inert")).to.be.true;
        expect(
          toolbar.getSectionByKey("layers").contentEl.hasAttribute("inert"),
        ).to.be.true;
        expect(
          toolbar.getSectionByKey("export").contentEl.hasAttribute("inert"),
        ).to.be.false;
        expect(
          widget.el.querySelector(".map-export-overlay__mask").hidden,
        ).to.be.false;

        finish({ blob: new Blob(["png"]), settled: true });
        await saving;
        expect(toolbar.linksContainer.hasAttribute("inert")).to.be.false;
      });

      it("cancels only the capture when Cancel is clicked during the capture", async () => {
        exporter.exportMap.callsFake(
          ({ signal }) =>
            new Promise((resolve, reject) => {
              signal.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            }),
        );
        toolbar.pinSection("export");
        const saving = controller.save();
        toolbar
          .getSectionByKey("export")
          .sectionView.el.querySelector("[data-action='cancel']")
          .click();
        await saving;
        expect(controller.state).to.equal("active");
        expect(download.callCount).to.equal(0);
        expect(toolbar.linksContainer.hasAttribute("inert")).to.be.false;
        expect(
          widget.el.querySelector(".map-export-overlay__mask").hidden,
        ).to.be.true;
        expect(widget.setCameraInputsEnabled.calledWith(true)).to.be.true;
      });

      it("cancels the capture with the mask's Cancel button, then Escape leaves export mode", async () => {
        exporter.exportMap.callsFake(
          ({ signal }) =>
            new Promise((resolve, reject) => {
              signal.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            }),
        );
        toolbar.pinSection("export");
        const saving = controller.save();
        widget.el
          .querySelector(".map-export-overlay__mask [data-action='cancel']")
          .click();
        await saving;
        expect(controller.state).to.equal("active");
        pressEscape();
        expect(controller.state).to.equal("idle");
      });

      it("stays in export mode and shows a message when the export fails", async () => {
        const consoleError = sinon.stub(console, "error");
        try {
          exporter.exportMap.rejects(new Error("boom"));
          toolbar.pinSection("export");
          await controller.save();
          await tick();
          expect(controller.state).to.equal("active");
          expect(download.callCount).to.equal(0);
          const status = toolbar
            .getSectionByKey("export")
            .sectionView.getPart("status");
          expect(status.textContent).to.not.equal("");
          expect(status.classList.contains("export-panel__status--error")).to.be
            .true;
        } finally {
          consoleError.restore();
        }
      });
    });

    describe("ExportOverlayView", () => {
      it("positions the frame outline and the preview", () => {
        const widget = makeWidget();
        const overlay = new ExportOverlayView({ model, widget });
        overlay.render();
        overlay.setFrame({ left: 20, top: 12, width: 500, height: 300 });
        const outline = overlay.el.querySelector(".map-export-overlay__frame");
        expect(outline.style.left).to.equal("20px");
        expect(outline.style.width).to.equal("500px");
        expect(overlay.canvas.style.height).to.equal("300px");
        overlay.onClose();
      });

      it("shows and hides the mask", () => {
        const overlay = new ExportOverlayView({ model, widget: makeWidget() });
        overlay.render();
        expect(overlay.maskEl.hidden).to.be.true;
        overlay.showMask("Working");
        expect(overlay.maskEl.hidden).to.be.false;
        expect(overlay.maskEl.textContent).to.contain("Working");
        overlay.hideMask();
        expect(overlay.maskEl.hidden).to.be.true;
        overlay.onClose();
      });

      it("reports a missing scale bar", () => {
        const widget = makeWidget();
        widget.getExportViewInfo = () => ({
          metersPerPixel: null,
          northRotation: 0,
        });
        const overlay = new ExportOverlayView({ model, widget });
        overlay.render();
        const summary = sinon.spy();
        overlay.on("summary", summary);
        overlay.setFrame({ left: 0, top: 0, width: 500, height: 300 });
        expect(overlay.summary.scaleBarShown).to.be.false;
        expect(summary.callCount).to.be.above(0);
        overlay.onClose();
      });
    });
  });
});
