/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

	var DateFilter = Filter.extend({

    type: "DateFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        min: 0,
        max: (new Date()).getUTCFullYear()
      });
    },

    /*
    * Parses the dateFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the DateFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      var modelJSON = Filter.prototype.parse(xml);

      //Find the min XML node
      var minNode = $(xml).find("min");

      //If a min XML node is found
      if(minNode.length){
        //Parse the text content of the node into a float
        modelJSON.min = (new Date(minNode[0].textContent)).getUTCFullYear();

        //Find the max XML node
        var maxNode = $(xml).find("max");

        //If a max XML node is found
        if(maxNode.length){
          //Parse the text content of the node into a float
          modelJSON.max = (new Date(maxNode[0].textContent)).getUTCFullYear();
        }
      }

      return modelJSON;
    }

  });

  return DateFilter;
});
