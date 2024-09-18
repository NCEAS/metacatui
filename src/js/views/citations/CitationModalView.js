define([
  "jquery",
  "underscore",
  "backbone",
  "clipboard",
  "models/CitationModel",
  "views/CitationView",
  "text!templates/citations/citationModal.html",
], function ($, _, Backbone, Clipboard, Citation, CitationView, Template) {
  "use strict";

  /**
   * @class CitationModalView
   * @classdesc The CitationModalView shows a citation information displayed as
   * a modal, along with a copy citation button. This view will eventually allow
   * switching between different citation styles.
   * @classcategory Views
   * @extends Backbone.View
   */
  var CitationModalView = Backbone.View.extend(
    /** @lends CitationModalView.prototype */ {
      /**
       * Classes to add to the modal
       * @type {string}
       */
      className: "modal fade hide",

      /**
       * The underscore template for the main part of this view (modal)
       * @type {Underscore.Template}
       */
      template: _.template(Template),

      /**
       * The underscore template for the copy citation button. This will render
       * the inner HTML for the button, which will be added to the template and
       * also used to update the button when the citation is copied.
       * @type {Underscore.Template}
       */
      innerButtonTemplate: _.template(
        "<i class='icon <%=icon%> icon-on-left'></i> <%=text%>",
      ),

      /**
       * The citation model that contains the citation data
       * @type {CitationModel}
       */
      model: null,

      /**
       * The citation style to use
       * @type {string}
       * @default "apa"
       * @see {@link CitationView#styles}
       */
      style: "apaAllAuthors",

      /**
       * The events this view will listen for. See
       * {@link https://backbonejs.org/#View-events}
       * @type {Object}
       */
      events: {
        hidden: "teardown",
      },

      /**
       * The font awesome icons to use for this view
       * @type {Object}
       * @property {string} title - The icon to use in the modal title
       * @property {string} button - The icon to use in the copy citation button
       * @property {string} buttonSuccess - The icon to use in the copy citation
       * button when the citation has been copied
       */
      icons: {
        title: "icon-quote-right",
        button: "icon-copy",
        buttonSuccess: "icon-ok success",
      },

      /**
       * The ids to use for this view
       * @type {Object}
       * @property {string} citationContainer - The id to use for the citation
       * container
       * @property {string} copyButton - The id to use for the copy citation
       * button
       */
      ids: {
        citationContainer: "cmv_citation-container",
        copyButton: "cmv_copy-button",
      },

      /**
       * The text to use for this view
       * @type {Object}
       * @property {string} title - The title to use in the modal
       * @property {string} copyButton - The text to use in the copy citation
       * button
       * @property {string} copySuccess - The text to use in the copy citation
       * button when the citation has been copied
       */
      text: {
        title: "Cite this Dataset",
        copyButton: "Copy To Clipboard",
        copySuccess: "Copied!",
      },

      /**
       * Initialize a new CitationModalView
       * @param {Object} options - A literal object with options to pass to the
       * view
       * @param {CitationModel} options.model - The citation model, or other
       * model accepted by the CitationView, that contains the citation data
       * @param {string} options.style - The citation style to use. This will be
       * passed to the CitationView
       */
      initialize: function (options) {
        if (typeof options === "undefined") {
          var options = {};
        }

        this.model = options.model || new Citation();
        this.style = options.style || this.style;
      },

      /**
       * Render the view
       */
      render: function () {
        // Set listeners
        this.$el.off("shown");
        this.$el.on("shown", this.renderView.bind(this));
        this.show();
        return this;
      },

      /**
       * Render the view
       * @returns {CitationModalView} - Returns this view
       */
      renderView: function () {
        try {
          const ids = this.ids;

          // Make the inner HTML for the copy button. This will be added in the
          // template and after the button has been clicked and the citation has
          // been copied
          this.buttonInnerHTML = this.innerButtonTemplate({
            icon: this.icons.button,
            text: this.text.copyButton,
          });

          // Make the inner HTML for the copy button when the citation has been
          // copied
          this.buttonSuccessInnerHTML = this.innerButtonTemplate({
            icon: this.icons.buttonSuccess,
            text: this.text.copySuccess,
          });

          // Render the modal
          this.el.innerHTML = this.template({
            icons: this.icons,
            ids: ids,
            text: this.text,
            buttonInnerHTML: this.buttonInnerHTML,
          });

          // Find the citation container
          this.citationContainer = this.el.querySelector(
            "#" + ids.citationContainer,
          );

          // Find the citation button
          this.copyButton = this.el.querySelector("#" + ids.copyButton);

          this.insertCitation();
          this.listenForCopy();
        } catch (e) {
          console.error("Failed to render the Citation Modal View: ", e);
          MetacatUI.appView.showAlert({
            message: `Something went wrong displaying the citation for this dataset.`,
            classes: "alert-info",
            container: this.$el,
            replaceContents: true,
            includeEmail: true,
          });
        } finally {
          this.$el.modal({ show: false }); // don't show modal on instantiation
        }
      },

      /**
       * Insert the citation view into the modal
       */
      insertCitation: function () {
        const container = this.citationContainer;
        if (!container) return;

        // Create a new CitationView
        var citationView = new CitationView({
          model: this.model,
          style: this.style,
          createTitleLink: false,
        });

        // Render the CitationView
        citationView.render();

        // Insert the CitationView into the modal
        container.appendChild(citationView.el);
      },

      /**
       * Listen for the copy button to be clicked, and copy the citation to the
       * clipboard
       */
      listenForCopy: function () {
        const view = this;
        const btn = view.copyButton;
        if (!btn) return;

        //Create a copy citation button
        var clipboard = new Clipboard(btn);
        clipboard.on("success", function (e) {
          var originalWidth = $(e.trigger).width();
          $(e.trigger)
            .html(view.buttonSuccessInnerHTML)
            .addClass("success")
            .css("width", originalWidth + "px");
          setTimeout(function () {
            $(e.trigger)
              .html(view.buttonInnerHTML)
              .removeClass("success")
              .css("width", "auto");
          }, 500);
        });
        clipboard.on("error", function (e) {
          if (!$(e.trigger).prev("input.copy").length) {
            var textarea = $(document.createElement("input"))
              .val($(e.trigger).attr("data-clipboard-text"))
              .addClass("copy")
              .css("width", "0");
            textarea.tooltip({
              title: "Press ctrl+C or command+C to copy",
              placement: "top",
            });
            $(e.trigger).before(textarea);
          } else {
            var textarea = $(e.trigger).prev("input.copy");
          }
          textarea.animate(
            { width: "100px" },
            {
              duration: "slow",
              complete: function () {
                textarea.trigger("focus");
                textarea.tooltip("show");
              },
            },
          );
          textarea.focusout(function () {
            textarea.animate({ width: "0px" }, function () {
              textarea.remove();
            });
          });
        });
        this.$(".tooltip-this").tooltip();
      },

      /**
       * Make the modal visible
       */
      show: function () {
        this.$el.modal("show");
      },

      /**
       * Remove the modal from the DOM
       */
      teardown: function () {
        this.$el.modal("hide");
        this.$el.data("modal", null);
        this.remove();
      },

      /**
       * Cleans up and removes all artifacts created for view
       */
      onClose: function () {
        this.teardown();
      },
    },
  );

  return CitationModalView;
});
