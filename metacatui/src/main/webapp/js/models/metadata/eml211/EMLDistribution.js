/* global define */
define(['jquery', 'underscore', 'backbone'], 
    function($, _, Backbone) {

	var EMLDistribution = Backbone.Model.extend({
		
		defaults: {
			originalXML: null,
			mediumName: null,
			mediumVolume: null,
			mediumFormat: null,
			mediumNote: null,
			onlineDescription: null
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
			
			var offline = $(xml).find("offline"),
				online = $(xml).find("online");
			
			if(offline.length){
				if($(offline).children("mediumname").length) this.parseNode($(offline).children("mediumname"));
				if($(offline).children("mediumvolume").length) this.parseNode($(offline).children("mediumvolume"));
				if($(offline).children("mediumformat").length) this.parseNode($(offline).children("mediumformat"));
				if($(offline).children("mediumnote").length) this.parseNode($(offline).children("mediumnote"));
			}
			
			if(online.length){
				if($(online).children("onlinedescription").length) this.parseNode($(online).children("onlinedescription"));
			}
		},
		
		parseNode: function(node){
			if(!node || (Array.isArray(node) && !node.length))
				return;
			
			this.set($(node)[0].localName, $(node).text());
		},
		
		toXML: function(){
			
		}
	});
	
	return EMLDistribution;
});