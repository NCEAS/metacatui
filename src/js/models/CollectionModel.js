/* global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {

	var CollectionModel = Backbone.Model.extend({

		defaults: {
      id: null,
      name: null,
      label: null,
      synopsis: null,
			definition: null,
			optionalFilterGroups: null,
		},

    nodeNameMap: function(){
      return {
        "optionalfiltergroups" : "optionalFilterGroups",
      }
    },

		initialize: function(options){
      this.setURL();
		},

    setURL: function(){
			this.set("url", MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id")));
		},

    fetch: function(){
      var model = this;
      var requestSettings = {
        url: model.get("url"),
        dataType: "json"
      }

      //Add the authorization header and other AJAX settings
      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    },

		parse: function(response){

    }
	});

	return CollectionModel;
});
