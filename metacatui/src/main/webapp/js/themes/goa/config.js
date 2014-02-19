var theme = theme || "goa";
var themeMap = 
{
	'*': {
		// example overrides are provided here
		//'views/AboutView' : 'themes/' + theme + '/views/AboutView.js',
		'templates/app.html' : 'themes/' + theme + '/templates/app.html',
		'templates/navbar.html' : 'themes/' + theme + '/templates/navbar.html',
		'templates/footer.html' : 'themes/' + theme + '/templates/footer.html',
		'templates/search.html' : 'themes/' + theme + '/templates/search.html',
		'templates/defaultHeader.html' : 'themes/' + theme + '/templates/defaultHeader.html',
		'templates/alert.html' : 'themes/' + theme + '/templates/alert.html',
		'routers/router' : 'themes/' + theme + '/routers/router',
		'templates/appHead.html' : 'themes/' + theme + '/templates/appHead.html'
		}
};