"use strict";

define(["backbone", `text!${MetacatUI.root}/css/json-editor.css`], (
  Backbone,
  JSONEditorCSS,
) => {
  const BASE_CLASS = "json-editor";
  const CLASS_NAMES = {
    EDITOR: BASE_CLASS,
    LABEL: `${BASE_CLASS}__label`,
    INPUT: `${BASE_CLASS}__input`,
    ERROR: `${BASE_CLASS}__error`,
  };
  const ID_SUFFIXES = { INPUT: "-json", ERROR: "-error" };
  const CSS_KEY = "jsonEditor";

  /**
   * @class JSONEditorView
   * @classdesc Edits JSON values and keeps incomplete drafts.
   * @classcategory Views
   * @augments Backbone.View
   * @since 2.41.0
   * @screenshot views/JSONEditorView.png
   */
  const JSONEditorView = Backbone.View.extend(
    /** @lends JSONEditorView.prototype */ {
      /** @inheritdoc */
      className: CLASS_NAMES.EDITOR,

      /** @inheritdoc */
      events: {
        "input textarea": "updateDraft",
      },

      /**
       * Store the initial JSON as text so caller edits can't change it.
       * @param {object} options View options
       * @param {*} options.value A JSON value
       * @param {string} options.label The visible field label
       */
      initialize(options) {
        this.label = options.label;
        this.draft = JSON.stringify(options.value, null, 2);
        this.baseline = this.draft;
        this.errorMessage = "";
        MetacatUI.appModel.addCSS(JSONEditorCSS, CSS_KEY);
      },

      /**
       * The HTML template for the view.
       * @returns {string} The template string
       */
      template() {
        return `
          <label class="${CLASS_NAMES.LABEL}" for="${this.cid}${ID_SUFFIXES.INPUT}"></label>
          <textarea class="${CLASS_NAMES.INPUT}" id="${this.cid}${ID_SUFFIXES.INPUT}"
            rows="14" wrap="off" spellcheck="false" autocapitalize="off"
            aria-describedby="${this.cid}${ID_SUFFIXES.ERROR}"></textarea>
          <p class="${CLASS_NAMES.ERROR}" id="${this.cid}${ID_SUFFIXES.ERROR}" role="alert"></p>
        `;
      },

      /** @inheritdoc */
      render() {
        this.el.innerHTML = this.template();
        this.el.querySelector("label").textContent = this.label;
        this.textarea = this.el.querySelector("textarea");
        this.errorEl = this.el.querySelector(`.${CLASS_NAMES.ERROR}`);
        this.textarea.value = this.draft;
        this.showError(this.errorMessage);
        return this;
      },

      /**
       * Replace the draft and baseline with an accepted or discarded value.
       * @param {*} value A JSON value
       */
      setValue(value) {
        const wasPending = this.hasPendingChanges();
        this.draft = JSON.stringify(value, null, 2);
        this.baseline = this.draft;
        this.textarea.value = this.draft;
        this.textarea.setSelectionRange(0, 0);
        this.showError("");
        if (wasPending) this.trigger("change:draft", false);
      },

      /**
       * Parse the draft without accepting it. Show syntax errors in the editor.
       * @returns {{value: *, error: string|null}} Parsed value or syntax error
       */
      parse() {
        let value;
        try {
          value = JSON.parse(this.textarea.value);
        } catch (error) {
          this.showError(error.message);
          this.focus();
          return { value: undefined, error: error.message };
        }
        this.showError("");
        return { value, error: null };
      },

      /**
       * Check whether the draft differs from its last accepted value.
       * @returns {boolean} Whether changes are pending
       */
      hasPendingChanges() {
        return this.draft !== this.baseline;
      },

      /**
       * Show syntax errors or caller feedback as text.
       * @param {string} message The error message, or an empty string to clear it
       */
      showError(message) {
        this.errorMessage = message;
        this.errorEl.textContent = message;
        if (message) this.textarea.setAttribute("aria-invalid", "true");
        else this.textarea.removeAttribute("aria-invalid");
      },

      /** Focus the editor without changing its text selection */
      focus() {
        this.textarea.focus();
      },

      /**
       * Update the draft and clear old feedback. Fire change:draft when edits
       * become pending or return to the accepted text.
       * @param {Event} event The input event
       */
      updateDraft(event) {
        const wasPending = this.hasPendingChanges();
        this.draft = event.target.value;
        this.showError("");
        const pending = this.hasPendingChanges();
        if (pending !== wasPending) this.trigger("change:draft", pending);
      },
    },
  );

  return JSONEditorView;
});
