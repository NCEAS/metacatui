"use strict";

define(["jquery", "backbone", "models/SolrResult", "common/UrlUtilities"], (
  $,
  Backbone,
  SolrResult,
  UrlUtilities,
) => {
  /**
   * @class DownloadButtonView
   * @classdesc A Backbone View for rendering a download button for one object
   * @classcategory Views
   * @augments Backbone.View
   */
  const DownloadButtonView = Backbone.View.extend(
    /** @lends DownloadButtonView.prototype */ {
      /**
       * The HTML tag name for this view's root element.
       * @type {string}
       */
      tagName: "a",

      /**
       * The CSS class name(s) for this view's root element.
       * @type {string}
       */
      className: "btn download",

      /**
       * Initializes the view with options.
       * @param {object} [options] The options for the view
       * @param {Backbone.Model} [options.model] The model associated with this
       * button
       */
      initialize(options = {}) {
        this.model = options.model || new SolrResult();
      },

      /**
       * The DOM events bound to this view.
       * @type {object}
       */
      events: {
        click: "download",
      },

      /**
       * Renders the download button. Adds attributes, styles, and event listeners
       * based on the model and context.
       * @returns {DownloadButtonView} The view instance
       */
      render() {
        const { model } = this;

        let fileName =
          model.get("fileName") || model.get("title") || model.get("id") || "";
        if (typeof fileName === "string") fileName = fileName.trim();

        const id = model.get("id");
        const hrefLink = id
          ? model.get("url") ||
            UrlUtilities.getObjectDownloadUrl(id, {
              baseUrl:
                MetacatUI.appModel.get("objectServiceUrl") ||
                MetacatUI.appModel.get("resolveServiceUrl") ||
                "",
            })
          : "";
        this.$el
          .attr("href", hrefLink)
          .attr("data-id", model.get("id"))
          .attr("download", fileName)
          .text("Download")
          .append(
            $(document.createElement("i")).addClass("icon icon-cloud-download"),
          );

        // For CORS downloads the `download` attribute may be ignored, so open
        // cross-origin links in a new tab.
        if (hrefLink && hrefLink.indexOf(window.location.origin) === -1) {
          this.$el.attr("target", "_blank");
        }

        return this;
      },

      /**
       * Prevents the download button from being clickable and adds a tooltip
       * with a message explaining why.
       * @param {string} [message] The message to display in the tooltip
       * @since 2.36.2
       */
      inactivate(message = "This file is not available for download.") {
        this.$el.addClass("disabled").attr("disabled", "disabled");
        this.$el.css("cursor", "default");
        this.$el.removeAttr("href");

        this.$el.tooltip({
          trigger: "hover",
          placement: "top",
          delay: 100,
          title: message,
          container: "body",
        });
      },

      /**
       * Handles the download event when the button is clicked. Checks for
       * authentication and public/private access before proceeding.
       * @param {Event} e The click event
       */
      download(e) {
        const isDownloadDisabled =
          this.$el.attr("disabled") === "disabled" || this.$el.is(".disabled");

        // Do nothing if the `disabled` attribute is set. If the download is
        // already in progress, don't try to download again
        if (isDownloadDisabled || this.$el.is(".in-progress")) {
          e.preventDefault();
          return;
        }

        // If the user isn't logged in, let the browser handle the download
        // normally
        if (
          MetacatUI.appUserModel.get("tokenChecked") &&
          !MetacatUI.appUserModel.get("loggedIn")
        ) {
          return;
        }
        // If the authentication hasn't been checked yet, wait for it
        if (!MetacatUI.appUserModel.get("tokenChecked")) {
          e.preventDefault();
          this.listenToOnce(MetacatUI.appUserModel, "change:tokenChecked", () =>
            this.el.click(),
          );
          return;
        }
        // If the user is logged in but the object is public, download normally.
        if (this.model.get("isPublic")) {
          return;
        }

        e.preventDefault();

        // Show that the download has started
        this.$el.addClass("in-progress");
        const buttonHTML = this.$el.html();
        this.$el.html(
          "Downloading... <i class='icon icon-on-right icon-spinner icon-spin'></i>",
        );

        this.listenToOnce(this.model, "downloadComplete", () => {
          // Show that the download is complete
          this.$el
            .html("<i class='icon icon-on-right icon-ok'></i>Complete ")
            .addClass("complete")
            .removeClass("in-progress error");

          // Put the download button back to normal
          setTimeout(() => {
            // After one second, change the background color with an animation
            this.$el.removeClass("complete").html(buttonHTML);
          }, 2000);
        });

        this.listenToOnce(this.model, "downloadError", () => {
          // Show that the download failed to complete.
          this.$el
            .html("<i class='icon icon-on-right icon-warning-sign'></i>Error ")
            .addClass("error")
            .removeClass("in-progress")
            .tooltip({
              trigger: "hover",
              placement: "top",
              title:
                "Something went wrong while trying to download. Click to try again.",
            });
        });

        // Fire the download event via the SolrResult model
        this.model.downloadWithCredentials();
      },
    },
  );

  return DownloadButtonView;
});
