/* global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "collections/Filters",
  "models/filters/Filter",
], function ($, _, Backbone, Filters, Filter) {
  /**
   * @class FilterGroup
   * @classdesc A group of multiple Filters, and optionally nested Filter Groups, which
   * may be combined to create a complex query. A FilterGroup may be a Collection
   * FilterGroupType or a Portal UIFilterGroupType.
   * @classcategory Models/Filters
   * @extends Backbone.Model
   * @constructs
   */
  var FilterGroup = Backbone.Model.extend(
    /** @lends FilterGroup.prototype */ {
      /**
       * The name of this Model
       * @type {string}
       * @readonly
       */
      type: "FilterGroup",

      /**
       * Default attributes for FilterGroup models
       * @type {Object}
       * @property {string} label - For UIFilterGroupType filter groups, a
       * human-readable short label for this Filter Group
       * @property {string} description - For UIFilterGroupType filter groups, a
       * description of the Filter Group's function
       * @property {string} icon - For UIFilterGroupType filter groups, a term that
       * identifies a single icon in a supported icon library.
       * @property {Filters} filters - A collection of Filter models that represent a
       * full or partial query
       * @property {XMLElement} objectDOM - FilterGroup XML
       * @property {string} operator - The operator to use between filters (including
       * filter groups) set on this model. Must be set to "AND" or "OR".
       * @property {boolean} exclude - If true, search index docs matching the filters
       * within this group will be excluded from the search results
       * @property {boolean} isUIFilterType - Set to true if this group is
       * UIFilterGroupType (aka custom Portal search filter). Otherwise, it's assumed
       * that this model is FilterGroupType (e.g. a Collection FilterGroupType)
       * @property {string} nodeName - the XML node name to use when serializing this
       * model. For example, may be "filterGroup" or "definition".
       * @property {boolean} isInvisible - If true, this filter will be added to the
       * query but will act in the "background", like a default filter. It will not
       * appear in the Query Builder or other UIs. If this is invisible, then the
       * "isInvisible" property on sub-filters will be ignored.
       * @property {boolean} mustMatchIds - If the search results must always match one
       * of the ids in the id filters, then the id filters will be added to the query
       * with an AND operator.
       */
      defaults: function () {
        return {
          label: null,
          description: null,
          icon: null,
          filters: null,
          objectDOM: null,
          operator: "AND",
          exclude: false,
          isUIFilterType: false,
          nodeName: "filterGroup",
          isInvisible: false,
          mustMatchIds: false,
          // TODO: support options for UIFilterGroupType 1.1.0
          // options: [],
        };
      },

      /**
       * This function is executed whenever a new FilterGroup model is created. Model
       * attributes are set either by parsing attributes.objectDOM or ny extracting the
       * properties from attributes (e.g. attributes.nodeName, attributes.operator, etc)
       */
      initialize: function (attributes) {
        if (!attributes) {
          attributes = {};
        }

        if (attributes.isUIFilterType) {
          this.set("isUIFilterType", true);
        }

        // When a Filter model within this Filter group changes, or when the Filters
        // collection is updated, trigger a change event in this filterGroup model.
        // Updates and Changes in the Filters collection won't trigger an event from
        // this model otherwise. This helps when other models, collections, views are
        // listening to this filterGroup, e.g. when the collections model updates the
        // searchModel whenever the definition changes.
        this.off("change:filters");
        this.on(
          "change:filters",
          function () {
            this.stopListening(this.get("filters"), "update change");
            this.listenTo(
              this.get("filters"),
              "update change",
              function (model, record) {
                this.trigger("update", model, record);
              },
            );
          },
          this,
        );

        var newFiltersOptions = {};
        var catalogSearch = false;

        if (attributes.catalogSearch) {
          this.set("catalogSearch", true);
        }

        // Set the attributes on this model by parsing XML if some was provided,
        // or by using any attributes provided to this model
        if (attributes.objectDOM) {
          var groupAttrs = this.parse(attributes.objectDOM, catalogSearch);
          this.set(groupAttrs);
        } else {
          [
            "label",
            "description",
            "icon",
            "operator",
            "exclude",
            "nodeName",
            "isInvisible",
          ].forEach(function (modelAttribute) {
            if (
              attributes[modelAttribute] ||
              attributes[modelAttribute] === false
            ) {
              this.set(modelAttribute, attributes[modelAttribute]);
            }
          }, this);
        }

        if (attributes.filters) {
          var filtersCollection = new Filters(null, newFiltersOptions);
          filtersCollection.add(attributes.filters);
          this.set("filters", filtersCollection);
        }

        // Start a new Filters collection if no filters were provided
        if (!this.get("filters")) {
          this.set("filters", new Filters(null, newFiltersOptions));
        }

        if (attributes.mustMatchIds) {
          this.set("mustMatchIds", true);
          this.get("filters").mustMatchIds = true;
        }

        // The operator must be AND or OR
        if (!["AND", "OR"].includes(this.get("operator"))) {
          // Set the value to the default
          this.set("operator", this.defaults()["operator"]);
        }
      },

      /**
       * Overrides the default Backbone.Model.parse() function to parse the filterGroup
       * XML snippet
       *
       * @param {Element} xml - The XML Element that contains all the FilterGroup elements
       * @param {boolean} catalogSearch [false] - Set to true to append a catalog search phrase
       * to the search query created from Filters that limits the results to un-obsoleted
       * metadata.
       * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
       */
      parse: function (xml, catalogSearch = false) {
        var modelJSON = {};

        if (!xml) {
          return modelJSON;
        }

        // FilterGroups can be either <definition> or <filterGroup>
        this.set("nodeName", xml.nodeName);

        // Parse all the text nodes. Node names and model attributes always match
        // in this case.
        ["label", "description", "icon", "operator"].forEach(function (
          nodeName,
        ) {
          if ($(xml).find(nodeName).length) {
            modelJSON[nodeName] = this.parseTextNode(xml, nodeName);
          }
        }, this);

        // Parse the exclude field node (true or false)
        if ($(xml).find("exclude").length) {
          modelJSON.exclude =
            this.parseTextNode(xml, "exclude") === "true" ? true : false;
        }

        // Remove any nodes that aren't filters or filter groups from the XML
        var filterNodeNames = [
          "filter",
          "booleanFilter",
          "dateFilter",
          "numericFilter",
          "filterGroup",
          "choiceFilter",
          "toggleFilter",
        ];
        filterXML = xml.cloneNode(true);
        $(filterXML).children().not(filterNodeNames.join(", ")).remove();

        // Add the filters and nested filter groups to this filters model
        // TODO: Add isNested property for filterGroups that are within filterGroups?
        var filtersOptions = {
          objectDOM: filterXML,
          isUIFilterType: this.get("isUIFilterType"),
        };

        if (catalogSearch) {
          filtersOptions.catalogSearch = true;
        }

        modelJSON.filters = new Filters(null, filtersOptions);

        return modelJSON;
      },

      /**
       * Gets the text content of the XML node matching the given node name
       *
       * @param {Element} parentNode - The parent node to select from
       * @param {string} nodeName - The name of the XML node to parse
       * @param {boolean} isMultiple - If true, parses the nodes into an array
       * @return {(string|Array)} - Returns a string or array of strings of the text content
       */
      parseTextNode: function (parentNode, nodeName, isMultiple) {
        var node = $(parentNode).children(nodeName);

        //If no matching nodes were found, return falsey values
        if (!node || !node.length) {
          //Return an empty array if the isMultiple flag is true
          if (isMultiple) return [];
          //Return null if the isMultiple flag is false
          else return null;
        }
        //If exactly one node is found and we are only expecting one, return the text content
        else if (node.length == 1 && !isMultiple) {
          return node[0].textContent.trim();
        }
        //If more than one node is found, parse into an array
        else {
          return _.map(node, function (node) {
            return node.textContent.trim() || null;
          });
        }
      },

      /**
       * Builds the query string to send to the query engine. Iterates over each filter
       * in the filter group and adds to the query string.
       *
       * @return {string} The query string to send to Solr
       */
      getQuery: function () {
        try {
          // Although the logic used in this function is very similar to the getQuery()
          // function in the Filters collection, we can't just use
          // this.get("filters").getQuery(operator), because there are some subtle
          // differences with how queries are built using the information from
          // filterGroups, especially when the exclude attribute is set to true.

          var queryString = "";
          if (this.isEmpty()) {
            return queryString;
          }

          // The operator to use between queries from filters/sub-filterGroups
          var operator = this.get("operator");

          // Helper function that adds URI encoded spaces to either side of a string
          var padString = function (string) {
            return "%20" + string + "%20";
          };
          // Helper function that appends a new part to a query fragment, using an
          // operator if the initial fragment is not empty. Returns the string as-is if
          // the newFragment is empty.
          var addQueryFragment = function (string, newFragment, operator) {
            if (
              !newFragment ||
              (newFragment && newFragment.trim().length == 0)
            ) {
              return string;
            }
            if (string && string.trim().length) {
              string += padString(operator);
            }
            string += newFragment;
            return string;
          };
          // Helper function that wraps a string in parentheses
          var wrapInParentheses = function (string) {
            if (!string || (string && string.trim().length == 0)) {
              return string;
            }
            // TODO: We still want to wrap in parentheses in cases like "(a) OR (b)" and
            // "a OR (b) or c" but not in cases like (a OR b)

            // var alreadyWrapped = /^\(.*\)$/.test(string);
            // if (alreadyWrapped) {
            //   return string
            // }

            return "(" + string + ")";
          };

          // Get the list of filters that use id fields since these are used differently.
          var idFilters = this.get("filters").getIdFilters();
          // Get the remaining filters that don't contain any ID fields
          var mainFilters = this.get("filters").getNonIdFilters();

          // If the filterGroup should be excluded from the results, then don't include
          // the isPartOf filter in the part of the query that gets excluded. The
          // isPartOf filter is only meant to *include* additional results, never
          // exclude any.
          if (this.get("exclude")) {
            var isPartOfFilter = null;
            idFilters.forEach(function (filterModel, index) {
              if (filterModel.get("fields")[0] == "isPartOf") {
                idFilters.splice(index, 1);
                isPartOfFilter = filterModel;
              }
            }, this);
          }

          // Create the grouped query for the id filters (this will have the isPartOf
          // filter query if exclude is false, and will not have it if exclude is true)
          var idFilterQuery = this.get("filters")
            .getGroupQuery(idFilters, "OR")
            .trim();
          // Make the query fragment for all of the filters that do not contain ID fields
          var mainQuery = this.get("filters")
            .getGroupQuery(mainFilters, operator)
            .trim();
          // Make the query string that should be added to all catalog searches
          var categoryQuery = "";
          if (this.get("catalogSearch")) {
            categoryQuery = this.get("filters")
              .createCatalogSearchQuery()
              .trim();
          }
          // Make the query string for the isPartOf filter when the filter group should
          // be excluded
          var isPartOfQuery = "";
          if (isPartOfFilter) {
            isPartOfQuery = isPartOfFilter.getQuery().trim();
          }

          if (this.get("exclude")) {
            // The query is constructed like so for filter groups with exclude set to true:
            // ( ( -( mainQuery OR idFilterQuery ) AND *:* ) OR isPartOfQuery ) AND categoryQuery
            // Build the query string piece by piece:

            // 1. mainQuery
            queryString += mainQuery;
            queryString = wrapInParentheses(queryString);
            // 2. ( mainQuery OR idFilterQuery )
            if (idFilterQuery.trim().length) {
              idOperator = this.get("mustMatchIds") ? "AND" : "OR";
              queryString = addQueryFragment(
                queryString,
                idFilterQuery,
                idOperator,
              );
              queryString = wrapInParentheses(queryString);
            }
            // 3. -( mainQuery OR idFilterQuery )
            if (queryString.trim().length) {
              queryString = "-" + queryString;
            }
            // 4. ( -( mainQuery OR idFilterQuery ) AND *:* )  - see Filter model
            // requiresPositiveClause for details on why positive clause is
            // needed here
            if (queryString.trim().length) {
              queryString = addQueryFragment(queryString, "*:*", "AND");
              queryString = wrapInParentheses(queryString);
            }
            // 5. ( ( -( mainQuery OR idFilterQuery ) AND *:* ) OR isPartOfQuery)
            if (isPartOfQuery) {
              queryString = addQueryFragment(queryString, isPartOfQuery, "OR");
              queryString = wrapInParentheses(queryString);
            }

            // 6. (-( mainQuery OR idFilterQuery ) AND *:* OR isPartOfQuery) AND
            //    categoryQuery
            queryString = addQueryFragment(queryString, categoryQuery, "AND");
          } else {
            // The query is constructed like so for filter groups with exclude set to
            // false: ( mainQuery OR idFilterQuery ) AND catalogQuery where
            // idFilterQuery includes the isPartOfQuery

            // 1. mainQuery
            queryString += mainQuery;
            queryString = wrapInParentheses(queryString);
            // 2. ( mainQuery OR idFilterQuery )
            if (idFilterQuery.trim().length) {
              queryString = addQueryFragment(queryString, idFilterQuery, "OR");
              queryString = wrapInParentheses(queryString);
            }
            // 3. ( mainQuery OR idFilterQuery ) AND catalogQuery
            queryString = addQueryFragment(queryString, categoryQuery, "AND");
          }

          return queryString;
        } catch (error) {
          console.log(
            "Error creating a query for a Filter Group, error details:" + error,
          );
        }
      },

      /**
       * Overrides the default Backbone.Model.validate.function() to check if this
       * FilterGroup model has all the required values.
       *
       * @param {Object} [attrs] - A literal object of model attributes to validate.
       * @param {Object} [options] - A literal object of options for this validation
       * process
       * @return {Object} If there are errors, an object comprising error messages. If
       * no errors, returns nothing.
       */
      validate: function () {
        try {
          var errors = {};

          // The operator must be AND or OR
          if (!["AND", "OR"].includes(this.get("operator"))) {
            //Reset the value to the default rather than return an error
            this.set("operator", this.defaults()["operator"]);
          }

          //Exclude should always be a boolean
          if (typeof this.get("exclude") !== "boolean") {
            // Reset the value to the default rather than return an error
            this.set("exclude", this.defaults().exclude);
          }

          // Validate label, icon, and description for UI Filter Groups
          if (this.get("isUIFilterType")) {
            var textAttributes = ["label", "icon", "description"];
            // These fields should be strings
            _.each(
              textAttributes,
              function (attr) {
                if (typeof this.get(attr) !== "string") {
                  // Reset the value to the default rather than return an error
                  this.set(attr, this.defaults()[attr]);
                }
              },
              this,
            );
            // If this filter group is not empty, and it's a UI Filter Group, then
            // the group needs a label to be valid.
            if (!this.isEmpty() && !this.get("label")) {
              // Set a generic label instead of returning an error
              this.set("label", "Search");
            }
          }

          // There must be at least one filter or filter group within each group,
          // and each filter must be valid.
          if (this.get("filters").length == 0) {
            errors.noFilters = "At least one filter is required.";
          } else {
            this.get("filters").each(function (filter) {
              if (!filter.isValid()) {
                errors.filter = "At least one filter is invalid.";
              }
            });
          }

          if (Object.keys(errors).length) {
            return errors;
          } else {
            return;
          }
        } catch (error) {
          console.log(
            "Error validating a FilterGroup. Error details: " + error,
          );
        }
      },

      /**
       * isEmpty - Checks whether this Filter Group has any filter models that are not
       * empty.
       *
       * @return {boolean} returns true if the Filter Group has Filter models that are
       * not empty
       */
      isEmpty: function () {
        try {
          var filters = this.get("filters");
          if (!filters || !filters.length) {
            return true;
          }
          var subFilters = filters.getNonEmptyFilters();
          if (!subFilters || !subFilters.length) {
            return true;
          } else {
            return false;
          }
        } catch (error) {
          console.log(
            "Error checking if a Filter Group is empty. Assuming it is not." +
              " Error details: " +
              error,
          );
          return false;
        }
      },

      /**
       * Updates the XML DOM with the new values from the model
       * @param {object} [options] A literal object with options for this serialization
       * @return {XMLElement} An updated filterGroup XML element
       */
      updateDOM: function (options) {
        try {
          // Don't serialize an empty filter group
          if (this.isEmpty()) {
            return null;
          }

          // Clone the DOM if it exists
          var objectDOM = this.get("objectDOM");

          if (objectDOM) {
            objectDOM = objectDOM.cloneNode(true);
          } else {
            // Create an XML filterGroup or definition element from scratch
            if (!objectDOM) {
              var name = this.get("nodeName");
              objectDOM = new DOMParser().parseFromString(
                "<" + name + "></" + name + ">",
                "text/xml",
              );
              objectDOM = $(objectDOM).find(name)[0];
            }
          }

          $(objectDOM).empty();

          // label, description, and icon are elements that are used in Portal
          // UIFilterGroupType filterGroups only. Collection FilterGroupType filterGroups
          // do not use these elements.
          if (this.get("isUIFilterType")) {
            // Get the new values for the simple text elements
            var filterGroupData = {
              label: this.get("label"),
              description: this.get("description"),
              icon: this.get("icon"),
            };
            // Serialize the simple text elements
            _.map(filterGroupData, function (value, nodeName) {
              // Don't serialize falsey values
              if (value) {
                // Make new sub-node
                var nodeSerialized =
                  objectDOM.ownerDocument.createElement(nodeName);
                $(nodeSerialized).text(value);
                // Append new sub-node to objectDOM
                $(objectDOM).append(nodeSerialized);
              }
            });
          }

          // Serialize the filters
          var filterModels = this.get("filters").models;

          // TODO: Remove filter types depending on isUIFilterType attribute?
          // toggleFilter and choiceFilter are only allowed in Portal UIFilterGroupType.
          // nested filterGroups are only allowed in Collection FilterGroupType.

          // Don't serialize falsey values
          if (filterModels && filterModels.length) {
            // Update each filter and append it to the DOM
            _.each(filterModels, function (filterModel) {
              if (filterModel) {
                var filterModelSerialized = filterModel.updateDOM();
              }
              $(objectDOM).append(filterModelSerialized);
            });
          }

          // exclude and operator are elements used only in Collection FilterGroupType
          // filterGroups. Portal UIFilterGroupType filterGroups do not use either of
          // these elements.
          if (!this.get("isUIFilterType")) {
            // The nodeName and model attribute are the same in these cases.
            ["operator", "exclude"].forEach(function (nodeName) {
              // Don't serialize empty, null, undefined, or default values
              var value = this.get(nodeName);
              if (
                (value || value === false) &&
                value !== this.defaults()[nodeName]
              ) {
                // Make new sub-node
                var nodeSerialized =
                  objectDOM.ownerDocument.createElement(nodeName);
                $(nodeSerialized).text(value);
                // Append new sub-node to objectDOM
                $(objectDOM).append(nodeSerialized);
              }
            }, this);
          }

          // TODO: serialize the new <option> elements supported for Portal
          // UIFilterGroupType 1.1.0
          // if(this.get("isUIFilterType")){
          //  ... serialize options ...
          // }

          return objectDOM;
        } catch (error) {
          console.error("Unable to serialize a Filter Group.", error);
          return this.get("objectDOM") || "";
        }
      },
    },
  );

  return FilterGroup;
});
