MetacatUI.theme = MetacatUI.theme || "default";
MetacatUI.themeTitle = "NCEAS Data Catalog";
MetacatUI.themeMap = 
{
	'*': {
		// example overrides are provided here
		//'views/AboutView' : MetacatUI.root + '/themes/' + MetacatUI.theme + '/views/AboutView.js',
		'templates/navbar.html' 	 	: MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/footer.html' 	 	: MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/loginHeader.html' 	: MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/loginHeader.html',
		'templates/registryFields.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/registryFields.html',
		'models/AppModel'	     	    : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/AppModel.js',
		'models/RegistryModel'	     	: MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/RegistryModel.js',
		'routers/router' 			 	: MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};