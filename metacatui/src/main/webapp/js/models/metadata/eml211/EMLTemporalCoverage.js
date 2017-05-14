/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLTemporalCoverage = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			singleDateTime: null,
			rangeofDates: null
		},
		
		initialize: function(attributes){
			if(attributes && attributes.objectDOM) 
				this.set(this.parse(attributes.objectDOM));

			this.on("change:singleDateTime change:rangeOfDates", this.trickleUpChange);
		},
		
		/*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
         * Used during parse() and serialize()
         */
        nodeNameMap: function(){
        	return {
        		"begindate" : "beginDate",
        		"calendardate" : "calendarDate",
        		"enddate" : "endDate",
            	"rangeofdates" : "rangeOfDates",
            	"singledatetime" : "singleDateTime",
            	"spatialraster" : "spatialRaster",
            	"spatialvector" : "spatialVector",
            	"storedprocedure" : "storedProcedure",
            	"temporalcoverage" : "temporalCoverage"
            }
        },
		
		parse: function(objectDOM){
			if(!objectDOM) var objectDOM = this.get("objectDOM");

			var rangeOfDates   = $(objectDOM).children('rangeofdates'),
				singleDateTime = $(objectDOM).children('singledatetime');
			
			// If the temporalCoverage element has both a rangeOfDates and a
			// singleDateTime (invalid EML), the rangeOfDates is preferred.
			if (rangeOfDates.length) {
				return {
					'rangeOfDates' : this.parseRangeOfDates(rangeOfDates)
				};
			} else if (singleDateTime.length) {
				return {
					'singleDateTime' : this.parseSingleDateTime(singleDateTime)
				};
			}
		},

		parseRangeOfDates: function(rangeOfDates) {
			var beginDate = $(rangeOfDates).find('beginDate'),
				endDate = $(rangeOfDates).find('endDate'),
				properties = {
					beginDate: { 
						calendarDate: null,
						time: null
					},
					endDate: {
						calendarDate: null,
						time: null
					}
				};
			
			if (beginDate.length > 0) {
				if ($(beginDate).find('calendardate')) {
					properties.beginDate.calendarDate = $(beginDate).find('calendardate').first().text();
				}

				if ($(beginDate).find('time').length > 0) {
					properties.beginDate.time = $(beginDate).find('time').first().text();
				}
			}

			if (endDate.length > 0) {
				if ($(endDate).find('calendardate').length > 0) {
					properties.endDate.calendarDate = $(endDate).find('calendardate').first().text();
				}

				if ($(endDate).find('time').length > 0) {
					properties.endDate.time = $(endDate).find('time').first().text();
				}
			}

			return properties;
		},

		parseSingleDateTime: function(singleDateTime) {
			var calendarDate = $(singleDateTime).find("calendardate"),
			    time = $(singleDateTime).find("time");

			return { 
				calendarDate: calendarDate.length > 0 ? calendarDate.first().text() : null, 
				time: time.length > 0 ? time.first().text() : null
			};
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
				//Empty the DOM
				$(objectDOM).empty();
			} else {
				objectDOM = $("<temporalcoverage></temporalcoverage>");
			}

			// Fill in the range of dates DOM
			if(this.get("beginDate") && this.get("endDate")){
				
				//Get or create the rangeOfDates element
				var rangeOfDates = $(objectDOM).find("rangeofdates");
				if(!rangeOfDates.length){
					rangeOfDates = document.createElement("rangeofdates");
					rangeOfDates.append(document.createElement("begindate"), document.createElement("enddate"));
					$(objectDOM).append(rangeOfDates);
				}
				
				//Serialize the SingleDateTime types
				$(rangeOfDates).find("begindate").html(this.serializeSingleDateTime(this.get("beginDate"), this.get("beginTime")));
				$(rangeOfDates).find("enddate").html(this.serializeSingleDateTime(this.get("endDate"), this.get("endTime")));
			
			}
			// Fill in the single date DOM
			else if(this.get("beginDate")){
				//Get or create the rangeOfDates element
				var singleDateTime = $(objectDOM).find("singleDateTime");
				if(!singleDateTime.length){
					singleDateTime = document.createElement("singleDateTime");
					$(objectDOM).append(singleDateTime);
				}
				
				$(singleDateTime).html(this.serializeSingleDateTime(this.get("beginDate"), this.get("beginTime")));

			}

			// Remove empty (zero-length or whitespace-only) nodes
			$(objectDOM).find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();
			
			return objectDOM;
		},
		
		serializeSingleDateTime: function(date, time){
			var xml = "<calendarDate>" + date + "</calendarDate>";
			
			if(time)
				xml += "<time>" + time + "</time>";
			
			return xml;
		},
		
		trickleUpChange: function(){
			MetacatUI.rootDataPackage.packageModel.set("changed", true);
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLTemporalCoverage;
});