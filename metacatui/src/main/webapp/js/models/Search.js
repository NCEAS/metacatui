﻿/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrResult'], 				
	function($, _, Backbone, SolrResult) {
	'use strict';

	// Search Model 
	// ------------------
	var Search = Backbone.Model.extend({
		// This model contains all of the search/filter terms
		/*
		 * Search filters can be either plain text or a filter object with the following options:
		 * filterLabel - text that will be displayed in the filter element in the UI
		 * label - text that will be displayed in the autocomplete  list
		 * value - the value that will be included in the query
		 * description - a longer text description of the filter value
		 */
		defaults: function(){
			return {
				all: [],
				creator: [],
				taxon: [],
				resourceMap: false,
				yearMin: 1900, //The user-selected minimum year
				yearMax: new Date().getUTCFullYear(), //The user-selected maximum year
				pubYear: false,
				dataYear: false,
				sortOrder: 'dateUploaded+desc',
				sortByReads: false, // True if we can sort by reads/popularity
				east: null,
				west: null,
				north: null,
				south: null,
				useGeohash: true,
				geohashes: [],
				geohashLevel: 9,
				geohashGroups: {},
				//dataSource: [],
				username: [],
				rightsHolder: [],
				submitter: [],
				spatial: [],
				attribute: [],
				//annotation: [],
				additionalCriteria: [],
				id: [],
				seriesId: [],
				formatType: [{
					value: "METADATA",
					label: "science metadata",
					description: null
				}],
				exclude: [{
					field: "obsoletedBy",
					value: "*"
				}]
			}
		},
		
		//A list of all the filter names that are related to the spatial/map filter
		spatialFilters: ["useGeohash", "geohashes", "geohashLevel", "geohashGroups", "east", "west", "north", "south"],
		
		initialize: function(){
			this.listenTo(this, "change:geohashes", this.groupGeohashes);
		},
		
		fieldLabels: {
			attribute : "Data attribute",
		  resourceMap : "Only results with data", 
		   annotation : "Annotation",
		   dataSource : "Data source",
		      creator : "Creator",
		     dataYear : "Data coverage",
		      pubYear : "Publish year",
		      	   id : "Identifier",
		     seriesId : "seriesId",
		        taxon : "Taxon",
		      spatial : "Location",
		      	  all : ""
		},
		
		//Map the filter names to their index field names
		fieldNameMap: {
					 attribute : "attribute",
					annotation : "sem_annotation_bioportal_sm",
					dataSource : "datasource",
					formatType : "formatType",
						   all : "",
					   creator : "originText",
					   spatial : "siteText",
				   resourceMap : "resourceMap",
				   	   pubYear : ["datePublished", "dateUploaded"],
				   	   		id : "id",
				  rightsHolder : "rightsHolder",
				     submitter : "submitter",
				      username : ["rightsHolder", "writePermission", "changePermission"],
			     	     taxon : ["kingdom", "phylum", "class", "order", "family", "genus", "species"]
		},
		
		currentFilters: function(){
			var changedAttr = this.changedAttributes(_.clone(this.defaults()));
			
			if (!changedAttr) return new Array();
			
			var currentFilters = _.keys(changedAttr);

			//Don't count the sort order as a changed filter
			currentFilters = _.without(currentFilters, "sortOrder");
			
			//Don't count the geohashes or directions as a filter if the geohash filter is turned off
			if(!this.get("useGeohash"))
				currentFilters = _.difference(currentFilters, this.spatialFilters);
			
			return currentFilters;
		},
		
		filterCount: function() {
			var currentFilters = this.currentFilters();
			
			return currentFilters.length;			
		},
		
		//Function filterIsAvailable will check if a filter is available in this search index - 
		//if the filter name if included in the defaults of this model, it is marked as available. 
		//Comment out or remove defaults that are not in the index or should not be included in queries
		filterIsAvailable: function(name){
			//Get the keys for this model as a way to list the filters that are available
			var defaults = _.keys(this.defaults());
			if(_.indexOf(defaults, name) >= 0) return true;
			else return false;
		},
		
		/*
		 * Removes a specified filter from the search model
		 */
		removeFromModel : function(category, filterValueToRemove){			
			//Remove this filter term from the model
			if (category){				
				//Get the current filter terms array
				var currentFilterValues = this.get(category);
				
				//The year filters have special rules
				//If both year types will be reset/default, then also reset the year min and max values
				if((category == "pubYear") || (category == "dataYear")){
					var otherType = (category == "pubYear") ? "dataYear" : "pubYear";
					
					if(_.contains(this.currentFilters(), otherType))
						var newFilterValues = this.defaults()[category];
					else{
						this.set(category, this.defaults()[category]);
						this.set("yearMin", this.defaults()["yearMin"]);
						this.set("yearMax", this.defaults()["yearMax"]);
						return;
					}
						
				}
				//Remove this filter term from the array
				else if(Array.isArray(currentFilterValues)){
					var newFilterValues = _.without(currentFilterValues, filterValueToRemove);
					_.each(currentFilterValues, function(currentFilterValue, key){
						var valueString = (typeof currentFilterValue == "object")? currentFilterValue.value : currentFilterValue;
						if(valueString == filterValueToRemove){
							newFilterValues = _.without(newFilterValues, currentFilterValue);
						}
					});
				}
				//Get the default value
				else
					var newFilterValues = this.defaults()[category]; 
						
				//Set the new value
				this.set(category, newFilterValues);	
				
			}
		},
		
		/*
		 * Resets the geoashes and geohashLevel filters to default
		 */
		resetGeohash : function(){
			this.set("geohashes",    this.defaults().geohashes);
			this.set("geohashLevel", this.defaults().geohashLevel);
			this.set("geohashGroups", this.defaults().geohashGroups);
		},
		
		groupGeohashes: function(){
			//Find out if there are any geohashes that can be combined together, by looking for all 32 geohashes within the same precision level
			var sortedGeohashes = this.get("geohashes");
			sortedGeohashes.sort();
			
			var groupedGeohashes = _.groupBy(sortedGeohashes, function(n){
										return n.substring(0, n.length-1);
									});
			
			//Find groups of geohashes that makeup a complete geohash tile (32) so we can shorten the query
			var completeGroups = _.filter(Object.keys(groupedGeohashes), function(n){ return (groupedGeohashes[n].length == 32) });
			//Find the remaining incomplete geohash groupss
			var incompleteGroups = [];
			_.each(_.filter(Object.keys(groupedGeohashes), function(n){ return (groupedGeohashes[n].length < 32) }), function(n){ incompleteGroups.push(groupedGeohashes[n]); });
			incompleteGroups = _.flatten(incompleteGroups);
			
			//Start a geohash group object
			var geohashGroups = {};			
			if((typeof incompleteGroups !== "undefined") && (incompleteGroups.length > 0))
				geohashGroups[incompleteGroups[0].length.toString()] = incompleteGroups;							
			if((typeof completeGroups !== "undefined") && (completeGroups.length > 0))
				geohashGroups[completeGroups[0].length.toString()] = completeGroups;

			//Save it
			this.set("geohashGroups", geohashGroups);	
			this.trigger("change", "geohashGroups");
		},
		
		/*
		 * Builds the query string to send to the query engine. Goes over each filter specified in this model and adds to the query string.
		 * Some filters have special rules on how to format the query, which are built first, then the remaining filters are tacked on to the
		 * query string as a basic name:value pair. These "other filters" are specified in the otherFilters variable.
		 */
		getQuery: function(filter){
			
			//----All other filters with a basic name:value pair pattern----
			var otherFilters = ["attribute", "formatType", "rightsHolder", "submitter"];
			
			//Start the query string
			var query = "";
			
			//See if we are looking for a sub-query or a query for all filters
			if(typeof filter == "undefined"){
				var filter = null;
				var getAll = true;
			}
			else var getAll = false;
			
			var model = this;
			
			//-----Annotation-----
			if(this.filterIsAvailable("annotation") && ((filter == "annotation") || getAll)){
				var annotations = this.get("annotation");
				_.each(annotations, function(annotationFilter, key, list){
					var filterValue = "";
					
					//Get the filter value
					if(typeof annotationFilter == "object"){
						filterValue = annotationFilter.value || "";
					}
					else
						filterValue = annotationFilter;

					//Trim the spaces off
					filterValue = filterValue.trim();
					
					// Does this need to be wrapped in quotes?
					if(model.needsQuotes(filterValue))
						filterValue = "%22" + encodeURIComponent(filterValue) + "%22";
					else filterValue = encodeURIComponent(filterValue);

					query += "+" + model.fieldNameMap["annotation"] + ":" + filterValue;			
				});
			}
			
			//---Identifier---
			if(this.filterIsAvailable("id") && ((filter == "id") || getAll) && this.get('id').length){
				var identifiers = this.get('id');
				
				if(Array.isArray(identifiers))
					query += "+" + this.getGroupedQuery(this.fieldNameMap["id"], identifiers, { operator: "AND", subtext: true });				
				else if(identifiers) 
					query += "+" + this.fieldNameMap["id"] + ':*' + encodeURIComponent(identifiers) + "*";
			}
			
			//---resourceMap---
			if(this.filterIsAvailable("resourceMap") && ((filter == "resourceMap") || getAll)){
				var resourceMap = this.get('resourceMap');
				
				//If the resource map search setting is a list of resource map IDs
				if(Array.isArray(resourceMap))
					query += "+" + this.getGroupedQuery(this.fieldNameMap["resourceMap"], resourceMap,  { operator: "OR" });				
				//Otherwise, treat it as a binary setting
				else if(resourceMap) 
					query += "+" + this.fieldNameMap["resourceMap"] + ':*';
			}
			
			//---Username: search for this username in rightsHolder and submitter ---
			if(this.filterIsAvailable("username") && ((filter == "username") || getAll) && this.get('username').length){
				var username = this.get('username');
				if(username)
					query += "+" + this.getGroupedQuery(this.fieldNameMap["username"], username, {operator: "OR"});
			}
			
			//---Taxon---
			if(this.filterIsAvailable("taxon") && ((filter == "taxon") || getAll) && this.get('taxon').length){
				var taxon = this.get('taxon');
				
				for(var i=0; i<taxon.length; i++){
					var value = (typeof taxon == "object")? taxon[i].value : taxon[i].trim();
					value = value.substring(0, 1).toUpperCase() + value.substring(1);
					
					query += this.getMultiFieldQuery(this.fieldNameMap["taxon"], value, {subtext: true});
				}
			}
			
			//------Pub Year-----
			if(this.filterIsAvailable("pubYear") && ((filter == "pubYear") || getAll)){
				//Get the types of year to be searched first
				var pubYear  = this.get('pubYear');
				if (pubYear){
					//Get the minimum and maximum years chosen
					var yearMin = this.get('yearMin');
					var yearMax = this.get('yearMax');	
					
					//Add to the query if we are searching publication year
					query += "+" + this.getMultiFieldQuery(this.fieldNameMap["pubYear"], "[" + yearMin + "-01-01T00:00:00Z TO " + yearMax + "-12-31T00:00:00Z]");
					//query += "+" + this.fieldNameMap["pubYear"] + ":%5B" + yearMin + "-01-01T00:00:00Z%20TO%20" + yearMax + "-12-31T00:00:00Z%5D";				
				}
			}
			
			//-----Data year------
			if(this.filterIsAvailable("dataYear") && ((filter == "dataYear") || getAll)){
				var dataYear = this.get('dataYear');
				
				if(dataYear){
					//Get the minimum and maximum years chosen
					var yearMin = this.get('yearMin');
					var yearMax = this.get('yearMax');	
					
					query += "+beginDate:[" + yearMin + "-01-01T00:00:00Z%20TO%20*]" +
					 		 "+endDate:[*%20TO%20" + yearMax + "-12-31T00:00:00Z]";
				}
			}
			
			//-----Data Source--------
			if(this.filterIsAvailable("dataSource") && ((filter == "dataSource") || getAll)){
				var filterValue = null;
				var filterValues = [];
									
				if(this.get("dataSource").length > 0){
					var objectValues =  _.filter(this.get("dataSource"), function(v){ return (typeof v == "object") });
					if(objectValues && objectValues.length)
						filterValues.push(_.pluck(objectValues, "value"));
				}
				
				var stringValues = _.filter( this.get("dataSource"), function(v){ return (typeof v == "string") });
				if(stringValues && stringValues.length)
					filterValues.push(stringValues);
				
				filterValues = _.flatten(filterValues);
				
				query += "+" + this.getGroupedQuery(this.fieldNameMap["dataSource"], filterValues,  { operator: "OR" });				
			}
	
			//-----Excluded fields-----
			if(this.filterIsAvailable("exclude") && ((filter == "exclude") || getAll)){
				var exclude = this.get("exclude");
				_.each(exclude, function(excludeField, key, list){
					query += "+-" + excludeField.field + ":" + excludeField.value;
				});
			}
			
			//-----Additional criteria - both field and value are provided-----
			if(this.filterIsAvailable("additionalCriteria") && ((filter == "additionalCriteria") || getAll)){
				var additionalCriteria = this.get('additionalCriteria');
				for (var i=0; i < additionalCriteria.length; i++){
					var value;
					
					//if(this.needsQuotes(additionalCriteria[i])) value = "%22" + encodeURIComponent(additionalCriteria[i]) + "%22";
					value = encodeURIComponent(additionalCriteria[i]);
					
					query += "+" + value;
				}
			}
			
			//-----All (full text search) -----
			if(this.filterIsAvailable("all") && ((filter == "all") || getAll)){
				var all = this.get('all');
				for (var i=0; i < all.length; i++){
					var filterValue = all[i];
					
					if(typeof filterValue == "object")
						filterValue = filterValue.value;
					
					if(this.needsQuotes(filterValue)) filterValue = "%22" + encodeURIComponent(filterValue) + "%22";
					else filterValue = encodeURIComponent(filterValue);
					
					query += "+" + filterValue;
				}
			}
						
			//-----Other Filters/Basic Filters-----			
			_.each(otherFilters, function(filterName, key, list){
				if(model.filterIsAvailable(filterName) && ((filter == filterName) || getAll)){
					var filterValue = null;
					var filterValues = model.get(filterName);
					
					for (var i=0; i < filterValues.length; i++){
						
						//Trim the spaces off
						var filterValue = filterValues[i];
						if(typeof filterValue == "object"){
							filterValue = filterValue.value;
						}
						filterValue = filterValue.trim();
						
						// Does this need to be wrapped in quotes?
						if(model.needsQuotes(filterValue)) filterValue = "%22" + encodeURIComponent(filterValue) + "%22";
						else filterValue = encodeURIComponent(filterValue);

						query += "+" + model.fieldNameMap[filterName] + ":" + filterValue;			
					}
				}
			});
			
			//-----Geohashes-----
			if(this.filterIsAvailable("geohashLevel") && (((filter == "geohash") || getAll)) && this.get("useGeohash")){
				var geohashes = this.get("geohashes");
				
				if ((typeof geohashes != undefined) && (geohashes.length > 0)){ 
					var groups = this.get("geohashGroups");					
					
					if((typeof groups !== "undefined") && (Object.keys(groups).length > 0)){
						query += "+(";
						
						_.each(Object.keys(groups), function(level){
							var geohashList = groups[level];
							
							query += "geohash_" + level + ":(";
							
							_.each(geohashList, function(g){
								if(query.length < 7900) //Keep URI's from getting too long for Apache
									query += g + "%20OR%20";
							});
							
							//Remove the last "OR"
							query = query.substr(0, (query.length-8));	
							
							query += ")%20OR%20";
							
						});
						
						//Remove the last "OR"
						query = query.substr(0, (query.length-8));														
						query += ")";
					}
				}
			}
			
			//---Spatial---
			if(this.filterIsAvailable("spatial") && ((filter == "spatial") || getAll)){
				var spatial = this.get('spatial');
				
				if(Array.isArray(spatial))
					query += "+" + this.getGroupedQuery(this.fieldNameMap["spatial"], spatial, { operator: "AND", subtext: true });				
				else if(spatial) 
					query += "+" + this.fieldNameMap["spatial"] + ':*' + encodeURIComponent(spatial) + "*";
			}
			
			//---Creator---
			if(this.filterIsAvailable("creator") && ((filter == "creator") || getAll)){
				var creator = this.get('creator');
				
				if(Array.isArray(creator))
					query += "+" + this.getGroupedQuery(this.fieldNameMap["creator"], creator, { operator: "AND", subtext: true });				
				else if(creator) 
					query += "+" + this.fieldNameMap["creator"] + ':*' + encodeURIComponent(creator) + "*";
			}
						
			return query;
		},
		
		getFacetQuery: function(){
			
			var facetQuery = "&facet=true" +
							 "&facet.sort=count" +
							 "&facet.mincount=1" +
							 "&facet.limit=-1" +
							 "&facet.field=keywords" +
							 "&facet.field=origin" +
							 "&facet.field=family" +
							 "&facet.field=species" +
							 "&facet.field=genus" +
							 "&facet.field=kingdom" + 
							 "&facet.field=phylum" + 
							 "&facet.field=order" +
							 "&facet.field=class" +
							 "&facet.field=site";
			if(this.filterIsAvailable("attribute")) facetQuery += "&facet.field=attributeName&facet.field=attributeLabel";
			if(this.filterIsAvailable("annotation")) facetQuery += "&facet.field=sem_annotation_bioportal_sm";
			
			return facetQuery;
		},
		
		//Check for spaces in a string - we'll use this to url encode the query
		needsQuotes: function(entry){
				
			//Check for spaces
			var value = "";
			
			if(typeof entry == "object")
				value = entry.value;
			else if(typeof entry == "string")
				value = entry;
			else
				return false;
			
			//Is this a date range search? If so, we don't use quote marks
			var ISODateRegEx = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)/;
			if(ISODateRegEx.exec(value))
				return false;
			
			//Check for a space character
			if(value.indexOf(" ") > -1)
				return true;
			
			//Check for the colon : character (and encoded colons)
			if((value.indexOf(":") > -1) || value.indexOf("%3A") > -1)
				return true;
			
			return false;
		},
		
		/*
		 * Makes a Solr syntax grouped query using the field name, the field values to search for, and the operator.
		 * Example:  title:(resistance OR salmon OR "pink salmon")
		 */
		getGroupedQuery: function(fieldName, values, options){
			if(!values) return "";
			values = _.compact(values);
			if(!values.length) return "";

			var query = "",
				numValues = values.length,
				model = this;
			
			if(Array.isArray(fieldName) && (fieldName.length > 1))
				return this.getMultiFieldQuery(fieldName, values, options);
			
			if(options && (typeof options == "object")){
				var operator = options.operator,
					subtext = options.subtext;
			}
		
			if((typeof operator === "undefined") || !operator || ((operator != "OR") && (operator != "AND"))) var operator = "OR";
			
			if(numValues == 1){
				var value = values[0],
					queryAddition;
				
				if(!Array.isArray(value) && (typeof value === "object") && value.value)
					value = value.value.trim();
				
				if(this.needsQuotes(values[0])) queryAddition = '%22' + encodeURIComponent(value) + '%22';
				else if(subtext)                queryAddition = "*" + encodeURIComponent(value) + "*";
				else							queryAddition = encodeURIComponent(value);
					
				query = fieldName + ":" + queryAddition;
			}
			else{		
				_.each(values, function(value, i){					
					//Check for filter objects
					if(!Array.isArray(value) && (typeof value === "object") && value.value)
						value = value.value.trim();
					
					if(model.needsQuotes(value)) value = '%22' + encodeURIComponent(value) + '%22';
					else if(subtext)             value = "*" + encodeURIComponent(value) + "*";
					else                         value = encodeURIComponent(value);
						
					if((i == 0) && (numValues > 1)) 	   query += fieldName + ":(" + value;
					else if((i > 0) && (i < numValues-1))  query += "%20" + operator + "%20" + value;
					else if(i == numValues-1) 		 	   query += "%20" + operator + "%20" + value + ")";
				});
			}
			
			return query;
		},
		
		/*
		 * Makes a Solr syntax query using multiple field names, one field value to search for, and some options.
		 * Example: (family:*Pin* OR class:*Pin* OR order:*Pin* OR phlyum:*Pin*)
		 * Options: 
		 * 		- operator (OR or AND)
		 * 		- subtext (binary) - will surround search value with wildcards to search for partial matches
		 * 		- Example:
		 * 			var options = { operator: "OR", subtext: true }
		 */
		getMultiFieldQuery: function(fieldNames, value, options){
			var query = "",
				numFields = fieldNames.length,
				model = this;
			
			//Catch errors
			if((numFields < 1) || !value) return "";
			
			//If only one field was given, then use the grouped query function
			if(numFields == 1)
				return this.getGroupedQuery(fieldNames, value, options);
				
			//Get the options
			if(options && (typeof options == "object")){
				var operator = options.operator,
					subtext = options.subtext;
			}
		
			//Default to the OR operator
			if((typeof operator === "undefined") || !operator || ((operator != "OR") && (operator != "AND"))) 
				var operator = "OR";
			if((typeof subtext === "undefined")) 
				var subtext = false;
			
			//Create the value string
			//Trim the spaces off
			if(!Array.isArray(value) && (typeof value === "object") && value.value)
				value = [value.value.trim()];
			else if (typeof value == "string")
				value = [value.trim()];

			var valueString = "";
			if(Array.isArray(value)){
				var model = this;
				_.each(value, function(v, i){	
					if((value.length > 1) && (i == 0)) valueString += "("
						
					if(model.needsQuotes(v)) valueString += '"' + encodeURIComponent(v.trim()) + '"';
					else if(subtext)        valueString += "*" + encodeURIComponent(v.trim()) + "*";
					else                    valueString += encodeURIComponent(v.trim());
					
					if(i < value.length-1)
						valueString += " OR ";
					else if((i == value.length-1) && (value.length > 1))
						valueString += ")";
					
				});
			}
			else valueString = value;
			
			query = "+(";
				
			//Create the query string
			var last = numFields - 1;
			_.each(fieldNames, function(field, i){					
				query += field + ":" + valueString;
				if(i < last)  query += "%20" + operator + "%20";
			});
			
			query += ")";
			
			return query;			
		},
		
		/**** Provenance-related functions ****/
		// Returns which fields are provenance-related in this model
		// Useful for querying the index and such
		getProvFields: function(){
			var defaultFields = Object.keys(new SolrResult().defaults);
			var provFields = _.filter(defaultFields, function(fieldName){ 
				if(fieldName.indexOf("prov_") == 0) return true; 
			});

			return provFields;	
		},
		
		getProvFlList: function(){
			var provFields = this.getProvFields(),
			provFl = "";
			_.each(provFields, function(provField, i){
				provFl += provField;
				if(i < provFields.length-1) provFl += ","; 
			});
			
			return provFl;
		},
		
		clear: function() {
		    return this.set(_.clone(this.defaults()));
		}
		
	});
	return Search;
});
