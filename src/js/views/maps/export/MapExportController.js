"use strict";

define([
  "underscore",
  "backbone",
  "views/maps/export/constants",
  "views/maps/export/canvas/layout/FrameLayout",
  "views/maps/export/canvas/MapExporter",
  "views/maps/export/ExportOverlayView",
], (_, Backbone, constants, FrameLayout, MapExporter, ExportOverlayView) => {
  const EXPORT_MODE_CLASS = "map-view--export-mode";
  const SECTION_KEY = "export";

  const MESSAGES = {
    tooSmall:
      "The map area is too small to export. Make the window larger or close other panels.",
    overflow: (count) =>
      count === 1
        ? "1 layer did not fit in the legend. It will be listed below the map."
        : `${count} layers did not fit in the legend. They will be listed below the map.`,
    noScale:
      "The scale bar will be left out, because the scale cannot be determined for this view.",
    reduced:
      "The resolution will be reduced to fit within this device's memory limits.",
    loading: "Loading map data\u2026",
    rendering: "Creating the image\u2026",
    canceled: "Export canceled.",
    failed:
      "The map could not be exported. Try zooming out, or making the window smaller, then try again.",
  };

  /**
   * Creates a file name like "map-export-20250131-142501.png".
   * @param {Date} [date] The date to use.
   * @returns {string} The file name.
   */
  function makeFileName(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `map-export-${day}-${time}.png`;
  }

  /**
   * Downloads a blob as a file.
   * @param {Blob} blob The blob.
   * @param {string} fileName The file name.
   */
  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /**
   * @param {object} frame A frame, with a `width` and `height`.
   * @returns {boolean} True when the frame is too small to export.
   */
  function isTooSmall(frame) {
    return (
      frame.width < constants.EXPORT_MIN_FRAME_PX ||
      frame.height < constants.EXPORT_MIN_FRAME_PX / 2
    );
  }

  /**
   * @class MapExportController
   * @classdesc Runs the "Export Map" tool. When the toolbar's export section is
   * pinned, it puts the map in export mode: the camera is locked to a top-down
   * view, a dashed frame and a preview of the legend, scale bar and north arrow
   * are shown over the map, and the other toolbar panels are replaced by the
   * export panel. It then creates the PNG when the user clicks Save. Export mode
   * ends on Escape, Cancel, the close button or a successful save.
   *
   * States: "idle" (not exporting), "active" (the user is positioning the map)
   * and "capturing" (the image is being created; the map and the toolbar are
   * locked, and Cancel or Escape aborts).
   * @classcategory Views/Maps
   * @name MapExportController
   * @since 2.41.0
   */
  class MapExportController {
    /**
     * @param {object} options Options.
     * @param {Map} options.model The Map model.
     * @param {ToolbarView} options.toolbar The rendered toolbar, which must
     * have an export section.
     * @param {CesiumWidgetView} options.widget The map widget.
     * @param {HTMLElement} options.rootEl The map view's element, which gets
     * the export mode class.
     * @param {object} [options.exporter] Replaces `MapExporter`, for testing.
     * @param {function(Blob, string): void} [options.downloadBlob] Replaces
     * the function that downloads the image, for testing.
     */
    constructor(options) {
      this.model = options.model;
      this.toolbar = options.toolbar;
      this.widget = options.widget;
      this.rootEl = options.rootEl;
      this.exporter = options.exporter || MapExporter;
      this.downloadBlob = options.downloadBlob || downloadBlob;
      this.state = "idle";
      this.overlay = null;
      this.frame = null;
      this.abortController = null;

      this.panel = this.toolbar.getSectionByKey(SECTION_KEY)?.sectionView;

      this.handleKeydown = (event) => {
        if (event.key === "Escape") this.cancel();
      };
      this.handleResize = _.debounce(() => this.updateFrame(), 100);

      this.listenTo(this.toolbar, "toolbar:sectionPinned", (key) => {
        if (key === SECTION_KEY) this.enter();
      });
      this.listenTo(this.toolbar, "toolbar:sectionReleased", (key) => {
        if (key === SECTION_KEY) this.exit();
      });
      if (this.panel) {
        this.listenTo(this.panel, "save", this.save);
        this.listenTo(this.panel, "cancel", this.cancel);
      }
    }

    /**
     * @returns {boolean} True when the map is in export mode.
     */
    isActive() {
      return this.state !== "idle";
    }

    /**
     * Put the map in export mode.
     */
    enter() {
      if (this.state !== "idle" || !this.widget?.scene) return;
      this.state = "active";
      this.rootEl.classList.add(EXPORT_MODE_CLASS);
      this.widget.enterTopDownMode();

      this.overlay = new ExportOverlayView({
        model: this.model,
        widget: this.widget,
      });
      this.overlay.render();
      this.widget.el.appendChild(this.overlay.el);
      this.listenTo(this.overlay, "summary", () => this.updatePanel());
      this.listenTo(this.overlay, "cancel", this.cancel);

      document.addEventListener("keydown", this.handleKeydown);
      window.addEventListener("resize", this.handleResize);
      if (typeof ResizeObserver === "function") {
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.widget.el);
        if (this.toolbar.contentContainer) {
          this.resizeObserver.observe(this.toolbar.contentContainer);
        }
      }

      this.panel?.setStatus("");
      this.updateFrame();
      this.overlay.refreshContent();
      this.overlay.start();
      this.trigger("export:start");
    }

    /**
     * Take the map out of export mode, and release the toolbar section.
     */
    exit() {
      if (this.state === "idle") return;
      this.abortController?.abort();
      this.abortController = null;
      this.state = "idle";

      document.removeEventListener("keydown", this.handleKeydown);
      window.removeEventListener("resize", this.handleResize);
      this.handleResize.cancel?.();
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;

      if (this.overlay) {
        this.stopListening(this.overlay);
        this.overlay.onClose();
        this.overlay = null;
      }
      this.setInert(false);
      this.widget.setCameraInputsEnabled(true);
      this.widget.exitTopDownMode();
      this.rootEl.classList.remove(EXPORT_MODE_CLASS);
      this.panel?.setStatus("");
      this.toolbar.releaseSection(SECTION_KEY);
      this.widget.scene?.requestRender();
      this.trigger("export:end");
    }

    /**
     * Escape, Cancel or the close button. Aborts the image if one is being
     * created, and otherwise leaves export mode.
     */
    cancel() {
      if (this.state === "capturing") {
        this.abortController?.abort();
      } else {
        this.exit();
      }
    }

    /**
     * Find the part of the map that is not covered by the toolbar.
     * @returns {{left: number, top: number, width: number, height: number}}
     * The frame, in CSS pixels relative to the map's top left corner.
     */
    getFrame() {
      const canvasRect = this.widget.scene.canvas.getBoundingClientRect();
      const sidebar = this.toolbar.contentContainer;
      const sidebarRect = sidebar?.offsetParent
        ? sidebar.getBoundingClientRect()
        : null;
      return FrameLayout.computeFrameRect(sidebarRect, canvasRect);
    }

    /**
     * Recompute the frame, e.g. after the window was resized.
     */
    updateFrame() {
      if (!this.overlay) return;
      this.frame = this.getFrame();
      this.overlay.setFrame(this.frame);
      this.updatePanel();
    }

    /**
     * Update the export panel with the image size, and with anything the user
     * should know about.
     */
    updatePanel() {
      if (!this.panel || !this.overlay || !this.frame) return;
      if (this.state === "capturing") return;
      const { canvas } = this.widget.scene;
      const summary = this.overlay.summary || {};
      const tooSmall = isTooSmall(this.frame);
      const resolution = FrameLayout.computeResolutionScale({
        desired: constants.EXPORT_RESOLUTION_MULTIPLIER,
        baseRatio: this.widget.getPixelRatio(),
        container: { width: canvas.clientWidth, height: canvas.clientHeight },
        frame: this.frame,
        extraHeight: summary.extraHeight || 0,
        limits: this.widget.getRenderLimits(),
      });

      const notices = [];
      if (tooSmall) notices.push(MESSAGES.tooSmall);
      if (summary.overflowCount) {
        notices.push(MESSAGES.overflow(summary.overflowCount));
      }
      if (summary.scaleBarShown === false) notices.push(MESSAGES.noScale);
      if (resolution.reduced) notices.push(MESSAGES.reduced);

      this.panel.setOutputSize(
        tooSmall
          ? null
          : { width: resolution.outputWidth, height: resolution.outputHeight },
      );
      this.panel.setNotices(notices);
      this.panel.setSaveEnabled(!tooSmall);
    }

    /**
     * Make the toolbar, other than the export panel, ignore the user.
     * @param {boolean} inert True to block the toolbar.
     */
    setInert(inert) {
      const { toolbar } = this;
      toolbar.linksContainer?.toggleAttribute("inert", inert);
      toolbar.sectionElements.forEach((section) => {
        if (section.key !== SECTION_KEY) {
          section.contentEl?.toggleAttribute("inert", inert);
        }
      });
    }

    /**
     * Create the image and download it. On success, leaves export mode.
     * @returns {Promise<void>} Resolves when the export has finished or has
     * been canceled. Never rejects; errors are shown in the export panel.
     */
    async save() {
      if (this.state !== "active") return;
      const frame = this.getFrame();
      if (isTooSmall(frame)) return;

      this.state = "capturing";
      const abortController = new AbortController();
      this.abortController = abortController;
      const { overlay, panel } = this;

      overlay.stop();
      panel?.setSaveEnabled(false);
      panel?.setStatus(MESSAGES.loading);
      overlay.showMask(MESSAGES.loading);
      this.widget.setCameraInputsEnabled(false);
      this.setInert(true);

      let result = null;
      try {
        const content = overlay.getContent();
        result = await this.exporter.exportMap({
          widget: this.widget,
          frame,
          entries: content.entries,
          citations: content.citations,
          signal: abortController.signal,
          onStatus: (status) => {
            const message =
              status === "rendering" ? MESSAGES.rendering : MESSAGES.loading;
            overlay.showMask(message);
            panel?.setStatus(message);
          },
        });
        if (abortController.signal.aborted) result = null;
      } catch (error) {
        if (error?.name === "AbortError") {
          panel?.setStatus(MESSAGES.canceled);
        } else {
          // eslint-disable-next-line no-console
          console.error("Failed to export the map.", error);
          panel?.setStatus(MESSAGES.failed, { isError: true });
        }
      }

      // The user may have left export mode while the image was being created.
      if (this.state !== "capturing" || this.abortController !== abortController) {
        return;
      }
      this.abortController = null;
      this.state = "active";
      overlay.hideMask();
      this.widget.setCameraInputsEnabled(true);
      this.setInert(false);
      overlay.start();

      if (!result) {
        this.updatePanel();
        return;
      }
      if (!result.settled) {
        // eslint-disable-next-line no-console
        console.warn(
          "The map was still loading data when it was exported, so parts of the image may be missing.",
        );
      }
      this.downloadBlob(result.blob, makeFileName());
      // Triggers "export:complete" with the ExportResult.
      this.trigger("export:complete", result);
      this.exit();
    }

    /**
     * Leave export mode and stop listening.
     */
    onClose() {
      this.exit();
      this.stopListening();
    }
  }

  Object.assign(MapExportController.prototype, Backbone.Events);

  return MapExportController;
});
