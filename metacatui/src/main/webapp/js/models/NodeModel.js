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
			coordinators: [],
			hiddenMembers: [],
			currentMemberNode: appModel.get("nodeId") || null,
			checked: false
		},
		
		initialize: function(){
			var model = this;
			
			if(appModel.get('nodeServiceUrl')){
				//Get the node information from the CN
				this.getNodeInfo();
			}
		},
		
		getMember: function(memberInfo){
			if(!memberInfo) return false;
			
			//Get the member ID
			var memberId = null;			
			if((typeof memberInfo === "object") && memberInfo.type == "SolrResult")
				memberId = memberInfo.get("datasource");
			else if(typeof memberInfo === "string")
				memberId = memberInfo;
			else
				return false;
			
			//Find the member by its ID
			var member = _.findWhere(this.get("members"), {identifier: memberId});
			if(!member) return false;
			
			return member;
		},
		
		getNodeInfo: function(){
			var thisModel  = this,
				memberList = this.get('members'),
				coordList  = this.get('coordinators');
			
			$.ajax({
				url: appModel.get('nodeServiceUrl'),  
				dataType: "text",
				success: function(data, textStatus, xhr) { 
					
					var xmlResponse = $.parseXML(data) || null;
					if(!xmlResponse) return;
					
					thisModel.saveNodeInfo(xmlResponse);
					
					thisModel.set("checked", true);
				}		
			});
		},
		
		saveNodeInfo: function(xml){
			var thisModel = this,
				memberList = this.get('members'),
				coordList  = this.get('coordinators'),
				children   = xml.children || xml.childNodes;
				
			
			//Traverse the XML response to get the MN info
			_.each(children, function(d1NodeList){
				
				var d1NodeListChildren = d1NodeList.children || d1NodeList.childNodes;
				
				//The first (and only) child should be the d1NodeList
				_.each(d1NodeListChildren, function(thisNode){
					
					//Ignore parts of the XML that is not MN info
					if(!thisNode.attributes) return;
					
					//'node' will be a single node
					var node = {},
						nodeProperties = thisNode.children || thisNode.childNodes;
					
					//Grab information about this node from XML nodes
					_.each(nodeProperties, function(nodeProperty){
						
						if(nodeProperty.nodeName == "property")
							node[$(nodeProperty).attr("key")] = nodeProperty.textContent;
						else
							node[nodeProperty.nodeName] = nodeProperty.textContent;
						
						//Check if this member node has v2 read capabilities - important for the Package service
						if((nodeProperty.nodeName == "services") && nodeProperty.childNodes.length){
							var v2 = $(nodeProperty).find("service[name='MNRead'][version='v2'][available='true']").length;
							node["readv2"] = v2;
						}
					});
					
					//Grab information about this node from XLM attributes 
					_.each(thisNode.attributes, function(attribute){
						node[attribute.nodeName] = attribute.nodeValue;
					});
								
					//Create some aliases for node info properties
					node.logo = node.CN_logo_url;
					node.name = node.CN_node_name;
					node.status = node.CN_operational_status;
					node.memberSince = node.CN_date_operational;					
					node.shortIdentifier = node.identifier.substring(node.identifier.lastIndexOf(":") + 1);
					
					if(node.type == "mn") memberList.push(node);
					if(node.type == "cn") coordList.push(node);
				});
				
				//Save the cn and mn lists in the model when all members have been added
				thisModel.set('members', memberList);
				thisModel.trigger('change:members');
				thisModel.set('coordinators', coordList);
				thisModel.trigger('change:coordinators');
				
				//Find the node we are currently querying, if there is one
				if(!thisModel.get("currentMemberNode")){
					var thisMember = _.findWhere(thisModel.get("members"), { baseURL:  (appModel.get("baseUrl") + appModel.get('context') + appModel.get("d1Service")).replace("/v2", "").replace("/v1", "") });
					if(thisMember !== undefined)
						thisModel.set("currentMemberNode", thisMember.identifier);
					
					thisModel.trigger("change:currentMemberNode");
				}
			});
		}
				
	});
	return Node;
});
