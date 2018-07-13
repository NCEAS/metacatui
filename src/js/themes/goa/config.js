MetacatUI.theme = MetacatUI.theme || "goa";
MetacatUI.themeTitle = "Gulf of Alaska Data Portal";
MetacatUI.themeMap = 
{
	'*': {
		// example overrides are provided here
		//'views/AboutView' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/views/AboutView.js',
		'templates/app.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/app.html',
		'templates/navbar.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/footer.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/search.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/search.html',
		'templates/defaultHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/defaultHeader.html',
		'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router'
		//'templates/resultsItem.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/resultsItem.html'
		}
};