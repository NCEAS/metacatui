var theme = theme || "default";
var themeTitle = "DataONE Data Catalog"; 
var themeMap = 
{
	'*': {
		// example overrides are provided here
		//'views/AboutView' : 'themes/' + theme + '/views/AboutView.js',
		'templates/app.html' : 'themes/' + theme + '/templates/app.html',
		'templates/navbar.html' : 'themes/' + theme + '/templates/navbar.html',
		'templates/footer.html' : 'themes/' + theme + '/templates/footer.html',
		'templates/about.html' : 'themes/' + theme + '/templates/about.html',
		'templates/alert.html' : 'themes/' + theme + '/templates/alert.html',
		'templates/resultsItem.html' : 'themes/' + theme + '/templates/resultsItem.html',
		'templates/profile.html' : 'themes/' + theme + '/templates/profile.html',
		'templates/search.html' : 'themes/' + theme + '/templates/search.html',
		'models/AppModel' : 'js/themes/' + theme + '/models/AppModel.js',
		'models/Map' : 'js/themes/' + theme + '/models/Map.js',
		'models/Stats' : 'js/themes/' + theme + '/models/Stats.js',
		'models/Search' : 'js/themes/' + theme + '/models/Search.js',
		'routers/router' : 'js/themes/' + theme + '/routers/router.js'
		}
};
