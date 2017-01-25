/* global define */
define(['jquery', 'underscore', 'backbone', "models/metadata/eml211/EMLParty"], 
    function($, _, Backbone, EMLParty) {

	var EMLProject = Backbone.Model.extend({
		
		defaults: {
			objectDOM: null,
			title: null,
			funding: null,
			personnel: null,
			parentModel: null,
			parentAttribute: null
		},
		
		initialize: function(options){
			if(attributes.objectDOM) this.parse(attributes.objectDOM);

			this.on("change:personnel change:funding change:title", this.trickleUpChange);
		},
		
		parse: function(objectDOM){
			if(!objectDOM)
				var objectDOM = this.get("objectDOM");
			
			this.parseNode($(objectDOM).children("title"));
			this.parseNode($(objectDOM).children("funding"));
			
			var personnel = $(objectDOM).children("personnel"),
				personnelList = [];
			for(var i=0; i<personnel.length; i++){
				personnelList.push( new EMLParty({ objectDOM: personnel[i], parentModel: this, parentAttribute: "personnel" }) );
			}
			
			this.set("personnel", personnelList);
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
			this.get("parentModel").trigger("change", null, {changed: [this.get("parentAttribute")] });
		}
	});
	
	return EMLProject;
});