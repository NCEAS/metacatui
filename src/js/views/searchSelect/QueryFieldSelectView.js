define([
  "underscore",
  "semantic",
  "views/searchSelect/SearchSelectView",
  "models/searchSelect/QueryFieldSearchSelect",
], (_, Semantic, SearchSelect, QueryFieldSearchSelect) => {
  /**
   * @class QueryFieldSelectView
   * @classdesc A select interface that allows the user to search for and select
   * metadata field(s).
   * @classcategory Views/SearchSelect
   * @augments SearchSelect
   * @class
   * @since 2.14.0
   * @screenshot views/searchSelect/QueryFieldSelectView.png
   */
  const QueryFieldSelectView = SearchSelect.extend(
    /** @lends QueryFieldSelectView.prototype */
    {
      /** @inheritdoc */
      type: "QueryFieldSelect",

      /** @inheritdoc */
      className: `${SearchSelect.prototype.className} query-field-select`,

      /** @inheritdoc */
      ModelType: QueryFieldSearchSelect,

      /** @inheritdoc */
      tooltipSettings: {
        ...SearchSelect.prototype.tooltipSettings,
        variation: "mini",
        // the semantic "card" we use for inner content has sufficient padding
        onCreate() {
          this.css({ padding: 0 });
        },
      },

      /** @inheritdoc */
      tooltipHTML(option) {
        // If this option is one of the addedFields (an abstracted field), then
        // we need to check the QueryFields model for the actual fields and
        // field types this option represents.
        this.model.setAddedFieldDetails(option);

        const label = option.get("label") || "";
        const value = option.get("fields") || option.get("value") || "";
        const type = option.get("types") || option.get("type") || "";
        const description = option.get("description") || "";

        const htmlStr = `
        <div class="${Semantic.CLASS_NAMES.base} ${Semantic.CLASS_NAMES.variations.mini} ${Semantic.CLASS_NAMES.card.base}">
          <div class="${Semantic.CLASS_NAMES.card.content}">
            <div class="${Semantic.CLASS_NAMES.card.header}">${label}</div>
            <div class="${Semantic.CLASS_NAMES.card.meta}"><span class="category">${value}</span></div>
            <div class="${Semantic.CLASS_NAMES.card.description}">${description}</div>
          </div>
          <div class="${Semantic.CLASS_NAMES.card.extra} ${Semantic.CLASS_NAMES.card.content} ${Semantic.CLASS_NAMES.grid.floated} ${Semantic.CLASS_NAMES.grid.right}">Type: <code>${type}</code></div>
        </div>`;

        return htmlStr;
      },
    },
  );
  return QueryFieldSelectView;
});
