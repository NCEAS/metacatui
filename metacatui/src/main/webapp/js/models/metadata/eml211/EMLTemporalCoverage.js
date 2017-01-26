/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLTemporalCoverage = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			beginDate: null,
			endDate: null,
		},
		
		initialize: function(attributes){
			if(attributes.objectDOM) this.parse(attributes.objectDOM);

			this.on("change:beginDate change:endDate", this.trickleUpChange);
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

			var rangeOfDates = $(objectDOM).children('rangeofdates');

			var begin = $(rangeOfDates).children("begindate"),
				  end 	= $(rangeOfDates).children("enddate");

			this.set('beginDate', this.parseSingleDateTime(begin));
			this.set('endDate', this.parseSingleDateTime(end));
		},
		
		// Parse a singleDateTimeType into an POJO
		parseSingleDateTime: function(objectDOM) {
			var datetime = {
				calendarDate : null,
				time: null
			};

			datetime.calendarDate = $(objectDOM).children('calendarDate').text();

			if ($(objectDOM).children('time').length == 1) {
				datetime.time = $(objectDOM).children('time').text();
			}
			
			return datetime;
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
		updateDOM: function() {
			console.log('updateDOM')
			var objectDOM;

			if (this.get('objectDOM')) {
				objectDOM = this.get("objectDOM").cloneNode(true);
				//Empty the DOM
				$(objectDOM).empty();
			} else {
				objectDOM = $("temporalcoverage");
			}

			// Fill in the DOM
			var rangeOfDates = $(objectDOM).append('<rangeofdates></rangeofdates>').children("rangeofdates")[0];

			// beginDate
			if (this.get('beginDate')) {
				var beginEl = $(rangeOfDates).append("<begindate></begindate>").children("begindate")[0];

				$(beginEl).append("<calendardate>" + this.get('beginDate').calendarDate + "</calendardate>");

				if (this.get('beginDate').time) {
					$(beginEl).append("<time>" + this.get('beginDate').time + "</time>");
				}
			}

			// endDate
			if (this.get('endDate')) {
				var endEl = $(rangeOfDates).append("<enddate></enddate>").children("enddate")[0];

				$(endEl).append("<calendardate>" + this.get('endDate').calendarDate + "</calendardate>");

				if (this.get('endDate').time) {
					$(endEl).append("<time>" + this.get('endDate').time + "</time>");
				}
			}

			 return objectDOM;
		},
		
		trickleUpChange: function(){
			this.get("parentModel").trigger("change", null, {changed: [this.get("parentAttribute")] });
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLTemporalCoverage;
});