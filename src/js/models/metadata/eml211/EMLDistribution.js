/* global define */
define(["jquery", "underscore", "backbone", "models/DataONEObject"], function (
  $,
  _,
  Backbone,
  DataONEObject
) {
  /**
   * @class EMLDistribution
   * @classdesc Information on how the resource is distributed online and
   * offline
   * @classcategory Models/Metadata/EML211
   * @see
   * https://eml.ecoinformatics.org/schema/eml-resource_xsd.html#DistributionType
   * @extends Backbone.Model
   * @constructor
   */
  var EMLDistribution = Backbone.Model.extend({
    /**
     * Default values for an EML 211 Distribution model. This is essentially a
     * flattened version of the EML 2.1.1 DistributionType, including nodes and
     * node attributes. Not all nodes are supported by this model yet.
     * @type {Object}
     * @property {string} type - The name of the top-level XML element that this
     * model represents (distribution)
     * @property {string} objectXML - The XML string representation of the
     * distribution
     * @property {Element} objectDOM - The DOM representation of the
     * distribution
     * @property {string} mediumName - The name of the medium on which the
     * offline distribution is stored
     * @property {string} mediumVolume - The volume number of the medium on
     * which the offline distribution is stored
     * @property {string} mediumFormat - The format of the medium on which the
     * offline distribution is stored
     * @property {string} mediumNote - A note about the medium on which the
     * offline distribution is stored
     * @property {string} url - The URL of the online distribution
     * @property {string} urlFunction - The purpose of the URL. May be either
     * "information" or "download".
     * @property {string} onlineDescription - A description of the online
     * distribution
     * @property {EML211} parentModel - The parent model of this distribution
     * model
     */
    defaults: {
      type: "distribution",
      objectXML: null,
      objectDOM: null,
      mediumName: null,
      mediumVolume: null,
      mediumFormat: null,
      mediumNote: null,
      url: null,
      urlFunction: null,
      onlineDescription: null,
      parentModel: null,
    },

    /**
     * The direct children of the <distribution> node that can have values, and
     * that are supported by this model. "inline" is not supported yet. A
     * distribution may have ONE of these nodes.
     * @type {string[]}
     * @since x.x.x
     */
    distLocations: ["offline", "online"],

    /**
     * lower-case EML node names that belong within the <offline> node. These
     * must be in the correct order.
     * @type {string[]}
     * @since x.x.x
     */
    offlineNodes: ["mediumname", "mediumvolume", "mediumformat", "mediumnote"],

    /**
     * lower-case EML node names that belong within the <online> node. These
     * must be in the correct order.
     * @type {string[]}
     * @since x.x.x
     */
    onlineNodes: ["url"],

    /**
     * the allowed values for the urlFunction attribute
     * @type {string[]}
     * @since x.x.x
     */
    urlFunctionTypes: ["information", "download"],

    /**
     * Initializes this EMLDistribution object
     * @param {Object} options - A literal object with options to pass to the
     * model
     */
    initialize: function (attributes, options) {
      const nodeAttr = Object.values(this.nodeNameMap());
      this.listenTo(
        this,
        "change:" + nodeAttr.join(" change:"),
        this.trickleUpChange
      );
    },

    /*
     * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased
     * EML node names (valid in EML). Used during parse() and serialize()
     */
    nodeNameMap: function () {
      return {
        authsystem: "authSystem",
        connectiondefinition: "connectionDefinition",
        mediumdensity: "mediumDensity",
        mediumdensityunits: "mediumDensityUnits",
        mediumformat: "mediumFormat",
        mediumname: "mediumName",
        mediumnote: "mediumNote",
        mediumvolume: "mediumVolume",
        url: "url",
      };
    },

    /**
     * Parses the given XML node or object and sets the model's attributes
     * @param {Object} attributes - the attributes passed in when the model is
     * instantiated. Should include objectDOM or objectXML to be parsed.
     */
    parse: function (attributes) {
      if (!attributes) attributes = {};
      const objectDOM = attributes.objectDOM || attributes.objectXML;
      if (!objectDOM) return attributes;
      const $objectDOM = $(objectDOM);

      const nodeNameMap = this.nodeNameMap();
      this.distLocations.forEach((distLocation) => {
        const location = $objectDOM.find(distLocation);
        if (location.length) {
          this[`${distLocation}Nodes`].forEach((nodeName) => {
            const value = location.children(nodeName)?.text()?.trim();
            if (value.length) {
              attributes[nodeNameMap[nodeName]] = value;
            }
          });
        }
      });

      // Check for a urlFunction attribute if there is a url node
      const url = $objectDOM.find("url");
      if (url.length) {
        attributes.urlFunction = url.attr("function") || null;
      }

      return attributes;
    },

    /**
     * Returns the XML string representation of this model
     * @returns {string}
     */
    serialize: function () {
      const objectDOM = this.updateDOM();
      const xmlString = objectDOM.outerHTML;

      // Camel-case the XML
      xmlString = this.formatXML(xmlString);

      return xmlString;
    },

    /**
     * Check if the model has values for the given distribution location.
     * @param {string} location - one of the names of the direct children of the
     * <distribution> node, i.e. any of the values in this.distLocations.
     * @returns {boolean} - true if the model has values for the given location,
     * false otherwise.
     * @since x.x.x
     */
    hasValuesForDistributionLocation(location) {
      const nodeNameMap = this.nodeNameMap();
      return this[`${location}Nodes`].some((nodeName) => {
        return this.get(nodeNameMap[nodeName]);
      });
    },

    /*
     * Makes a copy of the original XML DOM and updates it with the new values
     * from the model.
     */
    updateDOM: function () {
      const objectDOM =
        this.get("objectDOM") || document.createElement(this.get("type"));
      const $objectDOM = $(objectDOM);

      // Remove empty (zero-length or whitespace-only) nodes
      $objectDOM
        .find("*")
        .filter(function () {
          return !$.trim($(this).text());
        })
        .remove();

      const nodeNameMap = this.nodeNameMap();

      // Determine if this is an online, offline, or inline distribution
      const distLocation = this.distLocations.find((location) => {
        return this.hasValuesForDistributionLocation(location);
      });

      // Remove all other distribution locations
      this.distLocations.forEach((location) => {
        if (location !== distLocation) {
          $objectDOM.find(location).remove();
        }
      });

      // If there is no distribution location, return the DOM
      if (!distLocation) return objectDOM;

      // Add the distribution location if it doesn't exist
      if (!$objectDOM.find(distLocation).length) {
        $objectDOM.append(`<${distLocation}></${distLocation}>`);
      }

      // For each node in the distribution location, add the value from the
      // model. If the model value is empty, remove the node. Make sure that we
      // don't replace any existing nodes, since not all nodes are supported by
      // this model yet. We also need to ensure that the nodes are in the
      // correct order.
      this[`${distLocation}Nodes`].forEach((nodeName) => {
        const nodeValue = this.get(nodeNameMap[nodeName]);
        if (nodeValue) {
          const node = $objectDOM.find(`${distLocation} > ${nodeName}`);
          if (node.length) {
            node.text(nodeValue);
          } else {
            const newNode = $(`<${nodeName}>${nodeValue}</${nodeName}>`);
            const position = this.getEMLPosition(objectDOM, nodeName);
            if (position) {
              newNode.insertAfter(position);
            } else {
              $objectDOM.children(distLocation).append(newNode);
            }
          }
        } else {
          $objectDOM.find(`${distLocation} > ${nodeName}`).remove();
        }
      });

      // Add the urlFunction attribute if one is set in the model. Remove it if
      // it's not set.
      const url = $objectDOM.find("url")
      if (url) {
        const urlFunction = this.get("urlFunction");
        if (urlFunction) {
          url.attr("function", urlFunction);
        } else {
          url.removeAttr("function");
        }
      }
      

      return objectDOM;
    },

    /*
     * Returns the node in the object DOM that the given node type should be
     * inserted after. @param {string} nodeName - The name of the node to find
     * the position for @return {jQuery} - The jQuery object of the node that
     * the given node should be inserted after, or false if the node is not
     * supported by this model. @since x.x.x
     */
    getEMLPosition: function (objectDOM, nodeName) {
      // If this is a top level node, return false since it should be inserted
      // within the <distribution> node, and there must only be one.
      if (this.distLocations.includes(nodeName)) return false;

      // Handle according to whether it's an online or offline node
      const nodeNameMap = this.nodeNameMap();
      this.distLocations.forEach((distLocation) => {
        const nodeOrder = this[`${distLocation}Nodes`];
        const siblingNodes = $(objectDOM).find(distLocation).children();
        let position = nodeOrder.indexOf(nodeName);
        if (position > -1) {
          // Go through each node in the node list and find the position where
          // this node will be inserted after
          for (var i = position - 1; i >= 0; i--) {
            const checkNode = siblingNodes.filter(nodeOrder[i]);
            if (checkNode.length) {
              return checkNode.last();
            }
          }
        }
      });

      // If we get here, the node is not supported by this model
      return false;
    },

    /*
     * Climbs up the model hierarchy until it finds the EML model
     *
     * @return {EML211 or false} - Returns the EML 211 Model or false if not
     * found
     */
    getParentEML: function () {
      var emlModel = this.get("parentModel"),
        tries = 0;

      while (emlModel.type !== "EML" && tries < 6) {
        emlModel = emlModel.get("parentModel");
        tries++;
      }

      if (emlModel && emlModel.type == "EML") return emlModel;
      else return false;
    },

    trickleUpChange: function () {
      MetacatUI.rootDataPackage?.packageModel?.set("changed", true);
    },

    formatXML: function (xmlString) {
      return DataONEObject.prototype.formatXML.call(this, xmlString);
    },
  });

  return EMLDistribution;
});
