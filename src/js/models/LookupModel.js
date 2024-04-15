/*global define */
define(["jquery", "jqueryui", "underscore", "backbone"], function (
  $,
  $ui,
  _,
  Backbone
) {
  "use strict";

  /**
   * @class LookupModel
   * @classdesc A utility model that contains functions for looking up values
   * from various services
   * @classcategory Models
   */
  var LookupModel = Backbone.Model.extend(
    /** @lends LookupModel.prototype */ {
      defaults: {
        concepts: {},
      },

      initialize: function () {},

      bioportalSearch: function (request, response, localValues, allValues) {
        // make sure we have something to lookup
        if (!MetacatUI.appModel.get("bioportalAPIKey")) {
          response(localValues);
          return;
        }

        var query =
          MetacatUI.appModel.get("bioportalSearchUrl") +
          "?q=" +
          request.term +
          "&apikey=" +
          MetacatUI.appModel.get("bioportalAPIKey") +
          "&ontologies=ECSO&pagesize=1000&suggest=true";
        var availableTags = [];
        $.get(query, function (data, textStatus, xhr) {
          _.each(data.collection, function (obj) {
            var choice = {};
            choice.label = obj["prefLabel"];
            var synonyms = obj["synonym"];
            if (synonyms) {
              choice.synonyms = [];
              _.each(synonyms, function (synonym) {
                choice.synonyms.push(synonym);
              });
            }
            choice.filterLabel = obj["prefLabel"];
            choice.value = obj["@id"];
            if (obj["definition"]) {
              choice.desc = obj["definition"][0];
            }

            // mark items that we know we have matches for
            if (allValues) {
              var matchingChoice = _.findWhere(allValues, {
                value: choice.value,
              });
              if (matchingChoice) {
                //choice.label = "*" + choice.label;
                choice.match = true;

                // remove it from the local value - why have two?
                if (localValues) {
                  localValues = _.reject(localValues, function (obj) {
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

      bioportalExpand: function (term) {
        // make sure we have something to lookup
        if (!MetacatUI.appModel.get("bioportalAPIKey")) {
          response(null);
          return;
        }

        var terms = [];
        var countdown = 0;

        var query =
          MetacatUI.appModel.get("bioportalSearchUrl") +
          "?q=" +
          term +
          "&apikey=" +
          MetacatUI.appModel.get("bioportalAPIKey") +
          "&ontologies=ECSO&pagesize=1000&suggest=true";
        $.ajax({
          url: query,
          method: "GET",
          async: false, // we want to wait for the response!
          success: function (data, textStatus, xhr) {
            _.each(data.collection, function (obj) {
              // use the preferred label
              var prefLabel = obj["prefLabel"];
              terms.push(prefLabel);

              // add the synonyms
              var synonyms = obj["synonym"];
              if (synonyms) {
                _.each(synonyms, function (synonym) {
                  terms.push(synonym);
                });
              }
              // process the descendants
              var descendantsUrl = obj["links"]["descendants"];
              //if (false) {
              if (descendantsUrl && countdown > 0) {
                countdown--;

                $.ajax({
                  url:
                    descendantsUrl +
                    "?apikey=" +
                    MetacatUI.appModel.get("bioportalAPIKey"),
                  method: "GET",
                  async: false,
                  success: function (data, textStatus, xhr) {
                    _.each(data.collection, function (obj) {
                      var prefLabel = obj["prefLabel"];
                      var synonyms = obj["synonym"];
                      if (synonyms) {
                        _.each(synonyms, function (synonym) {
                          terms.push(synonym);
                        });
                      }
                    });
                  },
                });
              }
            });
          },
        });
        return terms;
      },

      bioportalGetConcepts: function (uri, callback) {
        var concepts = this.get("concepts")[uri];

        if (concepts) {
          callback(concepts);
          return;
        } else {
          concepts = [];
        }

        // make sure we have something to lookup
        if (!MetacatUI.appModel.get("bioportalAPIKey")) {
          return;
        }

        var query =
          MetacatUI.appModel.get("bioportalSearchUrl") +
          "?q=" +
          encodeURIComponent(uri) +
          "&apikey=" +
          MetacatUI.appModel.get("bioportalAPIKey") +
          "&ontologies=ECSO&pagesize=1000&suggest=true";
        var availableTags = [];
        var model = this;
        $.get(query, function (data, textStatus, xhr) {
          _.each(data.collection, function (obj) {
            var concept = {};
            concept.label = obj["prefLabel"];
            concept.value = obj["@id"];
            if (obj["definition"]) {
              concept.desc = obj["definition"][0];
            }
            // add the synonyms
            var synonyms = obj["synonym"];
            if (synonyms) {
              concept.synonyms = [];
              _.each(synonyms, function (synonym) {
                concept.synonyms.push(synonym);
              });
            }

            concepts.push(concept);
          });
          model.get("concepts")[uri] = concepts;

          callback(concepts);
        });
      },

      bioportalGetConceptsBatch: function (uris, callback) {
        // make sure we have something to lookup
        if (!MetacatUI.appModel.get("bioportalBatchUrl")) {
          return;
        }
        // prepare the request JSON
        var batchData = {};
        batchData["http://www.w3.org/2002/07/owl#Class"] = {};
        batchData["http://www.w3.org/2002/07/owl#Class"]["display"] =
          "prefLabel,synonym,definition";
        batchData["http://www.w3.org/2002/07/owl#Class"]["collection"] = [];
        _.each(uris, function (uri) {
          var item = {};
          item["class"] = uri;
          item["ontology"] = "http://data.bioontology.org/ontologies/ECSO";
          batchData["http://www.w3.org/2002/07/owl#Class"]["collection"].push(
            item
          );
        });

        var url = MetacatUI.appModel.get("bioportalBatchUrl");
        var model = this;
        $.ajax(url, {
          method: "POST",
          //url: url,
          data: JSON.stringify(batchData),
          contentType: "application/json",
          headers: {
            Authorization:
              "apikey token=" + MetacatUI.appModel.get("bioportalAPIKey"),
          },
          error: function (e) {
            console.log(e);
          },
          success: function (data, textStatus, xhr) {
            _.each(data["http://www.w3.org/2002/07/owl#Class"], function (obj) {
              var concept = {};
              concept.label = obj["prefLabel"];
              concept.value = obj["@id"];
              if (obj["definition"]) {
                concept.desc = obj["definition"][0];
              }
              // add the synonyms
              var synonyms = obj["synonym"];
              if (synonyms) {
                concept.synonyms = [];
                _.each(synonyms, function (synonym) {
                  concept.synonyms.push(synonym);
                });
              }

              var conceptList = [];
              conceptList.push(concept);
              model.get("concepts")[concept.value] = conceptList;
            });

            callback.apply();
          },
        });
      },

      orcidGetConcepts: function (uri, callback) {
        var people = this.get("concepts")[uri];

        if (people) {
          callback(people);
          return;
        } else {
          people = [];
        }

        var query =
          MetacatUI.appModel.get("orcidBaseUrl") +
          uri.substring(uri.lastIndexOf("/"));
        var model = this;
        $.get(query, function (data, status, xhr) {
          // get the orcid info
          var profile = $(data).find("orcid-profile");

          _.each(profile, function (obj) {
            var choice = {};
            choice.label =
              $(obj).find("orcid-bio > personal-details > given-names").text() +
              " " +
              $(obj).find("orcid-bio > personal-details > family-name").text();
            choice.value = $(obj).find("orcid-identifier > uri").text();
            choice.desc = $(obj).find("orcid-bio > personal-details").text();
            people.push(choice);
          });

          model.get("concepts")[uri] = people;

          // callback with answers
          callback(people);
        });
      },

      /*
       * Supplies search results for ORCiDs to autocomplete UI elements
       */
      orcidSearch: function (request, response, more, ignore) {
        var people = [];

        if (!ignore) var ignore = [];

        var query = MetacatUI.appModel.get("orcidSearchUrl") + request.term;
        $.get(query, function (data, status, xhr) {
          // get the orcid info
          var profile = $(data).find("orcid-profile");

          _.each(profile, function (obj) {
            var choice = {};
            choice.value = $(obj).find("orcid-identifier > uri").text();

            if (_.contains(ignore, choice.value.toLowerCase())) return;

            choice.label =
              $(obj).find("orcid-bio > personal-details > given-names").text() +
              " " +
              $(obj).find("orcid-bio > personal-details > family-name").text();
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
       * Gets the bio of a person given an ORCID Updates the given user model
       * with the bio info from ORCID
       */
      orcidGetBio: function (options) {
        if (!options || !options.userModel) return;

        var orcid = options.userModel.get("username"),
          onSuccess = options.success || function () {},
          onError = options.error || function () {};

        $.ajax({
          url: MetacatUI.appModel.get("orcidSearchUrl") + orcid,
          type: "GET",
          //accepts: "application/orcid+json",
          success: function (data, textStatus, xhr) {
            // get the orcid info
            var orcidNode = $(data).find("path:contains(" + orcid + ")"),
              profile = orcidNode.length
                ? $(orcidNode).parents("orcid-profile")
                : [];

            if (!profile.length) return;

            var fullName =
              $(profile)
                .find("orcid-bio > personal-details > given-names")
                .text() +
              " " +
              $(profile)
                .find("orcid-bio > personal-details > family-name")
                .text();
            options.userModel.set("fullName", fullName);

            onSuccess(data, textStatus, xhr);
          },
          error: function (xhr, textStatus, error) {
            onError(xhr, textStatus, error);
          },
        });
      },

      /**
       * Using the NSF Award Search API, get a list of grants that match the
       * given term, as long as the term is at least 3 characters long and
       * doesn't consist of only digits. Used to populate the autocomplete list
       * for the Funding fields in the metadata editor. For this method to work,
       * there must be a grantsUrl set in the MetacatUI.appModel.
       * @param {jQuery} request - The jQuery UI autocomplete request object
       * @param {function} response - The jQuery UI autocomplete response function
       * @see {@link https://www.research.gov/common/webapi/awardapisearch-v1.htm}
       */
      getGrantAutocomplete: function (
        request,
        response,
        beforeRequest,
        afterRequest
      ) {
        // Handle errors in this function or in the findGrants function
        function handleError(error) {
          if (typeof afterRequest == "function") afterRequest();
          console.log("Error fetching awards from NSF: ", error);
          response([]);
        }

        try {
          let term = request.term;

          // Only search after 3 characters or more, and not just digits
          if (!term || term.length < 3 || /^\d+$/.test(term)) return;

          // If the beforeRequest function was passed, call it now
          if (typeof beforeRequest == "function") beforeRequest();

          // Search for grants
          this.findGrants(term)
            .then((awards) => {
              response(this.formatFundingForAutocomplete(awards));
            })
            .catch(handleError)
            .finally(() => {
              if (typeof afterRequest == "function") afterRequest();
            });
        } catch (error) {
          handleError(error);
        }
      },

      /**
       * Search the NSF Award Search API for grants that match the given term.
       * @param {string} term - The term to search for
       * @param {number} [offset=1] - The offset to use in the search. Defaults
       * to 1.
       * @returns {Promise} A promise that resolves to an array of awards in the
       * format {id: string, title: string}
       * @since 2.28.0
       */
      findGrants: function (term, offset = 1) {
        let awards = [];
        if (!term || term.length < 3) return awards;
        const grantsUrl = MetacatUI.appModel.get("grantsUrl");
        if (!grantsUrl) return awards;

        term = $.ui.autocomplete.escapeRegex(term);
        term = encodeURIComponent(term);
        const filterBy = "keyword";
        const url =
          `${grantsUrl}?${filterBy}=${term}` +
          `&printFields=title,id&offset=${offset}`;

        return fetch(url)
          .then((response) => {
            return response.json();
          })
          .then((data) => {
            if (!data || !data.response || !data.response.award) return awards;
            return data.response.award;
          })
          .catch((error) => {
            console.error("Error fetching data: ", error);
            return awards;
          });
      },

      /**
       * Format awards from the NSF Award Search API for use in the jQuery UI
       * autocomplete widget.
       * @param {Array} awards - An array of awards in the format
       * {id: string, title: string}
       * @returns {Array} An array of awards in the format
       * {value: string, label: string}
       * @since 2.28.0
       */
      formatFundingForAutocomplete: function (awards) {
        if (!awards || !awards.length) return [];
        return awards.map((award) => ({
          value: award.id,
          label: award.title,
        }));
      },

      getAccountsAutocomplete: function (request, response) {
        var searchTerm = $.ui.autocomplete.escapeRegex(request.term);

        //Only search after 2 characters or more
        if (searchTerm.length < 2) return;

        var url =
          MetacatUI.appModel.get("accountsUrl") + "?query=" + searchTerm;

        // Send the AJAX request as a JSONP data type since it will be
        // cross-origin
        var requestSettings = {
          url: url,
          success: function (data, textStatus, xhr) {
            if (!data) return [];

            //If an XML doc was not returned from the server, then try to parse
            //the response as XML
            if (!XMLDocument.prototype.isPrototypeOf(data)) {
              try {
                data = $.parseXML(data);
              } catch (e) {
                //If the parsing XML failed, exit now
                console.error(
                  "The accounts service did not return valid XML.",
                  e
                );
                return;
              }
            }

            var list = [];

            _.each(
              $(data)
                .children(/.+subjectInfo/)
                .children(),
              function (accountNode, i) {
                var name = "";
                var type = "";

                if ($(accountNode).children("givenName").length) {
                  name =
                    $(accountNode).children("givenName").text() +
                    " " +
                    $(accountNode).children("familyName").text();
                  type = "person";
                } else {
                  name = $(accountNode).children("groupName").text();
                  type = "group";
                }

                if (!name) {
                  name = $(accountNode).children("subject").text();
                  type = "unknown";
                }

                list.push({
                  value: $(accountNode).children("subject").text(),
                  label:
                    name +
                    "  (" +
                    $(accountNode).children("subject").text() +
                    ")",
                  type: type,
                });
              }
            );

            var term = $.ui.autocomplete.escapeRegex(request.term),
              startsWithMatcher = new RegExp("^" + term, "i"),
              startsWith = $.grep(list, function (value) {
                return startsWithMatcher.test(
                  value.label || value.value || value
                );
              }),
              containsMatcher = new RegExp(term, "i"),
              contains = $.grep(list, function (value) {
                return (
                  $.inArray(value, startsWith) < 0 &&
                  containsMatcher.test(value.label || value.value || value)
                );
              });

            response(startsWith.concat(contains));
          },
        };

        //Send the query
        $.ajax(requestSettings);
      },

      /**
       * Calls the monitor/status DataONE MN API and gets the size of the index
       * queue.
       * @param {function} [onSuccess]
       * @param {function} [onError]
       */
      getSizeOfIndexQueue: function (onSuccess, onError) {
        try {
          if (!MetacatUI.appModel.get("monitorStatusUrl")) {
            if (typeof onSuccess == "function") {
              onSuccess();
            } else {
              //Trigger a custom event for the size of the index queue.
              this.trigger("sizeOfQueue", -1);
            }

            return false;
          }

          var model = this;

          //Check if there is an indexing queue, because this model may still be
          //indexing
          var requestSettings = {
            url: MetacatUI.appModel.get("monitorStatusUrl"),
            type: "GET",
            error: function () {
              if (typeof onError == "function") {
                onError();
              }
            },
            success: function (data) {
              var sizeOfQueue = parseInt(
                $(data).find("status > index > sizeOfQueue").text()
              );

              if (sizeOfQueue > 0 || sizeOfQueue == 0) {
                //Trigger a custom event for the size of the index queue.
                model.trigger("sizeOfQueue", sizeOfQueue);

                if (typeof onSuccess == "function") {
                  onSuccess(sizeOfQueue);
                }
              } else {
                if (typeof onError == "function") {
                  onError();
                }
              }
            },
          };

          $.ajax(
            _.extend(
              requestSettings,
              MetacatUI.appUserModel.createAjaxSettings()
            )
          );
        } catch (e) {
          console.error(e);

          if (typeof onError == "function") {
            onError();
          }
        }
      },
    }
  );
  return LookupModel;
});
