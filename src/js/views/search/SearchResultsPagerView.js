/*global define */
define(["backbone"], function (Backbone) {
  "use strict";

  // Classes are from Bootstrap
  const INACTIVE_CLASS = "disabled";
  const ACTIVE_CLASS = "active";

  /**
   * @class SearchResultsPagerView
   * @name SearchResultsPagerView
   * @classcategory Views/Search
   * @extends Backbone.View
   * @description Renders a simple pager element for a SolrResults collection.
   * @constructor
   * @since 2.22.0
   * @screenshots views/search/SearchResultsPagerView.png
   */
  return Backbone.View.extend(
    /** @lends SearchResultsPagerView.prototype */ {
      /**
       * The classes to use for this view's element
       * @type {string}
       */
      className:
        `pager-view search-results-pager-view pagination ` +
        `pagination-centered resultspager`,

      /**
       * The HTML tag to use for this view's element
       * @type {string}
       */
      tagName: "nav",

      /**
       * The HTML to display when no search results are found. This will be
       * updated by the view.
       * @type {string}
       */
      template: `
        <ul>
          <li><a class="${INACTIVE_CLASS}"></a></li>
          <li><a class="${INACTIVE_CLASS}"></a></li>
          <li><a class="${INACTIVE_CLASS}"></a></li>
          <li><a class="${INACTIVE_CLASS}">...</a></li>
          <li><a class="${INACTIVE_CLASS}"></a></li>
        </ul>`,

      /**
       * Constructs and returns a URL string to use for the given page in this
       * pager. It assumes that the URL uses a ".../page/X" structure. To
       * provide a custom URL, override this function.
       * @param {number|string} page The page number in base 0
       * @returns {string} The relative URL to use for the given page. This
       * will include the root part of the path name if it exists.
       */
      url: function (page) {

        page = typeof page === 'number' ? page : parseInt(page, 10);
        if (page < 0 || isNaN(page)) return '';

        // Page number to display in the URL
        const pageBase1 = page + 1;
        // Current URL path
        const basePath = window.location.pathname;
        // Regex to match a trailing '/page/number' or a trailing slash
        const regexSuffix = /\/page\/\d+\/?$|\/$/;
        // Regex to match the MetacatUI root, if it exists
        const regexRoot = new RegExp(`^${MetacatUI.root}`);

        // Remove the root and the trailing / or page/number
        let newPath = basePath.replace(regexRoot, '').replace(regexSuffix, '');
        // Add the new page number
        newPath += `/page/${pageBase1}`;
        return newPath;
        
      },

      /**
       * Constructs and returns the HTML template string for a single page link
       * in the pager
       * @type {function}
       * @param {object} data
       * @returns {string}
       */
      linkTemplate: function (
        data = {
          page: 0,
          pageDisplay: "",
          className: "",
        }
      ) {
        // Expand the data object into individual variables
        let { page, pageDisplay, className } = data;
        let href = `${MetacatUI.root + this.url(data.page)}`;
        if (href.length) href = `href="${href}"`;
        if (className) className = `class="${className}"`;
        return `
        <li ${className}>
          <a class="pagerLink" data-page="${page}" ${href}>
            ${pageDisplay}
          </a>
        </li>`;
      },

      /**
       * A SolrResults collection that contains the page data that this Pager
       * displays.
       * @type {SolrResults}
       */
      searchResults: null,

      /**
       * An object literal of events to listen to on this view
       * @type {object}
       */
      events: {
        "click a": "handleClick",
      },

      /**
       * Renders the Pager View
       */
      render: function () {
        this.loading();
        this.el.innerHTML = this.template;

        if (this.searchResults) {
          this.renderPages();
          this.stopListening(this.searchResults, "reset error");
          this.listenTo(this.searchResults, "reset", this.renderPages);
          // Hide the pager if there is an error with the search results
          this.listenTo(this.searchResults, "error", this.hide);
        }
      },

      /**
       * Render the page numbers and links.
       */
      renderPages: function () {
        // Only show pages if the search results have been retrieved (by
        // checking for the header property which is set during parse())
        if (!this.searchResults || !this.searchResults.header) return;

        // Ensure that we don't navigate to a page that doesn't exist
        const numPages = this.searchResults.getNumPages();
        const currentPage = MetacatUI.appModel.get("page");
        if (currentPage > numPages) {
          MetacatUI.appModel.set("page", numPages);
          this.searchResults.toPage(numPages);
          return;
        }

        if (this.searchResults.getNumPages() < 1) {
          this.hide();
          return;
        }

        try {
          this.show();
          this.removeLoading();

          let container = this.el.querySelector("ul"),
            lastPage = this.searchResults.getNumPages(),
            firstPage = 0,
            currentPage = this.searchResults.getCurrentPage();

          //Empty the pager container
          container.innerHTML = "";

          //Show prev button and the first page number
          if (currentPage > 0) {
            container.insertAdjacentHTML(
              "afterbegin",
              this.linkTemplate({ page: currentPage - 1, pageDisplay: "<" })
            );
            container.insertAdjacentHTML(
              "beforeend",
              this.linkTemplate({ page: 0, pageDisplay: 1 })
            );

            //If there are pages between the first page and the current-2, then
            //show an ellipsis
            if (currentPage - 2 > firstPage) {
              container.insertAdjacentHTML(
                "beforeend",
                this.linkTemplate({
                  page: "",
                  pageDisplay: "...",
                  className: INACTIVE_CLASS,
                })
              );
            }
          }

          //Show the current page plus two on each side
          let pages = [
            currentPage - 2,
            currentPage - 1,
            currentPage,
            currentPage + 1,
            currentPage + 2,
          ];
          for (let page of pages) {
            if ((page > firstPage && page < lastPage) || page == currentPage) {
              container.insertAdjacentHTML(
                "beforeend",
                this.linkTemplate({
                  page: page,
                  pageDisplay: page + 1,
                  className: page == currentPage ? ACTIVE_CLASS : "",
                })
              );
            }
          }

          //Show next button and the last page number
          if (currentPage < lastPage) {
            //If there are pages between the last page and the current-2, then
            //show an ellipsis
            if (currentPage + 2 < lastPage) {
              container.insertAdjacentHTML(
                "beforeend",
                this.linkTemplate({
                  page: "",
                  pageDisplay: "...",
                  className: INACTIVE_CLASS,
                })
              );
            }

            container.insertAdjacentHTML(
              "beforeend",
              this.linkTemplate({ page: lastPage, pageDisplay: lastPage + 1 })
            );
            container.insertAdjacentHTML(
              "beforeend",
              this.linkTemplate({ page: currentPage + 1, pageDisplay: ">" })
            );
          }
        } catch (e) {
          console.log("There was an error rendering the pager: ", e);
          this.hide();
        }
      },

      /**
       * Handles clicks on the pager links
       * @param {Event} evt
       */
      handleClick: function (evt) {
        // Don't hijack the event if the user had Control or Command held down
        if (evt.ctrlKey || evt.metaKey) {
          return;
        }

        evt.preventDefault();
        evt.stopPropagation();

        // If the item is inactive, e.g. the ellipsis, then don't do anything
        if (evt.target.classList.contains(INACTIVE_CLASS)) {
          return;
        }

        const page = parseInt(evt.target.getAttribute("data-page"), 10);
        if (page >= 0) {
          this.goToPage(page);
        }
        
      },

      /**
       * Navigates to the given page in the search results
       * @param {number} page - The page number to navigate to (0-based)
       * @since 2.28.0
       */
      goToPage: function (page) {
        if (this.searchResults) {
          this.searchResults.toPage(page);
          MetacatUI.appModel.set("page", page);
          MetacatUI.uiRouter.navigate(this.url(page), { trigger: false });
        }
      },

      /**
       * Shows the loading version of the pager
       */
      loading: function () {
        this.show();
        this.el.classList.add("loading");
      },

      /**
       * Hides the pager
       * @since 2.25.0
       */
      hide: function () {
        this.el.style.visibility = "hidden";
      },

      /**
       * Shows the pager
       * @since 2.25.0
       */
      show: function () {
        this.el.style.visibility = "visible";
      },

      /**
       * Removes the loading version of the pager
       */
      removeLoading: function () {
        this.el.classList.remove("loading");
      },
    }
  );
});
