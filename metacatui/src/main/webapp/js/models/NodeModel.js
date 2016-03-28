/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Node Model
	// ------------------
	var Node = Backbone.Model.extend({
		memberLogos : {
				//"defaultLogo"		   : "img/node-logos/KNB.png",
				"urn:node:KNB"         : "img/node-logos/KNB.png",
				"urn:node:ESA"         : "img/node-logos/ESA.png",
				"urn:node:SANPARKS"    : "img/node-logos/SANPARKS.png",
				"urn:node:USGSCSAS"    : "img/node-logos/USGSCSAS.png",
				"urn:node:ORNLDAAC"    : "img/node-logos/ORNLDAAC.png",
				"urn:node:LTER"        : "img/node-logos/LTER.png",
				"urn:node:CDL"         : "img/node-logos/CDL.png",
				"urn:node:PISCO"       : "img/node-logos/PISCO.png",
				"urn:node:ONEShare"    : "img/node-logos/ONEShare.png",
				"urn:node:TFRI"        : "img/node-logos/TFRI.png",
				"urn:node:USANPN"      : "img/node-logos/USANPN.png",
				"urn:node:SEAD"        : "img/node-logos/SEAD.png",
				"urn:node:GOA"         : "img/node-logos/GOA.png",
				"urn:node:KUBI"        : "img/node-logos/KUBI.jpg",
				"urn:node:LTER_EUROPE" : "img/node-logos/LTER_EU.png",
				"urn:node:DRYAD"       : "img/node-logos/DRYAD.png",
				"urn:node:CLOEBIRD"    : "img/node-logos/CLOEBIRD.jpg",
				"urn:node:EDACGSTORE"  : "img/node-logos/EDAC.png",
				"urn:node:IOE"         : "img/node-logos/IOE.png",
				"urn:node:US_MPC"      : "img/node-logos/US_MPC.png",
				"urn:node:EDORA"       : "img/node-logos/EDORA.jpg",
				"urn:node:RGD"         : "img/node-logos/RGD.png",
				"urn:node:GLEON"       : "img/node-logos/GLEON.png",
				"urn:node:IARC"        : "img/node-logos/IARC.png",
				"urn:node:NMEPSCOR"    : "img/node-logos/NMEPSCOR.png",
				"urn:node:TERN"        : "img/node-logos/TERN.png",
				"urn:node:NKN"         : "img/node-logos/NKN.png",
				"urn:node:PPBio"       : "img/node-logos/PPBio.png",
				"urn:node:USGS_SDC"    : "img/node-logos/USGSCSAS.png",
				"urn:node:NRDC"        : "img/node-logos/NRDC.jpg",
				"urn:node:NCEI"        : "img/node-logos/NCEI.png",
				"urn:node:ARCTIC"      : "img/node-logos/ARCTIC.png"
		},
		
		// This model contains all of the information retrieved from calling listNodes() using the DataONE API
		defaults: {
			members: [],
			coordinators: [],
			replicaMembers: ["urn:node:mnUCSB1", "urn:node:mnORC1", "urn:node:mnUNM1"],
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
				error: function(){
					//Use backup node info
					$.get("./resources/nodeInfo.xml", function(data, textStatus, xhr){
						thisModel.saveNodeInfo(data);
					});
				},
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
					//'node' will be a single node
					var node = {},
						thisNodeChildren = thisNode.children || thisNode.childNodes;
					
					_.each(thisNodeChildren, function(child){
						//Information about this node
						node[child.nodeName] = child.textContent;
						
						//Check if this member node has v2 read capabilities - important for the Package service
						if((child.nodeName == "services") && child.childNodes.length){
							var v2 = $(child).find("service[name='MNRead'][version='v2'][available='true']").length;
							node["readv2"] = v2;
						}
					});
					_.each(thisNode.attributes, function(attribute){
						//Information about this node
						node[attribute.nodeName] = attribute.nodeValue;
					});
					
					//Get the logo path name for this member
					var logo = thisModel.memberLogos[node.identifier];
					if(!logo && thisModel.memberLogos["defaultLogo"])
						logo = thisModel.memberLogos["defaultLogo"];
					else if(!logo)
						logo = null;
							
					node.logo = logo;
					
					
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
