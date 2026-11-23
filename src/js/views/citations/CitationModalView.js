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
    icon: "icon",
    iconOnLeft: "icon-on-left",
    copyInput: "copy",
    checkIcon: "icon-ok",
    success: "success",
  };
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
       * Render the copy button's icon and text.
       * @param {object} options Button contents
       * @param {string} options.icon Icon class names
       * @param {string} options.text Button label
       * @returns {string} The button's inner HTML
       */
      innerButtonTemplate({ icon, text }) {
        return `<i class='${CLASS_NAMES.icon} ${icon ?? ""} ${CLASS_NAMES.iconOnLeft}'></i> ${text ?? ""}`;
      },

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
        const button = this.copyButton;
        if (!button) return;

        // Create a copy citation button
        const clipboard = new Clipboard(button);
        clipboard.on("success", () => {
          button.style.width = getComputedStyle(button).width;
          button.innerHTML = this.buttonSuccessInnerHTML;
          button.classList.add(CLASS_NAMES.success);
          setTimeout(() => {
            button.innerHTML = this.buttonInnerHTML;
            button.classList.remove(CLASS_NAMES.success);
            button.style.width = "auto";
          }, 500);
        });
        clipboard.on("error", () => {
          let input = button.previousElementSibling;
          if (!input?.matches(`textarea.${CLASS_NAMES.copyInput}`)) {
            input = document.createElement("textarea");
            input.rows = 1;
            input.className = CLASS_NAMES.copyInput;
            input.style.width = "0";
            $(input).tooltip({
              title: COPY_HINT,
              placement: "top",
            });
            button.before(input);
          }
          input.value =
            button.dataset.clipboardText ||
            this.citationContainer?.innerText ||
            "";
          const $input = $(input);
          $input.animate({ width: "100px" }, "slow", () => {
            input.focus();
            input.select();
            $input.tooltip("show");
          });
          input.addEventListener(
            "focusout",
            () => {
              $input.animate({ width: "0px" }, () => {
                $input.remove();
              });
            },
            { once: true },
          );
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
