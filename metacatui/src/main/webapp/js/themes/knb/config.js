var theme = theme || "knb";
var themeMap = 
{
	'*': {
		// Template overrides are provided here
		
		// Resources (js) omit extension
		//'models/AboutModel' : 'themes/' + theme + '/models/AboutModel',
		//'views/AboutView' : 'themes/' + theme + '/views/AboutView',
		'routers/router' : 'themes/' + theme + '/routers/router',
		
		// Templates include extension
		'templates/appHead.html' : 'themes/' + theme + '/templates/appHead.html',
		'templates/navbar.html' : 'themes/' + theme + '/templates/navbar.html',
		'templates/footer.html' : 'themes/' + theme + '/templates/footer.html'
		}
};