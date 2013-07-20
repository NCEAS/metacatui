/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/AboutView', 'views/DataCatalogView'], 				
function ($, _, Backbone, IndexView, AboutView, DataCatalogView) {

  var app = app || {};
	var indexView = new IndexView();
	var aboutView = new AboutView();
	var dataCatalogView = new DataCatalogView();
	
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''      : 'renderIndex', // the default route
			'about': 'renderAbout',  // about page
			'plans': 'renderPlans',  // plans page
			'tools': 'renderTools',  // tools page
			'data' : 'renderData'    // data page
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
		},
		
		renderData: function (param) {
			console.log('Called UIRouter.renderData()');
			appView.showView(dataCatalogView);
		}
		
	});

	return UIRouter;
});