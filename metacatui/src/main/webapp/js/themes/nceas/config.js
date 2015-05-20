var theme = theme || "default";
var themeTitle = "NCEAS Data Catalog";
var themeMap = 
{
	'*': {
		// example overrides are provided here
		//'views/AboutView' : 'themes/' + theme + '/views/AboutView.js',
		'templates/navbar.html' 	 	: 'themes/' + theme + '/templates/navbar.html',
		'templates/app.html' 		 	: 'themes/' + theme + '/templates/app.html',
		'templates/footer.html' 	 	: 'themes/' + theme + '/templates/footer.html',
		'templates/loginHeader.html' 	: 'themes/' + theme + '/templates/loginHeader.html',
		'templates/registryFields.html' : 'themes/' + theme + '/templates/registryFields.html',
		'models/AppModel'	     	    : 'js/themes/' + theme + '/models/AppModel.js',
		'models/RegistryModel'	     	: 'js/themes/' + theme + '/models/RegistryModel.js',
		'routers/router' 			 	: 'js/themes/' + theme + '/routers/router.js'
		}
};