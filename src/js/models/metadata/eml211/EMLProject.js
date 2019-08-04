/* global define */
define(['jquery', 'underscore', 'backbone', "models/DataONEObject", "models/metadata/eml211/EMLParty"],
    function($, _, Backbone, DataONEObject, EMLParty) {

	var EMLProject = Backbone.Model.extend({

		defaults: {
			objectDOM: null,
			title: null,
			funding: [],
			personnel: null,
			parentModel: null
		},

		initialize: function(options){
			if(options && options.objectDOM)
				this.set(this.parse(options.objectDOM));

			this.on("change:personnel change:funding change:title", this.trickleUpChange);
		},

		nodeNameMap: function(){
			return {
				"descriptorvalue" : "descriptorValue",
				"designdescription" : "designDescription",
				"studyareadescription" : "studyAreaDescription",
				"relatedproject" : "relatedProject",
				"researchproject" : "researchProject"
			}
		},

		//TODO: This only supports the funding and title elements right now
		parse: function(objectDOM){
			if(!objectDOM)
				var objectDOM = this.get("objectDOM");

			var modelJSON = {};

      //Parse the title
      var titleNode = $(objectDOM).children("title");
      if( titleNode.length ){
          modelJSON.title = titleNode.text() || null;
      }

			//Parse the funding info
			modelJSON.funding = [];
			var fundingEl    = $(objectDOM).children("funding"),
				  fundingNodes = fundingEl.children("para").length ? fundingEl.children("para") : fundingEl;

      //Iterate over each funding node and put the text into the funding array
			_.each(fundingNodes, function(fundingNode){

        if( $(fundingNode).text() ){
            modelJSON.funding.push( $(fundingNode).text() );
        }

			}, this);

			/*
			var personnelNode = $(objectDOM).find("personnel");
			modelJSON.personnel = [];
			for(var i=0; i<personnelNode.length; i++){
				modelJSON.personnel.push( new EMLParty({ objectDOM: personnelNode[i], parentModel: this }));
			}
			*/

			return modelJSON;
		},

		serialize: function(){
			var objectDOM = this.updateDOM(),
				xmlString = objectDOM.outerHTML;

			  //Camel-case the XML
	    	xmlString = this.formatXML(xmlString);

	    	return xmlString;
		},

		updateDOM: function(){
			var objectDOM = this.get("objectDOM") ? this.get("objectDOM").cloneNode(true) : document.createElement("project");

			//Create a project title
			//If there is no title node, create one
			if( !$(objectDOM).find("title").length ){

				var title = this.get("title") || this.get("parentModel").get("title") || "";
				$(objectDOM).prepend( $(document.createElement("title")).text(title) );

      }

			//Create project personnel
			if( !$(objectDOM).find("personnel").length ){
				var personnel = this.get("personnel");

				if(!personnel){

					personnel = [];

					_.each(this.get("parentModel").get("creator"), function(creator){

            var individualName = (typeof creator.get("individualName") == "object") ?
                                    Object.assign({}, creator.get("individualName")) : null,
                organizationName = creator.get("organizationName"),
                positionName = creator.get("positionName");

						var newPersonnel = new EMLParty({
							roles: ["principalInvestigator"],
							parentModel: this,
							type: "personnel",
							individualName: individualName,
              organizationName: organizationName,
              positionName: positionName
						});

						personnel.push(newPersonnel);

						$(objectDOM).append(newPersonnel.updateDOM());

					}, this);

					this.trigger("change:personnel");

				}
				else{

					_.each(this.get("personnel"), function(party){
						$(objectDOM).append(party.updateDOM());
					}, this);

				}
			}

			// Serialize funding (if needed)
			var fundingNode = $(objectDOM).children("funding");

			if (this.get('funding') && this.get('funding').length > 0) {

        // Create the funding element if needed
				if (fundingNode.length == 0) {

					fundingNode = document.createElement("funding");
					$(objectDOM).append(fundingNode);

				} else {

					// Clear the funding node out of all <para> child elements
					// We only replace <paras> because <funding> is an EMLText module
					// instance and can contain other content we don't want to remove
					// when serializing
					$(fundingNode).children("para").remove();

				}

        //Add a <para> element with the text for each funding info
				_.each(this.get('funding'), function(f) {
					$(fundingNode).append( $(document.createElement("para")).text(f) );
				});

			} else if ( (!this.get('funding') || !this.get('funding').length) && fundingNode.length > 0) {

          // Remove all funding elements
					$(fundingNode).remove();

			}

			// Remove empty (zero-length or whitespace-only) nodes
			$(objectDOM).find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();

			return objectDOM;
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
		}
	});

	return EMLProject;
});
