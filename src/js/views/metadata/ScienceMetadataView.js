/*global define */
define(["jquery", "jqueryui", "underscore", "backbone"], function (
  $,
  $ui,
  _,
  Backbone,
) {
  "use strict";

  /**
   * @class ScienceMetadataView
   * @classdesc The ScienceMetadataView renders the content of a ScienceMetadata model
   * @classcategory Views/Metadata
   * @extends Backbone.View
   */
  var ScienceMetadataView = Backbone.View.extend(
    /** @lends ScienceMetadataView.prototype */ {
      /**
       * The ScienceMetadata model to render
       * @type {ScienceMetadata}
       */
      type: "ScienceMetadata",

      initialize: function () {},

      render: function () {},

      /**
       * Takes the text object from a metadata model and returns it as HTML formatted with paragraph elements
       */
      formatParagraphs: function (text, edit) {
        //Get the abstract text
        var paragraphs = [],
          formattedText = "";

        //Get the text from the content attribute is it exists
        if (text) text = text;

        //Put the abstract in an array format to seperate out paragraphs
        if (typeof text.para == "string") paragraphs.push(text.para);
        else if (typeof text == "string") paragraphs.push(text || text);
        else if (Array.isArray(text.para)) {
          paragraphs = text.para;
        }

        //For each paragraph, insert a new line
        _.each(paragraphs, function (p) {
          if (edit) formattedText += p + "\n";
          else formattedText += "<p>" + p + "</p>";
        });

        return formattedText;
      },

      unformatParagraphs: function (htmlText) {
        var paragraphs = htmlText.trim().split("\n"),
          paragraphsJSON = [];

        _.each(paragraphs, function (p) {
          paragraphsJSON.push(p);
        });

        return paragraphsJSON;
      },

      /**
       * When a text element is changed, update the attribute in the model
       */
      updateText: function (e) {
        var textEl = e.target;

        //Get the new abstract text
        var newAttr = this.unformatParagraphs($(textEl).val());

        //Update the model
        this.model.set($(textEl).attr("data-category"), newAttr);
      },
    },
  );

  return ScienceMetadataView;
});
