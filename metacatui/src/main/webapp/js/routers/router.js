/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/AppView'], 				
function ($, _, Backbone, AppView) {

	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''      : 'renderIndex',  // the default route
			'*about': 'renderAbout',  // about page
			'*plans': 'renderPlans',  // plans page
			'*tools': 'renderTools'   // tools page

		},

		renderIndex: function (param) {
			console.log('Called UIRouter.renderIndex()');
			this.appView = new AppView();
			this.appView.render();
		},
		
		renderAbout: function (param) {
			console.log('Called UIRouter.renderAbout()');
		},
		
		renderPlans: function (param) {
			console.log('Called UIRouter.renderPlans()');
		},
		
		renderTools: function (param) {
			console.log('Called UIRouter.renderTools()');
		}
	});

	return UIRouter;
});