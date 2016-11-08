/* global define */
define(['jquery', 'underscore', 'backbone', "models/metadata/eml211/EMLParty"], 
    function($, _, Backbone, EMLParty) {

	var EMLProject = Backbone.Model.extend({
		
		defaults: {
			originalXML: null,
			title: null,
			funding: null,
			personnel: null
		},
		
		initialize: function(options){
			if(options && options.xml){
				this.set("originalXML", options.xml);
				this.parse(options.xml);
			}
		},
		
		parse: function(xml){
			if(!xml)
				var xml = this.get("originalXML");
			
			this.parseNode($(xml).children("title"));
			this.parseNode($(xml).children("funding"));
			
			var personnel = $(xml).children("personnel"),
				personnelList = [];
			for(var i=0; i<personnel.length; i++){
				personnelList.push( new EMLParty({ xml: personnel[i] }) );
			}
			this.set("personnel", personnelList);
		},
		
		parseNode: function(node){
			if(!node || (Array.isArray(node) && !node.length))
				return;
			
			this.set($(node)[0].localName, $(node).text());
		},
		
		toXML: function(){
			
		}
	});
	
	return EMLProject;
});