var theme = theme || "default";
var themeMap = 
{
	'*': {
		// example overrides are provided here
		//'views/AboutView' : 'themes/' + theme + '/views/AboutView.js',
		'templates/navbar.html' 	 : 'themes/' + theme + '/templates/navbar.html',
		'templates/app.html' 		 : 'themes/' + theme + '/templates/app.html',
		'templates/footer.html' 	 : 'themes/' + theme + '/templates/footer.html',
		'templates/loginHeader.html' : 'themes/' + theme + '/templates/loginHeader.html',
		'routers/router' 			 : 'js/themes/' + theme + '/routers/router.js'
		}
};