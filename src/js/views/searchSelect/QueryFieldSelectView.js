define([
  "underscore",
  "views/searchSelect/SearchSelectView",
  "models/searchSelect/QueryFieldSearchSelect",
], (_, SearchSelect, QueryFieldSearchSelect) => {
  // The classes for the semantic/formantic UI card component
  const CARD_CLASSES = {
    card: "ui card",
    content: "content",
    header: "header",
    meta: "meta",
    description: "description",
    extra: "extra content",
  };

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
        <div class="ui mini card">
          <div class="${CARD_CLASSES.content}">
            <div class="${CARD_CLASSES.header}">${label}</div>
            <div class="${CARD_CLASSES.meta}"><span class="category">${value}</span></div>
            <div class="${CARD_CLASSES.description}">${description}</div>
          </div>
          <div class="${CARD_CLASSES.extra} right floated">Type: <code>${type}</code></div>
        </div>`;

        return htmlStr;
      },
    },
  );
  return QueryFieldSelectView;
});
