/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLGeoCoverage = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			parentModel: null,
        	description: null,
    		east: null,
        	north: null,
        	south: null,
        	west: null
		},
		
		initialize: function(attributes){
			if(attributes && attributes.objectDOM) this.set(this.parse(attributes.objectDOM));

			//specific attributes to listen to
			this.on("change:description " +
					"change:east " +
					"change:west " +
					"change:south" +
					"change:north", 
					this.trickleUpChange);
		},
		
		/*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
         * Used during parse() and serialize()
         */
        nodeNameMap: function(){
        	return {
        		"boundingcoordinates" : "boundingCoordinates",
        		"eastboundingcoordinate" : "eastBoundingCoordinate",
            	"geographiccoverage" : "geographicCoverage",
            	"geographicdescription" : "geographicDescription",
            	"northboundingcoordinate" : "northBoundingCoordinate",
            	"southboundingcoordinate" : "southBoundingCoordinate",
            	"westboundingcoordinate" : "westBoundingCoordinate"
            }
        },
		
        /** Based on this example serialization
		<geographicCoverage scope="document">
			<geographicDescription>Rhine-Main-Observatory</geographicDescription>
			<boundingCoordinates>
				<westBoundingCoordinate>9.0005</westBoundingCoordinate>
				<eastBoundingCoordinate>9.0005</eastBoundingCoordinate>
				<northBoundingCoordinate>50.1600</northBoundingCoordinate>
				<southBoundingCoordinate>50.1600</southBoundingCoordinate>
			</boundingCoordinates>
		</geographicCoverage>
		 **/
		parse: function(objectDOM) {
			
			var modelJSON = {};

			if (!objectDOM){
				if(this.get("objectDOM"))
					var objectDOM = this.get("objectDOM");
				else
					return {};
			}
							
			//Create a jQuery object of the DOM
			var $objectDOM = $(objectDOM);
			
			//Get the geographic description
			modelJSON.description = $objectDOM.children('geographicdescription').text();
			
			//Get the bounding coordinates
			var boundingCoordinates = $objectDOM.children('boundingcoordinates');
			if (boundingCoordinates) {
				modelJSON.east  = boundingCoordinates.children('eastboundingcoordinate').text().replace("+", "");
				modelJSON.north = boundingCoordinates.children('northboundingcoordinate').text().replace("+", "");
				modelJSON.south = boundingCoordinates.children('southboundingcoordinate').text().replace("+", "");
				modelJSON.west  = boundingCoordinates.children('westboundingcoordinate').text().replace("+", "");
			}
			
			return modelJSON;
		},
		
		serialize: function(){
			var objectDOM = this.updateDOM(),
				xmlString = objectDOM.outerHTML;
			
			//Camel-case the XML
	    	xmlString = this.formatXML(xmlString);
        	
        	return xmlString;
		},
		
		/*
		 * Makes a copy of the original XML DOM and updates it with the new values from the model.
		 */
		updateDOM: function(){
			var objectDOM;

			if (this.get("objectDOM")) {
				objectDOM = $(this.get("objectDOM").cloneNode(true));
			} else {
				objectDOM = $(document.createElement("geographiccoverage"));
			}
			
			// Description
			if(!objectDOM.children("geographicdescription").length)			
				objectDOM.append( $(document.createElement("geographicdescription")).text(this.get("description")) );
			else
				objectDOM.children("geographicdescription").text(this.get("description"));
			
			// Create the bounding coordinates element
			var boundingCoordinates = objectDOM.find("boundingcoordinates");
			if (!boundingCoordinates.length){
				boundingCoordinates = document.createElement("boundingcoordinates");
				objectDOM.append(boundingCoordinates);
			}
			
			//Empty out the coordinates first
			$(boundingCoordinates).empty();
			
			//Add the four coordinate values
			$(boundingCoordinates).append( $(document.createElement("westboundingcoordinate")).text(this.get("west")),
											$(document.createElement("eastboundingcoordinate")).text(this.get("east")),
											$(document.createElement("northboundingcoordinate")).text(this.get("north")),
											$(document.createElement("southboundingcoordinate")).text(this.get("south")) );
			 
			 return objectDOM;
		},
		
		trickleUpChange: function(){
			MetacatUI.rootDataPackage.packageModel.set("changed", true);
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLGeoCoverage;
});