/* global define */
define(['jquery', 'underscore', 'backbone', 'rdflib', "uuid", "md5",
    'models/QualityCheckModel'
  ],
  function ($, _, Backbone, rdf, uuid, md5, QualityCheck) {

    /*
     A DataPackage represents a hierarchical collection of
     packages, metadata, and data objects, modeling an OAI-ORE RDF graph.
     TODO: incorporate Backbone.UniqueModel
    */
    var QualityReport = Backbone.Collection.extend({

      //The name of this type of collection
      type: "QualityReport",

      initialize: function (models, options) {
        if (typeof options == "undefined")
          var options = {};

        //Set the id or create a new one
        this.id = options.pid || "urn:uuid:" + uuid.v4();

        //this.on("add", this.handleAdd);
        //this.on("successSaving", this.updateRelationships);

        return this;
      },

      /*
       * The QualityReport collection stores a metadata quality
       * report that is generated from the MetaDIG quality engine.
       */
      model: QualityCheck,
      
      parse: function(response, options) {
        return response.result;
      },
      
      fetch: function(options) {
        var collectionRef = this;
        var fetchOptions = {};
        if((typeof options != "undefined")) {
          fetchOptions = _.extend(options, {
              url: options.url,
              cache: false,
              contentType: false, //"multipart/form-data",
              processData: false,
              type: 'GET',
              //headers: { 'Access-Control-Allow-Origin': 'http://localhost:8081' },
              headers: {
                'Accept': 'application/json'
              },
              success: function (data, textStatus, xhr) {
                //collectionRef.run = data;
                console.log("textStatus: " + textStatus)
                collectionRef.trigger("fetchComplete");
              },
              error: function (data, response, options) {
                console.debug("quality report not found.");
                if(response.status == 404) {
                  collectionRef.fetchResponse = response;
                  collectionRef.trigger("fetchError");
                }
              }
            });
          fetchOptions = _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());
          return Backbone.Collection.prototype.fetch.call(collectionRef, fetchOptions);
        }
      },
      
      groupResults: function (results) {
        var groupedResults = _.groupBy(results, function (result) {
          var color;

          var check = result.get("check");
          var status = result.get("status");
          // simple cases
          // always blue for info and skip
          if (check.level == 'INFO') {
            color = 'BLUE';
            return color;
          }
          if (status == 'SKIP') {
            color = 'BLUE';
            return color;
          }
          // always green for success
          if (status == 'SUCCESS') {
            color = 'GREEN';
            return color;
          }

          // handle failures and warnings
          if (status == 'FAILURE') {
            color = 'RED';
            if (check.level == 'OPTIONAL') {
              color = 'ORANGE';
            }
          }
          if (status == 'ERROR') {
            color = 'ORANGE';
            if (check.level == 'REQUIRED') {
              color = 'RED';
            }
          }
          return color;
        });

        // make sure we have everything, even if empty
        if (!groupedResults.BLUE) {
          groupedResults.BLUE = [];
        }
        if (!groupedResults.GREEN) {
          groupedResults.GREEN = [];
        }
        if (!groupedResults.ORANGE) {
          groupedResults.ORANGE = [];
        }
        if (!groupedResults.RED) {
          groupedResults.RED = [];
        }

        //if (groupedResults.BLUE) {
        //  total = total - groupedResults.BLUE.length;
        //}

        return groupedResults;
      },

      groupByType: function (results) {
        var groupedResults = _.groupBy(results, function (result) {
            
          var check = result.get("check");
          var status = result.get("status");

          if (status == "ERROR" || status == "SKIP") {
            // orange or blue
            return "removeMe";
          }
          if (status == "FAILURE" && check.level == "OPTIONAL") {
            // orange
            return "removeMe";
          }

          return check.type || "uncategorized";
        });

        // get rid of the ones that should not be counted in our totals
        delete groupedResults["removeMe"];

        return groupedResults;
      }
  });
  return QualityReport;
});