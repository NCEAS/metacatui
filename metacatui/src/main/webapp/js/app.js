/*global require */
/*jshint unused:false */
'use strict';

/** NOTE: The theme name and themeMap are specified in the loader.js file **/
var MetacatUI = MetacatUI || {};
MetacatUI.recaptchaURL = 'https://www.google.com/recaptcha/api/js/recaptcha_ajax';
if( MetacatUI.mapKey ){
	var gmapsURL = 'https://maps.googleapis.com/maps/api/js?v=3&key=' + MetacatUI.mapKey;
	define('gmaps', 
			['async!' + gmapsURL], 
			function() {
				return google.maps;
			});
            
} else {
	define('gmaps', null);
    
}
if ( MetacatUI.useD3 ) {
    MetacatUI.d3URL = '../components/d3.v3.min';
    
} else {
    MetacatUI.d3URL = null;
    
}

/* Configure the app to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively 
   support requirejs. */
require.config({
  baseUrl: 'js/',
  waitSeconds: 180, //wait 3 minutes before throwing a timeout error
  map: MetacatUI.themeMap,
  urlArgs: "v=" + MetacatUI.metacatUIVersion,
  paths: {
    jquery: 'https://code.jquery.com/jquery-1.9.1',//'../components/jquery',
    jqueryui: '../components/jquery-ui-1.10.3.custom.min',
    jqueryform: '../components/jquery.form',
    underscore: '../components/underscore-min',
    backbone: '../components/backbone-min',
    bootstrap: '../components/bootstrap.min',
    text: '../components/require-text',
    jws: '../components/jws-3.2.min',
    jsrasign: '../components/jsrsasign-4.9.0.min',    
    async: '../components/async',
    recaptcha: [MetacatUI.recaptchaURL, 'scripts/placeholder'],
	nGeohash: '../components/geohash/main',
	fancybox: '../components/fancybox/jquery.fancybox.pack', //v. 2.1.5
    annotator: '../components/annotator/v1.2.10/annotator-full',
    bioportal: '../components/bioportal/jquery.ncbo.tree-2.0.2',
    clipboard: '../components/clipboard.min',
    uuid: '../components/uuid',
    md5: '../components/md5',
    rdflib: '../components/rdflib.min',
    x2js: '../components/xml2json',
	//Have a null fallback for our d3 components for browsers that don't support SVG
	d3: MetacatUI.d3URL,
	LineChart: ['views/LineChartView', null],
	BarChart: ['views/BarChartView', null],
	CircleBadge: ['views/CircleBadgeView', null],
	DonutChart: ['views/DonutChartView', null]
  },
  shim: { /* used for libraries without native AMD support */
    underscore: {
      exports: '_'
    },
    backbone: {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    },
    bootstrap: { 
    	deps: ['jquery'],
    	exports: 'Bootstrap'
    },
    annotator: {
    	exports: 'Annotator'
    },
    bioportal: {
    	exports: 'Bioportal'
    },
    jws: {
    	exports: 'JWS',
        deps: ['jsrasign'],
    },
	nGeohash: {
		exports: "geohash"
	},
	fancybox: {
		deps: ['jquery']
	},
	uuid: {
        exports: 'uuid'
    },
    rdflib: {
        exports: 'rdf'
    }
  }
});

MetacatUI.appModel = MetacatUI.appModel || {};
MetacatUI.appView = MetacatUI.appView || {};
MetacatUI.uiRouter = MetacatUI.uiRouter || {};
MetacatUI.appSearchResults = MetacatUI.appSearchResults || {};
MetacatUI.appSearchModel = MetacatUI.appSearchModel || {};
MetacatUI.rootDataPackage = MetacatUI.rootDataPackage || {};
MetacatUI.statsModel = MetacatUI.statsModel || {};
MetacatUI.mapModel = MetacatUI.mapModel || {};
MetacatUI.appLookupModel = MetacatUI.appLookupModel || {};
MetacatUI.nodeModel = MetacatUI.nodeModel || {};
MetacatUI.appUserModel = MetacatUI.appUserModel || {};

/* Setup the application scaffolding first  */
require(['bootstrap', 'views/AppView', 'models/AppModel'],
function(Bootstrap, AppView, AppModel) {
	'use strict';  
    		
	// initialize the application
	MetacatUI.appModel = new AppModel({context: '/' + MetacatUI.metacatContext});
	
	//Check for custom settings in the theme config file
	if(typeof MetacatUI.customAppConfig == "function") MetacatUI.customAppConfig();
	
	/* Now require the rest of the libraries for the application */
	require(['backbone', 'routers/router', 'collections/SolrResults', 'models/Search', 
             'models/Stats', 'models/Map', 'models/LookupModel', 'models/NodeModel', 
             'models/UserModel', 'models/DataONEObject', 'collections/DataPackage'
	         ],
	function(Backbone, UIRouter, SolrResultList, Search, Stats, MapModel, LookupModel, NodeModel, UserModel, DataONEObject, DataPackage) {
		'use strict';  
	    		
		//Create all the other models and collections first
		MetacatUI.appSearchResults = new SolrResultList([], {});
		
		MetacatUI.appSearchModel = new Search();
				
		MetacatUI.statsModel = new Stats();
		
		MetacatUI.mapModel = (typeof customMapModelOptions == "object")? new MapModel(customMapModelOptions) : new MapModel();
		
		MetacatUI.appLookupModel = new LookupModel();
		
		MetacatUI.nodeModel = new NodeModel();
		
		MetacatUI.appUserModel = new UserModel();
		
		//Load the App View now
		MetacatUI.appView = new AppView();
			
		// Initialize routing and start Backbone.history()
		(function() {
		  /**
		   * Backbone.routeNotFound
		   *
		   * Simple plugin that listens for false returns on Backbone.history.loadURL and fires an event
		   * to let the application know that no routes matched.
		   *
		   * @author STRML
		   */
		  var oldLoadUrl = Backbone.History.prototype.loadUrl;

		  _.extend(Backbone.History.prototype, {

		    /**
		     * Override loadUrl & watch return value. Trigger event if no route was matched.
		     * @return {Boolean} True if a route was matched
		     */
		    loadUrl : function(fragment) {
		    	if (!this.matchRoot()) return false;
		        fragment = this.fragment = this.getFragment(fragment);
		       var match = _.some(this.handlers, function(handler) {
		          if (handler.route.test(fragment)) {
		            handler.callback(fragment);
		            return true;
		          }
		        });
		       
		       if(!match) this.trigger("routeNotFound");
		       return match;
		    },
		    matchRoot: function() {
		        var path = this.decodeFragment(this.location.pathname);
		        var rootPath = path.slice(0, this.root.length - 1) + '/';
		        return rootPath === this.root;
		      },
		      decodeFragment: function(fragment) {
		          return decodeURI(fragment.replace(/%25/g, '%2525'));
		        }
		  });
		}).call(this);
		
		//Make the router and begin the Backbone history
		//The router will figure out which view to load first based on window location
		MetacatUI.uiRouter = new UIRouter();
		Backbone.history.start();
	  
	});
    	
});



