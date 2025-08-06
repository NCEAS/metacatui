define([
  "jquery",
  "underscore",
  "backbone",
  "models/DataONEObject",
  "common/EMLUtilities",
], function ($, _, Backbone, DataONEObject, EMLUtilities) {
  var EMLKeywordSet = Backbone.Model.extend({
    type: "EMLKeywordSet",

    defaults: {
      objectXML: null,
      objectDOM: null,
      parentModel: null,
      thesaurus: "None",
      keywords: [], //The keyword values
    },

    initialize: function (attributes) {
      if (attributes && attributes.objectDOM)
        this.set(this.parse(attributes.objectDOM));

      this.on("change:thesaurus change:keywords", this.trickleUpChange);
    },

    /*
     * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
     * Used during parse() and serialize()
     */
    nodeNameMap: function () {
      return {
        keywordset: "keywordSet",
        keywordthesaurus: "keywordThesaurus",
      };
    },

    parse: function (objectDOM) {
      if (!objectDOM) var objectDOM = this.get("objectDOM").cloneNode(true);

      var modelJSON = {
        keywords: [],
      };

      //Get the list of keywords
      _.each($(objectDOM).find("keyword"), function (keyword) {
        modelJSON.keywords.push($(keyword).text());
      });

      //Get the thesaurus
      modelJSON.thesaurus = $(objectDOM).find("keywordthesaurus").text();

      return modelJSON;
    },

    serialize: function () {
      var objectDOM = this.updateDOM(),
        xmlString = objectDOM.outerHTML;

      //Camel-case the XML
      xmlString = this.formatXML(xmlString);

      return xmlString;
    },

    /*
     * Makes a copy of the original XML DOM and updates it with the new values from the model.
     */
    updateDOM: function () {
      var objectDOM = this.get("objectDOM")
        ? this.get("objectDOM").cloneNode(true)
        : document.createElement("keywordset");

      //Return an empty string if there are no keywords
      if (!this.get("keywords") || this.get("keywords").length == 0) {
        return "";
      }

      //Remove the keywords and thesaurus
      $(objectDOM).empty();

      //Add the keywords
      _.each(this.get("keywords"), function (keyword) {
        $(objectDOM).append($(document.createElement("keyword")).text(keyword));
      });

      //Add the thesaurus
      $(objectDOM).append(
        $(document.createElement("keywordthesaurus")).text(
          this.get("thesaurus"),
        ),
      );

      // Remove empty (zero-length or whitespace-only) nodes
      $(objectDOM)
        .find("*")
        .filter(function () {
          return $.trim(this.innerHTML) === "";
        })
        .remove();

      return objectDOM;
    },

    /*
     * Climbs up the model heirarchy until it finds the EML model
     *
     * @return {EML211 or false} - Returns the EML 211 Model or false if not found
     */
    getParentEML: function () {
      return EMLUtilities.getParentEML(this);
    },

    trickleUpChange: function () {
      MetacatUI.rootDataPackage.packageModel.set("changed", true);
    },

    formatXML: function (xmlString) {
      return DataONEObject.prototype.formatXML.call(this, xmlString);
    },
  });

  return EMLKeywordSet;
});
