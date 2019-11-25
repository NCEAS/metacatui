MetacatUI.theme = MetacatUI.theme || "knb";
MetacatUI.themeTitle = "KNB";
MetacatUI.themeMap =
{
    '*': {
        // Template overrides are provided here

        // Resources (js) omit extension in keys
        'views/BaseTextView' : MetacatUI.root + '/js/views/TextView.js',
        'views/TextView' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/views/TextView.js',
        'routers/BaseRouter' : MetacatUI.root + '/js/routers/router.js',
        'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js',
        'models/AppModel' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/AppModel.js',

        // Templates include extension
        'templates/app.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/app.html',
        'templates/navbar.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/navbar.html',
        'templates/featuredData.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/featuredData.html',
        'templates/footer.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/footer.html',
        'templates/mainContent.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/mainContent.html',
        'templates/metadataControls.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/metadataControls.html',
        'templates/altHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/altHeader.html',
        'templates/defaultHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/defaultHeader.html',
        'templates/tools.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/tools.html',
        'templates/about.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/about.html',
        'templates/preservation.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/preservation.html'
    }
};

MetacatUI.customAppConfig = function(){
    //Only apply these settings when we are in production
    if(!MetacatUI.appModel || (MetacatUI.appModel.get("baseUrl").indexOf("knb.ecoinformatics.org") < 0)) return;

    //Gmaps key  AIzaSyA6-jiEs5rmEqKk70bigvnwuvhdZbt4tJs

    MetacatUI.appModel.set("nodeId", "urn:node:KNB");
    MetacatUI.appModel.set("googleAnalyticsKey", "UA-1588494-14");
}
