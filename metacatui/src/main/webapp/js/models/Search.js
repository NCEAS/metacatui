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
			geohashBBoxes: [],
			geohashLevel: 9,
			map: {
				zoom: null,
				center: null
			},
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
		
		initialize: function(){
			/* Add trim() function for IE*/
			if(typeof String.prototype.trim !== 'function') {
				  String.prototype.trim = function() {
				    return this.replace(/^\s+|\s+$/g, ''); 
				  }
			}
		},
		
		//Map the filter names to their index field names
		fieldNameMap: {
					 attribute : "attribute",
				characteristic : "characteristic_sm",
					  standard : "standard_sm",
					formatType : "formatType",
						   all : "*",
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
			var otherFilters = ["attribute", "characteristic", "standard", "formatType", "all", "creator", "spatial"];
			
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
			
			var query = "";
			
			if(typeof filter == "undefined"){
				var filter = null;
				var getAll = true;
			}
			else var getAll = false;
			
			//---resourceMap---
			if((filter == "resourceMap") || getAll){
				if(this.get('resourceMap')) query += this.fieldNameMap["resourceMap"] + ':*';
			}
			
			//---Taxon---
			if((filter == "taxon") || getAll){
				var taxon = this.get('taxon');
				var thisTaxon = null;
				for (var i=0; i < taxon.length; i++){
					//Trim the spaces off
					thisTaxon = taxon[i].trim();
					
					// Does this need to be wrapped in quotes?
					if (needsQuotes(thisTaxon)){
						thisTaxon = thisTaxon.replace(" ", "%20");
						thisTaxon = "%22" + thisTaxon + "%22";
					}
					
					query += "+(" +
								   "family:" + thisTaxon + 
								   " OR " +
								   "species:" + thisTaxon + 
								   " OR " +
								   "genus:" + thisTaxon + 
								   " OR " +
								   "kingdom:" + thisTaxon + 
								   " OR " +
								   "phylum:" + thisTaxon + 
								   " OR " +
								   "order:" + thisTaxon +
								   " OR " +
								   "class:" + thisTaxon + 
								   ")";
				}
			}
			
			//------Pub Year-----
			if((filter == "pubYear") || getAll){
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
			if((filter == "dataYear") || getAll){
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
			if(((filter == "geohash") || getAll) && (this.get('north') != null)){
				var geohashBBoxes = this.get("geohashBBoxes");
				
				if((typeof geohashBBoxes === undefined) || (geohashBBoxes.length == 0)) return "";
				
				var query = "+geohash_" + this.get("geohashLevel") + ":(";
				
				_.each(geohashBBoxes, function(geohash, key, list){
					query += geohash + "%20OR%20";
				});
				
				//Remove the last "OR"
				query = query.substr(0, (query.length-8));
				query += ")";
			}
			
			//-----Excluded fields-----
			if((filter == "exclude") || getAll){
				var exclude = this.get("exclude");
				_.each(exclude, function(excludeField, key, list){
					query += "+-" + excludeField.field + ":" + excludeField.value;
				});
			}
			
			//-----Additional criteria - both field and value are provided-----
			if((filter == "additionalCriteria") || getAll){
				var additionalCriteria = this.get('additionalCriteria');
				for (var i=0; i < additionalCriteria.length; i++){
					query += "+" + additionalCriteria[i];
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
				if((filter == filterName) || getAll){
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
