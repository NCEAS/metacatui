/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLTemporalCoverage = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			beginDate: null,
			beginTime: null,
			endDate: null,
			endTime: null
		},
		
		initialize: function(attributes){
			if(attributes && attributes.objectDOM) 
				this.set(this.parse(attributes.objectDOM));

			this.on("change:beginDate change:beginTime change:endDate change:endTime", this.trickleUpChange);
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
		
		// TODO: This method only supports the rangeOfDates part of EML and
		// only supports the VERY simple case of having a begin and end date
		parse: function(objectDOM){
			if(!objectDOM) var objectDOM = this.get("objectDOM");

			var rangeOfDates   = $(objectDOM).children('rangeofdates'),
				singleDateTime = $(objectDOM).children('singledatetime');
			
			if(rangeOfDates.length){
				var beginDate = $(rangeOfDates).find("begindate calendardate"),
					endDate   = $(rangeOfDates).find("enddate calendardate"),
					beginTime = $(rangeOfDates).find("begindate time"),
					endTime   = $(rangeOfDates).find("enddate time");
			
				return {
					beginDate : beginDate.length ? beginDate.text() : null,
					endDate   : endDate.length ? endDate.text() : null,
					beginTime : beginTime.length ? beginTime.text() : null,
					endTime   : endTime.length ? endTime.text() : null
				}
	
			}
			else if(singleDateTime.length){
				var parsedDate = this.parseSingleDateTime(singleDateTime);
				
				return{
					beginDate: parsedDate.date,
					beginTime: parsedDate.time
				}
			}
			
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

			return objectDOM;
		},
		
		//Parse a SingleDateTime
		parseSingleDateTime: function(xml){
			var date = $(xml).find("calendarDate").text(),
				time = $(xml).find("time").text();
			
			return { date: date, time: time };
		},
		
		serializeSingleDateTime: function(date, time){
			var xml = "<calendarDate>" + date + "</calendarDate>";
			
			if(time)
				xml += "<time>" + time + "</time>";
			
			return xml;
		},
		
		trickleUpChange: function(){
			this.get("parentModel").trigger("change");
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLTemporalCoverage;
});