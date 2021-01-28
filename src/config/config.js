/*
* The MetacatUI configuration!
* See the documentation for the AppConfig namespace to see all config options:
* Configuration overview: https://nceas.github.io/metacatui/install/#for-metacatui-v2120-and-later
* Full list of AppConfig options: https://nceas.github.io/metacatui/docs/AppConfig.html
*/
MetacatUI.AppConfig = {
  //The path to the root location of MetacatUI, i.e. where index.html is
  root: "/",
  //Turn off the map features for now
  mapKey: "",
  //Turn off the Google Analytics
  googleAnalyticsKey: "",
  //Use the test.arcticdata.io repository, for development. DO NOT develop against the production arcticdata.io repository.
  baseUrl: "https://test.arcticdata.io",
  d1CNBaseUrl: "https://cn-stage.test.dataone.org/",
  mdqBaseUrl: "https://api.test.dataone.org:30443/quality",
  dataoneSearchUrl: "https://search-stage.test.dataone.org",
  //Allow 1000 portals to be created (instead of only ~5)
  portalLimit: 1000,
  //Use the Arctic theme
  theme: "arctic",
}
