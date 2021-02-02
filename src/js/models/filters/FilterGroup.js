/* global define */
define(["jquery", "underscore", "backbone", "collections/Filters" ],
  function ($, _, Backbone, Filters) {

    /**
    * @class FilterGroup
    * @classdesc A group of multiple Filters, and optionally nested Filter Groups, which may
    * be combined to create a complex query
    * @classcategory Models/Filters
    * @extends Backbone.Model
    * @constructs
    */
    var FilterGroup = Backbone.Model.extend(
    /** @lends FilterGroup.prototype */{

        /**
          * The name of this Model
          * @type {string}
          * @readonly
          */
        type: "FilterGroup",

        /**
            * Default attributes for DefinitionFilterGroupModels
            * @type {Object}
            * @property {type} name - desc
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
            isNested: false,
          }
        },

        /**
        * This function is executed whenever a new model is created.
        */
        initialize: function (attributes) {

          if (attributes && attributes.objectDOM) {
            var groupAttrs = this.parse(attributes.objectDOM);
            this.set(groupAttrs);
          }

          if (attributes && attributes.filters) {
            var filtersCollection = new Filters();
            filtersCollection.add(attributes.filters);
            this.set("filters", filtersCollection);
          }

        },

        /**
        * Overrides the default Backbone.Model.parse() function to parse the filterGroup
        * XML snippet
        *
        * @param {Element} xml - The XML Element that contains all the FilterGroup elements
        * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
        */
        parse: function (xml) {

          var modelJSON = {};

          // Parse all the text nodes. Node names and model attributes always match
          // in this case.
          ["label", "description", "icon", "operator"].forEach(
            function(nodeName){
              if($(xml).find(nodeName).length){
                modelJSON[nodeName] = this.parseTextNode(xml, nodeName)
              }
            },
            this
          );

          // Parse the exclude field node (true or false)
          if( $(xml).find("exclude").length ){
            modelJSON.exclude = (this.parseTextNode(xml, "exclude") === "true") ? true : false;
          }
          
          // Remove any nodes that aren't filters or filter groups from the XML
          var filterNodeNames = [
            "filter", "booleanFilter", "dateFilter", "numericFilter", "filterGroup",
            "choiceFilter", "toggleFilter"
          ]

          filterXML = _.clone(xml)
          $(filterXML)
            .children()
            .not(filterNodeNames.join(", "))
            .remove();

          // Add the filters and nested filter groups to this filters model
          // TODO: Add isNested property?
          modelJSON.filters = new Filters(null, { objectDOM: xml });

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
            if (isMultiple)
              return [];
            //Return null if the isMultiple flag is false
            else
              return null;
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
         * Updates the XML DOM with the new values from the model
         *
         *  @return {XMLElement} An updated filterGroup XML element from a portal document
        */
        updateDOM: function () {

          // Get the current object DOM
          var objectDOM = this.get("objectDOM");

          // Clone and empty the DOM if it exists
          if (objectDOM) {
            objectDOM = objectDOM.cloneNode(true);
            $(objectDOM).empty();
            // Otherwise create a new <filterGroup> node from scratch
          } else {
            // create an XML filterGroup element from scratch
            var objectDOM = new DOMParser().parseFromString("<filterGroup></filterGroup>", "text/xml"),
              objectDOM = $(objectDOM).children()[0];
          }

          // Get the new filter group data
          var filterGroupData = {
            label: this.get("label"),
            description: this.get("description"),
            icon: this.get("icon")
          }

          // Serialize the simple text elements
          _.map(filterGroupData, function (value, nodeName) {
            // Don't serialize falsey values
            if (value) {
              // Make new sub-node
              var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
              $(nodeSerialized).text(value);
              // Append new sub-node to objectDOM
              $(objectDOM).append(nodeSerialized);
            }
          });

          // Serialize the filters
          var filterModels = this.get("filters").models;

          // Don't serialize falsey values
          if (filterModels) {
            // Update each filter and append it to the DOM
            _.each(filterModels, function (filterModel) {
              if (filterModel) {
                var filterModelSerialized = filterModel.updateDOM();
              }
              $(objectDOM).append(filterModelSerialized);
            });
          }

          return objectDOM

        }

      });

    return FilterGroup;
  });
