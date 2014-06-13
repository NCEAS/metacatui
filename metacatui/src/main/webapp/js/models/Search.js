/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Search Model 
	// ------------------
	var Search = Backbone.Model.extend({
		// This model contains all of the search/filter terms
		defaults: {
			all: [],
			creator: [],
			taxon: [],
			resourceMap: false,
			yearMin: 1900, //The user-selected minimum year
			yearMax: new Date().getUTCFullYear(), //The user-selected maximum year
			pubYear: false,
			dataYear: false,
			sortOrder: 'dateUploaded+desc',
			east: null,
			west: null,
			north: null,
			south: null,
			geohashes: [],
			geohashLevel: 9,
			spatial: [],
			attribute: [],
			characteristic: [],
			standard: [],
			additionalCriteria: [],
			formatType: ["METADATA"],
			exclude: [{
				field: "obsoletedBy",
				value: "*"
			}]
		},
		
		//Map the filter names to their index field names
		fieldNameMap: {
					 attribute : "attribute",
				characteristic : "characteristic_sm",
					  standard : "standard_sm",
					formatType : "formatType",
						   all : "",
					   creator : "origin",
					   spatial : "site",
				   resourceMap : "resourceMap",
				   	   pubYear : "dateUploaded"
		},
		
		filterCount: function() {
			var changedAttr = this.changedAttributes(_.clone(this.defaults));
			if (changedAttr) {
				var changedKeys = _.keys(changedAttr);
				return changedKeys.length;
			}
			return 0;
		},
		
		/*
		 * Builds the query string to send to the query engine. Goes over each filter specified in this model and adds to the query string.
		 * Some filters have special rules on how to format the query, which are built first, then the remaining filters are tacked on to the
		 * query string as a basic name:value pair. These "other filters" are specified in the otherFilters variable.
		 */
		getQuery: function(filter){
			
			//----All other filters with a basic name:value pair pattern----
			var otherFilters = ["attribute", "characteristic", "standard", "formatType", "creator", "spatial"];
			
			//Function here to check for spaces in a string - we'll use this to url encode the query
			var needsQuotes = function(entry){
				//Check for spaces
				var space = null;
				
				space = entry.indexOf(" ");
				
				if(space >= 0){
					return true;
				}
				
				//Check for the colon : character
				var colon = null;
				colon = entry.indexOf(":");
				if(colon >= 0){
					return true;
				}
				
				return false;
			};
			
			//Star the query string
			var query = "";
			
			//Get the keys for this model as a way to list the filters that are available
			var defaults = _.keys(this.defaults),
			available = function(filterName){
				if(_.indexOf(defaults, filterName) >= 0) return true;
				else return false;
			};
			
			//See if we are looking for a sub-query or a query for all filters
			if(typeof filter == "undefined"){
				var filter = null;
				var getAll = true;
			}
			else var getAll = false;
			
			//---resourceMap---
			if(available("resourceMap") && ((filter == "resourceMap") || getAll)){
				if(this.get('resourceMap')) query += this.fieldNameMap["resourceMap"] + ':*';
			}
			
			//---Taxon---
			if(available("taxon") && ((filter == "taxon") || getAll)){
				var taxon = this.get('taxon');
				var thisTaxon = null;
				for (var i=0; i < taxon.length; i++){
					//Trim the spaces off
					thisTaxon = taxon[i].trim();
					
					if(needsQuotes(thisTaxon)) value = "%22" + encodeURIComponent(thisTaxon) + "%22";
					else value = encodeURIComponent(thisTaxon);
					
					query += "+(" +
								   "family:" + value + 
								   " OR " +
								   "species:" + value + 
								   " OR " +
								   "genus:" + value + 
								   " OR " +
								   "kingdom:" + value + 
								   " OR " +
								   "phylum:" + value + 
								   " OR " +
								   "order:" + value +
								   " OR " +
								   "class:" + value + 
								   ")";
				}
			}
			
			//------Pub Year-----
			if(available("pubYear") && ((filter == "pubYear") || getAll)){
				//Get the types of year to be searched first
				var pubYear  = this.get('pubYear');
				if (pubYear){
					//Get the minimum and maximum years chosen
					var yearMin = this.get('yearMin');
					var yearMax = this.get('yearMax');	
					
					//Add to the query if we are searching publication year
					query += "+" + this.fieldNameMap["pubYear"] + ":%5B" + yearMin + "-01-01T00:00:00Z%20TO%20" + yearMax + "-12-31T00:00:00Z%5D";				
				}
			}
			
			//-----Data year------
			if(available("dataYear") && ((filter == "dataYear") || getAll)){
				var dataYear = this.get('dataYear');
				
				if(dataYear){
					//Get the minimum and maximum years chosen
					var yearMin = this.get('yearMin');
					var yearMax = this.get('yearMax');	
					
					query += "+beginDate:%5B" + yearMin + "-01-01T00:00:00Z%20TO%20*%5D" +
					 		 "+endDate:%5B*%20TO%20" + yearMax + "-12-31T00:00:00Z%5D";
				}
			}
			
			//-----Geohashes-----
			if(available("geohashLevel") && (((filter == "geohash") || getAll) && (this.get('north') != null))){
				var geohashes = this.get("geohashes");
				
				if((typeof geohashes === undefined) || (geohashes.length == 0)) return "";
				
				var query = "+geohash_" + this.get("geohashLevel") + ":(";
				
				_.each(geohashes, function(geohash, key, list){
					query += geohash + "%20OR%20";
				});
				
				//Remove the last "OR"
				query = query.substr(0, (query.length-8));
				query += ")";
			}
			
			//-----Excluded fields-----
			if(available("exclude") && ((filter == "exclude") || getAll)){
				var exclude = this.get("exclude");
				_.each(exclude, function(excludeField, key, list){
					query += "+-" + excludeField.field + ":" + excludeField.value;
				});
			}
			
			//-----Additional criteria - both field and value are provided-----
			if(available("additionalCriteria") && ((filter == "additionalCriteria") || getAll)){
				var additionalCriteria = this.get('additionalCriteria');
				for (var i=0; i < additionalCriteria.length; i++){
					var value;
					
					if(needsQuotes(additionalCriteria[i])) value = "%22" + encodeURIComponent(additionalCriteria[i]) + "%22";
					else value = encodeURIComponent(additionalCriteria[i]);
					
					query += "+" + value;
				}
			}
			
			//-----All (full text search) -----
			if(available("all") && ((filter == "all") || getAll)){
				var all = this.get('all');
				for (var i=0; i < all.length; i++){
					var value;
					
					if(needsQuotes(all[i])) value = "%22" + encodeURIComponent(all[i]) + "%22";
					else value = encodeURIComponent(all[i]);
					
					query += "+" + value;
				}
			}
			
			//-----Theme restrictions from Registry Model-----
			if((filter == "registryCriteria") || getAll){
				var registryCriteria = registryModel.get('searchFields');
				_.each(registryCriteria, function(value, key, list) {
					query += "+" + value;
				});
			}
			
			var model = this;
			
			_.each(otherFilters, function(filterName, key, list){
				if(available(filterName) && ((filter == filterName) || getAll)){
					var filterValue = null;
					var filterValues = model.get(filterName);
					
					for (var i=0; i < filterValues.length; i++){
						
						//Trim the spaces off
						filterValue = filterValues[i].trim();
						
						// Does this need to be wrapped in quotes?
						if (needsQuotes(filterValue)){
							filterValue = filterValue.replace(" ", "%20");
							filterValue = "%22" + filterValue + "%22";
						}
						// TODO: surround with **?
						query += "+" + model.fieldNameMap[filterName] + ":" + filterValue;			
					}
				}
			});
						
			return query;
		},
		
		clear: function() {
			console.log('Clear the filters');
		    return this.set(_.clone(this.defaults));
		  }
		
	});
	return Search;
});
