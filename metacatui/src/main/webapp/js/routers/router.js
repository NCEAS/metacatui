/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/AboutView', 'views/DataCatalogView', 'views/RegistryView', 'views/MetadataView'], 				
function ($, _, Backbone, IndexView, AboutView, DataCatalogView, RegistryView, MetadataView) {

	var app = app || {};
	var indexView = new IndexView();
	var aboutView = new AboutView();
	var dataCatalogView = new DataCatalogView();
	var registryView = new RegistryView();
	var metadataView = new MetadataView();

	
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''      : 'renderIndex', // the default route
			'about': 'renderAbout',  // about page
			'plans': 'renderPlans',  // plans page
			'tools': 'renderTools',  // tools page
			'data(/search/:searchTerm)' : 'renderData',    // data search page
			'view/:pid' : 'renderMetadata',    // metadata page
			'logout' : 'logout',    // logout the user
			'share' : 'renderRegistry'    // registry page
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
		
		renderData: function (searchTerm) {
			console.log('Called UIRouter.renderData()');
			if (searchTerm) {
				appModel.set('searchTerm', searchTerm);
			}
			appView.showView(dataCatalogView);
		},
		
		renderMetadata: function (pid) {
			console.log('Called UIRouter.renderMetadata()');
			appModel.set('pid', pid);
			appView.showView(metadataView);
		},
		
		renderRegistry: function (param) {
			console.log('Called UIRouter.renderRegistry()');
			appView.showView(registryView);
		},
		
		logout: function (param) {
			console.log('Called UIRouter.logout()');
			registryView.logout();
			//appView.showView(indexView);
		}
		
	});

	return UIRouter;
});