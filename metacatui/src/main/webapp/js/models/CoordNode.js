/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// CoordNode Model
	// ------------------
	var CoordNode = Backbone.Model.extend({
		// This model contains all of the information retrieved from calling listNodes() using the DataONE API
		defaults: {
			members: []
		},
		
		initialize: function(){
			var model = this;
			
			if(appModel.get('nodeServiceUrl')){
				//Get the node information from the CN
				this.getNodeInfo();
			}
		},
		
		getNodeInfo: function(){
			var thisModel = this;
			var memberList = thisModel.get('members');
			
			$.get(appModel.get('nodeServiceUrl'),  function(data, textStatus, xhr) { 
				
				//Traverse the XML response to get the MN info
				_.each(data.children, function(d1NodeList){
					
					//The first (and only) child should be the d1NodeList
					_.each(d1NodeList.children, function(node){
						//'node' will be a single member node
						var member = {};
						
						_.each(node.children, function(attribute){
							//An attribute for this node
							member[attribute.nodeName] = attribute.textContent;
						});
						
						memberList.push(member);
					});
					
					//Save the member list in the model when all members have been added
					thisModel.set('members', memberList);
					thisModel.trigger('change:members');
				});
			});			
		}
		
	});
	return CoordNode;
});
