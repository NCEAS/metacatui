/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Node Model
	// ------------------
	var Node = Backbone.Model.extend({
		// This model contains all of the information retrieved from calling listNodes() using the DataONE API
		defaults: {
			members: [],
			coordinators: []
		},
		
		initialize: function(){
			var model = this;
			
			if(appModel.get('nodeServiceUrl')){
				//Get the node information from the CN
				this.getNodeInfo();
			}
		},
		
		getNodeInfo: function(){
			var thisModel  = this,
				memberList = this.get('members'),
				coordList  = this.get('coordinators');
			
			$.get(appModel.get('nodeServiceUrl'),  function(data, textStatus, xhr) { 
				
				//Traverse the XML response to get the MN info
				_.each(data.children, function(d1NodeList){
					
					//The first (and only) child should be the d1NodeList
					_.each(d1NodeList.children, function(thisNode){
						//'node' will be a single node
						var node = {};
						
						_.each(thisNode.children, function(child){
							//Information about this node
							node[child.nodeName] = child.textContent;
						});
						_.each(thisNode.attributes, function(attribute){
							//Information about this node
							node[attribute.nodeName] = attribute.nodeValue;
						});
						
						if(node.type == "mn") memberList.push(node);
						if(node.type == "cn") coordList.push(node);
					});
					
					//Save the cn and mn lists in the model when all members have been added
					thisModel.set('members', memberList);
					thisModel.trigger('change:members');
					thisModel.set('coordinators', coordList);
					thisModel.trigger('change:coordinators');
				});
			});			
		}
		
	});
	return Node;
});
