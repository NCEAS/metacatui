/*global define */
define(["backbone"], function (Backbone) {
  "use strict";

  /**
   * @class SearchResultsPagerView
   * @name SearchResultsPagerView
   * @classcategory Views/Search
   * @extends Backbone.View
   * @description Renders a simple pager element for a SolrResults collection.
   * @constructor
   * @since 2.22.0
   * TODO: Add screenshot
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
          <li><a class="unactive"></a></li>
          <li><a class="unactive"></a></li>
          <li><a class="unactive"></a></li>
          <li><a class="unactive">...</a></li>
          <li><a class="unactive"></a></li>
        </ul>`,

      /**
       * Constructs and returns a URL string to use for the given page in this
       * pager. It assumes that the URL uses a ".../page/X" structure. To
       * provide a custom URL, override this function.
       * @param {number|string} page
       * @returns {string}
       */
      url: function (page) {
        if (typeof page !== "number") {
          try {
            page = parseInt(page);
          } catch (e) {
            console.error(e);
            return "";
          } finally {
            if (isNaN(page)) {
              return "";
            }
          }
        }

        if (window.location.pathname.includes("page")) {
          return window.location.pathname.replace(
            /\/page\/\d+/,
            "/page/" + (page + 1)
          );
        } else {
          if (window.location.pathname.endsWith("/"))
            return window.location.pathname + "page/" + (page + 1);
          else return window.location.pathname + "/page/" + (page + 1);
        }
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
        let href = `${this.url(data.page)}`;
        if (href.length) href = `href="${href}"`;
        return `
        <li class="${className}">
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
        if (this.searchResults.getNumPages() < 2) {
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
                  className: "inactive",
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
                  className: page == currentPage ? "active" : "",
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
                  className: "inactive",
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
        let page = evt.target.getAttribute("data-page");
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
       * @since x.x.x
       */
      hide: function () {
        this.el.style.visibility = "hidden";
      },

      /**
       * Shows the pager
       * @since x.x.x
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
