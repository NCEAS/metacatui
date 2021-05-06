define([
  "collections/Filters",
  "models/Search",
  "models/Filter",
  "views/DataCatalogViewWithFilters"], function(
    Filters,
    Search,
    Filter,
    DataCatalogView){

  var PortalsSearchView = Backbone.View.extend({

    render: function(){

      var filters = new Filters();

      // Filter datasets that the user has ownership of
      if ( MetacatUI.appUserModel.get("loggedIn") ) {
        filters.addWritePermissionFilter();
      }

      //Filter by the portal format ID
      filters.add({
        fields: ["formatId"],
        values: ["dataone.org/portals"],
        matchSubstring: true,
        exclude: false
      });

      var searchModel = new Search();
      searchModel.set("filters", filters);

      //Create a DataCatalogView
      var dataCatalogView = new DataCatalogView({
        mode: "list",
        searchModel: searchModel,
      //  searchResults: searchResults,
      //  mapModel: this.model.get("mapModel"),
        isSubView: true,
        filters: false,
        fixedHeight: false,
    //    filterGroupsView: filterGroupsView
      });

      this.$el.append(dataCatalogView.el);
      this.$el.data("view", this);

      dataCatalogView.render();
    }

  });

  return PortalsSearchView;

});
