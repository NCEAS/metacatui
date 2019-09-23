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
  baseUrl: MetacatUI.root + '/js/',
  waitSeconds: 180, //wait 3 minutes before throwing a timeout error
  map: MetacatUI.themeMap,
  urlArgs: "v=" + MetacatUI.metacatUIVersion,
  paths: {
    jquery: MetacatUI.root + '/components/jquery-1.9.1.min',
    jqueryui: MetacatUI.root + '/components/jquery-ui.min',
    jqueryform: MetacatUI.root + '/components/jquery.form',
    underscore: MetacatUI.root + '/components/underscore-min',
    backbone: MetacatUI.root + '/components/backbone-min',
    bootstrap: MetacatUI.root + '/components/bootstrap.min',
    text: MetacatUI.root + '/components/require-text',
    jws: MetacatUI.root + '/components/jws-3.2.min',
    jsrasign: MetacatUI.root + '/components/jsrsasign-4.9.0.min',
    async: MetacatUI.root + '/components/async',
    recaptcha: [MetacatUI.recaptchaURL, 'scripts/placeholder'],
	nGeohash: MetacatUI.root + '/components/geohash/main',
	fancybox: MetacatUI.root + '/components/fancybox/jquery.fancybox.pack', //v. 2.1.5
    annotator: MetacatUI.root + '/components/annotator/v1.2.10/annotator-full',
    bioportal: MetacatUI.root + '/components/bioportal/jquery.ncbo.tree-2.0.2',
    clipboard: MetacatUI.root + '/components/clipboard.min',
    uuid: MetacatUI.root + '/components/uuid',
    md5: MetacatUI.root + '/components/md5',
    rdflib: MetacatUI.root + '/components/rdflib.min',
    x2js: MetacatUI.root + '/components/xml2json',
    he: MetacatUI.root + '/components/he',
    citation: MetacatUI.root + '/components/citation.min',
	// showdown + extensions (used in the markdownView to convert markdown to html)
	showdown: MetacatUI.root + '/components/showdown/showdown.min',
	showdownHighlight: MetacatUI.root + '/components/showdown/extensions/showdown-highlight/showdown-highlight',
	highlight: MetacatUI.root + '/components/showdown/extensions/showdown-highlight/highlight.pack',
	showdownFootnotes: MetacatUI.root + '/components/showdown/extensions/showdown-footnotes',
	showdownBootstrap: MetacatUI.root + '/components/showdown/extensions/showdown-bootstrap',
	showdownDocbook: MetacatUI.root + '/components/showdown/extensions/showdown-docbook',
	showdownKatex: MetacatUI.root + '/components/showdown/extensions/showdown-katex/showdown-katex.min',
	showdownCitation:  MetacatUI.root + '/components/showdown/extensions/showdown-citation/showdown-citation',
	showdownImages:  MetacatUI.root + '/components/showdown/extensions/showdown-images',
	showdownXssFilter: MetacatUI.root + '/components/showdown/extensions/showdown-xss-filter/showdown-xss-filter',
	xss: MetacatUI.root + '/components/showdown/extensions/showdown-xss-filter/xss.min',
	showdownHtags: MetacatUI.root + '/components/showdown/extensions/showdown-htags',
	// drop zone creates drag and drop areas
	dropZone: MetacatUI.root + '/components/dropzone-amd-module',
	//Have a null fallback for our d3 components for browsers that don't support SVG
	d3: MetacatUI.d3URL,
	LineChart: ['views/LineChartView', null],
	BarChart: ['views/BarChartView', null],
	CircleBadge: ['views/CircleBadgeView', null],
	DonutChart: ['views/DonutChartView', null],
	MetricsChart: ['views/MetricsChartView', null],
  },
  shim: { /* used for libraries without native AMD support */
    underscore: {
      exports: '_',
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
    },
	xss: {
		exports: 'filterXSS'
	},
	citation: {
		exports: 'citationRequire'
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
	require(['underscore', 'backbone', 'routers/router', 'collections/SolrResults', 'models/Search',
             'models/Stats', 'models/Map', 'models/LookupModel', 'models/NodeModel',
             'models/UserModel', 'models/DataONEObject', 'collections/DataPackage'
	         ],
	function(_, Backbone, UIRouter, SolrResultList, Search, Stats, MapModel, LookupModel, NodeModel, UserModel, DataONEObject, DataPackage) {
		'use strict';

		//Create all the other models and collections first
		MetacatUI.appSearchResults = new SolrResultList([], {});

		MetacatUI.appSearchModel = new Search();

		MetacatUI.statsModel = new Stats();

		MetacatUI.mapModel = (typeof customMapModelOptions == "object")? new MapModel(customMapModelOptions) : new MapModel();

		MetacatUI.appLookupModel = new LookupModel();

		MetacatUI.nodeModel = new NodeModel();

		MetacatUI.appUserModel = new UserModel();

        /* Create a general event dispatcher to enable
           communication across app components
        */
        MetacatUI.eventDispatcher = _.clone(Backbone.Events);

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

		//Take the protocol and origin out of the root URL when sending it to Backbone.history.
		// The root URL sent to Backbone.history should be either `/` or `/directory/...`
		var historyRoot = MetacatUI.root;

		//If there is a protocol
		if( historyRoot.indexOf("://") > -1 ){
			//Get the substring after the ``://``
			historyRoot = historyRoot.substring(historyRoot.indexOf("://") + 3);

			//If there is no `/`, this must be the root directory
			if( historyRoot.indexOf("/") == -1 )
				historyRoot = "/";
			//Otherwise get the substring after the first /
			else
				historyRoot = historyRoot.substring( historyRoot.indexOf("/") );
		}
		//If there are no colons, periods, or slashes, this is a directory name
		else if( historyRoot.indexOf(":") == -1 &&
						 historyRoot.indexOf(".") == -1 &&
						 historyRoot.indexOf("/") == -1 ){
			//So the root is a leading slash and the directory name
			historyRoot = "/" + historyRoot;
		}
		//If there is a slash, get the path name starting with the slash
		else if( historyRoot.indexOf("/") > -1 ){
			historyRoot = historyRoot.substring( historyRoot.indexOf("/") );
		}
		//All other strings are the root directory
		else{
			historyRoot = "/";
		}

		Backbone.history.start({
			pushState: true,
			root: historyRoot
		});

		$(document).on("click", "a:not([data-toggle])", function(evt) {
			// Don't hijack the event if the user had Control or Command held down
			if (evt.ctrlKey || evt.metaKey) {
				return;
			}

			var href = { prop: $(this).prop("href"), attr: $(this).attr("href") };

			// Stop if the click happened on an a w/o an href
			// This is kind of a weird edge case where. This could be removed if
			// we remove these instances from the codebase
			if (typeof href === "undefined" || typeof href.attr === "undefined" ||
					href.attr === "") {
				return;
			}

			//Don't route to URLs with the DataONE API, which are sometimes proxied
			// via Apache ProxyPass so start with the MetacatUI origin
			if( href.attr.indexOf("/cn/v2/") > 0 || href.attr.indexOf("/mn/v2/") > 0 ){
				return;
			}

			var root = location.protocol + "//" + location.host + Backbone.history.options.root;
			// Remove the MetacatUI (plus a trailing /) from the value in the 'href'
			// attribute of the clicked element so Backbone.history.navigate works.
			// Note that a RegExp was used here to anchor the .replace call to the
			// front of the string so that this code works when MetacatUI.root is "".
			var route = href.attr.replace(new RegExp("^" + MetacatUI.root + "/"), "");

			// Catch routes hrefs that start with # and don't do anything with them
			if (href.attr.indexOf("#") == 0) { return; }

			//If the URL is not a route defined in the app router, then follow the link
			//If the URL is not at the MetacatUI root, then follow the link
			if (href.prop && href.prop.slice(0, root.length) === root &&
					_.contains(MetacatUI.uiRouter.getRouteNames(), MetacatUI.uiRouter.getRouteName(route))) {
				evt.preventDefault();
				Backbone.history.navigate(route, true);
			}
		});
	});
});
