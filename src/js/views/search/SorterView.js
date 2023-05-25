/*global define */
define(["backbone"], function (Backbone) {
  "use strict";
  /**
   * @class SorterView
   * @classdesc A view that displays a sort controller and sets the sort order
   * on the attached {@link SolrResults} collection.
   * @name SorterView
   * @extends Backbone.View
   * @constructor
   * @since 2.22.0
   * @classcategory Views/Search
   * @screenshot views/search/SorterView.png
   */
  return Backbone.View.extend(
    /**
     * @lends SorterView.prototype
     */ {
      /**
       * A reference to the {@link SolrResults} collection that this sorter
       * displays and controls.
       * @type {SolrResults}
       */
      searchResults: null,

      /**
       * A list of sort order options to display in this view.
       * @typedef {Object} SearchSortOptions
       * @property {string} value The sort value that will be sent directly to
       * the search index in the query string.
       * @property {string} label The name of the sort option that will be shown
       * to the user.
       * @since 2.22.0
       */
      sortOptions: [
        { value: "dateUploaded+desc", label: "Most recent" },
        { value: "id+asc", label: "Identifier (a-z)" },
        { value: "titlestr+asc", label: "Title (a-z)" },
        { value: "authorSurNameSort+asc", label: "Author (a-z)" },
      ],

      /**
       * The HTML tag to use for this view's element
       * @type {string}
       */
      tagName: "div",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "sorter-view",

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {Object}
       */
      events: {
        change: "setSort",
      },

      /**
       * Renders the view
       */
      render: function () {
        this.stopListening(this.searchResults, "error reset");
        this.listenTo(this.searchResults, "error reset", this.hideIfNoResults);

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
       * Hides the view if there are no search results.
       * @since x.x.x
       */
      hideIfNoResults: function () {
        if (
          !this.searchResults ||
          !this.searchResults.header ||
          !this.searchResults.getNumFound()
        ) {
          this.hide();
        } else {
          this.show();
          this.render();
        }
      },

      /**
       * Sets the sort order on the {@link SolrResults} when the sort is changed
       * in the UI.
       * @param {Event} e
       */
      setSort: function (e) {
        this.searchResults.setSort(e.target.value);
      },

      /**
       * Hides the view
       * @since x.x.x
       */
      hide: function () {
        this.el.style.visibility = "hidden";
      },

      /**
       * Shows the view
       * @since x.x.x
       */
      show: function () {
        this.el.style.visibility = "visible";
      },
    }
  );
});
