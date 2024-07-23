"use strict";

define(["models/searchSelect/SearchSelect", "models/LookupModel"], (
  SearchSelect,
  LookupModel,
) => {
  /**
   * @class AccountSearchSelect
   * @classdesc An extension of SearchSelect that sets the options to the query
   * fields (e.g. Solr fields) available for searching.
   * @classcategory Models/SearchSelect
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const AccountSearchSelect = SearchSelect.extend({
    /** @lends AccountSearchSelect.prototype */

    /** @inheritdoc */
    defaults() {
      return {
        ...SearchSelect.prototype.defaults(),
        placeholderText: "Start typing a name",
        inputLabel: "Search for a person or group",
        allowMulti: true,
        allowAdditions: true,
        apiSettings: {
          responseAsync: this.responseAsync.bind(this),
        },
      };
    },

    /** @inheritdoc */
    initialize() {
      if (!MetacatUI.appLookupModel)
        MetacatUI.appLookupModel = new LookupModel();
      this.setOptionsForPreselected();
      SearchSelect.prototype.initialize.call(this);
    },

    /**
     * Handles the async response for the Accounts lookup
     * @param {object} settings - The settings object passed by Formantic-UI
     * @param {Function} callback - The callback function passed by Formantic-UI
     */
    responseAsync(settings, callback) {
      const model = this;

      // The search term that the user has typed into the input
      const searchTerm = settings.urlData.query;
      // To return, fail unless we have results
      const results = { success: false };

      // Only use the account lookup service is the user has typed at least two
      // characters. Otherwise, the callback function is never called.
      if (searchTerm.length < 2) callback(results);

      model
        .getAccountDetails(searchTerm)
        .then((response) => {
          if (response && response.length) {
            results.results = model.formatResults(response, false);
            results.success = true;
          }
          callback(results);
        })
        .catch(() => {
          callback(results);
        });
    },

    /**
     * Formats the results from the account lookup service for the dropdown
     * @param {object[]} results - The results from the account lookup service
     * @param {boolean} forTemplate - Whether to format the results for the
     * template in the SearchSelect view or directly for Formantic-UI
     * @returns {object[]} - The formatted results
     */
    formatResults(results, forTemplate = false) {
      return results.map((result) => this.formatResult(result, forTemplate));
    },

    /**
     * Formats a single result from the account lookup service
     * @param {object} rawResult - The result from the account lookup service
     * @param {boolean} forTemplate - See formatResults
     * @returns {object} - The formatted result
     */
    formatResult(rawResult, forTemplate = false) {
      // clone the result
      const result = { ...rawResult };

      let icon = "";
      if (result.type === "person") {
        icon = "user";
      } else if (result.type === "group") {
        icon = "group";
      }

      // Get the ID which is saved in the parentheses of the label
      const idRegex = /\(([^)]+)\)$/;
      const match = result.label.match(idRegex);
      const id = match?.[1] || "";

      // The label will be the name without the ID
      const accountName = result.label.replace(idRegex, "").trim();

      // Result for the template in the SearchSelect view
      if (forTemplate) {
        return {
          ...result,
          description: `Account ID: ${id}`,
          label: accountName,
          icon,
        };
      }
      // Result for a Formantic-UI item
      const formatIcon = icon
        ? `<i class="icon icon-on-left icon-${icon}"></i>`
        : "";
      const formatId = id ? `<span class="description">${id}</span>` : "";
      return {
        name: `${formatIcon} ${accountName} ${formatId}`,
        value: result.value,
      };
    },

    /**
     * Promisify the getAccountsAutocomplete function from the LookupModel
     * @param {string} searchTerm - The account ID, name, or partial name to search for
     * @returns {Promise<object[]>} - A promise that resolves with the results
     */
    async getAccountDetails(searchTerm) {
      return new Promise((resolve, reject) => {
        MetacatUI.appLookupModel.getAccountsAutocomplete(
          { term: searchTerm },
          (results) => {
            if (results) {
              resolve(results);
            } else {
              reject(new Error("Failed to fetch account details"));
            }
          },
        );
      });
    },

    /**
     * Use the account lookup service to match the pre-selected values to the
     * account holder's name to use as a label.
     */
    async setOptionsForPreselected() {
      const selected = this.get("selected");
      if (!selected?.length) return;
      const results = await Promise.all(
        selected.map((accountId) => this.getAccountDetails(accountId)),
      );
      const formattedResults = this.formatResults(results.flat(), true);
      this.updateOptions(formattedResults);
    },
  });

  return AccountSearchSelect;
});
