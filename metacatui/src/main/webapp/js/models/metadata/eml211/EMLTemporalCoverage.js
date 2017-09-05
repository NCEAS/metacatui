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
		
		parse: function(objectDOM){
			if(!objectDOM) var objectDOM = this.get("objectDOM");

			var rangeOfDates   = $(objectDOM).children('rangeofdates'),
				singleDateTime = $(objectDOM).children('singledatetime');
			
			// If the temporalCoverage element has both a rangeOfDates and a
			// singleDateTime (invalid EML), the rangeOfDates is preferred.
			if (rangeOfDates.length) {
				return this.parseRangeOfDates(rangeOfDates);
			} else if (singleDateTime.length) {
				return this.parseSingleDateTime(singleDateTime);
			}
		},

		parseRangeOfDates: function(rangeOfDates) {
			var beginDate = $(rangeOfDates).find('beginDate'),
				endDate = $(rangeOfDates).find('endDate'),
				properties = {};
			
			if (beginDate.length > 0) {
				if ($(beginDate).find('calendardate')) {
					properties.beginDate = $(beginDate).find('calendardate').first().text();
				}

				if ($(beginDate).find('time').length > 0) {
					properties.beginTime = $(beginDate).find('time').first().text();
				}
			}

			if (endDate.length > 0) {
				if ($(endDate).find('calendardate').length > 0) {
					properties.endDate = $(endDate).find('calendardate').first().text();
				}

				if ($(endDate).find('time').length > 0) {
					properties.endTime = $(endDate).find('time').first().text();
				}
			}

			return properties;
		},

		parseSingleDateTime: function(singleDateTime) {
			var calendarDate = $(singleDateTime).find("calendardate"),
			    time = $(singleDateTime).find("time");

			return { 
				beginDate: calendarDate.length > 0 ? calendarDate.first().text() : null, 
				beginTime: time.length > 0 ? time.first().text() : null
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

			if (this.get('beginDate') && this.get('endDate')) {
				$(objectDOM).append(this.serializeRangeOfDates());
			} else if (!this.get('endDate')) {
				$(objectDOM).append(this.serializeSingleDateTime());
			}
			else if(this.get("singleDateTime")){
				var singleDateTime = $(objectDOM).find("singledatetime");
				if(!singleDateTime.length){
					singleDateTime = document.createElement("singledatetime");
					$(objectDOM).append(singleDateTime);
				}
				
				if(this.get("singleDateTime").calendarDate)
					$(singleDateTime).html(this.serializeSingleDateTime( this.get("singleDateTime").calendarDate ));
			}

			// Remove empty (zero-length or whitespace-only) nodes
			$(objectDOM).find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();
			
			return objectDOM;
		},
		
		serializeRangeOfDates: function() {
			var objectDOM = $(document.createElement('rangeofdates')),
			    beginDateEl = $(document.createElement('begindate')),
				endDateEl = $(document.createElement('enddate'));

			if (this.get('beginDate')) {
				$(beginDateEl).append(this.serializeCalendarDate(this.get('beginDate')));

				if (this.get('beginTime')) {
					$(beginDateEl).append(this.serializeTime(this.get('beginTime')));
				}

				objectDOM.append(beginDateEl);
			}
			
			if (this.get('endDate')) {
				$(endDateEl).append(this.serializeCalendarDate(this.get('endDate')));

				if (this.get('endTime')) {
					$(endDateEl).append(this.serializeTime(this.get('endTime')));
				}
				objectDOM.append(endDateEl);
			}
			
			return objectDOM;
		},

		serializeSingleDateTime: function() {
			var objectDOM = $(document.createElement('singleDateTime'));

			if (this.get('beginDate')) {
				$(objectDOM).append(this.serializeCalendarDate(this.get('beginDate')));

				if (this.get('beginTime')) {
					$(objectDOM).append(this.serializeTime(this.get('beginTime')));
				}
			}

			return objectDOM;
		},
		
		serializeCalendarDate: function(date) {
			return $(document.createElement('calendarDate')).html(date);
		},
		
		serializeTime: function(time) {
			return $(document.createElement('time')).html(time);
		},
		
		trickleUpChange: function(){
			MetacatUI.rootDataPackage.packageModel.set("changed", true);
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		},

		// Checks the values of this model and determines whether they are valid according the the EML 2.1.1 schema.
		// Returns a hash of error messages
		validate: function() {
			var beginDate = this.get('beginDate'),
			    beginTime = this.get('beginTime'),
				endDate = this.get('endDate'),
				endTime = this.get('endTime'),
				errors  = {};

			// A valid temporal coverage at least needs a start date
			if (!beginDate) {
				errors.beginDate = "Provide a begin date.";
			}
			// endTime is set but endDate is not
			else if (endTime && endTime.length > 0 && (!endDate || endDate.length == 0)) {
				errors.endDate = "Provide an end date."
			}
			
			//Check the validity of the date format
			if(beginDate && !this.isDateFormatValid(beginDate)){
				errors.beginDate = "The begin date must be formatted as YYYY-MM-DD or YYYY.";
			}
			
			//Check the validity of the date format			
			if(endDate && !this.isDateFormatValid(endDate)){
				errors.endDate = "The end date must be formatted as YYYY-MM-DD or YYYY.";				
			}
			
			//Check the validity of the time formats
			if(beginTime && !this.isTimeFormatValid(beginTime))
				errors.beginTime = "The begin time must be formatted as HH:MM:SS";
			if(endTime && !this.isTimeFormatValid(endTime))
				errors.endTime = "The end time must be formatted as HH:MM:SS";
			
			console.log(errors);

			if(Object.keys(errors).length)
				return errors;
			else
				return;
		},
		
		isDateFormatValid: function(dateString){
			
			//Date strings that are four characters should be a full year. Make sure all characters are numbers
			if(dateString.length == 4){
				var digits = dateString.match( /[0-9]/g );
				return (digits.length == 4)
			}
			//Date strings that are 10 characters long should be a valid date
			else{
				var dateParts = dateString.split("-");
				
				if(dateParts.length != 3 || dateParts[0].length != 4 || dateParts[1].length != 2 || dateParts[2].length != 2)
					return false;
				
				var digits = _.filter(dateParts, function(part){
					return (part.match( /[0-9]/g ).length == part.length);
				});
				
				return (digits.length == 3);
			}
		},
		
		isTimeFormatValid: function(timeString){
			
			//If the last character is a "Z", then remove it for now
			if( timeString.substring(timeString.length-1, timeString.length) == "Z"){
				timeString = timeString.replace("Z", "", "g");
			}
				
			if(timeString.length == 8){
				var timeParts = timeString.split(":");
				
				if(timeParts.length != 3)
					return false;
				else{
					//Make sure the hours, minutes, and seconds are two digits long
					return _.every(timeParts, function(t){ 
							   return ( t.match( /[0-9]/g ) && t.length == 2 ); 
						   });
				}
			}
			else
				return false;
		}
	});
	
	return EMLTemporalCoverage;
});