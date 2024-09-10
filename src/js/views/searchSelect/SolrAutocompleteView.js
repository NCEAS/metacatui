define([
  "underscore",
  "views/searchSelect/SearchSelectView",
  "models/searchSelect/SolrAutocomplete",
], (_, SearchSelect, SolrAutocomplete) => {
  /**
   * @class
   * @classdesc
   * @classcategory Views/SearchSelect
   * @augments SearchSelect
   * @class
   * @since 2.31.0
   * @screenshot views/searchSelect/SolrAutocompleteView.png
   */
  const SolrAutocompleteView = SearchSelect.extend(
    /** @lends SolrAutocompleteView.prototype */
    {
      /** @inheritdoc */
      type: "SolrAutocomplete",

      /** @inheritdoc */
      className: `${SearchSelect.prototype.className} solr-autocomplete`,

      /** @inheritdoc */
      ModelType: SolrAutocomplete,

      /**
       * The name of the field in the Solr schema that the user is searching.
       * @type {string}
       */
      queryField: "",
    },
  );
  return SolrAutocompleteView;
});
