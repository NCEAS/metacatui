MetacatUI.theme = MetacatUI.theme || "default";
MetacatUI.themeTitle = "DataONE Data Catalog";
MetacatUI.themeMap =
{
	'*': {
		// example overrides are provided here
		'templates/navbar.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/footer.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/about.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/about.html',
		'templates/dataSource.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/dataSource.html',
		'templates/login.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/login.html',
		'templates/noResults.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/noResults.html',
		'models/AppModel' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/AppModel.js',
		'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};

MetacatUI.customAppConfig = function(){

}
