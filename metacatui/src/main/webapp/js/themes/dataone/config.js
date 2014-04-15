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
		'models/AppModel' : 'js/themes/' + theme + '/models/AppModel.js',
		'views/DataCatalogView' : 'js/themes/' + theme + '/views/DataCatalogView.js',
		'routers/router' : 'js/themes/' + theme + '/routers/router.js'
		}
};