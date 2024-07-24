"use strict";

define([
  "models/searchSelect/SearchSelect",
  "collections/queryFields/QueryFields",
], (SearchSelect, QueryFields) => {
  /**
   * @class QueryFieldSearchSelect
   * @classdesc An extension of SearchSelect that sets the options to the query
   * fields (e.g. Solr fields) available for searching.
   * @classcategory Models/SearchSelect
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const QueryFieldSearchSelect = SearchSelect.extend({
    /** @lends QueryFieldSearchSelect.prototype */

    /**
     * An additional field object contains the properties an additional query
     * field to add that are required to render it correctly. An additional
     * query field is one that does not actually exist in the query service
     * index.
     * @typedef {object} AdditionalField
     * @property {string} name - A unique ID to represent this field. It must
     * not match the name of any other query fields.
     * @property {string[]} fields - The list of real query fields that this
     * abstracted field will represent. It must exactly match the names of the
     * query fields that actually exist.
     * @property {string} label - A user-facing label to display.
     * @property {string} description - A description for this field.
     * @property {string} category - The name of the category under which to
     * place this field. It must match one of the category names for an existing
     * query field.
     * @since 2.15.0
     */

    /**
     * @returns {object} The default attributes for this model
     * @property {AdditionalField[]} addFields - A list of additional fields
     * which are not retrieved from the query service index, but which should be
     * added to the list of options. This can be used to add abstracted fields
     * which are a combination of multiple query fields, or to add a duplicate
     * field that has a different label.
     * @property {string[]} commonFields - A list of query fields names to
     * display at the top of the menu, above all other category headers
     * @property {string[]} categoriesToAlphabetize - The names of categories
     * that should have items sorted alphabetically. Names must exactly match
     * those in the {@link QueryField#categoriesMap Query Field model}
     * @property {boolean} excludeNonSearchable - Whether or not to exclude
     * fields which are not searchable. Set to false to keep query fields that
     * are not searchable in the returned list
     * @property {string} submenuStyle - The submenu style is set to "accordion"
     * by default for this submodel
     * @property {string[]} excludeFields - A list of query field names to
     * exclude from the list of options.
     */
    defaults() {
      return {
        ...SearchSelect.prototype.defaults(),
        placeholderText: "Search for or select a field",
        inputLabel: "Select one or more metadata fields to query",
        addFields: [],
        commonFields: ["text", "documents-special-field"],
        categoriesToAlphabetize: ["General"],
        excludeNonSearchable: true,
        submenuStyle: "accordion",
        excludeFields: [],
      };
    },

    /**
     * Initializes the QueryFieldSearchSelect model
     * @param {object} attributes - A literal object with model attributes
     * @param {object} options - A literal object with options
     * @param {boolean} options.collectionQuery - Set this to true to
     * automatically set the excludeFields and addFields to the collection query
     * defaults set in the appModel. See
     * {@link AppModel#collectionQueryExcludeFields} and
     * {@link AppModel#collectionQuerySpecialFields}.
     */
    initialize(attributes, options = {}) {
      if (options.collectionQuery) {
        this.set(
          "excludeFields",
          MetacatUI.appModel.get("collectionQueryExcludeFields"),
        );
        this.set(
          "addFields",
          MetacatUI.appModel.get("collectionQuerySpecialFields"),
        );
      }
      this.getQueryFieldOptions();
      SearchSelect.prototype.initialize.call(this, attributes, options);
    },

    /**
     * Fetches the query fields from the query service, converts them to the
     * format required by the SearchableSelectView, and sets them as the options
     * for this model
     */
    async getQueryFieldOptions() {
      const queryFields = await this.fetchQueryFields();
      const fields = queryFields.toJSON();
      const excludedFields = this.excludeFields(fields);
      const addedFields = this.addFields(excludedFields);
      const options = addedFields.map(this.fieldToOption);
      const sortedOptions = this.sortFields(options);
      this.updateOptions(sortedOptions);
    },

    /**
     * Fetches the query fields from the query service
     * @returns {Promise} A promise that resolves with the query fields
     * collection
     */
    async fetchQueryFields() {
      return new Promise((resolve) => {
        if (MetacatUI.queryFields?.length) {
          resolve(MetacatUI.queryFields);
        }
        MetacatUI.queryFields = new QueryFields();
        this.listenToOnce(MetacatUI.queryFields, "sync", () => {
          resolve(MetacatUI.queryFields);
        });
        MetacatUI.queryFields.fetch();
      });
    },

    /**
     * Filters out any objects in the fieldsJSON array that have a ".name"
     * property that matches one of the strings in the fieldsToExclude array
     * @param {object[]} fieldsJSON - JSON returned from QueryFields.toJSON()
     * @returns {object[]} The filtered fieldsJSON array
     */
    excludeFields(fieldsJSON) {
      const fieldsToExclude = this.get("excludeFields");
      const excludeNonSearchable = this.get("excludeNonSearchable");

      let filteredJSON = fieldsJSON;
      if (fieldsToExclude?.length) {
        filteredJSON = fieldsJSON.filter(
          (field) => !fieldsToExclude.includes(field.name),
        );
      }
      if (excludeNonSearchable) {
        filteredJSON = filteredJSON.filter(
          (field) => field.searchable !== false && field.searchable !== "false",
        );
      }
      return filteredJSON;
    },

    /**
     * Adds fields to the fieldsJSON array that are specified in the addFields
     * property of this model
     * @param {object[]} fieldsJSON - JSON returned from QueryFields.toJSON()
     * @returns {object[]} The fieldsJSON array with additional fields added
     */
    addFields(fieldsJSON) {
      const fieldsToAdd = this.get("addFields");
      if (!fieldsToAdd?.length) return fieldsJSON;

      const fieldsWithCategoryInfo = fieldsToAdd.map((fieldToAdd) => {
        const field = { ...fieldToAdd };
        if (field.category) {
          const categoryInfo = fieldsJSON.find(
            (f) => f.category === field.category,
          );
          if (categoryInfo) {
            field.icon = field.icon || categoryInfo.icon;
            field.categoryOrder =
              field.categoryOrder || categoryInfo.categoryOrder;
          }
        }
        return field;
      });

      return fieldsJSON.concat(fieldsWithCategoryInfo);
    },

    /**
     * Converts an object that represents a QueryField model to the format
     * specified by the SearchableSelectView.options
     * @param  {object} field An object with properties corresponding to a
     * QueryField model
     * @returns {object} An object with properties that match the format
     * specified by the SearchableSelectView.options
     */
    fieldToOption(field) {
      if (!field) return {};
      return {
        label: field.label || field.name,
        value: field.name,
        description: field.friendlyDescription || field.description,
        icon: field.icon,
        category: field.category,
        categoryOrder: field.categoryOrder,
        type: field.type,
      };
    },

    /**
     * Sorts the fieldsJSON array by categoryOrder and then alphabetically
     * within each category if the category is specified in the
     * categoriesToAlphabetize property of this model.
     * @param {object[]} unsortedOptions - An array of objects that represent
     * attributes for SearchSelectOptions.
     * @returns {object[]} The sorted options
     */
    sortFields(unsortedOptions) {
      const options = unsortedOptions;
      const commonFields = this.get("commonFields");
      if (commonFields?.length) {
        commonFields.forEach((commonFieldName) => {
          const i = options.findIndex(
            (field) => field.value === commonFieldName,
          );
          if (i > 0) {
            options[i] = {
              ...options[i],
              category: "",
              categoryOrder: 0,
              icon: "star",
            };
          }
        });
      }

      options.sort((a, b) => a.categoryOrder - b.categoryOrder);

      const sortCategories = this.get("categoriesToAlphabetize");
      if (sortCategories?.length) {
        sortCategories.forEach((categoryName) => {
          const category = options.filter(
            (field) => field.category === categoryName,
          );
          category.sort((a, b) =>
            a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
          );
          const categoryIndex = options.findIndex(
            (field) => field.category === categoryName,
          );
          options.splice(categoryIndex, category.length, ...category);
        });
      }

      return options;
    },

    /**
     * For options that are added fields, not real query fields from the query
     * service, this method sets fields and types attributes on the option model
     * that are the real query fields that the added field represents.
     * @param {SearchSelectOption} option - The option model to update
     */
    setAddedFieldDetails(option) {
      const addFields = this.get("addFields");
      const addedField = addFields?.find(
        (field) => field.name === option?.get("value"),
      );
      if (!addedField) return;

      const specialField = { ...addedField };
      const { fields } = specialField;

      const types = fields.map((fieldName) => {
        const realField = MetacatUI.queryFields.findWhere({ name: fieldName });
        return realField ? realField.get("type") : "special field";
      });

      option.set({
        fields,
        types,
      });
    },

    /**
     * Extends the isValidValue method of the SearchSelect model to allow for
     * the addition of fields that are excluded by default, if they are selected
     * @param {string} value - The value to check
     * @returns {boolean} - Returns true if the value is valid, false otherwise
     */
    isValidValue(value) {
      const excludedFields = this.get("excludeFields");

      if (!excludedFields || !excludedFields.includes(value)) {
        return SearchSelect.prototype.isValidValue.call(this, value);
      }

      let newField = MetacatUI.queryFields.findWhere({ name: value });
      if (newField) {
        newField = this.fieldToOption(newField.toJSON());
      }
      this.get("options").add(newField);
      return true;
    },
  });

  return QueryFieldSearchSelect;
});
