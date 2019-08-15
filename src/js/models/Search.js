/*global define */
define(["jquery", "underscore", "backbone", "models/SolrResult", "collections/Filters"],
    function($, _, Backbone, SolrResult, Filters) {
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
             * Example: {filterLabel: "Creator", label: "Jared Kibele (16)", value: "Kibele", description: "Search for data creators"}
             */
            defaults: function() {
                return {
                    all: [],
                    creator: [],
                    taxon: [],
                    documents: false,
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
                    dataSource: [],
                    username: [],
                    rightsHolder: [],
                    submitter: [],
                    spatial: [],
                    attribute: [],
                    //annotation: [],
                    additionalCriteria: [],
                    id: [],
                    seriesId: [],
                    idOnly: [],
                    formatType: [{
                        value: "METADATA",
                        label: "science metadata",
                        description: null
                    }],
                    exclude: [{
                        field: "obsoletedBy",
                        value: "*"
                    }],
                    /**
                    * The collection of filters used to build a query, an instance of Filters
                    * @type {Filters}
                    */
                    filters: null
                }
            },

            //A list of all the filter names that are related to the spatial/map filter
            spatialFilters: ["useGeohash", "geohashes", "geohashLevel",
                "geohashGroups", "east", "west", "north", "south"],

            initialize: function() {
                this.listenTo(this, "change:geohashes", this.groupGeohashes);
            },

            fieldLabels: {
                attribute: "Data attribute",
                documents: "Only results with data",
                annotation: "Annotation",
                dataSource: "Data source",
                creator: "Creator",
                dataYear: "Data coverage",
                pubYear: "Publish year",
                id: "Identifier",
                seriesId: "seriesId",
                taxon: "Taxon",
                spatial: "Location",
                all: ""
            },

            //Map the filter names to their index field names
            fieldNameMap: {
                attribute: "attribute",
                annotation: "sem_annotation",
                dataSource: "datasource",
                documents: "documents",
                formatType: "formatType",
                all: "",
                creator: "originText",
                spatial: "siteText",
                resourceMap: "resourceMap",
                pubYear: ["datePublished", "dateUploaded"],
                id: ["id", "identifier", "documents", "resourceMap", "seriesId"],
                idOnly: ["id", "seriesId"],
                rightsHolder: "rightsHolder",
                submitter: "submitter",
                username: ["rightsHolder", "writePermission", "changePermission"],
                taxon: ["kingdom", "phylum", "class", "order", "family", "genus", "species"]
            },

            facetNameMap: {
                "creator": "origin",
                "attribute": "attribute",
                "annotation": "sem_annotation",
                "spatial": "site",
                "taxon": ["kingdom", "phylum", "class", "order", "family", "genus", "species"],
                "all": "keywords"
            },

            getCurrentFilters: function() {
                var changedAttr = this.changedAttributes(_.clone(this.defaults()));

                if (!changedAttr) return new Array();

                var currentFilters = _.keys(changedAttr);

                //Don't count the sort order as a changed filter
                currentFilters = _.without(currentFilters, "sortOrder");

                //Don't count the geohashes or directions as a filter if the geohash filter is turned off
                if (!this.get("useGeohash")) {
                    currentFilters = _.difference(currentFilters, this.spatialFilters);
                }

                return currentFilters;
            },

            filterCount: function() {
                var currentFilters = this.getCurrentFilters();

                return currentFilters.length;
            },

            //Function filterIsAvailable will check if a filter is available in this search index -
            //if the filter name if included in the defaults of this model, it is marked as available.
            //Comment out or remove defaults that are not in the index or should not be included in queries
            filterIsAvailable: function(name) {
                //Get the keys for this model as a way to list the filters that are available
                var defaults = _.keys(this.defaults());
                if (_.indexOf(defaults, name) >= 0) {
                    return true;
                } else {
                    return false;
                }
            },

            /*
             * Removes a specified filter from the search model
             */
            removeFromModel: function(category, filterValueToRemove) {
                //Remove this filter term from the model
                if (category) {
                    //Get the current filter terms array
                    var currentFilterValues = this.get(category);

                    //The year filters have special rules
                    //If both year types will be reset/default, then also reset the year min and max values
                    if ((category == "pubYear") || (category == "dataYear")) {
                        var otherType = (category == "pubYear") ? "dataYear" : "pubYear";

                        if (_.contains(this.getCurrentFilters(), otherType))
                            var newFilterValues = this.defaults()[category];
                        else {
                            this.set(category, this.defaults()[category]);
                            this.set("yearMin", this.defaults()["yearMin"]);
                            this.set("yearMax", this.defaults()["yearMax"]);
                            return;
                        }

                    } else if (Array.isArray(currentFilterValues)) {
                        //Remove this filter term from the array
                        var newFilterValues = _.without(currentFilterValues, filterValueToRemove);
                        _.each(currentFilterValues, function(currentFilterValue, key) {
                            var valueString = (typeof currentFilterValue == "object") ? currentFilterValue.value : currentFilterValue;
                            if (valueString == filterValueToRemove) {
                                newFilterValues = _.without(newFilterValues, currentFilterValue);
                            }
                        });
                    } else {
                        //Get the default value
                        var newFilterValues = this.defaults()[category];
                    }

                    //Set the new value
                    this.set(category, newFilterValues);

                }
            },

            /*
             * Resets the geoashes and geohashLevel filters to default
             */
            resetGeohash: function() {
                this.set("geohashes", this.defaults().geohashes);
                this.set("geohashLevel", this.defaults().geohashLevel);
                this.set("geohashGroups", this.defaults().geohashGroups);
            },

            groupGeohashes: function() {
                //Find out if there are any geohashes that can be combined together, by looking for all 32 geohashes within the same precision level
                var sortedGeohashes = this.get("geohashes");
                sortedGeohashes.sort();

                var groupedGeohashes = _.groupBy(sortedGeohashes, function(n) {
                    return n.substring(0, n.length - 1);
                });

                //Find groups of geohashes that makeup a complete geohash tile (32) so we can shorten the query
                var completeGroups = _.filter(Object.keys(groupedGeohashes), function(n) {
                    return (groupedGeohashes[n].length == 32)
                });
                //Find the remaining incomplete geohash groupss
                var incompleteGroups = [];
                _.each(_.filter(Object.keys(groupedGeohashes), function(n) {
                    return (groupedGeohashes[n].length < 32)
                }), function(n) {
                    incompleteGroups.push(groupedGeohashes[n]);
                });
                incompleteGroups = _.flatten(incompleteGroups);

                //Start a geohash group object
                var geohashGroups = {};
                if ((typeof incompleteGroups !== "undefined") && (incompleteGroups.length > 0)) {
                    geohashGroups[incompleteGroups[0].length.toString()] = incompleteGroups;
                }
                if ((typeof completeGroups !== "undefined") && (completeGroups.length > 0)) {
                    geohashGroups[completeGroups[0].length.toString()] = completeGroups;
                }
                //Save it
                this.set("geohashGroups", geohashGroups);
                this.trigger("change", "geohashGroups");
            },

            /*
             * Builds the query string to send to the query engine. Goes over each filter specified in this model and adds to the query string.
             * Some filters have special rules on how to format the query, which are built first, then the remaining filters are tacked on to the
             * query string as a basic name:value pair. These "other filters" are specified in the otherFilters variable.
             */
            getQuery: function(filter) {

                //----All other filters with a basic name:value pair pattern----
                var otherFilters = ["attribute", "formatType", "rightsHolder", "submitter"];

                //Start the query string
                var query = "";

                //See if we are looking for a sub-query or a query for all filters
                if (typeof filter == "undefined") {
                    var filter = null;
                    var getAll = true;
                } else {
                    var getAll = false;
                }

                var model = this;

                //-----Annotation-----
                if (this.filterIsAvailable("annotation") && ((filter == "annotation") || getAll)) {
                    var annotations = this.get("annotation");
                    _.each(annotations, function(annotationFilter, key, list) {
                        var filterValue = "";

                        //Get the filter value
                        if (typeof annotationFilter == "object") {
                            filterValue = annotationFilter.value || "";
                        } else {
                            filterValue = annotationFilter;
                        }

                        //Trim the spaces off
                        filterValue = filterValue.trim();

                        // Does this need to be wrapped in quotes?
                        if (model.needsQuotes(filterValue)) {
                            filterValue = "%22" + encodeURIComponent(filterValue) + "%22";
                        } else {
                            filterValue = encodeURIComponent(filterValue);
                        }

                        filterValue = model.escapeSpecialChar(filterValue);

                        query += model.fieldNameMap["annotation"] + ":" + filterValue;
                    });
                }

                //---Identifier---
                if (this.filterIsAvailable("id") && ((filter == "id") || getAll) && this.get('id').length) {
                    var identifiers = this.get('id');

                    if (Array.isArray(identifiers)) {
                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.getGroupedQuery(this.fieldNameMap["id"], identifiers, {
                        operator: "OR",
                        subtext: true
                      });

                    } else if (identifiers) {
                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.fieldNameMap["id"] + ':*' + this.escapeSpecialChar(encodeURIComponent(identifiers)) + "*";
                    }
                }

                //---resourceMap---
                if (this.filterIsAvailable("resourceMap") && ((filter == "resourceMap") || getAll)) {
                    var resourceMap = this.get('resourceMap');

                    //If the resource map search setting is a list of resource map IDs
                    if (Array.isArray(resourceMap)) {
                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.getGroupedQuery(this.fieldNameMap["resourceMap"], resourceMap, {
                          operator: "OR"
                      });
                    } else if (resourceMap) {
                      if( query.length ){
                        query += " AND ";
                      }
                      //Otherwise, treat it as a binary setting
                      query += this.fieldNameMap["resourceMap"] + ':*';
                    }
                }

                //---documents---
                if (this.filterIsAvailable("documents") && ((filter == "documents") || getAll)) {
                    var documents = this.get('documents');

                    //If the documents search setting is a list ofdocuments IDs
                    if (Array.isArray(documents)) {
                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.getGroupedQuery(this.fieldNameMap["documents"], documents, {
                          operator: "OR"
                      });
                    } else if (documents) {

                      if( query.length ){
                        query += " AND ";
                      }
                      //Otherwise, treat it as a binary setting
                      query += this.fieldNameMap["documents"] + ':*';
                    }
                }

                //---Username: search for this username in rightsHolder and submitter ---
                if (this.filterIsAvailable("username") && ((filter == "username") || getAll) && this.get('username').length) {
                    var username = this.get('username');
                    if (username) {
                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.getGroupedQuery(this.fieldNameMap["username"], username, {
                          operator: "OR"
                      });
                    }
                }

                //--- ID Only - searches only the id and seriesId fields ---
                if (this.filterIsAvailable("idOnly") && ((filter == "idOnly") || getAll) && this.get('idOnly').length) {
                    var idOnly = this.get('idOnly');
                    if (idOnly) {

                        if( query.length ){
                          query += " AND ";
                        }

                        query += this.getGroupedQuery(this.fieldNameMap["idOnly"], idOnly, {
                            operator: "OR"
                        });
                    }
                }

                //---Taxon---
                if (this.filterIsAvailable("taxon") && ((filter == "taxon") || getAll) && this.get('taxon').length) {
                    var taxon = this.get('taxon');

                    for (var i = 0; i < taxon.length; i++) {
                        var value = (typeof taxon == "object") ? taxon[i].value : taxon[i].trim();

                        query += this.getMultiFieldQuery(this.fieldNameMap["taxon"], value, {
                            subtext: true
                        });
                    }
                }

                //------Pub Year-----
                if (this.filterIsAvailable("pubYear") && ((filter == "pubYear") || getAll)) {
                    //Get the types of year to be searched first
                    var pubYear = this.get('pubYear');
                    if (pubYear) {
                        //Get the minimum and maximum years chosen
                        var yearMin = this.get('yearMin');
                        var yearMax = this.get('yearMax');

                        if( query.length ){
                          query += " AND ";
                        }

                        //Add to the query if we are searching publication year
                        query += this.getMultiFieldQuery(this.fieldNameMap["pubYear"], "[" + yearMin + "-01-01T00:00:00Z TO " + yearMax + "-12-31T00:00:00Z]");
                    }
                }

                //-----Data year------
                if (this.filterIsAvailable("dataYear") && ((filter == "dataYear") || getAll)) {
                    var dataYear = this.get('dataYear');

                    if (dataYear) {
                        //Get the minimum and maximum years chosen
                        var yearMin = this.get('yearMin');
                        var yearMax = this.get('yearMax');

                        if( query.length ){
                          query += " AND ";
                        }

                        query += "beginDate:[" + yearMin + "-01-01T00:00:00Z TO *]" +
                            " AND endDate:[* TO " + yearMax + "-12-31T00:00:00Z]";
                    }
                }

                //-----Data Source--------
                if (this.filterIsAvailable("dataSource") && ((filter == "dataSource") || getAll)) {
                    var filterValue = null;
                    var filterValues = [];

                    if (this.get("dataSource").length > 0) {
                        var objectValues = _.filter(this.get("dataSource"), function(v) {
                            return (typeof v == "object")
                        });
                        if (objectValues && objectValues.length) {
                            filterValues.push(_.pluck(objectValues, "value"));
                        }
                    }

                    var stringValues = _.filter(this.get("dataSource"), function(v) {
                        return (typeof v == "string")
                    });
                    if (stringValues && stringValues.length) {
                        filterValues.push(stringValues);
                    }

                    filterValues = _.flatten(filterValues);

                    if( filterValues.length ){
                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.getGroupedQuery(this.fieldNameMap["dataSource"], filterValues, {
                          operator: "OR"
                      });
                    }
                }

                //-----Excluded fields-----
                if (this.filterIsAvailable("exclude") && ((filter == "exclude") || getAll)) {
                    var exclude = this.get("exclude");
                    _.each(exclude, function(excludeField, key, list) {

                        if (model.needsQuotes(excludeField.value)) {
                            var filterValue = "%22" + encodeURIComponent(excludeField.value) + "%22";
                        } else {
                            var filterValue = encodeURIComponent(excludeField.value);
                        }

                        filterValue = model.escapeSpecialChar(filterValue);

                        if( query.length ){
                          query += " AND ";
                        }

                        query += " -" + excludeField.field + ":" + filterValue;
                    });
                }

                //-----Additional criteria - both field and value are provided-----
                if (this.filterIsAvailable("additionalCriteria") && ((filter == "additionalCriteria") || getAll)) {
                    var additionalCriteria = this.get('additionalCriteria');
                    for (var i = 0; i < additionalCriteria.length; i++) {
                        var value;

                        //if(this.needsQuotes(additionalCriteria[i])) value = "%22" + encodeURIComponent(additionalCriteria[i]) + "%22";
                        value = encodeURIComponent(additionalCriteria[i]);

                        if( query.length ){
                          query += " AND ";
                        }

                        query += model.escapeSpecialChar(value);
                    }
                }

                //-----All (full text search) -----
                if (this.filterIsAvailable("all") && ((filter == "all") || getAll)) {
                    var all = this.get('all');
                    for (var i = 0; i < all.length; i++) {
                        var filterValue = all[i];

                        if (typeof filterValue == "object") {
                            filterValue = filterValue.value;
                        }

                        if (this.needsQuotes(filterValue)) {
                            filterValue = "%22" + encodeURIComponent(filterValue) + "%22";
                        } else {
                            filterValue = encodeURIComponent(filterValue);
                        }

                        if( query.length ){
                          query += " AND ";
                        }

                        query += model.escapeSpecialChar(filterValue);
                    }
                }

                //-----Other Filters/Basic Filters-----
                _.each(otherFilters, function(filterName, key, list) {
                    if (model.filterIsAvailable(filterName) && ((filter == filterName) || getAll)) {
                        var filterValue = null;
                        var filterValues = model.get(filterName);

                        for (var i = 0; i < filterValues.length; i++) {

                            //Trim the spaces off
                            var filterValue = filterValues[i];
                            if (typeof filterValue == "object") {
                                filterValue = filterValue.value;
                            }
                            filterValue = filterValue.trim();

                            // Does this need to be wrapped in quotes?
                            if (model.needsQuotes(filterValue)) {
                                filterValue = "%22" + encodeURIComponent(filterValue) + "%22";
                            } else  {
                                filterValue = encodeURIComponent(filterValue);
                            }

                            if( query.length ){
                              query += " AND ";
                            }

                            query += model.fieldNameMap[filterName] + ":" + model.escapeSpecialChar(filterValue);
                        }
                    }
                });

                //-----Geohashes-----
                if (this.filterIsAvailable("geohashLevel") && (((filter == "geohash") || getAll)) && this.get("useGeohash")) {
                    var geohashes = this.get("geohashes");

                    if ((typeof geohashes != undefined) && (geohashes.length > 0)) {
                        var groups = this.get("geohashGroups"),
                            numGroups = (typeof groups == "object")? Object.keys(groups).length : 0;

                        if(numGroups > 0){
                          //Add the AND operator in front of the geohash filter
                          if( query.length ){
                            query += " AND ";
                          }

                          //If there is more than one geohash group/level, wrap them in paranthesis
                          if( numGroups > 1){
                            query += "(";
                          }

                          _.each(Object.keys(groups), function(level, i, allLevels) {
                              var geohashList = groups[level];

                              query += "geohash_" + level + ":";

                              if( geohashList.length > 1 ){
                                query += "(";
                              }

                              _.each(geohashList, function(g, ii, allGeohashes) {
                                  //Keep URI's from getting too long if we are using GET
                                  if( MetacatUI.appModel.get("disableQueryPOSTs") && query.length > 1900){

                                    //Remove the last " OR "
                                    if( query.endsWith(" OR ") ){
                                      query = query.substring(0, query.length-4)
                                    }

                                    return;
                                  }
                                  else{
                                    //Add the geohash value to the query
                                    query += g;

                                    //Add an " OR " operator inbetween geohashes
                                    if( ii < allGeohashes.length-1 ){
                                      query += " OR ";
                                    }
                                  }
                              });

                              //Close the paranthesis
                              if( geohashList.length > 1 ){
                                query += ")";
                              }

                              //Add an " OR " operator inbetween geohash levels
                              if( i < allLevels.length-1 ){
                                query += " OR "
                              }

                          });

                          //Close the paranthesis
                          if(numGroups > 1){
                            query += ")";
                          }
                        }
                    }
                }

                //---Spatial---
                if (this.filterIsAvailable("spatial") && ((filter == "spatial") || getAll)) {
                    var spatial = this.get('spatial');

                    if (Array.isArray(spatial) && spatial.length) {

                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.getGroupedQuery(this.fieldNameMap["spatial"], spatial, {
                          operator: "AND",
                          subtext: false
                      });

                    } else if( typeof spatial == "string" && spatial.length) {

                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.fieldNameMap["spatial"] + ':' + model.escapeSpecialChar(encodeURIComponent(spatial));

                    }
                }

                //---Creator---
                if (this.filterIsAvailable("creator") && ((filter == "creator") || getAll)) {
                    var creator = this.get('creator');

                    if (Array.isArray(creator) && creator.length) {
                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.getGroupedQuery(this.fieldNameMap["creator"], creator, {
                          operator: "AND",
                          subtext: false
                      });
                    } else if (typeof creator == "string" && creator.length) {
                      if( query.length ){
                        query += " AND ";
                      }

                      query += this.fieldNameMap["creator"] + ':' + model.escapeSpecialChar(encodeURIComponent(creator));
                    }
                }

                return query;
            },

            getFacetQuery: function(fields) {

                var facetQuery = "&facet=true" +
                    "&facet.sort=count" +
                    "&facet.mincount=1" +
                    "&facet.limit=-1";

                //Get the list of fields
                if (!fields) {
                    var fields = "keywords,origin,family,species,genus,kingdom,phylum,order,class,site";
                    if (this.filterIsAvailable("annotation")) {
                        fields += "," + this.facetNameMap["annotation"];
                    }
                    if (this.filterIsAvailable("attribute")) {
                        fields += ",attributeName,attributeLabel";
                    }
                }

                var model = this;
                //Add the fields to the query string
                _.each(fields.split(","), function(f) {
                    var fieldNames = model.facetNameMap[f] || f;

                    if (typeof fieldNames == "string") {
                        fieldNames = [fieldNames];
                    }

                    _.each(fieldNames, function(fName) {
                        facetQuery += "&facet.field=" + fName;
                    });
                });

                return facetQuery;
            },

            //Check for spaces in a string - we'll use this to url encode the query
            needsQuotes: function(entry) {

                //Check for spaces
                var value = "";

                if (typeof entry == "object") {
                    value = entry.value;
                } else if (typeof entry == "string") {
                    value = entry;
                } else {
                    return false;
                }

                //Is this a date range search? If so, we don't use quote marks
                var ISODateRegEx = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)/;
                if (ISODateRegEx.exec(value)) {
                    return false;
                }

                //Check for a space character
                if (value.indexOf(" ") > -1) {
                    return true;
                }

                return false;
            },

            escapeSpecialChar: function(term) {
                term = term.replace(/%7B/g, "\\%7B");
                term = term.replace(/%7D/g, "\\%7D");
                term = term.replace(/%3A/g, "\\%3A");
                term = term.replace(/:/g, "\\:");
                term = term.replace(/\(/g, "\\(");
                term = term.replace(/\)/g, "\\)");
                term = term.replace(/\?/g, "\\?");
                term = term.replace(/%3F/g, "\\%3F");

                return term;
            },

            /*
             * Makes a Solr syntax grouped query using the field name, the field values to search for, and the operator.
             * Example:  title:(resistance OR salmon OR "pink salmon")
             */
            getGroupedQuery: function(fieldName, values, options) {
                if (!values) return "";
                values = _.compact(values);
                if (!values.length) return "";

                var query = "",
                    numValues = values.length,
                    model = this;

                if (Array.isArray(fieldName) && (fieldName.length > 1)) {
                    return this.getMultiFieldQuery(fieldName, values, options);
                }

                if (options && (typeof options == "object")) {
                    var operator = options.operator,
                        subtext = options.subtext;
                }

                if ((typeof operator === "undefined") || !operator || ((operator != "OR") && (operator != "AND"))) {
                    var operator = "OR";
                }

                if (numValues == 1) {
                    var value = values[0],
                        queryAddition;

                    if (!Array.isArray(value) && (typeof value === "object") && value.value) {
                        value = value.value.trim();
                    }

                    if (this.needsQuotes(values[0])) {
                        queryAddition = '%22' + this.escapeSpecialChar(encodeURIComponent(value)) + '%22';
                    } else if (subtext) {
                        queryAddition = "*" + this.escapeSpecialChar(encodeURIComponent(value)) + "*";
                    } else {
                        queryAddition = this.escapeSpecialChar(encodeURIComponent(value));
                    }
                    query = fieldName + ":" + queryAddition;
                } else {
                    _.each(values, function(value, i) {
                        //Check for filter objects
                        if (!Array.isArray(value) && (typeof value === "object") && value.value) {
                            value = value.value.trim();
                        }

                        if (model.needsQuotes(value)) {
                            value = '%22' + encodeURIComponent(value) + '%22';
                        } else if (subtext) {
                            value = "*" + this.escapeSpecialChar(encodeURIComponent(value)) + "*";
                        } else {
                            value = this.escapeSpecialChar(encodeURIComponent(value));
                        }

                        if ((i == 0) && (numValues > 1)) {
                            query += fieldName + ":(" + value;
                        } else if ((i > 0) && (i < numValues - 1) && query.length) {
                            query += " " + operator + " " + value;
                        } else if( (i > 0) && (i < numValues - 1) ){
                            query += value;
                        } else if (i == numValues - 1) {
                            query += " " + operator + " " + value + ")";
                        }
                    }, this);
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
            getMultiFieldQuery: function(fieldNames, value, options) {
                var query = "",
                    numFields = fieldNames.length,
                    model = this;

                //Catch errors
                if ((numFields < 1) || !value) return "";

                //If only one field was given, then use the grouped query function
                if (numFields == 1) {
                    return this.getGroupedQuery(fieldNames, value, options);
                }

                //Get the options
                if (options && (typeof options == "object")) {
                    var operator = options.operator,
                        subtext = options.subtext;
                }

                //Default to the OR operator
                if ((typeof operator === "undefined") || !operator ||
                    ((operator != "OR") && (operator != "AND"))) {
                    var operator = "OR";
                }
                if ((typeof subtext === "undefined")) {
                    var subtext = false;
                }

                //Create the value string
                //Trim the spaces off
                if (!Array.isArray(value) && (typeof value === "object") && value.value) {
                    value = [value.value.trim()];
                } else if (typeof value == "string") {
                    value = [value.trim()];
                }

                var valueString = "";
                if (Array.isArray(value)) {
                    var model = this;
                    _.each(value, function(v, i) {
                        if ((typeof v == "object") && v.value) {
                            v = v.value;
                        }

                        if ((value.length > 1) && (i == 0)) {
                            valueString += "("
                        }

                        if (model.needsQuotes(v) || _.contains(fieldNames, "id")) {
                            valueString += '"' + this.escapeSpecialChar(encodeURIComponent(v.trim())) + '"';
                        } else if (subtext) {
                            valueString += "*" + this.escapeSpecialChar(encodeURIComponent(v.trim())) + "*";
                        } else {
                            valueString += this.escapeSpecialChar(encodeURIComponent(v.trim()));
                        }

                        if (i < value.length - 1) {
                            valueString += " OR ";
                        } else if ((i == value.length - 1) && (value.length > 1)) {
                            valueString += ")";
                        }

                    }, this);
                } else valueString = value;

                query = "(";

                //Create the query string
                var last = numFields - 1;
                _.each(fieldNames, function(field, i) {
                    query += field + ":" + valueString;
                    if (i < last) {
                        query += " " + operator + " ";
                    }
                });

                query += ")";

                return query;
            },

            /**** Provenance-related functions ****/
            // Returns which fields are provenance-related in this model
            // Useful for querying the index and such
            getProvFields: function() {
                var defaultFields = Object.keys(new SolrResult().defaults);
                var provFields = _.filter(defaultFields, function(fieldName) {
                    if (fieldName.indexOf("prov_") == 0) return true;
                });

                return provFields;
            },

            getProvFlList: function() {
                var provFields = this.getProvFields(),
                    provFl = "";
                _.each(provFields, function(provField, i) {
                    provFl += provField;
                    if (i < provFields.length - 1) provFl += ",";
                });

                return provFl;
            },

            clear: function() {
                return this.set(_.clone(this.defaults()));
            }

        });
        return Search;
    });
