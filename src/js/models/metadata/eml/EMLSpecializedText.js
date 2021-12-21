/* global define */
define(['jquery', 'underscore', 'backbone', 'models/metadata/eml220/EMLText'],
    function($, _, Backbone, EMLText) {

      /**
      * @class EMLSpecializedText
      * @classdesc An EMLSpecializedText is an EML 2.2.0 Text module that is treated differently in
      * the UI display. It is identified as "Specialized", by the title (either a `title` element in EMLText
      * or a Markdown Header 1). For example, you may want to display a custom EML Method Step specifically about
      * "Ethical Research Practices". An EMLSpecializedText would have a title of `Ethical Research Practices`, which
      * would be serialized in the EML XML as a section title or markdown header.
      * @classcategory Models/Metadata/EML
      */
  var EMLSpecializedText = EMLText.extend(
    /** @lends EMLSpecializedText.prototype */{

    type: "EMLSpecializedText",

    defaults: function(){
      return _.extend(EMLText.prototype.defaults(), {
        id: null,
        title: "",
        titleOptions: []
      });
    },

    /**
    * Parses the XML objectDOM into a literal object to be set on the model.
    * It uses the EMLText 220 parse() method first and then performs additional
    * parsing for Specialized Texts. In particular, the first title in the text is
    * sorted out and used to identify as a Specialized text.
    *
    * @param {Element} objectDOM - XML Element to parse
    * @return {object} The literal object to be set on the model later
    */
    parse: function(objectDOM){

      try{
        if(!objectDOM)
          var objectDOM = this.get("objectDOM").cloneNode(true);

        //Use the parent EMLText model parse() method
        let parsedAttributes = EMLText.prototype.parse.call(this, objectDOM);

        try{
          //Find all of the title nodes inside each section
          let titleNodes = $(objectDOM).children("section").children("title");

          //Get the title text from the first title node
          if( titleNodes.length ){
            let firstTitleNode = titleNodes[0];
            if( firstTitleNode ){
              //Save the title to the model attributes
              parsedAttributes.title = firstTitleNode.text;
              //Remove the title from the text attribute so that it doesn't get serialized twice
              parsedAttributes.text = _.without(parsedAttributes.text, parsedAttributes.title);
              parsedAttributes.originalText = _.without(parsedAttributes.originalText, parsedAttributes.title);
            }
          }
          else if( parsedAttributes.markdown ){
            /** @TODO: Support Markdown by looking for the first Header Level 1 (starting with #) */
          }
        }
        catch(e){
          console.error("Failed to parse the Specialized part of the EMLSpecializedText: ", e);
        }
        finally{
          return parsedAttributes;
        }

      }
      catch(e){
        console.error("Failed to parse EMLSpecializedText: ", e);
        return {}
      }

    },

    /**
     * Makes a copy of the original XML DOM and updates it with the new values from the model
     *
     * @param {string} textType - a string indicating the name for the outer xml element (i.e. content). Used in case there is no exisiting xmlDOM.
     * @return {XMLElement}
     */
    updateDOM: function(textType){

      try{

        //First update the DOM using the inherited updateDOM() method
        let updatedDOM = EMLText.prototype.updateDOM.call(this);
        let title = this.get("title");

        if(this.get("markdown")){
          /** @todo Support EMLSpecializedText for Markdown */
        }
        else if( updatedDOM && title ){

          //Get the section element
          let sectionEl = $(updatedDOM).children("section");

          //If there isn't a selection Element, create one and wrap it around the paras
          if( !sectionEl.length ){
            let allParas = $(updatedDOM).find("para");
            allParas.wrapAll("<section />");
            sectionEl = $(updatedDOM).children("section");
          }

          //Find the most up-to-date title from the AppConfig.
          //The first title in the list gets used. All other titles in the list are
          // considered legacy/alternative titles that may have been used in the past.
          let titleOptions = this.get("titleOptions");
          title = titleOptions.length? titleOptions[0] : title;

          //Get the title of the first section
          let titleEl = sectionEl.children("title");
          //If there isn't a title, create one
          if( !titleEl.length ){
            titleEl = $(document.createElement("title")).text(title);
            sectionEl.prepend(titleEl);
          }
          //Otherwise update the title text content
          else{
            titleEl.text(title);
          }
        }

        return updatedDOM;

      }
      catch(e){
        console.error("Failed to serialize the EMLSpecializedText. Will proceed using the original EML snippet. ", e);
        return this.get("objectDOM")? this.get("objectDOM").cloneNode(true) : "";
      }

    }

  });

  return EMLSpecializedText;

});
