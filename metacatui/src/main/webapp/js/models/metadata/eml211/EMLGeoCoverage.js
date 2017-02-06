/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLGeoCoverage = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			parentModel: null,
        	geographicDescription: null,
    		eastBoundingCoordinate: null,
        	northBoundingCoordinate: null,
        	southBoundingCoordinate: null,
        	westBoundingCoordinate: null
		},
		
		initialize: function(attributes){
			if(attributes.objectDOM) this.parse(attributes.objectDOM);

			//TODO: Add the specific attributes to listen to
			//this.on("change", this.trickleUpChange);
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

			if (!objectDOM) var objectDOM = this.get("objectDOM");
			
			var geographicDescription = $(objectDOM).children('geographicDescription');
			modelJSON.geographicDescription = geographicDescription;
			
			var boundingCoordinates = $(objectDOM).children('boundingCoordinates');
			if (boundingCoordinates) {
				modelJSON.eastBoundingCoordinate = $(objectDOM).children('eastBoundingCoordinate').text();
				modelJSON.northBoundingCoordinate = $(objectDOM).children('northBoundingCoordinate').text();
				modelJSON.southBoundingCoordinate = $(objectDOM).children('southBoundingCoordinate').text();
				modelJSON.westBoundingCoordinate = $(objectDOM).children('westBoundingCoordinate').text();
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
				objectDOM = this.get("objectDOM").cloneNode(true);
			} else {
				objectDOM = $("<geographicCoverage></geographicCoverage>");
			}
			
			// description
			$(objectDOM).find("geographicDescription").text(this.get("geographicDescription"));
			
			// bounds
			if (!$(objectDOM).find("boundingCoordinates")) {
				$(objectDOM).append("<boundingCoordinates/>");
			}
			var boundingCoordinates = $(objectDOM).find("boundingCoordinates");
			$(boundingCoordinates).append("<westBoundingCoordinate/>");
			$(boundingCoordinates).append("<eastBoundingCoordinate/>");
			$(boundingCoordinates).append("<northBoundingCoordinate/>");
			$(boundingCoordinates).append("<southBoundingCoordinate/>");

			$(objectDOM).find("westBoundingCoordinate").text(this.get("westBoundingCoordinate"));
			$(objectDOM).find("eastBoundingCoordinate").text(this.get("eastBoundingCoordinate"));
			$(objectDOM).find("northBoundingCoordinate").text(this.get("northBoundingCoordinate"));
			$(objectDOM).find("southBoundingCoordinate").text(this.get("southBoundingCoordinate"));
			 
			 return objectDOM;
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