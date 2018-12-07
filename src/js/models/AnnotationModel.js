/*global define */
define(['jquery', 'underscore', 'backbone'],
	function($, _, Backbone) {
	'use strict';

	// Annotation Model
	// ------------------
	var Annotation = Backbone.Model.extend({
		defaults: {

		},
				
		initialize: function(options){
			this.getCreatorName();
			this.on("change:user", this.getCreatorName);
		},

		bioportalGetConcepts: function(uri) {
			var model = this;
			MetacatUI.appLookupModel.bioportalGetConcepts(uri, function(concepts){
				model.set("concept", concepts[0]);
			});
		},

		orcidGetConcepts: function(uri) {
			var model = this;
			MetacatUI.appLookupModel.orcidGetConcepts(uri, function(concepts){
				model.set("concept", concepts[0]);
			});
		},

		getCreatorName: function(onSuccess, onError){
			var username = this.get("user");

			if(!username)
				return false;

			var model = this;

			var requestSettings = {
				url: MetacatUI.appModel.get("accountsUrl") + encodeURIComponent(username),
				type: "GET",
				success: function(data, textStatus, xhr){
					var lastName = $(data).find("person").first().find("familyName").text(),
						firstName = $(data).find("person").first().find("givenName").text();

					model.set("name", firstName + " " + lastName);

					if(typeof onSuccess == "function") onSuccess(data, textStatus, xhr);
				},
				error: function(xhr, textStatus, errorThrown){
					if(typeof onError == "function") onError(xhr, textStatus, errorThrown);
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()))
		}
	});

	return Annotation;
});
