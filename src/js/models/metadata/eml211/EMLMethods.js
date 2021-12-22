/* global define */
define(['jquery',
    'underscore',
    'backbone',
    'models/DataONEObject',
    'models/metadata/eml/EMLMethodStep',
    'models/metadata/eml211/EMLText'],
    function($, _, Backbone, DataONEObject, EMLMethodStep, EMLText) {

  var EMLMethods = Backbone.Model.extend({

    defaults: function(){
      return {
        objectXML: null,
        objectDOM: null,
        methodSteps: [],
        studyExtentDescription: null,
        samplingDescription: null
      }
    },

    initialize: function(attributes){
      attributes = attributes || {};

      if(attributes.objectDOM){
        this.set(this.parse(attributes.objectDOM))
      }
      else{
        //Create the custom method steps and add to the step list
        let customMethodSteps = this.createCustomMethodSteps();
        this.set("methodSteps", customMethodSteps);
      }

      //specific attributes to listen to
      this.on("change:methodStepDescription change:studyExtentDescription change:samplingDescription",
          this.trickleUpChange);

    },

    /*
     * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
     * Used during parse() and serialize()
     */
    nodeNameMap: function(){
      return _.extend(EMLMethodStep.prototype.nodeNameMap(), {
        "methodstep" : "methodStep",
        "datasource" : "dataSource",
        "studyextent" : "studyExtent",
        "spatialsamplingunits" : "spatialSamplingUnits",
        "referencedentityid" : "referencedEntityId",
        "qualitycontrol" : "qualityControl"
      })
    },

    parse: function(objectDOM) {
      var modelJSON = {};

      if (!objectDOM) var objectDOM = this.get("objectDOM");

      var model = this;

      //Create the custom method steps
      let customMethodSteps = this.createCustomMethodSteps();

      //Create new EMLMethodStep models for the method steps
      let allMethodSteps = _.map($(objectDOM).find('methodstep'), function(el, i) {
                              return new EMLMethodStep({
                                objectDOM: el
                               });
                            }),
          //Get the custom IDs for each method step, if there any
          allMethodStepIDs = _.compact(allMethodSteps.map(step => { return step.get("customMethodID") }));

      //Filter out any custom method steps that we already created from the DOM
      customMethodSteps = customMethodSteps.filter(step => { return !allMethodStepIDs.includes(step.get("customMethodID")) });

      //Combine the parsed method steps and the default custom method steps
      allMethodSteps = allMethodSteps.concat(customMethodSteps);

      //Save the method steps to this model
      modelJSON.methodSteps = allMethodSteps;

      if ($(objectDOM).find('sampling studyextent description').length > 0) {
        modelJSON.studyExtentDescription = new EMLText({
          objectDOM: $(objectDOM).find('sampling studyextent description').get(0),
          type: 'description',
          parentModel: model
        });
      }

      if ($(objectDOM).find('sampling samplingdescription').length > 0) {
        modelJSON.samplingDescription = new EMLText({
          objectDOM: $(objectDOM).find('sampling samplingdescription').get(0),
          type: 'samplingDescription',
          parentModel: model
         });
       }

      return modelJSON;
    },

    serialize: function(){
      var objectDOM = this.updateDOM();

      if(!objectDOM)
        return "";

      var xmlString = objectDOM.outerHTML;

      //Camel-case the XML
      xmlString = this.formatXML(xmlString);

      return xmlString;
    },

    /*
     * Makes a copy of the original XML DOM and updates it with the new values from the model.
     */
    updateDOM: function(){
      var objectDOM;

      if (this.get("objectDOM")) {
        objectDOM = this.get("objectDOM").cloneNode(true);
      } else {
        objectDOM = $(document.createElement("methods"));
      }

      objectDOM = $(objectDOM);

      var methodStepsFromModel = this.get('methodSteps'),
          customMethodSteps = methodStepsFromModel.filter(step => { return step.isCustom() }),
          regularMethodSteps = _.difference(methodStepsFromModel, customMethodSteps),
          sortedCustomMethodSteps = [],
          methodStepsFromDOM   = $(objectDOM).find("methodstep");

      //Detach the existing method steps from the DOM first
      methodStepsFromDOM.detach();

      //Sort the custom method steps to match the app config order
      let configCustomMethods = _.clone(MetacatUI.appModel.get("customEMLMethods") || []);
      if( configCustomMethods.length ){
        configCustomMethods.forEach( customOptions => {
          let matchingStep = customMethodSteps.find( step => { return step.get("description").get("title") == customOptions.titleOptions[0] });
          if( matchingStep ){
            sortedCustomMethodSteps.push(matchingStep);
          }
        });
      }

      //Update each method step and prepend to the top of the methods (reverse arrays first to keep the right order)
      regularMethodSteps.reverse().concat(sortedCustomMethodSteps.reverse()).forEach(step => {
        objectDOM.prepend(step.updateDOM());
      });

      // Update the sampling metadata
      if (this.get('samplingDescription') || this.get('studyExtentDescription')) {

        var samplingEl    = $(document.createElement('sampling')),
            studyExtentEl = $(document.createElement('studyExtent')),
            missingStudyExtent = false,
            missingDescription = false;

        //If there is a study extent description, then create a DOM element for it and append it to the parent node
        if (this.get('studyExtentDescription') && !this.get('studyExtentDescription').isEmpty()) {
          $(studyExtentEl).append(this.get('studyExtentDescription').updateDOM());

          //If the text matches the default "filler" text, then mark it as missing
          if( this.get('studyExtentDescription').get("text")[0] == "No study extent description provided."){
            missingStudyExtent = true;
          }

        }
        //If there isn't a study extent description, then mark it as missing and append the default "filler" text
        else {
          missingStudyExtent = true;
          $(studyExtentEl).append($(document.createElement('description')).html("<para>No study extent description provided.</para>"));
        }


        //Add the study extent element to the sampling element
        $(samplingEl).append(studyExtentEl);

        //If there is a sampling description, then create a DOM element for it and append it to the parent node
        if (this.get('samplingDescription') && !this.get('samplingDescription').isEmpty()) {
          $(samplingEl).append(this.get('samplingDescription').updateDOM());

          //If the text matches the default "filler" text, then mark it as missing
          if( this.get('samplingDescription').get("text")[0] == "No sampling description provided."){
            missingDescription = true;
          }

        }
        //If there isn't a study extent description, then mark it as missing and append the default "filler" text
        else {
          missingDescription = true;
          $(samplingEl).append($(document.createElement('samplingDescription')).html("<para>No sampling description provided.</para>"));
        }

        //Find the existing <sampling> element
        var existingSampling = objectDOM.find("sampling");

        //Remove all the sampling nodes if there is no study extent and no description
        if(missingStudyExtent && missingDescription){
          existingSampling.remove();

          //If there are no method steps either, make sure their DOM elements are removed
          if(numMethods == 0){
            objectDOM.find("methodstep").remove();
          }
        }
        //Replace the existing sampling element, if it exists
        else if( existingSampling.length > 0 ){
          existingSampling.replaceWith(samplingEl);
        }
        //Or append a new one
        else{
          objectDOM.append(samplingEl);
        }

      }

      // Remove empty (zero-length or whitespace-only) nodes
      objectDOM.find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();

      //Check if all the content is filler content. This means there are no method steps, no sampling description, and
      // no study extent description.
      if( objectDOM.find("samplingdescription").length == 1 &&
          objectDOM.find("samplingdescription para").text() == "No sampling description provided." &&
          objectDOM.find("studyextent").length == 1 &&
          objectDOM.find("studyextent description para").text() == "No study extent description provided." ){

          //If it is all empty / filler content, then totally remove the methods
          return "";

      }

      //If there are sampling nodes listed before methodStep nodes, then reorder them
      if( objectDOM.children().index(objectDOM.find("methodstep").last()) >
            objectDOM.children().index(objectDOM.find("sampling").last()) ){

        //Detach all the sampling nodes and append them to the parent node
        objectDOM.append( objectDOM.children("sampling").detach() );

      }

      //If there is more than one method step, remove any that have the default filler text
      if( objectDOM.find("methodstep").length > 1 ){
        objectDOM.find("methodstep:contains('No method step description provided.')").remove();
      }

      //If there are sampling nodes but no method nodes, make method nodes
      if( objectDOM.find("samplingdescription").length > 0 &&
          objectDOM.find("studyextent").length > 0 &&
          objectDOM.find("methodstep").length == 0){
            objectDOM.prepend("<methodstep><description><para>No method step description provided.</para></description></methodstep>");
      }

       return objectDOM;
    },

    /**
    * Creates a new EMLMethodStep model and adds it to this model
    * @param {object} [attr] A literal object of attributes to set on the EMLMethodStep
    */
    addMethodStep: function(attr){

      try{

        if(!attr){
          let attr = {}
        }

        let newStep = new EMLMethodStep(attr);
        this.get("methodSteps").push(newStep);
        this.set("methodSteps", this.get("methodSteps"));
        return newStep;

      }
      catch(e){
        console.error(e);
      }

    },

    /**
    * Returns the EMLMethodSteps that are not custom methods, as configured in {@link AppConfig#customEMLMethods}
    * @returns {EMLMethodStep[]}
    */
    getNonCustomSteps: function(){
      return this.get("methodSteps").filter(step => !step.isCustom());
    },

    /**
    *  function isEmpty() - Will check if there are any values set on this model
    * that are different than the default values and would be serialized to the EML.
    *
    * @return {boolean} - Returns true is this model is empty, false if not
    */
    isEmpty: function(){

      var methodsStepsEmpty = false,
          studyExtentEmpty = false,
          samplingEmpty = false;

      if( !this.get("methodSteps").length || !this.get("methodSteps") || this.get("methodSteps").every(step => step.isEmpty()) ){
        methodsStepsEmpty = true;
      }

      if( this.get("studyExtentDescription") == this.defaults().studyExtentDescription ||
          !this.get("studyExtentDescription") ||
          (this.get("studyExtentDescription").isEmpty && this.get("studyExtentDescription").isEmpty()) ||
          (Array.isArray(this.get("studyExtentDescription")) && !this.get("studyExtentDescription").length ) ||
          (Array.isArray(this.get("studyExtentDescription")) &&
           this.get("studyExtentDescription").length == 1 &&
           this.get("studyExtentDescription")[0].get("text").length == 1 &&
           this.get("studyExtentDescription")[0].get("text")[0] == "No study extent description provided.") ){

          studyExtentEmpty = true;

      }

      if( this.get("samplingDescription") == this.defaults().samplingDescription ||
          !this.get("samplingDescription") ||
          (this.get("samplingDescription").isEmpty && this.get("samplingDescription").isEmpty()) ||
          (Array.isArray(this.get("samplingDescription")) && !this.get("samplingDescription").length ) ||
          (Array.isArray(this.get("samplingDescription")) &&
           this.get("samplingDescription").length == 1 &&
           this.get("samplingDescription")[0].get("text").length == 1 &&
           this.get("samplingDescription")[0].get("text")[0] == "No sampling description provided.") ){

          samplingEmpty = true;

      }

      if( methodsStepsEmpty && studyExtentEmpty && samplingEmpty )
        return true;

    },

    /*
    * Climbs up the model heirarchy until it finds the EML model
    *
    * @return {EML211 or false} - Returns the EML 211 Model or false if not found
    */
    getParentEML: function(){
      var emlModel = this.get("parentModel"),
          tries = 0;

      while (emlModel.type !== "EML" && tries < 6){
        emlModel = emlModel.get("parentModel");
        tries++;
      }

      if( emlModel && emlModel.type == "EML")
        return emlModel;
      else
        return false;

    },

    trickleUpChange: function(){
      MetacatUI.rootDataPackage.packageModel.set("changed", true);
    },

    formatXML: function(xmlString){
      return DataONEObject.prototype.formatXML.call(this, xmlString);
    },

    /**
    * Creates and returns the custom Method Step models, as configured in the {@link AppConfig}
    * @returns {EMLMethodStep[]}
    */
    createCustomMethodSteps: function(){
      //Get the custom methods configured in the app
      let configCustomMethods = MetacatUI.appModel.get("customEMLMethods"),
          customMethods = [];

      //If there is at least one
      configCustomMethods.forEach(config => {
        customMethods.push(new EMLMethodStep({
          customMethodID: config.id
        }))
      });

      return customMethods;
    }
  });

  return EMLMethods;
});
