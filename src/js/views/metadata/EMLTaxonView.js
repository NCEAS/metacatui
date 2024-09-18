/*
*
*  ------------ WARNING ---------------
*  This view is not hooked up to the overall app. It is not used anywhere.
*  This view was created as a starting point for refactoring the Taxon section.
*   The Taxon tables in the Editor should have its own views. This was a starting point on that but it is not finished.
   For now the taxon information is all rendered in the EML211View.
*/

define([
  "underscore",
  "jquery",
  "backbone",
  "models/metadata/eml211/EMLTaxonCoverage",
  "text!templates/metadata/taxonomicClassificationTable.html",
  "text!templates/metadata/taxonomicClassificationRow.html",
], function (
  _,
  $,
  Backbone,
  EMLTaxonCoverage,
  TaxonomicClassificationTable,
  TaxonomicClassificationRow,
) {
  var EMLTaxonView = Backbone.Model.extend(
    /** @lends EMLTaxonView.prototype */ {
      className: "row-fluid taxonomic-coverage",

      tagName: "div",

      initialize: function (options) {
        if (!options) var options = {};

        this.isNew = options.isNew || false;
        this.model = options.model || new EMLTaxonCoverage();
      },

      // Creates a table to hold a single EMLTaxonCoverage element (table) for
      // each root-level taxonomicClassification
      render: function (coverage) {
        var finishedEl = $('<div class="row-fluid taxonomic-coverage"></div>');
        $(finishedEl).data({ model: coverage });
        $(finishedEl).attr("data-category", "taxonomic-coverage");

        var classifications = coverage.get("taxonomicClassification");

        // Make a textarea for the generalTaxonomicCoverage
        var generalCoverageEl = $(document.createElement("textarea"))
          .addClass("medium text")
          .attr("data-category", "generalTaxonomicCoverage")
          .text(coverage.get("generalTaxonomicCoverage") || "");

        $(finishedEl).append(
          $(document.createElement("h5")).text("General Taxonomic Coverage"),
        );
        $(finishedEl).append(generalCoverageEl);

        // taxonomicClassifications
        $(finishedEl).append(
          $(document.createElement("h5")).text("Taxonomic Classification(s)"),
        );

        // Makes a table... for the root level
        for (var i = 0; i < classifications.length; i++) {
          $(finishedEl).append(
            this.createTaxonomicClassificationTable(classifications[i]),
          );
        }

        // Create a new, blank table for another taxonomicClassification
        var newTableEl = this.createTaxonomicClassificationTable();

        $(finishedEl).append(newTableEl);

        return finishedEl;
      },
    },
  );

  return EMLTaxonView;
});
