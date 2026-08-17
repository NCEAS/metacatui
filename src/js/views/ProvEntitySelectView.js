define(["underscore", "backbone", "text!templates/provEntitySelect.html"], (
  _,
  Backbone,
  provEntitySelectTemplate,
) => {
  "use strict";

  /**
   * Obtain a list of provenance entities from the DataPackage and display to
   * the user for selection. The selected package members will be added to the
   * provenance of the package member being edited.
   * @class ProvEntitySelectView
   * @classdesc Selects package members for a provenance relationship
   * @classcategory Views
   * @augments Backbone.View
   * @screenshot views/ProvEntitySelectView.png
   */
  const ProvEntitySelectView = Backbone.View.extend({
    /**
     * Initialize the provenance member picker.
     * @param {object} options View options
     * @param {string} [options.title] Dialog title
     * @param {string} [options.selectLabel] Selection field label
     * @param {string} [options.selectEntityType] Either data or program
     * @param {ProvenanceChartAdapter} options.projection Chart projection
     * @param {object} options.context Package member being edited
     * @param {Set<string>} [options.excludedPids] Identifiers to exclude
     * @param {number} [options.displayRows] Visible selection rows
     * @param {HTMLElement|JQuery|string} [options.additionalElements]
     * Additional dialog content
     * @returns {void}
     */
    initialize(options = {}) {
      this.title = options.title || "Add provenance";
      this.selectLabel =
        options.selectLabel || "Choose from the files in this dataset";
      this.selectEntityType = options.selectEntityType || "data";
      this.projection = options.projection || null;
      this.context = options.context || null;
      this.excludedPids = options.excludedPids || new Set();
      this.displayRows = options.displayRows || 0;
      this.additionalElements = options.additionalElements || "";
    },

    /** @inheritdoc */
    tagName: "div",

    /** @inheritdoc */
    className: "prov-entity-select",

    /** @inheritdoc */
    template: _.template(provEntitySelectTemplate),

    /**
     * Render selectable package members for the requested entity type.
     * @returns {ProvEntitySelectView} This view
     */
    render() {
      // Remove the current package member from the list of prov entities to select
      // and exclude metadata or resource records.
      let members = (this.projection?.records || []).filter(
        (item) =>
          item.pid !== this.context.pid &&
          !this.excludedPids.has(item.pid) &&
          item.type !== "metadata" &&
          item.type !== "resource",
      );

      if (this.selectEntityType === "program") {
        // Existing programs and unused files can be selected as programs.
        members = members.filter(
          (item) =>
            item.type === "program" ||
            this.projection.getStatements(item.pid).length === 0,
        );
      } else if (this.selectEntityType === "data") {
        members = members.filter((item) => item.type !== "program");
      }

      // Set the number of items to display in the select list
      if (this.displayRows === 0) {
        this.displayRows = Math.min(10, members.length);
      }

      this.$el.html(
        this.template({
          title: this.title,
          selectLabel: this.selectLabel,
          selectMode: this.selectEntityType === "program" ? "" : "multiple",
          members,
          displayRows: this.displayRows,
        }),
      );

      if (this.additionalElements) {
        this.$(".modal-body").prepend(this.additionalElements);
      }

      return this;
    },

    /**
     * Read the identifiers selected in the dialog.
     * @returns {string[]} Selected object identifiers
     */
    readSelected() {
      return this.$("#select-prov-entity option:selected")
        .map((_index, option) => option.value)
        .get();
    },

    /**
     * Remove the picker from the DOM.
     * @returns {void}
     */
    onClose() {
      this.remove();
      this.unbind();
    },
  });

  return ProvEntitySelectView;
});
