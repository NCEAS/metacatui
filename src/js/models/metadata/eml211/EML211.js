﻿/* global define */
define(['jquery', 'underscore', 'backbone', 'uuid',
        'collections/Units',
        'models/metadata/ScienceMetadata',
        'models/DataONEObject',
        'models/metadata/eml211/EMLGeoCoverage',
        'models/metadata/eml211/EMLKeywordSet',
        'models/metadata/eml211/EMLTaxonCoverage',
        'models/metadata/eml211/EMLTemporalCoverage',
        'models/metadata/eml211/EMLDistribution',
        'models/metadata/eml211/EMLEntity',
        'models/metadata/eml211/EMLDataTable',
        'models/metadata/eml211/EMLOtherEntity',
        'models/metadata/eml211/EMLParty',
        'models/metadata/eml211/EMLProject',
        'models/metadata/eml211/EMLText',
    'models/metadata/eml211/EMLMethods'],
    function($, _, Backbone, uuid, Units, ScienceMetadata, DataONEObject,
        EMLGeoCoverage, EMLKeywordSet, EMLTaxonCoverage, EMLTemporalCoverage,
        EMLDistribution, EMLEntity, EMLDataTable, EMLOtherEntity, EMLParty,
            EMLProject, EMLText, EMLMethods) {

      /*
      An EML211 object represents an Ecological Metadata Language
      document, version 2.1.1
      */
      var EML211 = ScienceMetadata.extend({

        type: "EML",

        defaults: function(){
          return _.extend(ScienceMetadata.prototype.defaults(), {
            id: "urn:uuid:" + uuid.v4(),
            formatId: "eml://ecoinformatics.org/eml-2.1.1",
            objectXML: null,
              isEditable: false,
              alternateIdentifier: [],
              shortName: null,
              title: [],
              creator: [], // array of EMLParty objects
              metadataProvider: [], // array of EMLParty objects
              associatedParty : [], // array of EMLParty objects
              contact: [], // array of EMLParty objects
              publisher: [], // array of EMLParty objects
              pubDate: null,
              language: null,
              series: null,
              abstract: [], //array of EMLText objects
              keywordSets: [], //array of EMLKeywordSet objects
              additionalInfo: [],
              intellectualRights: "This work is dedicated to the public domain under the Creative Commons Universal 1.0 Public Domain Dedication. To view a copy of this dedication, visit https://creativecommons.org/publicdomain/zero/1.0/.",
              onlineDist: [], // array of EMLOnlineDist objects
              offlineDist: [], // array of EMLOfflineDist objects
              geoCoverage : [], //an array for EMLGeoCoverages
              temporalCoverage : [], //an array of EMLTempCoverage models
              taxonCoverage : [], //an array of EMLTaxonCoverages
              purpose: [],
              entities: [], //An array of EMLEntities
              pubplace: null,
              methods: null, // An EMLMethods objects
              project: null // An EMLProject object
          });
        },

        units: new Units(),

        initialize: function(attributes) {
            // Call initialize for the super class
            ScienceMetadata.prototype.initialize.call(this, attributes);

            // EML211-specific init goes here
            // this.set("objectXML", this.createXML());
            this.parse(this.createXML());

            this.on("sync", function(){
              this.set("synced", true);
            });

            //Create a Unit collection
            if(!this.units.length)
              this.createUnits();
        },

        url: function(options) {
            var identifier;
            if ( options && options.update ) {
                identifier = this.get("oldPid") || this.get("seriesid");
            } else {
                identifier = this.get("id") || this.get("seriesid");
            }
            return MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(identifier);
        },

        /*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
         * Used during parse() and serialize()
         */
        nodeNameMap: function(){
          return _.extend(
              this.constructor.__super__.nodeNameMap(),
              EMLDistribution.prototype.nodeNameMap(),
              EMLGeoCoverage.prototype.nodeNameMap(),
              EMLKeywordSet.prototype.nodeNameMap(),
              EMLParty.prototype.nodeNameMap(),
              EMLProject.prototype.nodeNameMap(),
              EMLTaxonCoverage.prototype.nodeNameMap(),
              EMLTemporalCoverage.prototype.nodeNameMap(),
              EMLMethods.prototype.nodeNameMap(),
              {
                "additionalclassifications" : "additionalClassifications",
                "additionalinfo" : "additionalInfo",
                "additionallinks" : "additionalLinks",
                "additionalmetadata" : "additionalMetadata",
                "allowfirst" : "allowFirst",
                "alternateidentifier" : "alternateIdentifier",
                "asneeded" : "asNeeded",
                "associatedparty" : "associatedParty",
                "attributeaccuracyexplanation" : "attributeAccuracyExplanation",
                "attributeaccuracyreport" : "attributeAccuracyReport",
                "attributeaccuracyvalue" : "attributeAccuracyValue",
                "attributedefinition" : "attributeDefinition",
                "attributelabel" : "attributeLabel",
                "attributelist" : "attributeList",
                "attributename" : "attributeName",
                "attributeorientation" : "attributeOrientation",
                "blockedmembernode" : "blockedMemberNode",
                "casesensitive" : "caseSensitive",
                "changehistory" : "changeHistory",
                "changedate" : "changeDate",
                "changescope" : "changeScope",
                "characterencoding" : "characterEncoding",
                "codedefinition" : "codeDefinition",
                "codeexplanation" : "codeExplanation",
                "codesetname" : "codesetName",
                "codeseturl" : "codesetURL",
                "collapsedelimiters" : "collapseDelimiters",
                "constanttosi" : "constantToSI",
                "customunit" : "customUnit",
                "dataformat" : "dataFormat",
                "datatable" : "dataTable",
                "datatype" : "dataType",
                "datetime" : "dateTime",
                "datetimedomain" : "dateTimeDomain",
                "datetimeprecision" : "dateTimePrecision",
                "definitionattributereference" : "definitionAttributeReference",
                "dictref" : "dictRef",
                "endcondition" : "endCondition",
                "entitycodelist" : "entityCodeList",
                "entitydescription" : "entityDescription",
                "entityname" : "entityName",
                "entityreference" : "entityReference",
                "entitytype" : "entityType",
                "enumerateddomain" : "enumeratedDomain",
                "errorbasis" : "errorBasis",
                "errorvalues" : "errorValues",
                "externalcodeset" : "externalCodeSet",
                "externallydefinedformat" : "externallyDefinedFormat",
                "fielddelimiter" : "fieldDelimiter",
                "formatname" : "formatName",
                "formatstring" : "formatString",
                "fractiondigits" : "fractionDigits",
                "intellectualrights" : "intellectualRights",
                "literalcharacter" : "literalCharacter",
                "literallayout" : "literalLayout",
                "maintenanceupdatefrequency" : "maintenanceUpdateFrequency",
                "matrixtype" : "matrixType",
                "maxexclusive" : "maxExclusive",
                "maxinclusive" : "maxInclusive",
                "maxlength" : "maxLength",
                "maxrecordlength" : "maxRecordLength",
                "maxvalues" : "maxValues",
                "measurementscale" : "measurementScale",
                "methodstep" : "methodStep",
                "minexclusive" : "minExclusive",
                "mininclusive" : "minInclusive",
                "minlength" : "minLength",
                "minvalues" : "minValues",
                "missingvaluecode" : "missingValueCode",
                "multipliertosi" : "multiplierToSI",
                "nonnumericdomain" : "nonNumericDomain",
                "notplanned" : "notPlanned",
                "numbertype" : "numberType",
                "numericdomain" : "numericDomain",
                "numfooterlines" : "numFooterLines",
                "numheaderlines" : "numHeaderLines",
                "numberofrecords" : "numberOfRecords",
                "numphysicallinesperrecord" : "numPhysicalLinesPerRecord",
                "objectname" : "objectName",
                "oldvalue" : "oldValue",
                "orderattributereference" : "orderAttributeReference",
                "otherentity" : "otherEntity",
                "othermaintenanceperiod" : "otherMaintenancePeriod",
                "packageid" : "packageId",
                "parentsi" : "parentSI",
                "physicallinedelimiter" : "physicalLineDelimiter",
                "preferredmembernode" : "preferredMemberNode",
                "pubdate" : "pubDate",
                "pubplace" : "pubPlace",
                "quantitativeattributeaccuracyassessment" : "quantitativeAttributeAccuracyAssessment",
                "quotecharacter" : "quoteCharacter",
                "recommendedunits" : "recommendedUnits",
                "researchtopic" : "researchTopic",
                "recorddelimiter" : "recordDelimiter",
                "samplingdescription" : "samplingDescription",
                "shortname" : "shortName",
                "simpledelimited" : "simpleDelimited",
                "standardunit" : "standardUnit",
                "startcondition" : "startCondition",
                "storagetype" : "storageType",
                "studyextent" : "studyExtent",
                "studytype" : "studyType",
                "textdomain" : "textDomain",
                "textformat" : "textFormat",
                "totaldigits" : "totalDigits",
                "typesystem" : "typeSystem",
                "unittype" : "unitType",
                "unitlist" : "unitList",
                "valueattributereference" : "valueAttributeReference",
                "whitespace" : "whiteSpace",
                "xsi:schemalocation" : "xsi:schemaLocation"
              }
          );
        },

        /* Fetch the EML from the MN object service */
        fetch: function(options) {
          if( ! options ) var options = {};

          //Add the authorization header and other AJAX settings
           _.extend(options, MetacatUI.appUserModel.createAjaxSettings(), {dataType: "text"});

            // Merge the system metadata into the object first
            _.extend(options, {merge: true});
            this.fetchSystemMetadata(options);

            //If we are retrieving system metadata only, then exit now
            if(options.sysMeta)
              return;

          //Call Backbone.Model.fetch to retrieve the info
            return Backbone.Model.prototype.fetch.call(this, options);

        },

        /*
         Deserialize an EML 2.1.1 XML document
        */
        parse: function(response) {
          // Save a reference to this model for use in setting the
          // parentModel inside anonymous functions
          var model = this;

          //If the response is XML
          if((typeof response == "string") && response.indexOf("<") == 0){
            //Look for a system metadata tag and call DataONEObject parse instead
            if(response.indexOf("systemMetadata>") > -1)
              return DataONEObject.prototype.parse.call(this, response);

            response = this.cleanUpXML(response);
                response = this.dereference(response);
            this.set("objectXML", response);
            var emlElement = $($.parseHTML(response)).filter("eml\\:eml");
          }

          var datasetEl;
          if(emlElement[0])
            datasetEl = $(emlElement[0]).find("dataset");

          if(!datasetEl || !datasetEl.length)
            return {};

          var emlParties = ["metadataprovider", "associatedparty", "creator", "contact", "publisher"],
              emlDistribution = ["distribution"],
              emlEntities = ["datatable", "otherentity", "spatialvector"],
              emlText = ["abstract", "additionalinfo"],
              emlMethods = ["methods"];

          var nodes = datasetEl.children(),
              modelJSON = {};

          for(var i=0; i<nodes.length; i++){

            var thisNode = nodes[i];
            var convertedName = this.nodeNameMap()[thisNode.localName] || thisNode.localName;

            //EML Party modules are stored in EMLParty models
            if(_.contains(emlParties, thisNode.localName)){
              if(thisNode.localName == "metadataprovider")
                var attributeName = "metadataProvider";
              else if(thisNode.localName == "associatedparty")
                var attributeName = "associatedParty";
              else
                var attributeName = thisNode.localName;

              if(typeof modelJSON[attributeName] == "undefined") modelJSON[attributeName] = [];

              modelJSON[attributeName].push(new EMLParty({
                objectDOM: thisNode,
                parentModel: model,
                type: attributeName
              }));
            }
            //EML Distribution modules are stored in EMLDistribution models
            else if(_.contains(emlDistribution, thisNode.localName)){
              if(typeof modelJSON[thisNode.localName] == "undefined") modelJSON[thisNode.localName] = [];

              modelJSON[thisNode.localName].push(new EMLDistribution({
                objectDOM: thisNode,
                parentModel: model
              }));
            }
            //The EML Project is stored in the EMLProject model
            else if(thisNode.localName == "project"){

              modelJSON.project = new EMLProject({
                objectDOM: thisNode,
                parentModel: model
               });

            }
            //EML Temporal, Taxonomic, and Geographic Coverage modules are stored in their own models
            else if(thisNode.localName == "coverage"){

              var temporal = $(thisNode).children("temporalcoverage"),
                geo      = $(thisNode).children("geographiccoverage"),
                taxon    = $(thisNode).children("taxonomiccoverage");

              if(temporal.length){
                modelJSON.temporalCoverage = [];

                _.each(temporal, function(t){
                  modelJSON.temporalCoverage.push(new EMLTemporalCoverage({
                    objectDOM: t,
                    parentModel: model
                      }));
                });
              }

              if(geo.length){
                modelJSON.geoCoverage = [];
                _.each(geo, function(g){
                    modelJSON.geoCoverage.push(new EMLGeoCoverage({
                      objectDOM: g,
                      parentModel: model
                      }));
                });

              }

              if(taxon.length){
                modelJSON.taxonCoverage = [];
                _.each(taxon, function(t){
                    modelJSON.taxonCoverage.push(new EMLTaxonCoverage({
                      objectDOM: t,
                      parentModel: model
                        }));
                });

              }

            }
                //Parse EMLText modules
                else if(_.contains(emlText, thisNode.localName)){
                  if(typeof modelJSON[convertedName] == "undefined") modelJSON[convertedName] = [];

                  modelJSON[convertedName].push(new EMLText({
                      objectDOM: thisNode,
                      parentModel: model
                    }));

                }
          else if(_.contains(emlMethods, thisNode.localName)) {
            if(typeof modelJSON[thisNode.localName] === "undefined") modelJSON[thisNode.localName] = [];

            modelJSON[thisNode.localName] =  new EMLMethods({
              objectDOM: thisNode,
              parentModel: model
            });

          }
          //Parse keywords
          else if(thisNode.localName == "keywordset"){
            //Start an array of keyword sets
            if(typeof modelJSON["keywordSets"] == "undefined") modelJSON["keywordSets"] = [];

            modelJSON["keywordSets"].push(new EMLKeywordSet({
              objectDOM: thisNode,
              parentModel: model
            }));
          }
          //Parse intellectual rights
          else if(thisNode.localName == "intellectualrights"){
            var value = "";

            if($(thisNode).children("para").length == 1)
              value = $(thisNode).children("para").first().text().trim();
            else
              $(thisNode).text().trim();

            //If the value is one of our pre-defined options, then add it to the model
            //if(_.contains(this.get("intellRightsOptions"), value))
            modelJSON["intellectualRights"] = value;

          }
          //Parse Entities
          else if(_.contains(emlEntities, thisNode.localName)){

            //Start an array of Entities
            if(typeof modelJSON["entities"] == "undefined")
              modelJSON["entities"] = [];

            //Create the model
            var entityModel;
            if(thisNode.localName == "otherentity"){
              entityModel = new EMLOtherEntity({
                  objectDOM: thisNode,
                  parentModel: model
                }, {
                  parse: true
                });
                  } else if ( thisNode.localName == "datatable") {
                      entityModel = new EMLDataTable({
                          objectDOM: thisNode,
                          parentModel: model
                      }, {
                          parse: true
                      });
            } else {
              entityModel = new EMLOtherEntity({
                  objectDOM: thisNode,
                  parentModel: model,
                          entityType: "application/octet-stream"
                }, {
                  parse: true
                });
            }

            modelJSON["entities"].push(entityModel);
          }
          else{
            //Is this a multi-valued field in EML?
            if(Array.isArray(this.get(convertedName))){
              //If we already have a value for this field, then add this value to the array
              if(Array.isArray(modelJSON[convertedName]))
                modelJSON[convertedName].push(this.toJson(thisNode));
              //If it's the first value for this field, then create a new array
              else
                modelJSON[convertedName] = [this.toJson(thisNode)];
            }
            else
              modelJSON[convertedName] = this.toJson(thisNode);
          }

        }

        return modelJSON;
      },

      /*
       * Retireves the model attributes and serializes into EML XML, to produce the new or modified EML document.
       * Returns the EML XML as a string.
       */
      serialize: function(){

        //Get the EML document
        var xmlString   = this.get("objectXML"),
            eml         = $.parseHTML(xmlString),
            datasetNode = $(eml).filter("eml\\:eml").find("dataset");

        //Update the packageId on the eml node with the EML id
        $(eml).attr("packageId", this.get("id"));

        var nodeNameMap = this.nodeNameMap();

        //Serialize the basic text fields
        var basicText = ["alternateIdentifier", "title"];
        _.each(basicText, function(fieldName){
        var basicTextValues = this.get(fieldName);

        if(!Array.isArray(basicTextValues))
          basicTextValues = [basicTextValues];

        // Remove existing nodes
        datasetNode.find(fieldName.toLowerCase()).remove();

        // Create new nodes
        var nodes = _.map(basicTextValues, function(value) {

          if(value){

            var node = document.createElement(fieldName.toLowerCase());
            $(node).text(value);
            return node;

          }
          else{
            return "";
          }
        });

        var insertAfter = this.getEMLPosition(eml, fieldName.toLowerCase());

        if(insertAfter){
          insertAfter.after(nodes);
        }
        else{
          datasetNode.prepend(nodes);
        }

      }, this);

      // Serialize pubDate
      // This one is special because it has a default behavior, unlike
      // the others: When no pubDate is set, it should be set to
      // the current year
      var pubDate = this.get('pubDate');

      datasetNode.find('pubdate').remove();

      if (pubDate != null && pubDate.length > 0) {

        var pubDateEl = document.createElement('pubdate');

        $(pubDateEl).text(pubDate);

        this.getEMLPosition(eml, 'pubdate').after(pubDateEl);
      }

      // Serialize the parts of EML that are eml-text modules
      var textFields = ["abstract", "additionalInfo"];

      _.each(textFields, function(field){

        var fieldName = this.nodeNameMap()[field] || field;

        // Get the EMLText model
        var emlTextModels = Array.isArray(this.get(field)) ? this.get(field) : [this.get(field)];
        if( ! emlTextModels.length ) return;

        // Get the node from the EML doc
        var nodes = datasetNode.find(fieldName);

        // Update the DOMs for each model
        _.each(emlTextModels, function(thisTextModel, i){
          //Don't serialize falsey values
          if(!thisTextModel) return;

          var node;

          //Get the existing node or create a new one
          if(nodes.length < i+1){
            node = document.createElement(fieldName);
            this.getEMLPosition(eml, fieldName).after(node);

          }
          else {
             node = nodes[i];
          }

          $(node).html( $(thisTextModel.updateDOM() ).html());

        }, this);

        // Remove the extra nodes
        this.removeExtraNodes(nodes, emlTextModels);

      }, this);

      //Serialize the geographic coverage
      if ( typeof this.get('geoCoverage') !== 'undefined' && this.get('geoCoverage').length > 0) {

        // Don't serialize if geoCoverage is invalid
        var validCoverages = _.filter(this.get('geoCoverage'), function(cov) {
          return cov.isValid();
        });

        if ( datasetNode.find('coverage').length === 0 && validCoverages.length ) {
          var coveragePosition = this.getEMLPosition(eml, 'coverage');

          if(coveragePosition)
            coveragePosition.after(document.createElement('coverage'));
          else
            datasetNode.append(document.createElement('coverage'));
        }

        //Get the existing geo coverage nodes from the EML
        var existingGeoCov = datasetNode.find("geographiccoverage");

        //Update the DOM of each model
        _.each(validCoverages, function(cov, position){

          //Update the existing node if it exists
          if(existingGeoCov.length-1 >= position){
            $(existingGeoCov[position]).replaceWith(cov.updateDOM());
          }
          //Or, append new nodes
          else{
            var insertAfter = existingGeoCov.length? datasetNode.find("geographiccoverage").last() : null;

            if(insertAfter)
              insertAfter.after(cov.updateDOM());
            else
              datasetNode.find("coverage").append(cov.updateDOM());
          }
        }, this);

        //Remove existing taxon coverage nodes that don't have an accompanying model
        this.removeExtraNodes(datasetNode.find("geographiccoverage"), validCoverages);
      }

      //Serialize the taxonomic coverage
      if ( typeof this.get('taxonCoverage') !== 'undefined' && this.get('taxonCoverage').length > 0) {
        // TODO: This nonEmptyCoverages business could be wrapped up in a empty()
        // method on the model itself
        var nonEmptyCoverages;

        // Don't serialize if taxonCoverage is empty
        nonEmptyCoverages = _.filter(this.get('taxonCoverage'), function(t) {
          return _.flatten(t.get('taxonomicClassification')).length > 0;
        });

        if (nonEmptyCoverages.length > 0) {

          //Create the <coverage> node if there isn't one already
          if (datasetNode.find('coverage').length === 0) {
            var insertAfter = this.getEMLPosition(eml, 'coverage');

            if(insertAfter)
              insertAfter.after(document.createElement('coverage'));
            else
              datasetNode.append(document.createElement("coverage"));
          }

          //Get the existing taxon coverage nodes from the EML
          var existingTaxonCov = datasetNode.find("taxonomiccoverage");

          //Update the DOM of each model
          _.each(this.get("taxonCoverage"), function(taxonCoverage, position){

            //Update the existing taxonCoverage node if it exists
            if(existingTaxonCov.length-1 >= position){
              $(existingTaxonCov[position]).replaceWith(taxonCoverage.updateDOM());
            }
            //Or, append new nodes
            else{
              datasetNode.find('coverage').append(taxonCoverage.updateDOM());
            }
          });

          //Remove existing taxon coverage nodes that don't have an accompanying model
          this.removeExtraNodes(existingTaxonCov, this.get("taxonCoverage"));

        }
      }

      //Serialize the temporal coverage
      var existingTemporalCoverages = datasetNode.find("temporalcoverage");

      //Update the DOM of each model
      _.each(this.get("temporalCoverage"), function(temporalCoverage, position){

        //Update the existing temporalCoverage node if it exists
        if(existingTemporalCoverages.length-1 >= position){
          $(existingTemporalCoverages[position]).replaceWith(temporalCoverage.updateDOM());
        }
        //Or, append new nodes
        else{
          datasetNode.find('coverage').append(temporalCoverage.updateDOM());
        }
      });

      //Remove existing taxon coverage nodes that don't have an accompanying model
      this.removeExtraNodes(existingTemporalCoverages, this.get("temporalCoverage"));

      if(datasetNode.find("coverage").children().length == 0)
        datasetNode.find("coverage").remove();

      //If there is no creator, create one from the user
      if(!this.get("creator").length){
       var party = new EMLParty({ parentModel: this, type: "creator" });

       party.createFromUser();

       this.set("creator", [party]);
      }

      //Serialize the creators
      this.serializeParties(eml, "creator");

      //Serialize the metadata providers
      this.serializeParties(eml, "metadataProvider");

      //Serialize the associated parties
      this.serializeParties(eml, "associatedParty");

      //Serialize the contacts
      this.serializeParties(eml, "contact");

      //Serialize the publishers
      this.serializeParties(eml, "publisher");

      // Serialize methods
      if(this.get('methods')) {

        //If the methods model is empty, remove it from the EML
        if( this.get("methods").isEmpty() )
          datasetNode.find("methods").remove();
        else{

          //Serialize the methods model
          var methodsEl = this.get('methods').updateDOM();

          //If the methodsEl is an empty string or other falsey value, then remove the methods node
          if( !methodsEl || !$(methodsEl).children().length ){
            datasetNode.find("methods").remove();
          }
          else{

            //Add the <methods> node to the EML
            datasetNode.find("methods").detach();

            var insertAfter = this.getEMLPosition(eml, "methods");

            if(insertAfter)
              insertAfter.after(methodsEl);
            else
              datasetNode.append(methodsEl);
          }
        }
      }
      //If there are no methods, then remove the methods nodes
      else{

        if( datasetNode.find("methods").length > 0 ){
          datasetNode.find("methods").remove();
        }

      }

      //Serialize the keywords
      this.serializeKeywords(eml, "keywordSets");

      //Serialize the intellectual rights
      if(this.get("intellectualRights")){
        if(datasetNode.find("intellectualRights").length)
          datasetNode.find("intellectualRights").html("<para>" + this.get("intellectualRights") + "</para>")
        else{

          this.getEMLPosition(eml, "intellectualrights").after(
              $(document.createElement("intellectualRights"))
                .html("<para>" + this.get("intellectualRights") + "</para>"));
        }
      }

      //Detach the project elements from the DOM
      if(datasetNode.find("project").length){

        datasetNode.find("project").detach();

      }

      //If there is an EMLProject, update its DOM
      if(this.get("project")){

        this.getEMLPosition(eml, "project").after(this.get("project").updateDOM());

      }

      //Get the existing taxon coverage nodes from the EML
      var existingEntities = datasetNode.find("otherEntity, dataTable");

      //Serialize the entities
      _.each(this.get("entities"), function(entity, position) {

        //Update the existing node if it exists
        if(existingEntities.length - 1 >= position) {
          //Remove the entity from the EML
          $(existingEntities[position]).detach();
          //Insert it into the correct position
          this.getEMLPosition(eml, entity.get("type").toLowerCase()).after(entity.updateDOM());        }
        //Or, append new nodes
        else {
          //Inser the entity into the correct position
          this.getEMLPosition(eml, entity.get("type").toLowerCase()).after(entity.updateDOM());
        }

      }, this);

      //Remove extra entities that have been removed
      var numExtraEntities = existingEntities.length - this.get("entities").length;
      for( var i = (existingEntities.length - numExtraEntities); i<existingEntities.length; i++){
        $(existingEntities)[i].remove();
      }

      //Do a final check to make sure there are no duplicate ids in the EML
      var elementsWithIDs = $(eml).find("[id]"),
      //Get an array of all the ids in this EML doc
          allIDs = _.map(elementsWithIDs, function(el){ return $(el).attr("id") });

      //If there is at least one id in the EML...
      if(allIDs && allIDs.length){
        //Boil the array down to just the unique values
        var uniqueIDs = _.uniq(allIDs);

        //If the unique array is shorter than the array of all ids,
        // then there is a duplicate somewhere
        if(uniqueIDs.length < allIDs.length){

          //For each element in the EML that has an id,
          _.each(elementsWithIDs, function(el){

            //Get the id for this element
            var id = $(el).attr("id");

            //If there is more than one element in the EML with this id,
            if( $(eml).find("[id='" + id + "']").length > 1 ){
              //And if it is not a unit node, which we don't want to change,
              if( !$(el).is("unit") )
                //Then change the id attribute to a random uuid
                $(el).attr("id", "urn-uuid-" + uuid.v4());
            }

          });

        }
      }

      //Camel-case the XML
      var emlString = "";
      _.each(eml, function(rootEMLNode){ emlString += this.formatXML(rootEMLNode); }, this);

      return emlString;
    },

    /*
     * Given an EML DOM and party type, this function updated and/or adds the EMLParties to the EML
     */
    serializeParties: function(eml, type){

      //Remove the nodes from the EML for this party type
      $(eml).find(type.toLowerCase()).remove();

      //Serialize each party of this type
       _.each(this.get(type), function(party, i){

         //Get the last node of this type to insert after
         var insertAfter = $(eml).find(type.toLowerCase()).last();

         //If there isn't a node found, find the EML position to insert after
         if( !insertAfter.length ) {
           insertAfter = this.getEMLPosition(eml, type);
         }

         //Update the DOM of the EMLParty
         var emlPartyDOM = party.updateDOM();

         //Make sure we don't insert empty EMLParty nodes into the EML
         if( $(emlPartyDOM).children().length ){
           //Insert the party DOM at the insert position
                if ( insertAfter && insertAfter.length )
                  insertAfter.after(emlPartyDOM);
                //If an insert position still hasn't been found, then just append to the dataset node
                else
                  $(eml).find("dataset").append(emlPartyDOM);
            }

       }, this);

      //Create a certain parties from the current app user if none is given
      if(type == "contact" && !this.get("contact").length){
        //Get the creators
        var creators = this.get("creator"),
          contacts = [];

        _.each(creators, function(creator){
          //Clone the creator model and add it to the contacts array
          var newModel = new EMLParty({ parentModel: this });
          newModel.set(creator.toJSON());
          newModel.set("type", type);

          contacts.push(newModel);
        }, this);

         this.set(type, contacts);

         //Call this function again to serialize the new models
         this.serializeParties(eml, type);
       }
     },


      serializeKeywords: function(eml) {
        // Remove all existing keywordSets before appending
        $(eml).find('dataset').find('keywordset').remove();

        if (this.get('keywordSets').length == 0) return;

        // Create the new keywordSets nodes
        var nodes = _.map(this.get('keywordSets'), function(kwd) {
          return kwd.updateDOM();
        });

            this.getEMLPosition(eml, "keywordset").after(nodes);
      },

      /*
       * Remoes nodes from the EML that do not have an accompanying model
       * (Were probably removed from the EML by the user during editing)
       */
      removeExtraNodes: function(nodes, models){
        // Remove the extra nodes
         var extraNodes =  nodes.length - models.length;
         if(extraNodes > 0){
           for(var i = models.length; i < nodes.length; i++){
             $(nodes[i]).remove();
           }
         }
      },

      /*
       * Saves the EML document to the server using the DataONE API
       */
      save: function(attributes, options){

        //Validate before we try anything else
        if(!this.isValid()){
          this.trigger("invalid");
          this.trigger("cancelSave");
          return false;
        }
        else{
          this.trigger("valid");
        }

        this.setFileName();

        //Set the upload transfer as in progress
        this.set("uploadStatus", "p");

        //Reset the draftSaved attribute
        this.set("draftSaved", false);

        //Create the creator from the current user if none is provided
        if(!this.get("creator").length){
         var party = new EMLParty({ parentModel: this, type: "creator" });

         party.createFromUser();

         this.set("creator", [party]);
        }

        //Create the contact from the current user if none is provided
        if(!this.get("contact").length){
         var party = new EMLParty({ parentModel: this, type: "contact" });

         party.createFromUser();

         this.set("contact", [party]);
        }

        //If this is an existing object and there is no system metadata, retrieve it
        if(!this.isNew() && !this.get("sysMetaXML")){
          var model = this;

          //When the system metadata is fetched, try saving again
          var fetchOptions = {
             success: function(response){
               model.set(DataONEObject.prototype.parse.call(model, response));
               model.save(attributes, options);
             }
          }

          //Fetch the system metadata now
          this.fetchSystemMetadata(fetchOptions);

          return;
        }

       //Create a FormData object to send data with our XHR
       var formData = new FormData();

       try{

         //Add the identifier to the XHR data
        if(this.isNew()){
          formData.append("pid", this.get("id"));
        }
        else{
          //Create a new ID
          this.updateID();

          //Add the ids to the form data
          formData.append("newPid", this.get("id"));
          formData.append("pid", this.get("oldPid"));
        }

        //Serialize the EML XML
        var xml = this.serialize();
        var xmlBlob = new Blob([xml], {type : 'application/xml'});

        //Get the size of the new EML XML
        this.set("size", xmlBlob.size);

        //Get the new checksum of the EML XML
        var checksum = md5(xml);
        this.set("checksum", checksum);
        this.set("checksumAlgorithm", "MD5");

        //Create the system metadata XML
        var sysMetaXML = this.serializeSysMeta();

        //Send the system metadata as a Blob
        var sysMetaXMLBlob = new Blob([sysMetaXML], {type : 'application/xml'});

        //Add the object XML and System Metadata XML to the form data
        formData.append("object", xmlBlob);
        formData.append("sysmeta", sysMetaXMLBlob, "sysmeta");
      }
      catch(error){
         //Reset the identifier since we didn't actually update the object
         this.resetID();

         this.set("uploadStatus", "e");
         this.trigger("error");
         this.trigger("cancelSave");
         return false;
       }

       var model = this;
       var saveOptions = options || {};
       _.extend(saveOptions, {
         data : formData,
         cache: false,
         contentType: false,
         dataType: "text",
         processData: false,
         parse: false,
         //Use the URL function to determine the URL
         url: this.isNew() ? this.url() : this.url({update: true}),
         xhr: function(){
            var xhr = new window.XMLHttpRequest();

            //Upload progress
            xhr.upload.addEventListener("progress", function(evt){
              if (evt.lengthComputable) {
                var percentComplete = evt.loaded / evt.total * 100;

                model.set("uploadProgress", percentComplete);
              }
            }, false);

            return xhr;
        },
        success: function(model, response, xhr){

          model.set("numSaveAttempts", 0);
          model.set("uploadStatus", "c");
          model.set("sysMetaXML", model.serializeSysMeta());
          model.fetch({merge: true, sysMeta: true});
          model.trigger("successSaving", model);

        },
        error: function(model, response, xhr){

          model.set("numSaveAttempts", model.get("numSaveAttempts") + 1);
          var numSaveAttempts = model.get("numSaveAttempts");

          //Reset the identifier changes
          model.resetID();

          if( numSaveAttempts < 3 && (response.status == 408 || response.status == 0) ){

            //Try saving again in 10, 40, and 90 seconds
            setTimeout(function(){
                        model.save.call(model);
                       },
                       (numSaveAttempts * numSaveAttempts) * 10000);
          }
          else{
            model.set("numSaveAttempts", 0);

            //Get the error error information
            var errorDOM       = $($.parseHTML(response.responseText)),
                errorContainer = errorDOM.filter("error"),
                msgContainer   = errorContainer.length? errorContainer.find("description") : errorDOM.not("style, title"),
                errorMsg       = msgContainer.length? msgContainer.text() : errorDOM;

            //When there is no network connection (status == 0), there will be no response text
            if(!errorMsg || (response.status == 408 || response.status == 0))
              errorMsg = "There was a network issue that prevented your metadata from uploading. " +
                     "Make sure you are connected to a reliable internet connection.";

            //Save the error message in the model
            model.set("errorMessage", errorMsg);

            //Set the model status as e for error
            model.set("uploadStatus", "e");

            //Save the EML as a plain text file, until drafts are a supported feature
            var copy = model.createTextCopy();

            //If the EML copy successfully saved, let the user know that there is a copy saved behind the scenes
            model.listenToOnce(copy, "successSaving", function(){

              model.set("draftSaved", true);

              //Trigger the errorSaving event so other parts of the app know that the model failed to save
              //And send the error message with it
              model.trigger("errorSaving", errorMsg);

            });

            //If the EML copy fails to save too, then just display the usual error message
            model.listenToOnce(copy, "errorSaving", function(){

              //Trigger the errorSaving event so other parts of the app know that the model failed to save
              //And send the error message with it
              model.trigger("errorSaving", errorMsg);

            });

            //Save the EML plain text copy
            copy.save();

            //Send this exception to Google Analytics
            if(MetacatUI.appModel.get("googleAnalyticsKey") && (typeof ga !== "undefined")){
              ga('send', 'exception', {
                'exDescription': "EML save error: " + errorMsg + " | Id: " + model.get("id") +
                  " | v. " + MetacatUI.metacatUIVersion + " | EML draft: " + copy.get("id"),
                'exFatal': true
              });
            }
          }
        }
     }, MetacatUI.appUserModel.createAjaxSettings());

      return Backbone.Model.prototype.save.call(this, attributes, saveOptions);
    },


      /*
       * Checks if this EML model has all the required values necessary to save to the server
       */
      validate: function() {
        var errors = {};

        //A title is always required by EML
        if( !this.get("title").length || !this.get("title")[0] ){
          errors.title = "A title is required";
        }

        // Validate the publication date
        if (this.get("pubDate") != null) {
          if (!this.isValidYearDate(this.get("pubDate"))) {
            errors["pubDate"] = ["The value entered for publication date, '"
              + this.get("pubDate") +
              "' is not a valid value for this field. Enter with a year (e.g. 2017) or a date in the format YYYY-MM-DD."]
          }
        }

        // Validate the temporal coverage
        if ( this.get("temporalCoverage").length ) {
          _.each(this.get("temporalCoverage"), function(temporalCoverage){
            if( !temporalCoverage.isValid() ){
              if( !errors.temporalCoverage )
                errors.temporalCoverage = [temporalCoverage.validationError];
              else
                errors.temporalCoverage.push(temporalCoverage.validationError);
            }
          });
        }

        //Validate the EMLParty models
        var partyTypes = ["associatedParty", "contact", "creator", "metadataProvider", "publisher"];
        _.each(partyTypes, function(type){

          var people = this.get(type);
          _.each(people, function(person, i){

            if( !person.isValid() ){
              if( !errors[type] )
                errors[type] = [person.validationError];
              else
                errors[type].push(person.validationError);
            }

          }, this);

        }, this);

        //Validate the EMLGeoCoverage models
        _.each(this.get("geoCoverage"), function(geoCoverageModel, i){

          if( !geoCoverageModel.isValid() ){
            if( !errors.geoCoverage )
              errors.geoCoverage = [geoCoverageModel.validationError];
            else
              errors.geoCoverage.push(geoCoverageModel.validationError);
          }

        }, this);

        //Validate the EMLTaxonCoverage model
        var taxonModel = this.get("taxonCoverage")[0];

        if( !taxonModel.isEmpty() && !taxonModel.isValid() ){
          errors = _.extend(errors, taxonModel.validationError);
        }
        else if( taxonModel.isEmpty() &&
          this.get("taxonCoverage").length == 1 &&
          MetacatUI.appModel.get("emlEditorRequiredFields").taxonCoverage ){

          taxonModel.isValid();
          errors = _.extend(errors, taxonModel.validationError);

        }

        //Validate each EMLEntity model
        _.each( this.get("entities"), function(entityModel){

          if( !entityModel.isValid() ){
            if( !errors.entities )
              errors.entities = [entityModel.validationError];
            else
              errors.entities.push(entityModel.validationError);
          }

        });

        //Check the required fields for this MetacatUI configuration
        if(MetacatUI.appModel.get("emlEditorRequiredFields")){
            _.each(Object.keys(MetacatUI.appModel.get("emlEditorRequiredFields")), function(key){
              var isRequired = MetacatUI.appModel.get("emlEditorRequiredFields")[key];

              //If it's not required, then exit
              if(!isRequired) return;

              if(key == "alternateIdentifier"){
                if( !this.get("alternateIdentifier").length || _.every(this.get("alternateIdentifier"), function(altId){ return altId.trim() == "" }) )
                  errors.alternateIdentifier = "At least one alternate identifier is required."
              }
              else if(key == "generalTaxonomicCoverage"){
                if( !this.get("taxonCoverage").length || !this.get("taxonCoverage")[0].get("generalTaxonomicCoverage") )
                  errors.generalTaxonomicCoverage = "Provide a description of the general taxonomic coverage of this data set.";
              }
              else if(key == "geoCoverage"){
                if(!this.get("geoCoverage").length)
                  errors.geoCoverage = "At least one location is required.";
              }
              else if(key == "intellectualRights"){
                if( !this.get("intellectualRights") )
                  errors.intellectualRights = "Select usage rights for this data set.";
              }
              else if(key == "studyExtentDescription"){
                if( !this.get("methods") || !this.get("methods").get("studyExtentDescription") )
                  errors.studyExtentDescription = "Provide a study extent description.";
              }
              else if(key == "samplingDescription"){
                if( !this.get("methods") || !this.get("methods").get("samplingDescription") )
                  errors.samplingDescription = "Provide a sampling description.";
              }
              else if(key == "temporalCoverage"){
                if(!this.get("temporalCoverage").length)
                  errors.temporalCoverage = "Provide the date(s) for this data set.";
              }
              else if(key == "taxonCoverage"){
                if(!this.get("taxonCoverage").length)
                  errors.taxonCoverage = "At least one taxa rank and value is required.";
              }
              else if(key == "keywordSets"){
                if( !this.get("keywordSets").length )
                  errors.keywordSets = "Provide at least one keyword.";
              }
              else if(key == "methods"){
                if(!this.get("methods"))
                  errors.methods = "At least one method step is required.";
              }
              else if(key == "funding"){
                if(!this.get("project") || !this.get("project").get("funding").length)
                  errors.funding = "Provide at least one project funding number or name.";
              }
              else if(key == "abstract"){
                if(!this.get("abstract").length)
                  errors["abstract"] = "Provide an abstract.";
              }
              else if( !this.get(key) || (Array.isArray(this.get(key)) && !this.get(key).length) ){
                errors[key] = "Provide a " + key + ".";
              }
            }, this);

        }

        if( Object.keys(errors).length )
          return errors;
        else{
          return;
        }
      },

      /* Returns a boolean for whether the argument 'value' is a valid
      value for EML's yearDate type which is used in a few places.

      Note that this method considers a zero-length String to be valid
      because the EML211.serialize() method will properly handle a null
      or zero-length String by serializing out the current year. */
      isValidYearDate: function(value) {
        return (value === "" || /^\d{4}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value));
      },

      /*
       * Sends an AJAX request to fetch the system metadata for this EML object.
       * Will not trigger a sync event since it does not use Backbone.Model.fetch
       */
      fetchSystemMetadata: function(options){

        if(!options) var options = {};
        else options = _.clone(options);

        var model = this,
          fetchOptions = _.extend({
            url: MetacatUI.appModel.get("metaServiceUrl") + this.get("id"),
            dataType: "text",
            success: function(response){
              model.set(DataONEObject.prototype.parse.call(model, response));
            },
            error: function(){
              model.trigger('error');
            }
          }, options);

          //Add the authorization header and other AJAX settings
          _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());

          $.ajax(fetchOptions);
      },

      /*
       * Returns the node in the given EML document that the given node type should be inserted after
       */
      getEMLPosition: function(eml, nodeName) {
        var nodeOrder = ["alternateidentifier", "shortname", "title", "creator", "metadataprovider", "associatedparty",
                        "pubdate", "language", "series", "abstract", "keywordset", "additionalinfo", "intellectualrights",
                        "distribution", "coverage", "purpose", "maintenance", "contact", "publisher", "pubplace",
                        "methods", "project", "datatable", "spatialraster", "spatialvector", "storedprocedure", "view", "otherentity"];
          var entityNodes = ["datatable", "spatialraster", "spatialvector", "storedprocedure", "view", "otherentity"];
          var isEntityNode = _.contains(entityNodes, nodeName);
          var position = _.indexOf(nodeOrder, nodeName.toLowerCase());
          if ( position == -1 ) {
              return false;
          }

          //Go through each node in the node list and find the position where this node will be inserted after
          for (var i = position - 1; i >= 0; i--) {
              if ( $(eml).find(nodeOrder[i]).length ) {
                  // Handle non-entity nodes
                  if ( ! isEntityNode ) {
                      return $(eml).find("dataset").children(nodeOrder[i]).last();
                  } else {
                      // Handle entity nodes by returning the
                      // last child of the parent <dataset> since
                      // entities have a {0..n}+ model
                      // (i.e optional, repeatable, no specific order)
                      return $(eml).find("dataset").children().last();
                  }
              }
        }

        return false;
      },

      /*
       * Checks if this model has updates that need to be synced with the server.
       */
      hasUpdates: function(){
        if(this.constructor.__super__.hasUpdates.call(this)) return true;

        //If nothing else has been changed, then this object hasn't had any updates
        return false;
      },

      /*
       Add an entity into the EML 2.1.1 object
      */
      addEntity: function(emlEntity, position) {
        //Get the current list of entities
        var currentEntities = this.get("entities");

        if( typeof position == "undefined" || position == -1)
          currentEntities.push(emlEntity);
        else
          //Add the entity model to the entity array
          currentEntities.splice(position, 0, emlEntity);

        this.trigger("change:entities");

        this.trickleUpChange();

        return this;
      },

      /*
       Remove an entity from the EML 2.1.1 object
      */
      removeEntity: function(emlEntity) {
          if(!emlEntity || typeof emlEntity != "object")
            return;

        //Get the current list of entities
        var entities = this.get("entities");

        entities = _.without(entities, emlEntity);

        this.set("entities", entities);
      },

      /*
       * Find the entity model for a given DataONEObject
       */
      getEntity: function(dataONEObj){

        //If an EMLEntity model has been found for this object before, then return it
        if( dataONEObj.get("metadataEntity") ){
          dataONEObj.get("metadataEntity").set("dataONEObject", dataONEObj);
          return dataONEObj.get("metadataEntity");
        }

        var entity = _.find(this.get("entities"), function(e){

          //Matches of the checksum or identifier are definite matches
          if( e.get("xmlID") == dataONEObj.getXMLSafeID() )
            return true;
          else if( e.get("physicalMD5Checksum") && (e.get("physicalMD5Checksum") == dataONEObj.get("checksum") && dataONEObj.get("checksumAlgorithm").toUpperCase() == "MD5"))
            return true;
          else if(e.get("downloadID") && e.get("downloadID") == dataONEObj.get("id"))
            return true;

          // Get the file name from the EML for this entity
          var fileNameFromEML = e.get("physicalObjectName") || e.get("entityName");

          // If the EML file name matches the DataONEObject file name
          if( fileNameFromEML &&
            ((fileNameFromEML == dataONEObj.get("fileName")) ||
              (fileNameFromEML.replace(/ /g, "_") == dataONEObj.get("fileName"))) ){

            //Get an array of all the other entities in this EML
            var otherEntities = _.without(this.get("entities"), e);

              // If this entity name matches the dataone object file name, AND no other dataone object file name
              // matches, then we can assume this is the entity element for this file.
            var otherMatchingEntity = _.find(otherEntities, function(otherE){

              // Get the file name from the EML for the other entities
              var otherFileNameFromEML = otherE.get("physicalObjectName") || otherE.get("entityName");

              // If the file names match, return true
              if( (otherFileNameFromEML == dataONEObj.get("fileName")) || (otherFileNameFromEML.replace(/ /g, "_") == dataONEObj.get("fileName")) )
                return true;
            });

            // If this entity's file name didn't match any other file names in the EML,
            // then this entity is a match for the given dataONEObject
            if( !otherMatchingEntity )
              return true;
          }

        }, this);

        //If we found an entity, give it an ID and return it
        if(entity){

          //If this entity has been matched to another DataONEObject already, then don't match it again
          if( entity.get("dataONEObject") ){
            return;
          }
          else{
            entity.set("dataONEObject", dataONEObj);
          }

            //Create an XML-safe ID and set it on the Entity model
            var entityID = this.getUniqueEntityId(dataONEObj);
            entity.set("xmlID", entityID);

            //Save a reference to this entity so we don't have to refind it later
            dataONEObj.set("metadataEntity", entity);

          return entity;
        }

        //See if one data object is of this type in the package
        var matchingTypes = _.filter(this.get("entities"), function(e){
          return (e.get("formatName") == (dataONEObj.get("formatId") || dataONEObj.get("mediaType")));
        });

        if(matchingTypes.length == 1){
            //Create an XML-safe ID and set it on the Entity model
          matchingTypes[0].set("xmlID", dataONEObj.getXMLSafeID());

          return matchingTypes[0];
        }

        //If this EML is in a DataPackage with only one other DataONEObject,
        // and there is only one entity in the EML, then we can assume they are the same entity
        if( this.get("entities").length == 1 ){

          if( this.get("collections")[0] && this.get("collections")[0].type == "DataPackage" &&
              this.get("collections")[0].length == 2 && _.contains(this.get("collections")[0].models, dataONEObj)){
                return this.get("entities")[0];
          }

        }

        return false;

      },

      createEntity: function(dataONEObject){
        // Add or append an entity to the parent's entity list
          var entityModel = new EMLOtherEntity({
              entityName : dataONEObject.get("fileName"),
              entityType : dataONEObject.get("formatId") ||
                           dataONEObject.get("mediaType") ||
                           "application/octet-stream",
              dataONEObject: dataONEObject,
              parentModel: this,
              xmlID: dataONEObject.getXMLSafeID()
          });

          this.addEntity(entityModel);

          //If this DataONEObject fails to upload, remove the EML entity
          this.listenTo(dataONEObject, "errorSaving", function(){
            this.removeEntity(dataONEObject.get("metadataEntity"));

            //Listen for a successful save so the entity can be added back
            this.listenToOnce(dataONEObject, "successSaving", function(){
              this.addEntity(dataONEObject.get("metadataEntity"))
            });
          });

      },

      /*
      * Creates an XML-safe identifier that is unique to this EML document,
      * based on the given DataONEObject model. It is intended for EML entity nodes in particular.
      *
      * @param {DataONEObject} - a DataONEObject model that this EML documents
      * @return {string} - an identifier string unique to this EML document
      */
      getUniqueEntityId: function(dataONEObject){

        var uniqueId = "";

        uniqueId = dataONEObject.getXMLSafeID();

        //Get the EML string, if there is one, to check if this id already exists
        var emlString = this.get("objectXML");

        //If this id already exists in the EML...
        if(emlString && emlString.indexOf(' id="' + uniqueId + '"')){
          //Create a random uuid to use instead
          uniqueId = "urn-uuid-" + uuid.v4();
        }

        return uniqueId;

      },

      /*
       * removeParty - removes the given EMLParty model from this EML211 model's attributes
       */
      removeParty: function(partyModel){
        //The list of attributes this EMLParty might be stored in
        var possibleAttr = ["creator", "contact", "metadataProvider", "publisher", "associatedParty"];

        // Iterate over each possible attribute
        _.each(possibleAttr, function(attr){

          if( _.contains(this.get(attr), partyModel) ){
            this.set( attr, _.without(this.get(attr), partyModel) );
          }

        }, this);
      },

      /*
      * Adds the given EMLParty model to this EML211 model in the
      * appropriate role array in the given position
      *
      * @param {EMLParty} - The EMLParty model to add
      * @param {number} - The position in the role array in which to insert this EMLParty
      * @return {boolean} - Returns true if the EMLParty was successfully added, false if it was cancelled
      */
      addParty: function(partyModel, position){

        //If the EMLParty model is empty, don't add it to the EML211 model
        if(partyModel.isEmpty())
          return false;

        //Get the role of this EMLParty
        var role = partyModel.get("type") || "associatedParty";

        //If this model already contains this EMLParty, then exit
        if( _.contains(this.get(role), partyModel) )
          return false;

        if( typeof position == "undefined" ){
          this.get(role).push(partyModel);
        }
        else {
          this.get(role).splice(position, 0, partyModel);
        }

        this.trigger("change:" + role);

        return true;
      },

      createUnits: function(){
        this.units.fetch();
      },

      /* Initialize the object XML for brand spankin' new EML objects */
      createXML: function() {
          var xml = "<eml:eml xmlns:eml=\"eml://ecoinformatics.org/eml-2.1.1\"></eml:eml>",
              eml = $($.parseHTML(xml));

              // Set base attributes
              eml.attr("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
              eml.attr("xmlns:stmml", "http://www.xml-cml.org/schema/stmml-1.1");
              eml.attr("xsi:schemaLocation", "eml://ecoinformatics.org/eml-2.1.1 eml.xsd");
              eml.attr("packageId", this.get("id"));
              eml.attr("system", "knb"); // We could make this configurable at some point

              // Add the dataset
              eml.append(document.createElement("dataset"));
              eml.find("dataset").append(document.createElement("title"));

              emlString = $(document.createElement("div")).append(eml.clone()).html();

              return emlString;
      },

      /*
          Replace elements named "source" with "sourced" due to limitations
          with using $.parseHTML() rather than $.parseXML()

          @param xmlString  The XML string to make the replacement in
      */
      cleanUpXML: function(xmlString){
        xmlString.replace("<source>", "<sourced>");
        xmlString.replace("</source>", "</sourced>");

        return xmlString;
      },

      createTextCopy: function(){
        var emlDraftText = "EML draft for " + this.get("id") + "(" + this.get("title") + ") by " +
              MetacatUI.appUserModel.get("firstName") + " " + MetacatUI.appUserModel.get("lastName");

        if(this.get("uploadStatus") == "e" && this.get("errorMessage")){
          emlDraftText += ". This EML had the following save error: `" + this.get("errorMessage") + "`   ";
        }
        else {
          emlDraftText += ":   ";
        }

        emlDraftText += this.serialize();

        var plainTextEML = new DataONEObject({
              formatId: "text/plain",
              fileName: "eml_draft_" + (MetacatUI.appUserModel.get("lastName") || "") + ".txt",
              uploadFile: new Blob([emlDraftText], {type : 'plain/text'}),
              synced: true
            });

        return plainTextEML;
      },

      /*
      * Cleans up the given text so that it is XML-valid by escaping reserved characters, trimming white space, etc.
      *
      * @param {string} textString - The string to clean up
      * @return {string} - The cleaned up string
      */
      cleanXMLText: function(textString){

        if( typeof textString != "string" )
          return;

        textString = textString.trim();

        //Check for XML/HTML elements
        _.each(textString.match(/<\s*[^>]*>/g), function(xmlNode){

          //Encode <, >, and </ substrings
          var tagName = xmlNode.replace(/>/g, "&gt;");
          tagName = tagName.replace(/</g, "&lt;");

          //Replace the xmlNode in the full text string
          textString = textString.replace(xmlNode, tagName);

        });

        return textString;

      },

      /*
          Dereference "reference" elements and replace them with a cloned copy
          of the referenced content

          @param xmlString  The XML string with reference elements to transform
      */
      dereference: function(xmlString) {
          var referencesList; // the array of references elements in the document
          var referencedID;  // The id of the referenced element
          var referencesParentEl;  // The parent of the given references element
          var referencedEl; // The referenced DOM to be copied

          xmlDOM = $.parseXML(xmlString);
          referencesList = xmlDOM.getElementsByTagName("references");

          if (referencesList.length) {
              // Process each references elements
              _.each(referencesList, function(referencesEl, index, referencesList) {
                  // Can't rely on the passed referencesEl since the list length changes
                  // because of the remove() below. Reuse referencesList[0] for every item:
                  // referencedID = $(referencesEl).text(); // doesn't work
                  referencesEl = referencesList[0];
                  referencedID = $(referencesEl).text();
                  referencesParentEl = ($(referencesEl).parent())[0];
                  if (typeof referencedID !== "undefined" && referencedID != "") {
                      referencedEl = xmlDOM.getElementById(referencedID);
                      if (typeof referencedEl != "undefined") {
                          // Clone the referenced element and replace the references element
                          var referencedClone = ($(referencedEl).clone())[0];
                          $(referencesParentEl)
                              .children(referencesEl.localName)
                              .replaceWith($(referencedClone).children());
                          //$(referencesParentEl).append($(referencedClone).children());
                          $(referencesParentEl).attr("id", DataONEObject.generateId());
                      }
                  }
              }, xmlDOM);
          }
          return (new XMLSerializer()).serializeToString(xmlDOM);
      },

      /*
      * Uses the EML `title` to set the `fileName` attribute on this model.
      */
      setFileName: function(){

        var title = "";

        // Get the title from the metadata
        if( Array.isArray(this.get("title")) ){
          title = this.get("title")[0];
        }
        else if( typeof this.get("title") == "string" ){
          title = this.get("title");
        }

        //Max title length
        var maxLength = 50;

        //trim the string to the maximum length
        var trimmedTitle = title.trim().substr(0, maxLength);

        //re-trim if we are in the middle of a word
        if( trimmedTitle.indexOf(" ") > -1 ){
          trimmedTitle = trimmedTitle.substr(0, Math.min(trimmedTitle.length, trimmedTitle.lastIndexOf(" ")));
        }

        //Replace all non alphanumeric characters with underscores
        // and make sure there isn't more than one underscore in a row
        trimmedTitle = trimmedTitle.replace(/[^a-zA-Z0-9]/g, "_").replace(/_{2,}/g, "_");

        //Set the fileName on the model
        this.set("fileName", trimmedTitle + ".xml");
      },

      trickleUpChange: function(){
        if( !MetacatUI.rootDataPackage || !MetacatUI.rootDataPackage.packageModel )
          return;

        //Mark the package as changed
        MetacatUI.rootDataPackage.packageModel.set("changed", true);
      }

    });

    return EML211;
  }
);
