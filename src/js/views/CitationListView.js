/*global define */
define(['jquery', 'underscore', 'backbone', 'collections/Citations', 'views/CitationView'],
    function($, _, Backbone, Citations, CitationView) {
    'use strict';

    var CitationListView = Backbone.View.extend({

        id: 'table',
        className: 'table',
        citationsCollection: null,

        events: {

        },

        initialize: function(options) {
          if((typeof options == "undefined")){
              var options = {};
          }

          // Initializing the Citation collection
          this.citationsCollection = options.citations;
        },


        // retrun the DOM object to the calling view.
        render: function() {
          this.renderView();
          return this;
        },


        // The renderView funciton creates a Citation table and appends every
        // citation found in the citations collection object.
        renderView: function() {
            var self = this;
            
            this.$el.append($(document.createElement("table"))
                                        .addClass("table"));
                                        
            this.$el.append($(document.createElement("tbody")));

            this.citationsCollection.each(
                function(model) {
                    var citationView = new CitationView({model:model});
                    self.$el.append($(document.createElement("tr"))).append(citationView.render().$el);
                }
            );
        }
    });
     
     return CitationListView;
  });