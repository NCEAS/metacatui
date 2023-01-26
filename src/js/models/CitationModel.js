/* global define */
"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @class Citation
   * @classdesc A Citation Model represents a single Citation Object returned by
   * the metrics-service. A citation model can alternatively be populated with
   * an EML model or a DataONE object model...
   * @classcategory Models
   * @extends Backbone.Model
   * @see https://app.swaggerhub.com/apis/nenuji/data-metrics/1.0.0.3
   */
  var Citation = Backbone.Model.extend({
    
    /**
     * The name of this type of model
     * @type {string}
     */
    type: "CitationModel",

    /**
     * The default Citation fields
     * @name CitationModel#defaults
     * @type {Object}
     * @property {string} origin -  text of authors who published the source
     * dataset / document / article
     * @property {string} title - Title of the source dataset / document /
     * article
     * @property {number} year_of_publishing - Year in which the source dataset
     * / document / article was published
     * @property {string} source_url - URL to the source dataset / document /
     * article
     * @property {string} source_id - Unique identifier to the source dataset /
     * document / article that cited the target dataset
     * @property {string} target_id - Unique identifier to the target DATAONE
     * dataset. This is the dataset that was cited.
     * @property {string} publisher - Publisher for the source dataset /
     * document / article
     * @property {string} journal - The journal where the the document was
     * published
     * @property {number|string} volume - The volume of the journal where the
     * document was published
     * @property {number} page - The page of the journal where the document was
     * published
     * @property {Backbone.Model} citationMetadata - A model containing the
     * metadata (TODO - check this)
     */
    defaults: function () {
      return {
        origin: null,
        title: null,
        year_of_publishing: null,
        source_url: null,
        source_id: null,
        target_id: null,
        publisher: null,
        journal: null,
        volume: null,
        page: null,
        citationMetadata: null,
      };
    },

    // /* Constructs a new instance */
    // initialize: function (attrs, options) {},
  });

  return Citation;
});
