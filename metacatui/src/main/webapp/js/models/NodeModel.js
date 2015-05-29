/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Node Model
	// ------------------
	var Node = Backbone.Model.extend({
		memberLogos : {
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
				"urn:node:mnDemo2"     : "img/node-logos/KNB.png"
		},
		
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
						
						node.logo = thisModel.memberLogos[node.identifier];
						node.shortIdentifier = node.identifier.substring(node.identifier.lastIndexOf(":") + 1);
						
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
