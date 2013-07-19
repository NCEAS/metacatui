/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/AboutView'], 				
function ($, _, Backbone, IndexView, AboutView) {

  var app = app || {};
	var indexView = new IndexView();
	var aboutView = new AboutView();
	
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
			appView.showView(indexView);
		},
		
		renderAbout: function (param) {
			console.log('Called UIRouter.renderAbout()');
			appView.showView(aboutView);
			
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