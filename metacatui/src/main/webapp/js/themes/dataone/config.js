var theme = theme || "default";
var themeMap = 
{
	'*': {
		// example overrides are provided here
		//'views/AboutView' : 'themes/' + theme + '/views/AboutView.js',
		'templates/navbar.html' : 'themes/' + theme + '/templates/navbar.html',
		'templates/footer.html' : 'themes/' + theme + '/templates/footer.html',
		'templates/about.html' : 'themes/' + theme + '/templates/about.html',
		'templates/alert.html' : 'themes/' + theme + '/templates/alert.html',
		'templates/resultsItem.html' : 'themes/' + theme + '/templates/resultsItem.html',
		'templates/profile.html' : 'themes/' + theme + '/templates/profile.html',
		'models/AppModel' : 'js/themes/' + theme + '/models/AppModel.js',
		'models/Stats' : 'js/themes/' + theme + '/models/Stats.js',
		'models/Search' : 'js/themes/' + theme + '/models/Search.js',
		'views/DataCatalogView' : 'js/themes/' + theme + '/views/DataCatalogView.js',
		'views/StatsView' : 'js/themes/' + theme + '/views/StatsView.js',
		'routers/router' : 'js/themes/' + theme + '/routers/router.js'
		}
};