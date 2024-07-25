define([
  "views/searchSelect/SearchSelectView",
  "models/searchSelect/AccountSearchSelect",
], (SearchSelect, AccountSearchSelect) => {
  /**
   * @class AccountSelectView
   * @classdesc A select interface that allows the user to search for and select one or
   * more accountIDs
   * @classcategory Views/SearchSelect
   * @augments SearchSelect
   * @class
   * @since 2.15.0
   * @screenshot views/searchSelect/AccountSelectViewView.png
   */
  const AccountSelectView = SearchSelect.extend(
    /** @lends AccountSelectViewView.prototype */
    {
      /** @inheritdoc */
      type: "AccountSelect",

      /** @inheritdoc */
      ModelType: AccountSearchSelect,

      /** @inheritdoc */
      className: `${SearchSelect.prototype.className} account-select`,

      // TODO: We may want to add a custom is valid option to warn the user when
      // a value entered cannot be found in the accounts lookup service.
      // isValidOption (value) {...}
    },
  );

  return AccountSelectView;
});
