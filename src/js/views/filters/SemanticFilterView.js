define([
  "jquery",
  "underscore",
  "backbone",
  "models/filters/Filter",
  "views/filters/FilterView",
  "views/searchSelect/AnnotationFilterView",
], function ($, _, Backbone, Filter, FilterView, AnnotationFilterView) {
  "use strict";

  /**
   * @class SemanticFilterView
   * @classdesc Render a specialized view of a single Filter model using the
   *   AnnotationFilterView.
   * @classcategory Views/Filters
   * @extends FilterView
   * @screenshot views/filters/SemanticFilterView.png
   * @since 2.22.0
   */
  var SemanticFilterView = FilterView.extend(
    /** @lends SemanticFilterView.prototype */ {
      /**
       * @inheritdoc
       */
      model: null,

      /**
       * @inheritdoc
       */
      modelClass: Filter,

      className: "filter semantic",

      // Template is an empty function because this view delegates to the
      // AnnotationFilterView. See render() method.
      template: function () {},

      /**
       * Render an instance of a Semantic Filter View.
       *
       * Note that this View doesn't have a template and instead delegates to
       * the AnnotationFilterView which renders a SearchableSelectView which
       * renders an NCBOTree.
       * @since 2.22.0
       */
      render: function () {
        try {
          var templateVars = this.model.toJSON();
          templateVars.id = this.model.cid;

          // Renders the template and inserts the FilterEditorView if the mode is uiBuilder
          FilterView.prototype.render.call(this, templateVars);

          var viewOpts = {
            useSearchableSelect: true,
            placeholderText: templateVars.placeholder,
            inputLabel: null, // Hides label and uses FilterView label
            ontology: this.model.get("ontology"),
            startingRoot: this.model.get("startingRoot"),
          };

          var subView = new AnnotationFilterView(viewOpts);

          this.$el.append(subView.el);
          subView.render();

          var view = this;
          subView.on("annotationSelected", function (event, item) {
            // Get the value of the associated input
            var term = !item || !item.value ? input.val() : item.value;
            var label = !item || !item.filterLabel ? null : item.filterLabel;

            // Set up a label mapping for the term so we can display a
            // human-readable label for it in the UI
            view.setLabelMapping(term, label);

            // Set the value, supports multiple values
            var currentValue = view.model.get("values");
            var newValuesArray = _.flatten(new Array(currentValue, term));
            view.model.set("values", newValuesArray);

            view.defocus();
          });
        } catch (error) {
          console.log(
            "There was an error rendering a SemanticFilterView." +
              " Error details: " +
              error,
          );
        }
      },

      /**
       * Helper function which defocuses the dropdown portion of the
       * SearchableSelectView used by this View's AnnotationFilterView. When the
       * user clicks an item in the NCBOTree widget, we want the
       * SearchableSelectView's dropdown to go away and I couldn't find any API
       * to do that so we have this code. See the render() method to see how it's
       * called.
       *
       * Note: This isn't really a stable API and is really something we might
       * remove in the future if we refactor the NCBOTree widget.
       * @since 2.22.0
       */
      defocus: function () {
        this.$el.find("div.menu").removeClass("visible").addClass("hidden");
        this.$el
          .find("div.fluid.ui.dropdown")
          .removeClass("active")
          .removeClass("visible");
        this.$el.find("input").blur();
      },

      /**
       * Set the human-readable label for a term URI.
       *
       * For most uses of the Filter model, the value(s) set on the model can
       * be shown directly in the UI. But for Semantic searches, we need to
       * be able to display a human-readable label for the value because the
       * value is likely an opaque URI.
       *
       * Rather than fetch and/or store all the possible labels for all
       * possible URIs, we store a label for whichever terms the user chooses
       * and keep that around until we need it in the UI.
       *
       * @param {string} term The term URI to set a label for
       * @param {string} label The label to set
       * @since 2.22.0
       */
      setLabelMapping: function (term, label) {
        var newMappings;

        if (this.model.get("valueLabels")) {
          newMappings = _.clone(this.model.get("valueLabels"));
        } else {
          newMappings = new Object();
        }

        newMappings[term] = label;
        this.model.set("valueLabels", newMappings);
      },
    },
  );

  return SemanticFilterView;
});
