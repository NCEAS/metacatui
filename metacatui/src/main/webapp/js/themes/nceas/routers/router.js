/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/TextView', 'views/RegistryView', 'views/MetadataView', 'views/ExternalView', 'views/LdapView'], 				
function ($, _, Backbone, IndexView, TextView, RegistryView, MetadataView, ExternalView, LdapView) {
		
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'navigateToDefault',    // the default route
			'view/*pid'                 : 'renderMetadata', // metadata page
			'logout'                    : 'logout',    		// logout the user
			'signup'          			: 'renderLdap',     // use ldapweb for registration
			'external(/*url)'           : 'renderExternal', // renders the content of the given url in our UI
			'account(/:stage)'          : 'renderLdap',     // use ldapweb for different stages
			'share(/:stage/*pid)'       : 'renderRegistry'  // registry page
		},
		
		initialize: function(){
			this.listenTo(Backbone.history, "routeNotFound", this.navigateToDefault);
			
			appView.indexView = new IndexView();
			appView.textView = new TextView();
			appView.registryView = new RegistryView();
			appView.metadataView = new MetadataView();
			appView.externalView = new ExternalView();
			appView.ldapView = new LdapView();
		},
		
		routeHistory: new Array(),
		
		// Will return the last route, which is actually the second to last item in the route history, 
		// since the last item is the route being currently viewed
		lastRoute: function(){
			if((typeof this.routeHistory === "undefined") || (this.routeHistory.length <= 1))
				return false;
			else
				return this.routeHistory[this.routeHistory.length-2];
		},

		renderIndex: function (param) {
			this.routeHistory.push("index");
			appView.showView(appView.indexView);
		},
		
		renderMetadata: function (pid) {
			this.routeHistory.push("metadata");
			appModel.set('lastPid', appModel.get("pid"));
			appModel.set('pid', pid);
			appView.metadataView.pid = pid;
			appView.showView(appView.metadataView);
		},
		
		renderRegistry: function (stage, pid) {
			this.routeHistory.push("registry");
			appView.registryView.stage = stage;
			appView.registryView.pid = pid;
			appView.showView(appView.registryView);
		},
		
		renderLdap: function (stage) {
			this.routeHistory.push("ldap");
			appView.ldapView.stage = stage;
			appView.showView(appView.ldapView);
		},
		
		logout: function (param) {
			//Clear our browsing history when we log out
			this.routeHistory.length = 0;
			appUserModel.logout();
		},
		
		renderExternal: function(url) {
			// use this for rendering "external" content pulled in dynamically
			this.routeHistory.push("external");
			appView.externalView.url = url;
			appView.showView(appView.externalView);
		},
		
		navigateToDefault: function(){
			//Navigate to the default view
			this.navigate(appModel.defaultView, {trigger: true});
		},
		
		closeLastView: function(){
			//Get the last route and close the view
			var lastRoute = _.last(this.routeHistory);
		}
		
	});

	return UIRouter;
});