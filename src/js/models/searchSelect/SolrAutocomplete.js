"use strict";

define(["models/searchSelect/SearchSelect", "collections/SolrResults"], (
  SearchSelect,
  SolrResults,
) => {
  /**
   * @class SolrAutocomplete
   * @classdesc An extension of SearchSelect that limits the options to the
   * available values within a given Solr field.
   * @classcategory Models/SearchSelect
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const SolrAutocomplete = SearchSelect.extend({
    /** @lends SolrAutocomplete.prototype */

    /** @inheritdoc */
    defaults() {
      return {
        ...SearchSelect.prototype.defaults(),
        placeholderText: "Start typing a term...",
        inputLabel: "Search for a term",
        allowMulti: false,
        allowAdditions: true,
        queryField: "",
      };
    },

    /** @inheritdoc */
    initialize(attributes, options) {
      const queryField = attributes?.queryField || this.get("queryField");
      if (!queryField) {
        throw new Error("queryField is required.");
      }
      this.set(
        "searchResults",
        new SolrResults([], {
          rows: 1,
          fields: [queryField],
          query: `${queryField}:*`,
          facet: [queryField],
        }),
      );
      this.getSearchResults();
      SearchSelect.prototype.initialize.call(this, attributes, options);
    },

    getSearchResults() {
      const results = this.get("searchResults");
      this.listenToOnce(results, "sync", this.formatOptions);
      results.query();
    },

    formatOptions() {
      const results = this.get("searchResults");
      const queryField = this.get("queryField");
      const facetArray = results.facetCounts[queryField];
      const formattedFacets = [];

      for (let i = 0; i < facetArray.length; i += 2) {
        // Array format is [term, count, term, count, ...]
        const term = facetArray[i];
        const count = facetArray[i + 1];

        formattedFacets.push({
          label: term,
          value: term,
          description: `${count} matching results`,
          numResults: count,
        });
      }

      formattedFacets.sort((a, b) => b.numResults - a.numResults);

      this.updateOptions(formattedFacets);
    },
  });

  return SolrAutocomplete;
});
