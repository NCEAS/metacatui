MetacatUI.theme = MetacatUI.theme || "default";
MetacatUI.themeTitle = "DataONE Data Catalog"; 
MetacatUI.themeMap =
{
	'*': {
		// example overrides are provided here
		'templates/app.html' : 'themes/' + MetacatUI.theme + '/templates/app.html',
		'templates/navbar.html' : 'themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/footer.html' : 'themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/about.html' : 'themes/' + MetacatUI.theme + '/templates/about.html',
		'templates/alert.html' : 'themes/' + MetacatUI.theme + '/templates/alert.html',
		'templates/dataSource.html' : 'themes/' + MetacatUI.theme + '/templates/dataSource.html',
		'templates/login.html' : 'themes/' + MetacatUI.theme + '/templates/login.html',
		'templates/resultsItem.html' : 'themes/' + MetacatUI.theme + '/templates/resultsItem.html',
		'templates/noResults.html' : 'themes/' + MetacatUI.theme + '/templates/noResults.html',
		'models/AppModel' : 'js/themes/' + MetacatUI.theme + '/models/AppModel.js',
		'models/Search' : 'js/themes/' + MetacatUI.theme + '/models/Search.js',
		'routers/router' : 'js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};

MetacatUI.customAppConfig = function(){

}