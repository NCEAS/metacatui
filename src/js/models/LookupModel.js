/*global define */
define(['jquery', 'jqueryui', 'underscore', 'backbone'],
	function($, $ui, _, Backbone) {
	'use strict';

	/**
  * @class LookupModel
  * @classdesc A uttility model that contains functions for looking up values from various services
  * @classcategory Models
  */
	var LookupModel = Backbone.Model.extend(
    /** @lends LookupModel.prototype */{
		defaults: {
			concepts: {}
		},

		initialize: function() {



		},

		bioportalSearch: function(request, response, localValues, allValues) {

			// make sure we have something to lookup
			if (!MetacatUI.appModel.get('bioportalAPIKey')) {
				response(localValues);
				return;
			}

			var query = MetacatUI.appModel.get('bioportalSearchUrl') +
                  "?q=" + request.term +
                  "&apikey=" + MetacatUI.appModel.get("bioportalAPIKey") +
                  "&ontologies=ECSO&pagesize=1000&suggest=true";
			var availableTags = [];
			$.get(query, function(data, textStatus, xhr) {

				_.each(data.collection, function(obj) {
					var choice = {};
					choice.label = obj['prefLabel'];
					var synonyms = obj['synonym'];
					if (synonyms) {
						choice.synonyms = [];
						_.each(synonyms, function(synonym) {
							choice.synonyms.push(synonym);
						});
					}
					choice.filterLabel = obj['prefLabel'];
					choice.value = obj['@id'];
					if (obj['definition']) {
						choice.desc = obj['definition'][0];
					}

					// mark items that we know we have matches for
					if (allValues) {
						var matchingChoice = _.findWhere(allValues, {value: choice.value});
						if (matchingChoice) {
							//choice.label = "*" + choice.label;
							choice.match = true;

							// remove it from the local value - why have two?
							if (localValues) {
								localValues = _.reject(localValues, function(obj) {
									return obj.value == matchingChoice.value;
								});
							}
							//availableTags.push(choice);
						}
					}

					availableTags.push(choice);

				});

				// combine the lists if called that way
				if (localValues) {
					availableTags = localValues.concat(availableTags);
				}

				response(availableTags);

			});
		},

		bioportalExpand: function(term) {

			// make sure we have something to lookup
			if (!MetacatUI.appModel.get('bioportalAPIKey')) {
				response(null);
				return;
			}

			var terms = [];
			var countdown = 0;

			var query = MetacatUI.appModel.get('bioportalSearchUrl') +
                  "?q=" + term +
                  "&apikey=" + MetacatUI.appModel.get("bioportalAPIKey") +
                  "&ontologies=ECSO&pagesize=1000&suggest=true";;
			$.ajax(
			{
				url: query,
				method: "GET",
				async: false, // we want to wait for the response!
				success: function(data, textStatus, xhr) {

				_.each(data.collection, function(obj) {
					// use the preferred label
					var prefLabel = obj['prefLabel'];
					terms.push(prefLabel);

					// add the synonyms
					var synonyms = obj['synonym'];
					if (synonyms) {
						_.each(synonyms, function(synonym) {
							terms.push(synonym);
						});
					}
					// process the descendants
					var descendantsUrl = obj['links']['descendants'];
					//if (false) {
					if (descendantsUrl && countdown > 0) {

						countdown--;

						$.ajax(
						{
						url: descendantsUrl + "?apikey=" + MetacatUI.appModel.get("bioportalAPIKey"),
						method: "GET",
						async: false,
						success: function(data, textStatus, xhr) {
							_.each(data.collection, function(obj) {
								var prefLabel = obj['prefLabel'];
								var synonyms = obj['synonym'];
								if (synonyms) {
									_.each(synonyms, function(synonym) {
										terms.push(synonym);
									});
								}
							});
						}
							});
					}
				});
			}
			});
			return terms;
		},

		bioportalGetConcepts: function(uri, callback) {

			var concepts = this.get('concepts')[uri];

			if (concepts) {
				callback(concepts);
				return;
			} else {
				concepts = [];
			}

			// make sure we have something to lookup
			if (!MetacatUI.appModel.get('bioportalAPIKey')) {
				return;
			}

			var query = MetacatUI.appModel.get('bioportalSearchUrl') +
                  "?q=" + encodeURIComponent(uri) +
                  "&apikey=" + MetacatUI.appModel.get("bioportalAPIKey") +
                  "&ontologies=ECSO&pagesize=1000&suggest=true";
			var availableTags = [];
			var model = this;
			$.get(query, function(data, textStatus, xhr) {

				_.each(data.collection, function(obj) {
					var concept = {};
					concept.label = obj['prefLabel'];
					concept.value = obj['@id'];
					if (obj['definition']) {
						concept.desc = obj['definition'][0];
					}
					// add the synonyms
					var synonyms = obj['synonym'];
					if (synonyms) {
						concept.synonyms = [];
						_.each(synonyms, function(synonym) {
							concept.synonyms.push(synonym);
						});
					}

					concepts.push(concept);

				});
				model.get('concepts')[uri] = concepts;

				callback(concepts);
			});
		},

		bioportalGetConceptsBatch: function(uris, callback) {

			// make sure we have something to lookup
			if (!MetacatUI.appModel.get('bioportalBatchUrl')) {
				return;
			}
			// prepare the request JSON
			var batchData = {};
			batchData["http://www.w3.org/2002/07/owl#Class"] = {};
			batchData["http://www.w3.org/2002/07/owl#Class"]["display"] = "prefLabel,synonym,definition";
			batchData["http://www.w3.org/2002/07/owl#Class"]["collection"] = [];
			_.each(uris, function(uri) {
				var item = {};
				item["class"] = uri;
				item["ontology"] = "http://data.bioontology.org/ontologies/ECSO";
				batchData["http://www.w3.org/2002/07/owl#Class"]["collection"].push(item);
			});

			var url = MetacatUI.appModel.get('bioportalBatchUrl');
			var model = this;
			$.ajax(url,
					{
					method: "POST",
					//url: url,
					data: JSON.stringify(batchData),
					contentType: "application/json",
					headers: {
						"Authorization": "apikey token="+ MetacatUI.appModel.get("bioportalAPIKey")
					},
					error: function(e) {
						console.log(e);
					},
					success: function(data, textStatus, xhr) {

						_.each(data["http://www.w3.org/2002/07/owl#Class"], function(obj) {
							var concept = {};
							concept.label = obj['prefLabel'];
							concept.value = obj['@id'];
							if (obj['definition']) {
								concept.desc = obj['definition'][0];
							}
							// add the synonyms
							var synonyms = obj['synonym'];
							if (synonyms) {
								concept.synonyms = [];
								_.each(synonyms, function(synonym) {
									concept.synonyms.push(synonym);
								});
							}

							var conceptList = [];
							conceptList.push(concept);
							model.get('concepts')[concept.value] = conceptList;

						});

						callback.apply();
					}
				});

		},

		orcidGetConcepts: function(uri, callback) {

			var people = this.get('concepts')[uri];

			if (people) {
				callback(people);
				return;
			} else {
				people = [];
			}

			var query = MetacatUI.appModel.get('orcidBaseUrl')  + uri.substring(uri.lastIndexOf("/"));
			var model = this;
			$.get(query, function(data, status, xhr) {
				// get the orcid info
				var profile = $(data).find("orcid-profile");

				_.each(profile, function(obj) {
					var choice = {};
					choice.label = $(obj).find("orcid-bio > personal-details > given-names").text() + " " + $(obj).find("orcid-bio > personal-details > family-name").text();
					choice.value = $(obj).find("orcid-identifier > uri").text();
					choice.desc = $(obj).find("orcid-bio > personal-details").text();
					people.push(choice);
				});

				model.get('concepts')[uri] = people;

				// callback with answers
				callback(people);
			})
		},

		/*
		 * Supplies search results for ORCiDs to autocomplete UI elements
		 */
		orcidSearch: function(request, response, more, ignore) {

			var people = [];

			if(!ignore) var ignore = [];

			var query = MetacatUI.appModel.get('orcidSearchUrl') + request.term;
			$.get(query, function(data, status, xhr) {
				// get the orcid info
				var profile = $(data).find("orcid-profile");

				_.each(profile, function(obj) {
					var choice = {};
					choice.value = $(obj).find("orcid-identifier > uri").text();

					if(_.contains(ignore, choice.value.toLowerCase())) return;

					choice.label = $(obj).find("orcid-bio > personal-details > given-names").text() + " " + $(obj).find("orcid-bio > personal-details > family-name").text();
					choice.desc = $(obj).find("orcid-bio > personal-details").text();
					people.push(choice);
				});

				// add more if called that way
				if (more) {
					people = more.concat(people);
				}

				// callback with answers
				response(people);
			});
		},

		/*
		 * Gets the bio of a person given an ORCID
		 * Updates the given user model with the bio info from ORCID
		 */
		orcidGetBio: function(options){
			if(!options || !options.userModel) return;

			var orcid     = options.userModel.get("username"),
				onSuccess = options.success || function(){},
				onError   = options.error   || function(){};

			$.ajax({
				url: MetacatUI.appModel.get("orcidSearchUrl") + orcid,
				type: "GET",
				//accepts: "application/orcid+json",
				success: function(data, textStatus, xhr){
					// get the orcid info
					var orcidNode = $(data).find("path:contains(" + orcid + ")"),
						profile = orcidNode.length? $(orcidNode).parents("orcid-profile") : [];

					if(!profile.length) return;

					var fullName = $(profile).find("orcid-bio > personal-details > given-names").text() + " " + $(profile).find("orcid-bio > personal-details > family-name").text();
					options.userModel.set("fullName", fullName);

					onSuccess(data, textStatus, xhr);
				},
				error: function(xhr, textStatus, error){
					onError(xhr, textStatus, error);
				}
			});
		},

		getGrantAutocomplete: function(request, response){
            var term = $.ui.autocomplete.escapeRegex(request.term),
            	filterBy = "";

            //Only search after 3 characters or more
            if(term.length < 3) return;
            else if(term.match(/\d/)) return; //Don't search for digit only since it's most likely a user just entering the grant number directy
            else filterBy = "keyword";

            var url = MetacatUI.appModel.get("grantsUrl") + "?"  + filterBy + "=" + term + "&printFields=title,id";

						// Send the AJAX request as a JSONP data type since it will be cross-origin
						var requestSettings = {
							url: url,
							dataType: "jsonp",
							success: function(data, textStatus, xhr) {

								// Handle the response from the NSF Award Search API and
								//transform each award query result into a jQueryUI autocomplete item

								if(!data || !data.response || !data.response.award) return [];

								var list = [];

								_.each(data.response.award, function(award, i){
									list.push({
										value: award.id,
										label: award.title
									});
								});

								var term = $.ui.autocomplete.escapeRegex(request.term)
									, startsWithMatcher = new RegExp("^" + term, "i")
									, startsWith = $.grep(list, function(value) {
											return startsWithMatcher.test(value.label || value.value || value);
									})
									, containsMatcher = new RegExp(term, "i")
									, contains = $.grep(list, function (value) {
											return $.inArray(value, startsWith) < 0 &&
													containsMatcher.test(value.label || value.value || value);
									});

								response(startsWith.concat(contains));
							}
						}

						//Send the query
						$.ajax(requestSettings);
		},

		getGrant: function(id, onSuccess, onError){
			if(!id || !onSuccess || !MetacatUI.appModel.get("useNSFAwardAPI") || !MetacatUI.appModel.get("grantsUrl")) return;

			var requestSettings = {
					url: MetacatUI.appModel.get("grantsUrl") + "?id=" + id,
					success: function(data, textStatus, xhr){
						if(!data || !data.response || !data.response.award || !data.response.award.length){
							if(onError) onError();
							return;
						}

						onSuccess(data.response.award[0]);
					},
					error: function(){
						if(onError) onError();
					}
			}

			//Send the query
			$.ajax(requestSettings);
		},

    getAccountsAutocomplete: function(request, response){
      var searchTerm = $.ui.autocomplete.escapeRegex(request.term);

      //Only search after 2 characters or more
      if(searchTerm.length < 2)
        return;

      var url = MetacatUI.appModel.get("accountsUrl") + "?query=" + searchTerm;

      // Send the AJAX request as a JSONP data type since it will be cross-origin
      var requestSettings = {
        url: url,
        success: function(data, textStatus, xhr) {

          if(!data)
            return [];

          //If an XML doc was not returned from the server, then try to parse the response as XML
          if( !XMLDocument.prototype.isPrototypeOf(data) ){
            try{
              data = $.parseXML(data);
            }
            catch(e){
              //If the parsing XML failed, exit now
              console.error("The accounts service did not return valid XML.", e);
              return;
            }
          }

          var list = [];

          _.each($(data).children(/.+subjectInfo/).children(), function(accountNode, i){

            var name = "";

            if( $(accountNode).children("givenName").length ){
              name = $(accountNode).children("givenName").text() + " " + $(accountNode).children("familyName").text()
            }
            else{
              name = $(accountNode).children("groupName").text();
            }

            if( !name ){
              name = $(accountNode).children("subject").text();
            }

            list.push({
              value: $(accountNode).children("subject").text(),
              label: name + "  (" + $(accountNode).children("subject").text() + ")"
            });
          });

          var term = $.ui.autocomplete.escapeRegex(request.term)
            , startsWithMatcher = new RegExp("^" + term, "i")
            , startsWith = $.grep(list, function(value) {
                return startsWithMatcher.test(value.label || value.value || value);
            })
            , containsMatcher = new RegExp(term, "i")
            , contains = $.grep(list, function (value) {
                return $.inArray(value, startsWith) < 0 &&
                    containsMatcher.test(value.label || value.value || value);
            });

          response(startsWith.concat(contains));
        }
      }

      //Send the query
      $.ajax(requestSettings);
    },

    /**
    * Calls the monitor/status DataONE MN API and gets the size of the index queue.
    * @param {function} [onSuccess]
    * @param {function} [onError]
    */
    getSizeOfIndexQueue: function(onSuccess, onError){

      try{

        if( !MetacatUI.appModel.get("monitorStatusUrl") ){
          if( typeof onSuccess == "function" ){
            onSuccess();
          }
          else{
            //Trigger a custom event for the size of the index queue.
            this.trigger("sizeOfQueue", -1);
          }

          return false;
        }

        var model = this;

        //Check if there is an indexing queue, because this model may still be indexing
        var requestSettings = {
          url: MetacatUI.appModel.get("monitorStatusUrl"),
          type: "GET",
          error: function(){
            if( typeof onError == "function" ){
              onError();
            }
          },
          success: function(data){

            var sizeOfQueue = parseInt($(data).find("status > index > sizeOfQueue").text());

            if(sizeOfQueue > 0 || sizeOfQueue == 0){
              //Trigger a custom event for the size of the index queue.
              model.trigger("sizeOfQueue", sizeOfQueue);

              if( typeof onSuccess == "function" ){
                onSuccess(sizeOfQueue);
              }
            }
            else{
              if( typeof onError == "function" ){
                onError();
              }
            }
          }
        }

        $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
      }
      catch(e){
        console.error(e);

        if( typeof onError == "function" ){
          onError();
        }

      }
    }

	});
	return LookupModel;
});
