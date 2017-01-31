/* global define */
define(['jquery', 'underscore', 'backbone', "models/metadata/eml211/EMLParty"], 
    function($, _, Backbone, EMLParty) {

	var EMLProject = Backbone.Model.extend({
		
		defaults: {
			objectDOM: null,
			title: null,
			funding: null,
			personnel: null,
			parentModel: null
		},
		
		initialize: function(options){
			if(attributes.objectDOM) 
				this.set(this.parse(attributes.objectDOM));

			this.on("change:personnel change:funding change:title", this.trickleUpChange);
		},
		
		parse: function(objectDOM){
			if(!objectDOM)
				var objectDOM = this.get("objectDOM");
			
			var modelJSON = {};
			
			//Parse the funding info
			modelJSON.funding = [];
			_.each($(objectDOM).find("funding"), function(fundingNode){
				modelJSON.funding.push(new EMLText({ objectDOM: fundingNode, parentModel: this, parentAttribute: "funding" }));
			}, this);
			
			var personnelNode = $(objectDOM).find("personnel");
			modelJSON.personnel = [];
			for(var i=0; i<personnelNode.length; i++){
				modelJSON.personnel.push( new EMLParty({ objectDOM: personnelNode[i], parentModel: this, parentAttribute: "personnel" }) );
			}
			
			return modelJSON;
		},
		
		parseNode: function(node){
			if(!node || (Array.isArray(node) && !node.length))
				return;
			
			this.set($(node)[0].localName, $(node).text());
		},
		
		serialize: function(){
			
		},
		
		updateDOM: function(){
			var objectDOM = this.get("objectDOM").cloneNode(true);
			 
			 return objectDOM;
		},
		
		trickleUpChange: function(){
			this.get("parentModel").trigger("change");
		}
	});
	
	return EMLProject;
});