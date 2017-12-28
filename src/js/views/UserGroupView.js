/*global define */
define(['jquery', 'underscore', 'backbone', 'views/UserView'], 				
	function($, _, Backbone, UserView) {
	'use strict';
	
	var UserGroupView = UserView.extend({
		initialize: function(options){
			if((typeof options == "undefined"))
				var options = {};
			
			UserView.prototype.initialize.apply(this, [options]);			
		},
		
		render: function(){
			console.log("hi");
			UserView.prototype.renderProfile.call(this);
		}
	});
	
	return UserGroupView;
});