MetacatUI.theme = MetacatUI.theme || "default";
MetacatUI.themeTitle = "NCEAS Data Catalog";
MetacatUI.themeMap = 
{
	'*': {
		// example overrides are provided here
		//'views/AboutView' : 'themes/' + MetacatUI.theme + '/views/AboutView.js',
		'templates/navbar.html' 	 	: 'themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/footer.html' 	 	: 'themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/loginHeader.html' 	: 'themes/' + MetacatUI.theme + '/templates/loginHeader.html',
		'templates/registryFields.html' : 'themes/' + MetacatUI.theme + '/templates/registryFields.html',
		'models/AppModel'	     	    : 'js/themes/' + MetacatUI.theme + '/models/AppModel.js',
		'models/RegistryModel'	     	: 'js/themes/' + MetacatUI.theme + '/models/RegistryModel.js',
		'routers/router' 			 	: 'js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};