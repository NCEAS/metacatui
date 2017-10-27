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
        		"altitudemaximum"     : "altitudeMaximum",
        		"altitudeminimum"     : "altitudeMinimum",
        		"altitudeunits"       : "altitudeUnits",
        		"boundingaltitudes"   : "boundingAltitudes",
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
			
			if(!this.isValid()){
				return "";
			}
			
			if (this.get("objectDOM")) {
				objectDOM = $(this.get("objectDOM").cloneNode(true));
			} else {
				objectDOM = $(document.createElement("geographiccoverage"));
			}
			
			//If only one point is given, make sure both points are the same
			if((this.get("north") && this.get("west")) && (!this.get("south") && !this.get("east"))){
				this.set("south", this.get("north"));
				this.set("east", this.get("west"));
			}
			else if((this.get("south") && this.get("east")) && (!this.get("north") && !this.get("west"))){
				this.set("north", this.get("south"));
				this.set("west", this.get("east"));
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
		
		validate: function(){
			var north = this.get("north"),
				east = this.get("east"),
				south = this.get("south"),
				west = this.get("west");
			 	
			if(!this.get("description"))
				return "Each location must have a description";

			var status = {
				'north': {
					isSet: typeof north !== "undefined" && north != null && north !== "",
					isValid: this.validateCoordinate(north, -90, 90)
				},
				'east': {
					isSet: typeof east !== "undefined" && east != null && east !== "",
					isValid: this.validateCoordinate(east, -180, 180)
				},
				'south': {
					isSet: typeof south !== "undefined" && south != null && south !== "",
					isValid: this.validateCoordinate(south, -90, 90)
				},
				'west': {
					isSet: typeof west !== "undefined" && west != null && west !== "",
					isValid: this.validateCoordinate(west, -180, 180)
				},
			}
			
			// Check that either 2 or 4 are set
			var isSet = _.filter(status, function(coord) { return coord.isSet == true; });

			if (isSet.length == 0) {
				return "Each location description must have at least one coordinate pair.";
			} else if (isSet.length == 1 || isSet.length == 3) {
				return "Each coordinate must include a latitude AND longitude.";
			}

			if ((status.north.isSet && !status.west.isSet) || 
				(!status.north.isSet && status.west.isSet)) {
				return "Each coordinate must include a latitude AND longitude.";
			} else if ((status.south.isSet && !status.east.isSet) || 
					   (!status.south.isSet && status.east.isSet)) {
				return "Each coordinate must include a latitude AND longitude.";
			}

			// Check that the set values are valid
			if (status.north.isSet && !status.north.isValid) {
				return "The North bounding coordinate must be between -90 and 90.";
			} else if (status.east.isSet && !status.east.isValid) {
				return "The East bounding coordinate must be between -180 and 180.";
			} else if (status.south.isSet && !status.south.isValid) {
				return "The South bounding coordinate must be between -90 and 90.";
			} else if (status.west.isSet && !status.west.isValid) {
				return "The West bounding coordinate must be between -180 and 180.";
			}
		},
		
		// Validate a coordinate String by making sure it can be coerced into a number and
		// is within the given bounds.
		// Note: Min and max are inclusive
		validateCoordinate: function(value, min, max) {

			if (typeof value === "undefined" || value === null || value === "" && isNaN(value)) {
				return false;
			}

			var parsed = Number(value);

			if (isNaN(parsed)) { 
				return false;
			}

			if (parsed < min || parsed > max) {
				return false;
			}

			return true;
		},

		trickleUpChange: function(){
			this.get("parentModel").trigger("change");
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLGeoCoverage;
});