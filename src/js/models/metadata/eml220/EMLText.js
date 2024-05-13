/* global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "models/metadata/eml211/EMLText",
  "text!templates/portals/editor/MarkdownExample.md",
], function ($, _, Backbone, EMLText211, MarkdownExample) {
  /**
   * @class EMLText
   * @classdesc A model that represents the EML 2.2.0 Text module
   * @classcategory Models/Metadata/EML220
   * @extends EMLText211
   */
  var EMLText = EMLText211.extend(
    /** @lends EMLText.prototype */ {
      defaults: function () {
        return _.extend(EMLText211.prototype.defaults(), {
          markdown: null,
          markdownExample: MarkdownExample,
        });
      },

      /**
       * Parses the XML objectDOM into a JSON object to be set on the model.
       * If this EMLText element contains markdown, then parse it. Otherwise, use
       * the EMLText 211 parse() method.
       *
       * @param {Element} objectDOM - XML Element to parse
       * @return {JSON} The literal object to be set on the model later
       */
      parse: function (objectDOM) {
        if (!objectDOM) var objectDOM = this.get("objectDOM").cloneNode(true);

        // Get the markdown elements inside this EMLText element
        var markdownElements = $(objectDOM).children("markdown"),
          modelJSON = {};

        //Grab the contents of each markdown element and add it to the JSON
        if (markdownElements.length) {
          modelJSON.markdown = "";

          //Get the text content of the markdown element
          _.each(markdownElements, function (markdownElement) {
            // Concatenate markdown elements with a space.
            if (modelJSON.markdown === "") {
              modelJSON.markdown = markdownElement.textContent;
            } else {
              modelJSON.markdown += " " + markdownElement.textContent;
            }
          });

          //Return the JSON
          return modelJSON;
        }
        //If there is no markdown, parse as the same as EML 2.1.1
        else {
          return EMLText211.prototype.parse(objectDOM);
        }
      },

      /**
       * Makes a copy of the original XML DOM and updates it with the new values from the model
       *
       * @param {string} textType - a string indicating the name for the outer xml element (i.e. content). Used in case there is no exisiting xmlDOM.
       * @return {XMLElement}
       */
      updateDOM: function (textType) {
        var markdown = this.get("markdown");

        //If there is no markdown, parse as the same as EML 2.1.1
        if (!markdown) {
          return EMLText211.prototype.updateDOM.call(this);
        } else {
          var objectDOM = this.get("objectDOM");

          if (objectDOM) {
            objectDOM = objectDOM.cloneNode(true);
            $(objectDOM).empty();
          } else {
            // create an XML section element from scratch
            var xmlText = "<" + textType + "></" + textType + ">",
              objectDOM = new DOMParser().parseFromString(xmlText, "text/xml"),
              objectDOM = $(objectDOM).children()[0];
          }

          // There could be multiple markdown elements, or markdown could be a string
          if (typeof markdown == "string") {
            markdown = [markdown];
          }

          _.each(
            markdown,
            function (markdownElement) {
              // Create markdown element with content wrapped in CDATA tags
              var markdownSerialized =
                objectDOM.ownerDocument.createElement("markdown");
              var cdataMarkdown =
                objectDOM.ownerDocument.createCDATASection(markdownElement);
              $(markdownSerialized).append(cdataMarkdown);
              $(objectDOM).append(markdownSerialized);
            },
            this,
          );

          return objectDOM;
        }
      },

      /**
       * @overrides EML211.setText
       * If there is markdown, then the markdown gets updated. Otherwise, we default to the EML211.setText() functionality
       */
      setText: function (text) {
        if (this.get("markdown")) {
          this.set("markdown", text);
        } else {
          return EMLText211.prototype.setText.call(this, text);
        }
      },

      /**
       * @overrides EML211.toString
       * Returns the markdown string or EML Text paragraphs as a string, if there  is no  markdown. (For
       * compatability with EML 2.1.1). Returns an empty string if neither are set on the model.
       * @returns {string}
       */
      toString: function () {
        try {
          return (
            this.get("markdown") ||
            EMLText211.prototype.toString.call(this) ||
            ""
          );
        } catch (e) {
          console.error("Failed to convert EMLText toString(): ", e);
          return "";
        }
      },
    },
  );

  return EMLText;
});
