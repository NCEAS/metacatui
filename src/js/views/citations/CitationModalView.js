define([
  "jquery",
  "underscore",
  "backbone",
  "clipboard",
  "models/CitationModel",
  "views/CitationView",
  "text!templates/citations/citationModal.html",
], ($, _, Backbone, Clipboard, Citation, CitationView, Template) => {
  "use strict";

  const CLASS_NAMES = {
    copyInput: "copy",
    checkIcon: "icon-ok",
    success: "success",
  };
  const CLIPBOARD_TEXT_ATTRIBUTE = "data-clipboard-text";
  const COPY_HINT = "Press ctrl+C or command+C to copy";

  /**
   * @class CitationModalView
   * @classdesc A dialog for reading and copying dataset citations.
   * @classcategory Views
   * @augments Backbone.View
   */
  const CitationModalView = Backbone.View.extend(
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
       * @type {Backbone.Model|null}
       */
      model: null,

      /**
       * The citation style to use
       * @type {string}
       * @default "apaAllAuthors"
       * @see {@link CitationView#styles}
       */
      style: "apaAllAuthors",

      /**
       * The events this view will listen for. See
       * {@link https://backbonejs.org/#View-events}
       * @type {object}
       */
      events: {
        hidden: "teardown",
      },

      /**
       * The font awesome icons to use for this view
       * @type {object}
       * @property {string} title The icon to use in the modal title
       * @property {string} button The icon to use in the copy citation button
       * @property {string} buttonSuccess The icon to use in the copy citation
       * button when the citation has been copied
       */
      icons: {
        title: "icon-quote-right",
        button: "icon-copy",
        buttonSuccess: `${CLASS_NAMES.checkIcon} ${CLASS_NAMES.success}`,
      },

      /**
       * The ids to use for this view
       * @type {object}
       * @property {string} citationContainer The id to use for the citation
       * container
       * @property {string} copyButton The id to use for the copy citation
       * button
       */
      ids: {
        citationContainer: "cmv_citation-container",
        copyButton: "cmv_copy-button",
      },

      /**
       * The text to use for this view
       * @type {object}
       * @property {string} title The title to use in the modal
       * @property {string} copyButton The text to use in the copy citation
       * button
       * @property {string} copySuccess The text to use in the copy citation
       * button when the citation has been copied
       */
      text: {
        title: "Cite this Dataset",
        copyButton: "Copy To Clipboard",
        copySuccess: "Copied!",
      },

      /**
       * Set the citation source and style.
       * @param {object} [options] View options
       * @param {Backbone.Model} [options.model] Citation or source metadata
       * @param {string} [options.style] Citation style to use
       */
      initialize(options = {}) {
        this.model = options?.model || new Citation();
        this.style = options?.style || this.style;
      },

      /** @inheritdoc */
      render() {
        // Set listeners
        this.$el.off("shown");
        this.$el.on("shown", this.renderView.bind(this));
        return this;
      },

      /** Fill the dialog and fire `rendered` once the citation is ready */
      renderView() {
        try {
          const { ids } = this;

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
            ids,
            text: this.text,
            buttonInnerHTML: this.buttonInnerHTML,
          });

          // Find the citation container
          this.citationContainer = this.el.querySelector(
            `#${ids.citationContainer}`,
          );

          // Find the citation button
          this.copyButton = this.el.querySelector(`#${ids.copyButton}`);

          this.insertCitation();
          this.listenForCopy();
          this.trigger("rendered");
        } catch {
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
       * Insert a citation before or after the existing citations.
       * @param {Backbone.Model} [model] Citation source (defaults to
       * this.model)
       * @param {boolean} [after] Append by default, or prepend when false
       * @returns {CitationView|null} The inserted view, or null if the dialog
       * has no citation container
       */
      insertCitation(model, after = true) {
        const container = this.citationContainer;
        if (!container) return null;

        // Create a new CitationView
        const citationView = new CitationView({
          model: model || this.model,
          style: this.style,
          createTitleLink: false,
        });

        // Render the CitationView
        const citationEl = citationView.render().el;

        // Insert the CitationView into the modal
        if (after) {
          container.appendChild(citationEl);
        } else {
          container.prepend(citationEl);
        }

        return citationView;
      },

      /** Set up the copy button and its fallback for copying by hand */
      listenForCopy() {
        const view = this;
        const btn = view.copyButton;
        if (!btn) return;

        // Create a copy citation button
        const clipboard = new Clipboard(btn);
        clipboard.on("success", (e) => {
          const originalWidth = $(e.trigger).width();
          $(e.trigger)
            .html(view.buttonSuccessInnerHTML)
            .addClass(CLASS_NAMES.success)
            .css("width", `${originalWidth}px`);
          setTimeout(() => {
            $(e.trigger)
              .html(view.buttonInnerHTML)
              .removeClass(CLASS_NAMES.success)
              .css("width", "auto");
          }, 500);
        });
        clipboard.on("error", (e) => {
          const $button = $(e.trigger);
          let $input = $button.prev(`textarea.${CLASS_NAMES.copyInput}`);
          if (!$input.length) {
            $input = $(document.createElement("textarea"))
              .attr("rows", 1)
              .addClass(CLASS_NAMES.copyInput)
              .css("width", "0");
            $input.tooltip({
              title: COPY_HINT,
              placement: "top",
            });
            $button.before($input);
          }
          const text =
            $button.attr(CLIPBOARD_TEXT_ATTRIBUTE) ||
            view.citationContainer?.innerText;
          $input.val(text || "");
          $input.animate(
            { width: "100px" },
            {
              duration: "slow",
              complete() {
                $input.trigger("focus");
                $input[0].select();
                $input.tooltip("show");
              },
            },
          );
          $input.focusout(() => {
            $input.animate({ width: "0px" }, () => {
              $input.remove();
            });
          });
        });
        this.$(".tooltip-this").tooltip();
      },

      /** Show the citation dialog */
      show() {
        this.$el.modal("show");
      },

      /** Hide the dialog and remove it from the DOM */
      teardown() {
        this.$el.modal("hide");
        this.$el.data("modal", null);
        this.remove();
      },

      /** Remove the citation dialog */
      onClose() {
        this.teardown();
      },
    },
  );

  return CitationModalView;
});
