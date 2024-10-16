define([
  "jquery",
  "underscore",
  "backbone",
  "views/searchSelect/SearchSelectView",
  "views/searchSelect/QueryFieldSelectView",
  "views/searchSelect/NodeSelectView",
  "views/searchSelect/AccountSelectView",
  "views/filters/NumericFilterView",
  "views/filters/DateFilterView",
  "views/searchSelect/ObjectFormatSelectView",
  "views/searchSelect/BioontologySelectView",
], (
  $,
  _,
  Backbone,
  SearchSelect,
  QueryFieldSelect,
  NodeSelect,
  AccountSelect,
  NumericFilterView,
  DateFilterView,
  ObjectFormatSelect,
  BioontologySelect,
) =>
  /**
   * @class QueryRuleView
   * @classdesc A view that provides an UI for a user to construct a single filter that
   * is part of a complex query
   * @classcategory Views/QueryBuilder
   * @screenshot views/QueryRuleView.png
   * @augments Backbone.View
   * @class
   * @since 2.14.0
   */
  Backbone.View.extend(
    /** @lends QueryRuleView.prototype */
    {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "QueryRule",

      /**
       * The HTML class names for this view element
       * @type {string}
       */
      className: "query-rule",

      /**
       * The class to add to the rule number and other information on the left
       * @type {string}
       */
      ruleInfoClass: "rule-info",

      /**
       * The class to add to the field select element
       * @type {string}
       */
      fieldsClass: "field",

      /**
       * The class to add to the operator select element
       * @type {string}
       */
      operatorClass: "operator",

      /**
       * The class to add to the value select element
       * @type {string}
       */
      valuesClass: "value",

      /**
       * The class to add to the element that a user should click to remove a rule.
       * @type {string}
       */
      removeClass: "remove-rule",

      /**
       * An ID for the element that a user should click to remove a rule. A unique ID
       * will be appended to this ID, and the ID will be added to the template.
       * @type {string}
       */
      removeRuleID: "remove-rule-",

      /**
       * The maximum number of levels of nested Rule Groups (i.e. nested FilterGroup
       * models) that a user is permitted to build in the Query Builder that contains
       * this rule. This value should be passed to the rule by the parent Query Builder.
       * This value minus one will be passed on to any child Query Builders (those that
       * render nested FilterGroup models).
       * @type {number}
       * @since 2.17.0
       */
      nestedLevelsAllowed: 1,

      /**
       * An array of hex color codes used to help distinguish between different rules.
       * If this is a nested Query Rule, and the rule should inherit its colour from
       * the parent Query Rule, then set ruleColorPalette to "inherit".
       * @type {string[]|string}
       */
      ruleColorPalette: [
        "#44AA99",
        "#137733",
        "#c9a538",
        "#CC6677",
        "#882355",
        "#AA4499",
        "#332288",
      ],

      /**
       * Search index fields to exclude in the metadata field selector
       * @type {string[]}
       */
      excludeFields: [],

      /**
       * Query fields to exclude in the metadata field selector for any Query Rules that
       * are in nested Query Builders (i.e. in nested Filter Groups). This is a list of
       * field names that exist in the query service index (i.e. Solr), but which should
       * be hidden in nested Query Builders
       * @type {string[]}
       */
      nestedExcludeFields: [],

      /**
       * A single Filter model that is part of a Filters collection, such as the
       * definition filters for a Collection or Portal or the filters for a Search
       * model. The Filter model must be part of a Filters collection (i.e. there must
       * be a model.collection property)
       * @type {Filter|BooleanFilter|NumericFilter|DateFilter|FilterGroup}
       */
      model: undefined,

      /**
       * A function that creates and returns the Backbone events object.
       * @returns {object} Returns a Backbone events object
       */
      events() {
        const events = {};
        const removeID = `#${this.removeRuleID}${this.cid}`;
        events[`click ${removeID}`] = "removeSelf";
        events[`mouseover ${removeID}`] = "previewRemove";
        events[`mouseout ${removeID}`] = "previewRemove";
        return events;
      },

      /**
       * A list of additional fields which are not retrieved from the query API, but
       * which should be added to the list of options. This can be used to add
       * abstracted fields which are a combination of multiple query fields, or to add a
       * duplicate field that has a different label. These special fields are passed on
       * to {@link QueryFieldSelectView#addFields}.
       * @type {SpecialField[]}
       * @since 2.15.0
       */
      specialFields: [
        {
          name: "documents-special-field",
          fields: ["documents"],
          label: "Contains Data Files",
          description:
            "Limit results to packages that include data files. Without" +
            " this rule, results may include packages with metadata but no data.",
          category: "General",
          values: ["*"],
        },
        {
          name: "year-data-collection",
          fields: ["beginDate", "endDate"],
          label: "Year of Data Collection",
          description:
            "The temporal range of content described by the metadata",
          category: "Dates",
        },
      ],

      /**
       * An operator option is an object that lists the properties of one of the
       * operators that will be displayed to the user in the Query Rule "operator"
       * dropdown list. The operator properties are used to pre-select the correct
       * operator based on attributes in the associated
       * {@link Filter#defaults Filter model}, as well as to update the Filter model
       * when a user selects a new operator. Operators can set the exclude and
       * matchSubstring properties of the model, and sometimes the values as well.
       * Either the types property OR the fields property must be set, not both.
       * @typedef {object} OperatorOption
       * @property {string} label - The label to display to the user
       * @property {string} icon - An icon that represents the operator
       * @property {boolean} matchSubstring - Whether the matchSubstring attribute is
       * true or false in the filter model that matches this operator
       * @property {boolean} exclude - Whether the exclude attribute is true or false in
       * the filter model that matches this operator
       * @property {boolean} hasMax - Whether the filter model that matches this
       * operator must have a max attribute
       * @property {boolean} hasMin - Whether the filter model that matches this
       * operator must have a min attribute
       * @property {string[]} values - For this operator to work as desired, the values
       * that should be set in the filter (e.g. ["true"] for the operator "is true")
       * @property {string[]} [types] - The node names of the filters that this operator
       * is used for (e.g. "filter", "booleanFilter")
       * @property {string[]} [fields] - The query field names of the filters that this
       * operator is used for. If this is used for a
       * {@link QueryRuleView#specialFields special field}, then list the special field
       * name (id), and not the real query field names. If this fields property is set,
       * then the types property will be ignored. (i.e. fields is more specific than
       * types.)
       */

      /**
       * The list of operators that will be available in the dropdown list that connects
       * the query fields to the values. Each operator must be unique.
       * @type {OperatorOption[]}
       */
      operatorOptions: [
        {
          label: "is true",
          description:
            "The data package includes data files (and not only metadata)",
          icon: "ok-circle",
          matchSubstring: false,
          exclude: false,
          values: ["*"],
          fields: ["documents-special-field"],
        },
        {
          label: "is false",
          description:
            "The data package only contains metadata; it contains no data files.",
          icon: "ban-circle",
          matchSubstring: false,
          exclude: true,
          values: ["*"],
          fields: ["documents-special-field"],
        },
        {
          label: "equals",
          description:
            "The text in the metadata field is an exact match to the" +
            " selected value",
          icon: "equal",
          matchSubstring: false,
          exclude: false,
          types: ["filter"],
        },
        {
          label: "does not equal",
          description:
            "The text in the metadata field is anything except an exact" +
            " match to the selected value",
          icon: "not-equal",
          matchSubstring: false,
          exclude: true,
          types: ["filter"],
        },
        {
          label: "contains",
          description:
            "The text in the metadata field matches or contains the words" +
            " or phrase selected",
          icon: "ok-circle",
          matchSubstring: true,
          exclude: false,
          types: ["filter"],
        },
        {
          label: "does not contain",
          description:
            "The words or phrase selected are not contained within the" +
            " metadata field",
          icon: "ban-circle",
          matchSubstring: true,
          exclude: true,
          types: ["filter"],
        },
        {
          label: "is empty",
          description: "The metadata field contains no text or value",
          icon: "circle-blank",
          matchSubstring: false,
          exclude: true,
          values: ["*"],
          types: ["filter"],
        },
        {
          label: "is not empty",
          description: "The metadata field is filled in with any text at all",
          icon: "circle",
          matchSubstring: false,
          exclude: false,
          values: ["*"],
          types: ["filter"],
        },
        {
          label: "is true",
          description: "The metadata field is set to true",
          icon: "ok-circle",
          matchSubstring: false,
          exclude: false,
          values: [true],
          types: ["booleanFilter"],
        },
        {
          label: "is false",
          description: "The metadata field is set to false",
          icon: "ban-circle",
          matchSubstring: false,
          exclude: false,
          values: [false],
          types: ["booleanFilter"],
        },
        {
          label: "is between",
          description:
            "The metadata field is a value between the range selected" +
            " (inclusive of both values)",
          icon: "resize-horizontal",
          matchSubstring: false,
          exclude: false,
          hasMin: true,
          hasMax: true,
          types: ["numericFilter", "dateFilter"],
        },
        {
          label: "is less than or equal to",
          description:
            "The metadata field is a number less than the value selected",
          icon: "less-than-or-eq",
          matchSubstring: false,
          exclude: false,
          hasMin: false,
          hasMax: true,
          types: ["numericFilter"],
        },
        {
          label: "is greater than or equal to",
          description:
            "The metadata field is a number greater than the value selected",
          icon: "greater-than-or-eq",
          matchSubstring: false,
          exclude: false,
          hasMin: true,
          hasMax: false,
          types: ["numericFilter"],
        },
        {
          label: "is exactly",
          description: "The metadata field exactly equals the value selected",
          icon: "equal",
          matchSubstring: false,
          exclude: false,
          hasMin: false,
          hasMax: false,
          types: ["numericFilter"],
        },
        // TODO: The dateFilter model & view need to be updated for these to work:
        // {
        //   label: "is during or before", icon: "less-than-or-eq", matchSubstring:
        //   false, exclude: false, hasMin: false, hasMax: true, types: ["dateFilter"]
        // },
        // {
        //   label: "is during or after", icon: "greater-than", matchSubstring: false,
        //   exclude: false, hasMin: true, hasMax: false, types: ["dateFilter"]
        // },
        // {
        //   label: "is in the year", icon: "equal", matchSubstring: false, exclude:
        //   false, hasMin: false, hasMax: false, types: ["dateFilter"]
        // }
      ],

      /**
       * The third input in each Query Rule is where the user enters a value, minimum,
       * or maximum for the filter model. Different types of values are appropriate for
       * different solr query fields, and so we display different interfaces depending
       * on the type and category of the selected query fields. A Value Input Option
       * object defines a of interface to show for a given type and category.
       * @typedef {object} ValueInputOption
       * @property {string[]} filterTypes - An array of one or more filter types that
       * are allowed for this interface.  If none are provided then any filter type is
       * allowed. Filter types are one of the four keys defined in
       * {@link QueryField#filterTypesMap}.
       * @property {string[]} categories - An array of one or more categories that are
       * allowed for this interface. These strings must exactly match the categories
       * provided in QueryField.categoriesMap(). If none are provided then any category
       * is allowed.
       * @property {string[]} queryFields - Specific names of fields that are allowed in
       * this interface. If none are provided, then any query fields are allowed that
       * match the other properties. If this value select should be used for a
       * {@link QueryRuleView#specialFields special field}, then use the name (id) of
       * the special field, not the actual query fields that it represents.
       * @property {string} label - If the interface does not include a label (e.g.
       * number filter), include a string to display here.
       * @property {Function} uiFunction - A function that returns the UI view to use
       * with all appropriate options set. The function will be called with this view as
       * the context.
       */

      /**
       * This list defines which type of value input to show depending on filter type,
       * category, and query fields. The value input options are ordered from *most*
       * specific to *least*, since the first match will be selected. The filter model
       * must match either the queryFields, or both the filterTypes AND the categories
       * for a UI to be selected.
       * @type {ValueInputOption[]}
       */
      valueSelectUImap: [
        // serviceCoupling field
        {
          queryFields: ["serviceCoupling"],
          uiFunction() {
            return new SearchSelect({
              options: [
                {
                  label: "tight",
                  description:
                    "Tight coupled service work only on the data described" +
                    " by this metadata document.",
                },
                {
                  label: "mixed",
                  description:
                    "Mixed coupling means service works on data described" +
                    " by this metadata document but may work on other data.",
                },
                {
                  label: "loose",
                  description:
                    "Loose coupling means service works on any data.",
                },
              ],
              allowMulti: true,
              allowAdditions: false,
              inputLabel: "Select a coupling",
              selected: this.model.get("values"),
              separator: this.model.get("operator"),
            });
          },
        },
        // Metadata format IDs
        {
          queryFields: ["formatId"],
          uiFunction() {
            return new ObjectFormatSelect({
              selected: this.model.get("values"),
              separator: this.model.get("operator"),
            });
          },
        },
        // Semantic annotation picker
        {
          queryFields: ["sem_annotation"],
          uiFunction() {
            // A bioportalAPIKey is required for the Annotation Filter UI
            if (MetacatUI.appModel.get("bioportalAPIKey")) {
              return new BioontologySelect({
                selected: this.model.get("values"),
                separator: this.model.get("operator"),
                allowMulti: true,
                allowAdditions: true,
                inputLabel: "Search for a term",
              });
              // If there's no API key, render the default UI (the last in this list)
            }
            return this.valueSelectUImap.slice(-1)[0].uiFunction.call(this);
          },
        },
        // User/Organization account ID lookup
        {
          queryFields: [
            "writePermission",
            "readPermission",
            "changePermission",
            "rightsHolder",
            "submitter",
          ],
          uiFunction() {
            return new AccountSelect({
              selected: this.model.get("values"),
              separator: this.model.get("operator"),
            });
          },
        },
        // Repository picker for fields that need a member node ID
        {
          filterTypes: ["filter"],
          queryFields: [
            "blockedReplicationMN",
            "preferredReplicationMN",
            "replicaMN",
            "authoritativeMN",
            "datasource",
          ],
          uiFunction() {
            return new NodeSelect({
              selected: this.model.get("values"),
              separator: this.model.get("operator"),
            });
          },
        },
        // Any numeric fields don't fit one of the above options
        {
          filterTypes: ["numericFilter"],
          label: "Choose a value",
          uiFunction() {
            return new NumericFilterView({
              model: this.model,
              showButton: false,
              separator: this.model.get("operator"),
            });
          },
        },
        // Any date fields that don't fit one of the above options
        {
          filterTypes: ["dateFilter"],
          label: "Choose a year",
          uiFunction() {
            return new DateFilterView({
              model: this.model,
              separator: this.model.get("operator"),
            });
          },
        },
        // The last is the default value selection UI
        {
          uiFunction() {
            return new SearchSelect({
              options: [],
              allowMulti: true,
              allowAdditions: true,
              inputLabel: "Type a value",
              selected: this.model.get("values"),
              separator: this.model.get("operator"),
            });
          },
        },
      ],

      /**
       * Creates a new QueryRuleView
       * @param {object} options - A literal object with options to pass to the view
       */
      initialize(options) {
        // Apply all the options to this view
        if (typeof options === "object") {
          Object.assign(this, options);
        }

        // If no model is provided in the options, we cannot render this view. A
        // filter model cannot be created, because it must be part of a collection.
        if (!this.model || !this.model.collection) {
          throw new Error(
            "A Filter model that's part of a Filters collection is required to initialize a Query Rule view.",
          );
        }

        // The model may be removed during the save process if it's empty. Remove this
        // Rule Group view when that happens.
        this.stopListening(this.model, "remove");
        this.listenTo(this.model, "remove", () => {
          this.removeSelf();
        });
      },

      /**
       * render - Render the view
       * @returns {QueryRule}  Returns the view
       */
      render() {
        // Add the Rule number.
        // TODO: Also add the number of datasets related to rule
        this.addRuleInfo();
        this.stopListening(this.model.collection, "remove");
        this.listenTo(this.model.collection, "remove", this.updateRuleInfo);
        // Nested rules should also listen for changes in Filters of their parent Rule
        if (this.parentRule) {
          this.stopListening(this.parentRule.model.collection, "remove");
          this.listenTo(
            this.parentRule.model.collection,
            "remove",
            this.updateRuleInfo,
          );
        }

        // The remove button is needed for both FilterGroups and other Filter models
        this.addRemoveButton();

        // Render nested filter group views as another Query Builder.
        if (this.model.type === "FilterGroup") {
          this.$el.addClass("rule-group");

          // We must initialize a QueryBuilderView using the inline require syntax to
          // avoid the problem of circular dependencies. QueryRuleView requires
          // QueryBuilderView, and QueryBuilderView requires QueryRuleView. For more
          // info, see https://requirejs.org/docs/api.html#circular
          const QueryBuilderView = require("views/queryBuilder/QueryBuilderView");

          // The default
          let nestedLevelsAllowed = 1;
          // If we are adding a query builer, then it is a nested level. Subtract one
          // from the total levels allowed.
          if (typeof this.nestedLevelsAllowed === "number") {
            nestedLevelsAllowed = this.nestedLevelsAllowed - 1;
          }

          // If there is a special list of fields to exclude in nested Query Builders
          // (i.e. in nested FilterGroup models), then pass this list on as the
          // excludeFields list in the child QueryBuilder
          let { excludeFields } = this;
          if (
            this.nestedExcludeFields &&
            Array.isArray(this.nestedExcludeFields)
          ) {
            excludeFields = this.nestedExcludeFields;
          }

          // Insert QueryRuleView
          const ruleGroup = new QueryBuilderView({
            filterGroup: this.model,
            // Nested Query Rules have the same color as their parent rule
            ruleColorPalette: "inherit",
            excludeFields,
            specialFields: this.specialFields,
            parentRule: this,
            nestedLevelsAllowed,
          });
          this.el.append(ruleGroup.el);
          ruleGroup.render();
        } else {
          // For any other filter type... Add a metadata selector field whether the
          // rule is new or has already been created
          this.addFieldSelect();

          // Operator field and value field Add an operator input only for already
          // existing filters (For new filters, a metadata field needs to be selected
          // first)
          if (this.model.get("fields") && this.model.get("fields").length) {
            this.addOperatorSelect();
            this.addValueSelect();
          }
        }

        return this;
      },

      /**
       * Insert container for the color-coded rule numbering.
       */
      addRuleInfo() {
        this.$indexEl = $(document.createElement("span"));
        this.$ruleInfoEl = $(document.createElement("div")).addClass(
          this.ruleInfoClass,
        );
        this.$ruleInfoEl.append(this.$indexEl);

        this.$el.append(this.$ruleInfoEl);
        this.updateRuleInfo();
      },

      /**
       * Selects a color from the {@link QueryRuleView#ruleColorPalette}, given an
       * index. If the index is greater than the length of the palette, then the palette
       * is effectively repeated until long enough (i.e. colours will be recycled). If
       * no index in provided, the first colour in the palette will be selected.
       * @param  {number} [index] - The position of the rule within the Filters
       * collection.
       * @param  {string} [defaultColor] - A default colour to use in case
       * there is problem with this function (hex color code beginning with '#').
       * @returns {string} - Returns a hex color code string
       */
      getPaletteColor(index = 0, defaultColor = "#57b39c") {
        try {
          // Allow the rule to inherit its color from the parent rule within which it's
          // nested
          if (this.ruleColorPalette === "inherit") {
            return null;
          }

          if (!this.ruleColorPalette || !this.ruleColorPalette.length) {
            return defaultColor;
          }

          const numCols = this.ruleColorPalette.length;
          const adjustedIndex = index % numCols;

          return this.ruleColorPalette[adjustedIndex];
        } catch {
          return defaultColor;
        }
      },

      /**
       * Adds or updates the color-coded Query Rule information displayed to the user.
       * This needs to be run when rules are added or removed. Rule information includes
       * the rule number, but may one day also display information such as the number of
       * results that there are for this individual rule.
       */
      updateRuleInfo() {
        // Rules are numbered in the order in which they appear in the Filters
        // collection, excluding any invisible filter models. Rules nested in Rule
        // Groups (within Filter Models) get numbered 3A, 3B, etc.
        let letter = "";
        let index = "";
        // If this is a filter model nested in a filter group
        if (this.parentRule) {
          index = this.parentRule.ruleNumber;
          const letterIndex = this.model.collection.visibleIndexOf(this.model);
          if (typeof letterIndex === "number") {
            letter = String.fromCharCode(94 + letterIndex + 3).toUpperCase();
          }
          // For top-level filter models
        } else {
          index = this.model.collection.visibleIndexOf(this.model);
        }

        if (typeof index === "number") {
          index += 1;
        }

        const ruleNumber = index + letter;

        // Set the rule number of the parent view to be accessed by any nested child
        // rules
        this.ruleNumber = ruleNumber;

        // if(this.model.type == "FilterGroup")
        if (ruleNumber && ruleNumber.length) {
          this.$indexEl.text(`Rule ${ruleNumber}`);
        } else {
          this.$indexEl.text("");
          return;
        }
        const color = this.getPaletteColor(index);
        if (color) {
          this.el.style.setProperty("--rule-color", color);
        }
      },

      /**
       * addRemoveButton - Create and insert the button to remove the Query Rule
       */
      addRemoveButton() {
        const removeButton = $(
          `<i id='${this.removeRuleID}${this.cid}' class='${this.removeClass} icon icon-remove' title='Remove this Query Rule'></i>`,
        );
        this.el.append(removeButton[0]);
      },

      /**
       * Determines whether the filter model that this rule renders matches one of the
       * {@link QueryRuleView#specialFields special fields} set on this view. If it
       * does, returns the first special field object that matches. For a filter model
       * to match to one of the special fields, it must contain all of the fields listed
       * in the special field's "fields" property. If the special field has an array set
       * for "values", then the model's values must also exactly match the special
       * field's values.
       * @param  {string[]} [fields] - Optionally set a list of query fields to search
       * with. If not set, then the fields that are set on the view's filter model are
       * used.
       * @returns {SpecialField|null} - The matching special field, or null if no match
       * was found.
       * @since 2.15.0
       */
      getSpecialField(fields) {
        // Get information about the filter model (or used the fields passed to this
        // function)
        const originalSelectedFields = fields || this.model.get("fields");
        const selectedFields = _.clone(originalSelectedFields);
        const selectedValues = this.model.get("values");

        if (!this.specialFields || !Array.isArray(this.specialFields)) {
          return null;
        }

        const matchingSpecialField = _.find(
          this.specialFields,
          (specialField) => {
            let fieldsMatch = false;
            let mustMatchValues = false;
            let valuesMatch = false;

            // If *all* the fields in the fields array are present in the list
            // of fields that the special field represents, then count this as a match.
            const commonFields = _.intersection(
              specialField.fields,
              selectedFields,
            );
            if (commonFields.length === specialField.fields.length) {
              fieldsMatch = true;
            }

            // The selected value must *exactly match* if one is set in the special
            // field
            if (specialField.values) {
              mustMatchValues = true;
              valuesMatch = _.isEqual(specialField.values, selectedValues);
            }

            return (
              fieldsMatch &&
              (!mustMatchValues || (mustMatchValues && valuesMatch))
            );
          },
          this,
        );

        // If this model matches one of the special fields, render it differently
        return matchingSpecialField || null;
      },
      /**
       * Converts a list of query field names to special field names based on matches
       * from the special fields defined. If a field matches a special field's subfields,
       * it is replaced by the special field name.
       * @param {string[]} fields - The list of field names to convert
       * @returns {string[]} - The converted list of field names. If no special fields are
       * detected, then the field names are returned unchanged.
       */
      convertToSpecialFields(fields) {
        let fieldsCopy = [...fields];

        // Helper function to replace fields with a special field name
        const replaceWithSpecialField = (originalFields, specialField) => {
          const position = originalFields.findIndex((field) =>
            specialField.fields.includes(field),
          );
          if (position !== -1) {
            originalFields.splice(
              position,
              specialField.fields.length,
              specialField.name,
            );
          }
          return originalFields;
        };

        // Iterate over each selected special field to transform the fields array
        if (this.selectedSpecialFields && this.selectedSpecialFields.length) {
          this.selectedSpecialFields.forEach((specialField) => {
            fieldsCopy = replaceWithSpecialField(fieldsCopy, specialField);
          });
        }

        // Replace any remaining matches
        let matchingSpecialField = this.getSpecialField(fieldsCopy);
        while (matchingSpecialField) {
          fieldsCopy = replaceWithSpecialField(
            fieldsCopy,
            matchingSpecialField,
          );
          matchingSpecialField = this.getSpecialField(fieldsCopy);
        }

        return fieldsCopy;
      },

      /**
       * Takes a list of query field names and checks if it contains any of the
       * {@link QueryRuleView#specialFields special field names}. Returns the list with
       * the special field names replaced with the actual field names that those special
       * fields represent. Stores the name of each special field name removed in an
       * array set on the view's selectedSpecialFields property. selectedSpecialFields
       * is cleared each time this function runs. This function is the opposite of
       * {@link QueryRuleView#convertToSpecialFields}
       * @param {string[]} fields - The list of fields to convert to actual query
       * service index fields
       * @returns {string[]} - Returns the list of fields with any special field
       * replaced with real fields from the query service index.  If there were no
       * special fields detected, or if there's an error, then then the field names are
       * returned unchanged.
       * @since 2.15.0
       */
      convertFromSpecialFields(fields) {
        try {
          this.selectedSpecialFields = [];
          if (this.specialFields) {
            this.specialFields.forEach((specialField) => {
              const index = fields.indexOf(specialField.name);
              if (index >= 0) {
                // Keep a record that the user selected a special field (useful in the
                // case that the special field is just a duplicate of another field)
                this.selectedSpecialFields.push(specialField);
                fields.splice(index, 1, ...specialField.fields);
              }
            }, this);
          }
          return fields;
        } catch (error) {
          return fields;
        }
      },

      /**
       * Create and insert an input that allows the user to select a metadata field to
       * query
       */
      addFieldSelect() {
        // Check whether the filter model set on this view contains query fields
        // and values that match one of the special rules. If it does,
        // convert the list of field names to special field to pass on to the
        // Query Field Select View.
        let selectedFields = _.clone(this.model.get("fields"));
        selectedFields = this.convertToSpecialFields(selectedFields);

        this.fieldSelect = new QueryFieldSelect({
          selected: selectedFields,
          excludeFields: this.excludeFields,
          addFields: this.specialFields,
          separator: this.model.get("fieldsOperator"),
        });
        this.fieldSelect.$el.addClass(this.fieldsClass);
        this.el.append(this.fieldSelect.el);
        this.fieldSelect.render();

        // Update the model when the fieldsOperator changes
        this.stopListening(this.fieldSelect.model, "change:separator");
        this.listenTo(
          this.fieldSelect.model,
          "change:separator",
          (_model, newOperator) => {
            this.model.set("fieldsOperator", newOperator);
          },
        );
        // Update model when the selected fields change
        this.stopListening(this.fieldSelect.model, "change:selected");
        this.listenTo(
          this.fieldSelect.model,
          "change:selected",
          (_model, fields) => {
            this.handleFieldChange(fields);
          },
        );
      },

      /**
       * Called when the Query Field Select View triggers a change
       * event. Updates the model with the new fields, and if required,
       * 1) converts the filter model to a different type based on the types of fields
       * selected, 2) updates the operator select and the value select
       * @param  {string[]} fields The list of new query fields that were selected
       */
      handleFieldChange(fields) {
        // Get the selected operator before the field changed
        const opBefore = this.getSelectedOperator();

        // If any of the new fields are special fields, replace them with the
        // actual query fields before setting them in the model...
        const newFields = this.convertFromSpecialFields(fields);

        // Get the current type of filter and required type given the newly selected
        // fields
        const typeBefore = this.model.get("nodeName");
        const typeAfter =
          MetacatUI.queryFields.getRequiredFilterType(newFields);

        // If the type has changed, then replace the model with one of the correct
        // type, update the value and operator inputs, and do nothing else
        if (typeBefore !== typeAfter) {
          this.model = this.model.collection.replaceModel(this.model, {
            filterType: typeAfter,
            fields: newFields,
          });
          this.removeInput("value");
          this.removeInput("operator");
          this.addOperatorSelect("");
          return;
        }

        // If the filter model type is the same, and the operator options are the same
        // for the selected fields, then update the model
        this.model.set("fields", newFields);

        // Get the selected operator now that we've updated the model with new fields
        const opAfter = this.getSelectedOperator();

        // Add an empty operator input field, if there isn't one
        if (!this.operatorSelect) {
          this.addOperatorSelect("");
          // If the operator options have changed, refresh the operator input
        } else if (opAfter !== opBefore) {
          this.removeInput("operator");
          // Make sure that we overwrite any values that don't apply to the new options.
          this.handleOperatorChange([""]);
          this.addOperatorSelect("");
          return;
        }

        // Refresh the value select in case a different value input is required for
        // the new fields
        if (this.valueSelect) {
          this.removeInput("value");
          this.addValueSelect();
        }
      },

      /**
       * Create and insert an input field where the user can select an operator for the
       * given rule. Operators will vary depending on filter model type.
       * @param {string} operator - optional. The label of an operator to
       * pre-select. Set to an empty string to render an empty operator selector.
       */
      addOperatorSelect(operator) {
        const view = this;
        const options = this.getOperatorOptions();
        let operatorError = false;
        let selectedOperator = operator;

        // Identify the selected operator for existing models
        if (typeof selectedOperator !== "string") {
          selectedOperator = this.getSelectedOperator();
          // If there was no operator found, then this is probably an unsupported
          // combination of exclude + matchSubstring + filterType
          if (selectedOperator === "") {
            operatorError = true;
          }
        }

        if (selectedOperator === "") {
          selectedOperator = [];
        } else {
          selectedOperator = [selectedOperator];
        }

        this.operatorSelect = new SearchSelect({
          options,
          allowMulti: false,
          inputLabel: "Select an operator",
          clearable: false,
          placeholderText: "Select an operator",
          selected: selectedOperator,
        });
        this.operatorSelect.$el.addClass(this.operatorClass);
        this.el.append(this.operatorSelect.el);

        this.operatorSelect.render();

        if (operatorError) {
          view.operatorSelect.showInvalidSelectionError();
        }

        // Update model when the values change
        this.stopListening(this.operatorSelect.model, "change:selected");
        this.listenTo(
          this.operatorSelect.model,
          "change:selected",
          (_model, newOperator) => {
            this.handleOperatorChange(newOperator);
          },
        );
      },

      /**
       * handleOperatorChange - When the operator selection is changed, update the model
       * and re-set the value UI when required
       * @param  {string[]} newOperatorLabel The new operator label within an array,
       * e.g. ["is greater than"]
       */
      handleOperatorChange(newOperatorLabel) {
        const view = this;

        if (!newOperatorLabel || newOperatorLabel[0] === "") {
          const modelDefaults = this.model.defaults();
          this.model.set({
            min: modelDefaults.min,
            max: modelDefaults.max,
            values: modelDefaults.values,
          });
          this.removeInput("value");
          return;
        }

        // Get the properties of the newly selected operator. The newOperatorLabel
        // will be an array with one value. Select only from the available options,
        // since there may be multiple options with the same label in
        // this.operatorOptions.
        const options = this.getOperatorOptions();
        const operator = _.findWhere(options, { label: newOperatorLabel[0] });

        // Gather  information about which values are currently set on the model, and
        // which are required
        const // Type
          type = view.model.get("nodeName");
        const isNumeric = ["dateFilter", "numericFilter"].includes(type);
        const isRange = operator.hasMin && operator.hasMax;
        // Values
        const modelValues = this.model.get("values");
        const modelHasValues = modelValues
          ? modelValues && modelValues.length
          : false;
        const modelFirstValue = modelHasValues ? modelValues[0] : null;
        const modelValueInt = parseInt(modelFirstValue, 10)
          ? parseInt(modelFirstValue, 10)
          : null;
        const needsValue =
          isNumeric && !modelValueInt && !operator.hasMin && !operator.hasMax;
        // Min
        const modelMin = this.model.get("min");
        const modelHasMin = modelMin === 0 || modelMin;
        const needsMin = operator.hasMin && !modelHasMin;
        // Max
        const modelMax = this.model.get("max");
        const modelHasMax = modelMax === 0 || modelMax;
        const needsMax = operator.hasMax && !modelHasMax;

        // Some operator options include a specific value to be set on the model. For
        // example, "is not empty", should set the model value to the "*" wildcard.
        // For operators with these specific value requirements, update the filter
        // model value and remove the value select input.
        if (operator.values && operator.values.length) {
          this.removeInput("value");
          this.model.set("values", operator.values);
          // If the operator does not have a default value, then ensure that there is
          // a value select available.
        } else if (!this.valueSelect) {
          this.model.set("values", view.model.defaults().values);
          this.addValueSelect();
        }

        // Update the model with true or false for matchSubstring and exclude
        ["matchSubstring", "exclude"].forEach((prop) => {
          if (typeof operator[prop] !== "undefined") {
            view.model.set(prop, operator[prop]);
          } else {
            view.model.set(prop, view.model.defaults()[prop]);
          }
        });

        // Set min & max values as required by the operator
        // TODO - test this strategy with dates...

        // Add a minimum value if one is needed
        if (needsMin) {
          // Search for the min in the values, then in the max
          if (modelValueInt || modelValueInt === 0) {
            this.model.set("min", modelValueInt);
          } else if (modelHasMax) {
            this.model.set("min", modelMax);
          } else {
            this.model.set("min", 0);
          }
        }

        // Add a maximum value if one is needed
        if (needsMax) {
          // Search for the min in the values, then in the max
          if (modelValueInt || modelValueInt === 0) {
            this.model.set("max", modelValueInt);
          } else if (modelHasMin) {
            this.model.set("max", modelMin);
          } else {
            this.model.set("max", 0);
          }
        }

        // Add a value if one is needed
        if (needsValue) {
          if (modelHasMin) {
            this.model.set("values", [modelMin]);
          } else if (modelHasMax) {
            this.model.set("values", [modelMax]);
          } else {
            this.model.set("values", [0]);
          }
        }

        // Remove the minimum and max if they should not be included in the filter
        if (modelHasMax && !operator.hasMax) {
          this.model.set("max", this.model.defaults().max);
        }
        if (modelHasMin && !operator.hasMin) {
          this.model.set("min", this.model.defaults().min);
        }

        if (isRange) {
          this.model.set("range", true);
        } else if (isNumeric) {
          this.model.set("range", false);
        } else {
          this.model.unset("range");
        }

        // If the operator changed for a numeric or date field, reset the value
        // select. This way it can change from a range to a single value input if
        // needed.
        if (isNumeric) {
          this.removeInput("value");
          this.addValueSelect();
        }
      },

      /**
       * Get a list of {@link QueryRuleView#operatorOptions operatorOptions} that are
       * allowed for this view's filter model
       * @param  {string[]} [inputFields] - Optional list of fields to use instead of the
       * fields set on this view's Filter model
       * @returns {object[]} - Returns an array of operator options that are allowed for
       * this view's filter model
       * @since 2.15.0
       */
      getOperatorOptions(inputFields) {
        // Check which type of rule this is (boolean, numeric, text, date)
        const type = this.model.get("nodeName");

        // If this rule contains a special field, replace the real query field names
        // with the special field names for the purpose of selecting operator options
        let fields = inputFields || this.model.get("fields");
        fields = _.clone(fields);
        fields = this.convertToSpecialFields(fields);

        // Get the list of options for a user to select from based on field name.
        // All of the rule's fields must be contained within the operator option's
        // list of allowed fields for it to be a match.
        let options = _.filter(this.operatorOptions, (option) => {
          if (option.fields) {
            return _.every(fields, (fieldName) =>
              option.fields.includes(fieldName),
            );
          }
          return false;
        });

        // Function to check if option types include the specified type
        const includesType = (option) =>
          option.types && option.types.includes(type);

        // Get the list of options for a user to select from based on type, if there
        // were none that matched based on field names
        if (!options || !options.length) {
          options = this.operatorOptions.filter(includesType);
        }

        return options;
      },

      /**
       * getSelectedOperator - Based on values set on the model, get the label to show
       * in the "operator" filed of the Query Rule
       * @returns {string} The operator label
       */
      getSelectedOperator() {
        // This view
        const view = this;
        // The user-facing operator label that we will return
        let selectedOperator = "";

        // --- Filter 1 - Filter options by type --- //

        // Reduce list of options to only  those that apply to the current filter type
        const type = view.model.get("nodeName");
        let operatorOptions = this.getOperatorOptions();

        // --- Filter 2 - filter by 'matchSubstring', 'exclude', 'min', 'max' --- //

        // Create the conditions based on the model
        const conditions = _.pick(
          this.model.attributes,
          "matchSubstring",
          "exclude",
          "min",
          "max",
        );

        const isNumeric = ["dateFilter", "numericFilter"].includes(type);

        if (!conditions.min && conditions.min !== 0) {
          if (isNumeric) {
            conditions.hasMin = false;
          }
        } else if (isNumeric) {
          conditions.hasMin = true;
        }
        if (!conditions.max && conditions.max !== 0) {
          if (isNumeric) {
            conditions.hasMax = false;
          }
        } else if (isNumeric) {
          conditions.hasMax = true;
        }

        delete conditions.min;
        delete conditions.max;

        operatorOptions = _.where(operatorOptions, conditions);

        // --- Filter 3 - filter based on the value, if there's > 1 option --- //

        if (operatorOptions.length > 1) {
          // Model values that determine the user-facing operator eg ["*"], [true],
          // [false]
          let specialValues = _.compact(
            _.pluck(this.operatorOptions, "values"),
          );
          specialValues = specialValues.map((val) => JSON.stringify(val));
          specialValues = _.uniq(specialValues);

          const modelValues = view.model.get("values");
          const modelValuesString = JSON.stringify(modelValues);

          operatorOptions = operatorOptions.filter((option) => {
            if (!option.values) return true; // Filter in options without values
            if (!specialValues.includes(modelValuesString)) return false; // If model values not special, filter out
            return JSON.stringify(option.values) === modelValuesString; // Check exact match for special values
          });
        }
        // --- Return value --- //

        if (operatorOptions.length === 1) {
          selectedOperator = operatorOptions[0].label;
        }

        return selectedOperator;
      },

      /**
       * getCategory - Given an array of query fields, get the user-facing category that
       * these fields belong to. If there are fields from multiple categories, then a
       * default "Text" category is returned.
       * @param  {string[]} fields An array of query (Solr) fields
       * @returns {string} The label for the category that the given fields belong to
       */
      getCategory(fields) {
        const categories = [];
        // When fields is empty or are different types
        const defaultCategory = "Text";

        if (!fields || fields.length === 0 || fields[0] === "") {
          return defaultCategory;
        }

        fields.forEach((field) => {
          // Get the category of the field from the matching filter model in the Query
          // Fields Collection
          const fieldModel = MetacatUI.queryFields.findWhere({ name: field });
          categories.push(fieldModel.get("category"));
        });

        // Test of all the fields are of the same type
        const allEqual = categories.every((val, i, arr) => val === arr[0]);

        if (allEqual) {
          return categories[0];
        }
        return defaultCategory;
      },

      /**
       * Create and insert an input field where the user can provide a search value
       */
      addValueSelect() {
        const view = this;
        const fields = this.model.get("fields");
        const filterType = MetacatUI.queryFields.getRequiredFilterType(fields);
        const category = this.getCategory(fields);
        const interfaces = this.valueSelectUImap;
        let label = "";

        // To help guide users to create valid queries, the type of value field will
        // vary based on the type of field (i.e. filter nodeName), and the operator
        // selected.

        // Some user-facing operators (e.g. "is true") don't require a value to be set
        const selectedOperator = _.findWhere(this.operatorOptions, {
          label: this.getSelectedOperator(),
        });
        if (selectedOperator) {
          if (selectedOperator.values && selectedOperator.values.length) {
            return;
          }
        }

        // Find the appropriate UI to use the the value select field. Find the first
        // match in the valueSelectUImap according to the filter type and the
        // categories associated with the metadata field.
        const interfaceProperties = _.find(interfaces, (thisInterface) => {
          let typesMatch = true;
          let categoriesMatch = true;
          let namesMatch = true;
          if (thisInterface.queryFields && thisInterface.queryFields.length) {
            fields.forEach((field) => {
              if (thisInterface.queryFields.includes(field) === false) {
                namesMatch = false;
              }
            });
          }
          if (thisInterface.filterTypes && thisInterface.filterTypes.length) {
            typesMatch = thisInterface.filterTypes.includes(filterType);
          }
          if (thisInterface.categories && thisInterface.categories.length) {
            categoriesMatch = thisInterface.categories.includes(category);
          }
          return typesMatch && categoriesMatch && namesMatch;
        });

        this.valueSelect = interfaceProperties.uiFunction.call(this);
        if (interfaceProperties.label && interfaceProperties.label.length) {
          label = $(
            `<p class='subtle search-select-label'>${interfaceProperties.label}</p>`,
          );
        }

        // Append and render the chosen value selector
        this.el.append(view.valueSelect.el);
        this.valueSelect.$el.addClass(this.valuesClass);
        view.valueSelect.render();
        if (label) {
          view.valueSelect.$el.prepend(label);
        }

        // Make sure the listeners set below are not set multiple times
        this.stopListening(
          view.valueSelect.model,
          "change:selected change:separator",
        );
        this.stopListening(view.valueSelect.model, "change:lastInteraction");

        // Update model when the values change - note that the date & numeric filter
        // views do not trigger a 'change:selected' event, (because they are not based
        // on a SearchSelect View) but update the models directly
        this.listenTo(
          view.valueSelect.model,
          "change:selected",
          (_model, newValues) => {
            this.handleValueChange(newValues);
          },
        );

        // Update the model when the operator changes
        this.listenTo(
          view.valueSelect.model,
          "change:separator",
          (_model, newOperator) => {
            this.model.set("operator", newOperator);
          },
        );

        // Show a message that reminds the user that capitalization matters when they
        // are typing a value for a field that is case-sensitive.
        this.listenTo(
          view.valueSelect.model,
          "change:lastInteraction",
          (model, interaction) => {
            if (interaction !== "focus") return;
            const currentFields = view.model.get("fields");
            const isCaseSensitive = _.some(currentFields, (field) =>
              MetacatUI.queryFields.findWhere({
                name: field,
                caseSensitive: true,
              }),
            );

            if (isCaseSensitive) {
              let fieldsText = "The field";
              if (currentFields.length > 1) {
                fieldsText = "At least one of the fields";
              }

              const message = `<i class='icon-lightbulb icon-on-left'></i> <b>Hint:</b> ${fieldsText} you selected is case-sensitive. Capitalization matters here.`;
              view.valueSelect.showMessage(message, "info", false);
            } else {
              view.valueSelect.removeMessages();
            }
          },
        );
      },

      /**
       * handleValueChange - Called when the select values for rule are changed. Updates
       * the model.
       * @param  {string[]} newValues The new values that were selected
       */
      handleValueChange(newValues) {
        // TODO: validate values
        // Don't add empty values to the model
        const filteredValues = _.reject(newValues, (val) => val === "");
        this.model.set("values", filteredValues);
      },

      /**
       * Remove one of the three input fields from the rule
       * @param  {string} inputType Which of the inputs to remove? "field", "operator",
       * or "value"
       */
      removeInput(inputType) {
        // TODO - what, if any, model updates should happen here?
        switch (inputType) {
          case "value":
            if (this.valueSelect) {
              this.stopListening(this.valueSelect.model, "change:selected");
              this.stopListening(
                this.valueSelect.model,
                "change:lastInteraction",
              );
              this.valueSelect.remove();
              this.valueSelect = null;
            }
            break;
          case "operator":
            if (this.operatorSelect) {
              this.stopListening(this.operatorSelect.model, "change:selected");
              this.operatorSelect.remove();
              this.operatorSelect = null;
            }
            break;
          case "field":
            if (this.fieldSelect) {
              this.stopListening(this.fieldSelect.model, "change:selected");
              this.fieldSelect.remove();
              this.fieldSelect = null;
            }
            break;
          default:
            break;
        }
      },

      /**
       * Indicate to the user that the rule will be removed when they hover over the
       * remove button.
       * @param {Event} e The mouseover or mouseout event
       */
      previewRemove(e) {
        const normalOpacity = 1.0;
        const previewOpacity = 0.2;
        const speed = 175;

        const removeEl = e.target;
        const subElements = this.$el.children().not(removeEl);

        if (e.type === "mouseover") {
          subElements.fadeTo(speed, previewOpacity);
          $(removeEl).fadeTo(speed, normalOpacity);
        }
        if (e.type === "mouseout") {
          subElements.fadeTo(speed, normalOpacity);
          $(removeEl).fadeTo(speed, previewOpacity);
        }
      },

      /**
       * removeSelf - When the delete button is clicked, remove this entire View and
       * associated model
       */
      removeSelf() {
        $("body .popover").remove();
        $("body .tooltip").remove();
        if (this.model && this.model.collection) {
          this.model.collection.remove(this.model);
        }
        this.remove();
      },
    },
  ));
