define([
  "views/searchSelect/SearchableSelectView",
  "models/searchSelect/AccountSearchSelect",
], (SearchableSelect, AccountSearchSelect) => {
  /**
   * @class AccountSelectView
   * @classdesc A select interface that allows the user to search for and select one or
   * more accountIDs
   * @classcategory Views/SearchSelect
   * @augments SearchableSelect
   * @class
   * @since 2.15.0
   * @screenshot views/searchSelect/AccountSelectViewView.png
   */
  const AccountSelectView = SearchableSelect.extend(
    /** @lends AccountSelectViewView.prototype */
    {
      /** @inheritdoc */
      type: "AccountSelect",

      /** @inheritdoc */
      ModelType: AccountSearchSelect,

      /** @inheritdoc */
      className: `${SearchableSelect.prototype.className} account-select`,

      // TODO: We may want to add a custom is valid option to warn the user when
      // a value entered cannot be found in the accounts lookup service.
      // isValidOption (value) {...}
    },
  );

  return AccountSelectView;
});
