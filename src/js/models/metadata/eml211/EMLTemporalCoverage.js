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
			if(_.contains(MetacatUI.rootDataPackage.models, this.get("parentModel")))
				MetacatUI.rootDataPackage.packageModel.set("changed", true);
		},

		mergeIntoParent: function(){
			if(this.get("parentModel") && this.get("parentModel").type == "EML" && !_.contains(this.get("parentModel").get("temporalCoverage"), this))
				this.get("parentModel").get("temporalCoverage").push(this);
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

      if( typeof endDate == "string" && endDate.length && beginDate <= 0 ){
        errors.beginDate = "The begin date must be greater than zero.";
      }

      if( typeof endDate == "string" && endDate.length && endDate <= 0 ){
        errors.endDate = "The end date must be greater than zero.";
      }

			//Check the validity of the begin time format
			if(beginTime){
				var timeErrorMessage = this.validateTimeFormat(beginTime);

				if( typeof timeErrorMessage == "string" )
					errors.beginTime = timeErrorMessage;
			}

			//Check the validity of the end time format
			if(endTime){
				var timeErrorMessage = this.validateTimeFormat(endTime);

				if( typeof timeErrorMessage == "string" )
					errors.endTime = timeErrorMessage;
			}

			// Check if begin date greater than end date for the temporalCoverage
			if (this.isGreaterDate(beginDate, endDate))
				errors.beginDate = "The begin date must be before the end date."

			// Check if begin time greater than end time for the temporalCoverage in case of equal dates.
			if (this.isGreaterTime(beginDate, endDate, beginTime, endTime))
				errors.beginTime = "The begin time must be before the end time."

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

				dateYear = dateParts[0];
				dateMonth = dateParts[1];
				dateDay = dateParts[2];

				// Validating the values for the date and month if in YYYY-MM-DD format.
				if (dateMonth < 1 || dateMonth > 12)
					return false;
				else if (dateDay < 1 || dateDay > 31)
					return false;
				else if ((dateMonth == 4 || dateMonth == 6 || dateMonth == 9 || dateMonth == 11) && dateDay == 31)
					return false;
				else if (dateMonth == 2) {
				// Validation for leap year dates.
					var isleap = (dateYear % 4 == 0 && (dateYear % 100 != 0 || dateYear % 400 == 0));
					if ((dateDay > 29) || (dateDay == 29 && !isleap))
						return false;
				}

				var digits = _.filter(dateParts, function(part){
					return (part.match( /[0-9]/g ).length == part.length);
				});

				return (digits.length == 3);
			}
		},

		validateTimeFormat: function(timeString){

			//If the last character is a "Z", then remove it for now
			if( timeString.substring(timeString.length-1, timeString.length) == "Z"){
				timeString = timeString.replace("Z", "", "g");
			}

			if(timeString.length == 8){
				var timeParts = timeString.split(":");

				if(timeParts.length != 3){
					return "Time must be formatted as HH:MM:SS";
				}

				// Validation pattern for HH:MM:SS values.
				// Range for HH validation : 00-24
				// Range for MM validation : 00-59
				// Range for SS validation : 00-59
				// Leading 0's are must in case of single digit values.
				var timePattern = /^(?:2[0-4]|[01][0-9]):[0-5][0-9]:[0-5][0-9]$/,
					validTimePattern = timeString.match(timePattern);

				//If the hour is 24, only accept 00:00 for MM:SS. Any minutes or seconds in the midnight hour should be
				//formatted as 00:XX:XX not 24:XX:XX
				if(validTimePattern && timeParts[0] == "24" && (timeParts[1] != "00" || timeParts[2] != "00")){
					return "The midnight hour starts at 00:00:00 and ends at 00:59:59.";
				}
				else if(!validTimePattern && parseInt(timeParts[0]) > "24"){
					return "Time of the day starts at 00:00 and ends at 23:59.";
				}
				else if(!validTimePattern && parseInt(timeParts[1]) > "59"){
					return "Minutes should be between 00 and 59.";
				}
				else if(!validTimePattern && parseInt(timeParts[2]) > "59"){
					return "Seconds should be between 00 and 59.";
				}
				else
					return true;

			}
			else
				return "Time must be formatted as HH:MM:SS";
		},

		/**
		 * This function checks whether the begin date is greater than the end date.
		 *
		 * @function isGreaterDate
		 * @param {string} beginDate the begin date string
		 * @param {string} endDate the end date string
		 * @return {boolean}
		 */
		isGreaterDate: function(beginDate, endDate) {

			if(typeof beginDate == "undefined" || !beginDate)
				return false;

			if(typeof endDate == "undefined" || !endDate)
				return false;

			//Making sure that beginDate year is smaller than endDate year
			if (beginDate.length == 4 && endDate.length == 4) {
				if (beginDate > endDate) {
					return true;
				}
			}

			//Checking equality for either dateStrings that are greater than 4 characters
			else {
				beginDateParts = beginDate.split("-");
				endDateParts = endDate.split("-");

				if (beginDateParts.length == endDateParts.length) {
					if (beginDateParts[0] > endDateParts[0]) {
						return true;
					}
					else if (beginDateParts[0] == endDateParts[0]) {
						if (beginDateParts[1] > endDateParts[1]) {
							return true;
						}
						else if (beginDateParts[1] == endDateParts[1]) {
							if (beginDateParts[2] > endDateParts[2]) {
								return true;
							}
						}
					}
				}
				else {
					if (beginDateParts[0] > endDateParts[0]) {
						return true;
					}
				}
			}
			return false;
		},

        /**
		 * This function checks whether the begin time is greater than the end time.
		 *
		 * @function isGreaterTime
		 * @param {string} beginDate the begin date string
		 * @param {string} endDate the end date string
		 * @param {string} beginTime the begin time string
		 * @param {string} endTime the end time string
		 * @return {boolean}
		 */
		isGreaterTime: function (beginDate, endDate, beginTime, endTime) {
			if(!beginTime || !endTime)
				return false;

			var equalDates = false;

			//Making sure that beginDate year is smaller than endDate year
			if (beginDate.length == 4 && endDate.length == 4) {
				if (beginDate == endDate) {
					equalDates = true;
				}
			}

			else {
				beginDateParts = beginDate.split("-");
				endDateParts = endDate.split("-");

				if (beginDateParts.length == endDateParts.length) {
					if (beginDateParts[0] == endDateParts[0]) {
						if (beginDateParts[1] == endDateParts[1]) {
							if (beginDateParts[2] == endDateParts[2]) {
								equalDates = true;
							}
						}
					}
				}
			}

			// If the dates are equal, check for validity of time frame.
			if (equalDates) {
				beginTimeParts = beginTime.split(":");
				endTimeParts = endTime.split(":");
				if (beginTimeParts[0] > endTimeParts[0]) {
					return true;
				}
				else if (beginTimeParts[0] == endTimeParts[0]) {
					if (beginTimeParts[1] > endTimeParts[1]) {
						return true;
					}
					else if (beginTimeParts[1] == endTimeParts[1]) {
						if (beginTimeParts[2] > endTimeParts[2]) {
							return true;
						}
					}
				}
			}
			return false;
		},

    /**
    * Checks if this model has no values set on it
    * @return {boolean}
    */
    isEmpty: function(){

      return (!this.get('beginDate') && !this.get('beginTime') && !this.get('endDate')
              && !this.get('endTime'));

    },

    /*
    * Climbs up the model heirarchy until it finds the EML model
    *
    * @return {EML211 or false} - Returns the EML 211 Model or false if not found
    */
    getParentEML: function(){
      var emlModel = this.get("parentModel"),
          tries = 0;

      while (emlModel.type !== "EML" && tries < 6){
        emlModel = emlModel.get("parentModel");
        tries++;
      }

      if( emlModel && emlModel.type == "EML")
        return emlModel;
      else
        return false;

    }
	});

	return EMLTemporalCoverage;
});
