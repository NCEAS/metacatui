/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/AboutView', 'views/ToolsView', 'views/DataCatalogView', 'views/RegistryView', 'views/MetadataView', 'views/ExternalView', 'views/LdapView'], 				
function ($, _, Backbone, IndexView, AboutView, ToolsView, DataCatalogView, RegistryView, MetadataView, ExternalView, LdapView) {

	var indexView = new IndexView();
	var aboutView = aboutView || new AboutView();
	var toolsView = toolsView || new ToolsView();
	var dataCatalogView = new DataCatalogView();
	var registryView = new RegistryView();
	var metadataView = new MetadataView();
	var externalView = new ExternalView();
	var ldapView = new LdapView();

	
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'renderIndex', // the default route
			'about'                     : 'renderAbout',  // about page
			'about(/:anchorId)'         : 'renderAbout',  // about page anchors
			'plans'                     : 'renderPlans',  // plans page
			'tools(/:anchorId)'         : 'renderTools',  // tools page
			'data(/page/:page)'			: 'renderData',    // data search page
			'view/*pid'                 : 'renderMetadata',    // metadata page
			'external(/*url)'           : 'renderExternal',    // renders the content of the given url in our UI
			'logout'                    : 'logout',    // logout the user
			'signup'          			: 'renderLdap',    // use ldapweb for registration
			'account(/:stage)'          : 'renderLdap',    // use ldapweb for different stages
			'share'                     : 'renderRegistry'    // registry page
		},

		renderIndex: function (param) {
			console.log('Called UIRouter.renderIndex()');
			appView.showView(indexView);
		},
		
		renderAbout: function (anchorId) {
			console.log('Called UIRouter.renderAbout()');
			appModel.set('anchorId', anchorId);
			appView.showView(aboutView);
		},
		
		renderPlans: function (param) {
			console.log('Called UIRouter.renderPlans()');
		},
		
		renderTools: function (anchorId) {
			console.log('Called UIRouter.renderTools()');
			appModel.set('anchorId', anchorId);
			appView.showView(toolsView);
		},
		
		renderData: function (page) {
			console.log('Called UIRouter.renderData()');
			appModel.set('page', page);
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
		
		renderLdap: function (stage) {
			console.log('Called UIRouter.renderLdap()');
			ldapView.stage = stage;
			appView.showView(ldapView);
		},
		
		logout: function (param) {
			console.log('Called UIRouter.logout()');
			registryView.logout();
			//appView.showView(indexView);
		},
		
		renderExternal: function(url) {
			// use this for rendering "external" content pulled in dynamically
			console.log('Called UIRouter.renderExternal()');
			externalView.url = url;
			appView.showView(externalView);
		}
		
	});

	return UIRouter;
});