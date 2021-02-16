/* global define */
define(['underscore', 'jquery', 'backbone', 'bioportal',
  'models/metadata/eml211/EMLAnnotation',
  'views/AnnotationView',
  'text!templates/metadata/eml-measurement-type.html',
  'text!templates/metadata/eml-measurement-type-annotations.html'],
  function (_, $, Backbone, BioPortal, EMLAnnotation, AnnotationView, EMLMeasurementTypeTemplate, EMLMeasurementTypeAnnotationsTemplate) {
    var EMLMeasurementTypeView = Backbone.View.extend({

      tagName: "div",
      className: "eml-measurement-type row-fluid",
      template: _.template(EMLMeasurementTypeTemplate),
      annotationsTemplate: _.template(EMLMeasurementTypeAnnotationsTemplate),

      events: {
        "click .nav-tabs a" : "showTab",
        "change input" : "updateModel",
        "click .remove": "handleRemove"
      },

      /**
       * Reference to the parent EMLAttribute model so we can .set/.get the
       * 'annotation' attribute when this view adds or removes annotations
       */
      model: null,

      /**
       * Whether to allow (true) the user to pick more than one value
       */
      multiSelect: false,

      /**
       * The ontology (on BioPortal) to show a tree for
       */
      ontology: "ECSO",

      /**
       * Which term within this.ontology to root the tree at
       */
      startingRoot: "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType",

      /**
       * The label and URI of for the property that goes with terms selected
       * with this interface
       */
      filterLabel: "contains measurements of type",
      filterURI: "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#containsMeasurementsOfType",

      initialize: function (options) {
        this.model = options.model;
      },

      render: function () {
        var viewRef = this;

        // Do an initial render of the view
        this.$el.html(this.template());
        this.renderAnnotations();

        // Set up tree widget
        var tree = this.$(".measurement-type-browse").NCBOTree({
          apikey: MetacatUI.appModel.get("bioportalAPIKey"),
          ontology: this.ontology,
          width: "400",
          startingRoot: this.startingRoot,
          jumpAfterSelect: true,
          selectFromAutocomplete: true
        });

        tree.on("afterSelect", function(event, classId, prefLabel, selectedNode) {
          viewRef.selectConcept.call(viewRef, event, classId, prefLabel, selectedNode)
        });

        tree.init();
      },

      /**
       * Render just the list of annotation in the view
       *
       * Used in both render() to perform the initial render and by
       * selectConcept and handleRemove to update the list as annotations
       * are added and removed
       */
      renderAnnotations: function() {
        var viewRef = this;

        var filtered = _.filter(this.model.get("annotation"), function(annotation) {
          return annotation.get("propertyURI") === viewRef.filterURI;
        });

        var templateData = {
          annotations: _.map(filtered, function(annotation) {
            return {
              propertyLabel: annotation.get("propertyLabel"),
              propertyURI: annotation.get("propertyURI"),
              valueLabel: annotation.get("valueLabel"),
              valueURI: annotation.get("valueURI"),
              contextString: "This is my context string, which needs work."
            }
          })
        };

        this.$(".measurement-type-annotations").html(
          this.annotationsTemplate(templateData)
        );

        // Create AnnotationViews for each Measurement Type so we have nice
        // popovers
        _.each(this.$(".annotation"), function (annoEl) {
          var view = new AnnotationView({ el: annoEl });

          view.render();
        });
      },

      /**
       * Add an annotation when the user selects on in the UI
       *
       * @param {Event} event - The click event handler
       * @param {string} classId - The selected term's URI
       * @param {string} prefLabel - The selected term's prefLabel
       * @param {Element} selectedNode - The clicked element
       */
      selectConcept: function(event, classId, prefLabel, selectedNode) {
        var anno = new EMLAnnotation({
          propertyLabel: this.filterLabel,
          propertyURI: this.filterURI,
          valueLabel: prefLabel,
          valueURI: classId
        });

        if (!this.model.get("annotation")) {
          this.model.set("annotation", []);
        }

        var annotations = this.model.get("annotation");

        // Replace if multiselect is false and we can find another
        // MeasurementType annotation. Pushes otherwise.
        if (!this.multiSelect) {
          var findResult = _.findIndex(this.model.get("annotation"), function(annotation) {
            return annotation.get("propertyURI") === this.filterURI
          }, this);

          if (findResult >= 0) {
            annotations.splice(findResult, 1);
          }
        }
        annotations.push(anno);
        this.model.set("annotation", annotations);
        this.model.trickleUpChange();

        // Force a re-render of the annotations
        this.renderAnnotations();
      },

      /**
       * Handle a click event to remove an annotation
       *
       * This method deletes by value rather than index because multiple
       * views may be managing the state of the annotation attribute for a given
       * EMLAttribute. i.e., the indices might not match when removals are
       * happening in both views.
       *
       * @param {Event} e - A click event handler
       */
      handleRemove: function(e) {
        // First we find the container div for the annotation so we can get
        // the values to match against from data properties
        var annotationEl = $(e.target).parents(".annotation");

        if (!annotationEl) {
          return;
        }

        var valueLabel = $(annotationEl).data("value-label"),
            valueURI = $(annotationEl).data("value-uri");

        if (!valueLabel || !valueURI) {
          return;
        }

        var index = this.findAnnotationIndex(valueLabel, valueURI);

        if (index < 0) {
          return;
        }

        // Remove by index now that we've found the right one
        var existing = this.model.get("annotation");
        existing.splice(index, 1);
        this.model.set("annotation", existing);
        this.model.trickleUpChange();

        // Force a re-render
        this.renderAnnotations();
      },

      /**
       * Find the index of the first annotation that matches the given values
       *
       * @param {string} valueLabel - The valueLabel to look for
       * @param {string} valueURI - The valueURI to look for
       *
       * @return {number} -1 if not found, or the index otherwise
       */
      findAnnotationIndex: function(valueLabel, valueURI) {
        var index = -1;
        var annotations = this.model.get("annotation");

        if (!annotations) {
          return;
        }

        for (var i = 0; i < annotations.length; i++) {
          var anno = annotations[i];

          if (
            anno.get("propertyLabel") == this.filterLabel &&
            anno.get("propertyURI") == this.filterURI &&
            anno.get("valueLabel") == valueLabel &&
            anno.get("valueURI") == valueURI
          ) {
            index = i;

            break;
          }
        }

        return index;
      }
    });

    return EMLMeasurementTypeView;
  });
