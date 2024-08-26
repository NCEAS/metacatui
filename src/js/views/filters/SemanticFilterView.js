"use strict";

define([
  "views/filters/FilterView",
  "views/searchSelect/BioontologySelectView",
], (FilterView, BioontologySelectView) => {
  /**
   * @class SemanticFilterView
   * @classdesc Render a specialized view of a single Filter model using the
   *   AnnotationFilterView.
   * @classcategory Views/Filters
   * @augments FilterView
   * @screenshot views/filters/SemanticFilterView.png
   * @since 2.22.0
   */
  const SemanticFilterView = FilterView.extend(
    /** @lends SemanticFilterView.prototype */ {
      /** @inheritdoc */
      className: "filter semantic",

      /**
       * The ontologies to search for terms in.
       * @type {Array.<{label: string, ontology: string, subTree: string}>}
       * @since 0.0.0
       */
      ontologies: [],

      /** override the template function and use subView instead */
      template() {},

      /**
       * Render an instance of a Semantic Filter View. Note that this View
       * doesn't have a template and instead delegates to the
       * AnnotationFilterView which renders a SearchSelectView which renders the
       * BioontologySelectView.
       * @returns {SemanticFilterView} This instance
       * @since 2.22.0
       */
      render() {
        // Inserts the FilterEditorView if the mode is uiBuilder
        FilterView.prototype.render.call(this);

        this.subView = new BioontologySelectView({
          placeholderText: this.model.get("placeholder"),
          inputLabel: null,
          ontologies: this.ontologies,
        }).render();
        this.el.appendChild(this.subView.el);
        this.listenTo(
          this.subView.model,
          "change:selected",
          this.onSubViewSelection,
        );
        return this;
      },

      /**
       * Update the filter model when a class is selected in the
       * BioontologySelectView. Clear the selection/search input from the
       * SelectView and collapse the menu.
       * @since 0.0.0
       */
      onSubViewSelection() {
        const view = this;
        requestAnimationFrame(() => {
          const selected = view.subView.model.getSelectedModels()?.[0];
          if (!selected) return;

          const value = selected.get("value");
          const label = selected.get("label") || value;
          const description = selected.get("description") || "";

          view.setLabelMapping(value, label);
          view.model.set("description", description);
          const newValuesArray = [...view.model.get("values"), value];
          view.model.set("values", newValuesArray);
          view.subView.reset(true);
        });
      },

      /**
       * Set the human-readable label for a term URI.
       * For most uses of the Filter model, the value(s) set on the model can
       * be shown directly in the UI. But for Semantic searches, we need to
       * be able to display a human-readable label for the value because the
       * value is likely an opaque URI.
       * Rather than fetch and/or store all the possible labels for all
       * possible URIs, we store a label for whichever terms the user chooses
       * and keep that around until we need it in the UI.
       * @param {string} term The term URI to set a label for
       * @param {string} label The label to set
       * @since 2.22.0
       */
      setLabelMapping(term, label) {
        const newMappings = { ...(this.model.get("valueLabels") || {}) };
        newMappings[term] = label;
        this.model.set("valueLabels", newMappings);
      },
    },
  );

  return SemanticFilterView;
});
