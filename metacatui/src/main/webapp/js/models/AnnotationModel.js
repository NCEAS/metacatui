/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Annotation Model
	// ------------------
	var Annotation = Backbone.Model.extend({
		defaults: {
			
		},
		
		//url: appModel.get(""),
		
		initialize: function(options){
			this.getCreatorName();
			this.on("change:user", this.getCreatorName);
		},
		
		bioportalGetConcepts: function(uri) {
			var model = this;
			appLookupModel.bioportalGetConcepts(uri, function(concepts){
				model.set("concept", concepts[0]);
			});						
		},
		
		orcidGetConcepts: function(uri) {
			var model = this;
			appLookupModel.orcidGetConcepts(uri, function(concepts){
				model.set("concept", concepts[0]);
			});
		},
		
		getCreatorName: function(onSuccess, onError){
			var username = this.get("user");
			
			if(!username)
				return false;
			
			var model = this;
			
			var requestSettings = {
				url: appModel.get("accountsUrl") + encodeURIComponent(username),
				type: "GET",
				success: function(data, textStatus, xhr){
					var lastName = $(data).find("person").find("familyName").text(),
						firstName = $(data).find("person").find("givenName").text();
					
					model.set("name", firstName + " " + lastName);
					
					if(typeof onSuccess == "function") onSuccess(data, textStatus, xhr);
				},
				error: function(xhr, textStatus, errorThrown){
					if(typeof onError == "function") onError(xhr, textStatus, errorThrown);
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()))
		}
	});
	
	return Annotation;
});