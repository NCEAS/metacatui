/*global define */
define(["backbone"], function (Backbone) {
  "use strict";

  return Backbone.View.extend(
    /**
     * @class SorterView
     * @classdesc A view that displays a sort controller and sets the sort order on the attached {@link SolrResults} collection.
     * @name SorterView
     * @extends Backbone.View
     * @constructor
     * @since 2.X
     * @classcategory Views/Search
     */ {
      /**
       * A reference to the {@link SolrResults} collection that this sorter displays and controls.
       * @type {SolrResults}
       */
      searchResults: null,

      /**
       * A list of sort order options to display in this view.
       * @typedef {Object} SearchSortOptions
       * @property {string} value The sort value that will be sent directly to the search index in the query string.
       * @property {string} label The name of the sort option that will be shown to the user.
       * @since 2.X
       */
      sortOptions: [
        { value: "dateUploaded+desc", label: "Most recent" },
        { value: "id+asc", label: "Identifier (a-z)" },
        { value: "titlestr+asc", label: "Title (a-z)" },
        { value: "authorSurNameSort+asc", label: "Author (a-z)" },
      ],

      tagName: "div",
      className: "sorter-view",

      events: {
        change: "setSort",
      },

      /**
       * Renders the view
       */
      render: function () {
        let select = document.createElement("select");
        select.setAttribute("id", "sortOrder");

        for (let opt of this.sortOptions) {
          select.insertAdjacentHTML(
            "beforeend",
            `<option value="${opt.value}">${opt.label}</option>`
          );
        }

        this.el.replaceChildren(select);
      },

      /**
       * Sets the sort order on the {@link SolrResults} when the sort is changed in the UI.
       * @param {Event} e
       */
      setSort: function (e) {
        this.searchResults.setSort(e.target.value);
      },
    }
  );
});
