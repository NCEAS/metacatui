/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// User Model
	// ------------------
	var UserModel = Backbone.Model.extend({
		defaults: {
			lastName: null,
			firstName: null,
			verified: null,
			username: null,
			completeFlag: false
		},
		
		initialize: function(){
			this.set("username", appModel.get("profileUsername"));
		},
		
		getInfo: function(){
			var model = this;
			
			//Get the user info using the DataONE API
			var url = appModel.get("accountsUrl") + encodeURIComponent(this.get("username"));
			
			$.get(url, function(data, textStatus, xhr){				
				model.set("verified", $(data).find("person verified").text());
				model.set("firstName", $(data).find("person givenName").text());
				model.set("lastName", $(data).find("person familyName").text());
			});
		}
	});
	
	return UserModel;
});
		