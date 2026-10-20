define([
  "jquery",
  "underscore",
  "backbone",
  "collections/Filters",
  "models/filters/Filter",
  "collections/SolrResults",
  "views/PagerView",
  "text!templates/portals/portalList.html",
], ($, _, Backbone, Filters, Filter, SearchResults, PagerView, Template) => {
  /**
   * @class PortalListView
   * @classdesc A view that shows a list of Portals
   * @classcategory Views/Portals
   * @augments Backbone.View
   * @screenshot views/portals/PortalListView.png
   * @class
   */
  const PortalListView = Backbone.View.extend(
    /** @lends PortalListView.prototype */ {
      /**
       * An array of Filter models  or Filter model JSON to use in the query.
       * If not provided, a default query will be used.
       * @type {Filter[]}
       */
      filters: null,

      /**
       * The general search term applied to the portal's indexed metadata.
       * @type {string}
       */
      searchTerm: "",

      /**
       * A SolrResults collection that contains the results of the search for the portals
       * @type {SolrResults}
       */
      searchResults: new SearchResults(),

      /**
       * A comma-separated list of Solr index fields to retrieve when searching for portals
       * @type {string}
       * @default "id,seriesId,title,formatId,label,logo"
       */
      searchFields:
        "id,seriesId,title,formatId,label,logo,datasource,writePermission,changePermission,rightsHolder,abstract",

      /**
       * The number of portals to dispaly per page
       * @default 10
       * @type {number}
       */
      numPortalsPerPage: 10,

      /**
       * The number of portals to retrieve and render in this view
       * @default 100
       * @type {number}
       */
      numPortals: 100,

      /**
       * An array of additional SolrResult models for portals that will be displayed
       * in this view in addition to the SolrResults found as a result of the search.
       * These could be portals that wouldn't otherwise be found by a search but should be displayed anyway.
       * @type {SolrResult[]}
       */
      additionalPortalsToDisplay: [],

      /**
       * The message to display when there are no portals in this list
       * @type {string}
       */
      noResultsMessage: `You haven't created or have access to any ${MetacatUI.appModel.get(
        "portalTermPlural",
      )} yet.`,

      /**
       * A jQuery selector for the element that the list should be inserted into
       * @type {string}
       */
      listContainer: ".portal-list-container",
      /**
       * A jQuery selector for the element that the Create Portal should be inserted into
       * @type {string}
       */
      createBtnContainer: ".create-btn-container",

      /**
       * References to templates for this view. HTML files are converted to Underscore.js templates
       */
      template: _.template(Template),

      /**
       * Creates the result collection and tracks its active request.
       * @returns {void}
       */
      initialize() {
        this.searchResults = new SearchResults();
        this.listenTo(this.searchResults, "request", (_collection, request) => {
          this.searchRequest = request;
        });
      },

      /**
       * Renders the list of portals
       */
      render() {
        try {
          // If the "my portals" feature is disabled, exit now
          if (MetacatUI.appModel.get("showMyPortals") === false) {
            return;
          }

          // Insert the template
          this.$el.html(this.template());

          // If there are no given filters, create default ones
          if (!this.filters) {
            // Create search filters for finding the portals
            const filters = new Filters();

            // Filter datasets that the user has ownership of
            filters.addWritePermissionFilter();

            this.filters = filters;
          }
          // If the filters set on this view is an array of JSON, add it to a Filters collection
          else if (
            this.filters.length &&
            !Object.prototype.isPrototypeOf.call(
              Filters.prototype,
              this.filters,
            )
          ) {
            // Create search filters for finding the portals
            const filters = new Filters();

            filters.add(this.filters);

            this.filters = filters;
          }
          // If there is an empty array, create a new Filters collection
          else if (!this.filters.length) {
            this.filters = new Filters();
          }

          // Get the search results and render them
          this.getSearchResults();

          // Display any additional portals in the list that have been passed to
          // the view directly.
          _.each(
            this.additionalPortalsToDisplay,
            function renderAdditionalPortal(searchResult) {
              // Get the list container element
              const listContainer = this.$(this.listContainer);

              // Remove any 'loading' elements before adding items to the list
              listContainer.find(".loading").remove();

              // Create a list item element and add the search result element
              // to the list container
              listContainer.append(this.createListItem(searchResult));
            },
            this,
          );

          if (this.additionalPortalsToDisplay.length) {
            // While the search is being sent for the other portals in this list,
            // show a loading sign underneath the additional portals we just displayed.
            const loadingListItem = this.createListItem();
            loadingListItem.html(
              `<td class='loading subtle' colspan='4'>Loading more ${MetacatUI.appModel.get(
                "portalTermPlural",
              )}...</td>`,
            );
            this.$(this.listContainer).append(loadingListItem);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
        }
      },

      /**
       * Queries for the portal objects using the SearchResults collection
       */
      getSearchResults() {
        try {
          this.stopListening(this.searchResults, "reset", this.renderList);
          this.stopListening(this.searchResults, "error", this.showError);
          this.searchRequest?.abort();
          this.pagerView?.remove();
          this.$(this.listContainer).html(
            $(this.template()).filter(this.listContainer).html(),
          );

          // Stable IDs keep these required filters from accumulating on resubmission.
          this.filters.add({
            id: "portal-format",
            fields: ["formatId"],
            values: ["dataone.org/portals"],
            matchSubstring: true,
            exclude: false,
          });
          this.filters.add({
            id: "latest-portals",
            fields: ["obsoletedBy"],
            values: ["*"],
            matchSubstring: false,
            exclude: true,
          });

          // Get 100 rows
          this.searchResults.rows = this.numPortals;

          // The fields to return
          this.searchResults.fields = this.searchFields;

          // Set the query service URL
          try {
            if (MetacatUI.appModel.get("defaultAlternateRepositoryId")) {
              const mnToQuery = _.findWhere(
                MetacatUI.appModel.get("alternateRepositories"),
                {
                  identifier: MetacatUI.appModel.get(
                    "defaultAlternateRepositoryId",
                  ),
                },
              );
              if (mnToQuery) {
                this.searchResults.queryServiceUrl = mnToQuery.queryServiceUrl;
              }
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Could not get active alt repo. ", e);
          }

          // Set the query on the SearchResults
          let query = this.filters.getQuery();
          if (this.searchTerm) {
            const searchFilter = new Filter({
              fields: [
                "title",
                "abstract",
                "label",
                "investigator",
                "funderName",
                "funderIdentifier",
                "awardNumber",
                "collectionQuery",
              ],
              fieldsOperator: "OR",
              values: [this.searchTerm],
            });
            query += `%20AND%20${searchFilter.getQuery()}`;
          }
          this.searchResults.setQuery(query);

          // Listen to the search results collection and render the results when the search is complete
          this.listenToOnce(this.searchResults, "reset", this.renderList);
          // Listen to the search results collection for errors
          this.listenToOnce(this.searchResults, "error", this.showError);

          // Get the first page of results
          this.searchResults.toPage(0);
        } catch (e) {
          this.showError();
          // eslint-disable-next-line no-console
          console.error(
            "Failed to fetch the SearchResults for the PortalsList: ",
            e,
          );
        }
      },

      /**
       * Renders each search result from the SolrResults collection
       */
      renderList() {
        try {
          if (!this.searchTerm) {
            this.unfilteredPortalCount = this.searchResults.length;
          }
          // Get the list container element
          const listContainer = this.$(this.listContainer);

          // If no search results were found, display a message
          if (
            (!this.searchResults || !this.searchResults.length) &&
            !this.additionalPortalsToDisplay.length
          ) {
            const row = this.createListItem();
            const message = this.searchTerm
              ? `No matching ${MetacatUI.appModel.get("portalTermPlural")}.`
              : this.noResultsMessage;
            row.html(`<div class='no-results'>${message}</div>`);
            listContainer.html(row);

            // Add a "Create" button to create a new portal
            this.renderCreateButton();

            return;
          }

          // Remove any 'loading' elements before adding items to the list
          listContainer.find(".loading").remove();

          // Iterate over each search result and render it
          this.searchResults.each(function renderPortal(searchResult) {
            // Create a list item element and add the search result element
            // to the list container
            listContainer.append(this.createListItem(searchResult));
          }, this);

          // Add a "Create" button to create a new portal
          this.renderCreateButton();

          // Create a pager for this list if there are many portals
          if (this.$(".portals-list-entry").length > this.numPortalsPerPage) {
            this.pagerView = new PagerView({
              pages: this.$(".portals-list-entry"),
              itemsPerPage: this.numPortalsPerPage,
            });

            this.$el.append(this.pagerView.render().el);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);

          this.showError();
        }
      },

      /**
       * Creates a list entry for the given portal SolrResult model.
       * @param {SolrResult} [searchResult] The portal to display.
       * @returns {jQuery|string} The list entry, or an empty string on error.
       */
      createListItem(searchResult) {
        try {
          const listItem = $(document.createElement("div")).addClass(
            "portals-list-entry",
          );

          if (searchResult && typeof searchResult.get === "function") {
            // Don't render a list item for a portal that is already there
            if (
              this.$(`tr[data-seriesId='${searchResult.get("seriesId")}']`)
                .length
            ) {
              return listItem;
            }

            // Add an id to the list element
            listItem.attr("data-seriesId", searchResult.get("seriesId"));

            // Create a logo image
            let logoDiv = "";

            // Add link to the portal to the list item
            const link = $(document.createElement("a")).attr(
              "href",
              `${MetacatUI.root}/${MetacatUI.appModel.get(
                "portalTermPlural",
              )}/${encodeURIComponent(
                searchResult.get("label") ||
                  searchResult.get("seriesId") ||
                  searchResult.get("id"),
              )}`,
            );

            if (searchResult.get("logo")) {
              if (!searchResult.get("logo").startsWith("http")) {
                let urlBase = "";

                // If there are alt repos configured, use the datasource obbject service URL
                if (
                  MetacatUI.appModel.get("alternateRepositories").length &&
                  searchResult.get("datasource")
                ) {
                  const sourceMN = _.findWhere(
                    MetacatUI.appModel.get("alternateRepositories"),
                    { identifier: searchResult.get("datasource") },
                  );
                  if (sourceMN) {
                    urlBase = sourceMN.objectServiceUrl;
                  }
                }

                if (!urlBase) {
                  // use the resolve service if there is no object service url
                  // (e.g. in DataONE theme)
                  urlBase =
                    MetacatUI.appModel.get("objectServiceUrl") ||
                    MetacatUI.appModel.get("resolveServiceUrl");
                }

                searchResult.set("logo", urlBase + searchResult.get("logo"));
              }

              const logoImg = $(document.createElement("img"))
                .attr("src", searchResult.get("logo"))
                .attr("alt", `${searchResult.get("title")} logo`);
              const logoLink = link.clone().append(logoImg);

              logoDiv = $(document.createElement("div"))
                .addClass("portal-logo")
                .append(logoLink);
            } else {
              // Create an empty <div>, as no portal image is available.
              logoDiv = $(document.createElement("div")).addClass(
                "portal-logo",
              );
            }

            const portalTitle = $(document.createElement("h5"))
              .addClass("portal-title")
              .text(searchResult.get("title"));
            const titleLink = link.clone().append(portalTitle);

            let descriptionText = searchResult.get("abstract") || "";
            const maxLength = window.innerWidth < 800 ? 150 : 300;
            if (descriptionText.length > maxLength) {
              descriptionText = descriptionText.substr(0, maxLength);
              descriptionText = descriptionText.substr(
                0,
                Math.min(
                  descriptionText.length,
                  descriptionText.lastIndexOf(" "),
                ),
              );
              descriptionText += "...";
            }
            const description = $(document.createElement("div"))
              .addClass("portal-description")
              .append($(document.createElement("p")).text(descriptionText));

            const portalInfo = $(document.createElement("div"))
              .addClass("portal-info")
              .append(titleLink, description);

            const editDiv = $(document.createElement("div"))
              .addClass("portal-edit-link")
              .addClass("controls");

            // Add all the elements to the row
            listItem.append(logoDiv, portalInfo, editDiv);

            // Construct an array of ownership subjects
            const wPermission = searchResult.get("writePermission");
            const cPermission = searchResult.get("changePermission");
            const rightsHolder = searchResult.get("rightsHolder");
            let owners = [];

            [wPermission, cPermission, rightsHolder].forEach((subjects) => {
              if (typeof subjects === "string") {
                owners.push(subjects);
              } else if (Array.isArray(subjects)) {
                owners = owners.concat(subjects);
              }
            });

            // Render an Edit button
            if (MetacatUI.appUserModel.hasIdentityOverlap(owners)) {
              // Create an Edit buttton
              const editButton = $(document.createElement("a"))
                .attr(
                  "href",
                  `${MetacatUI.root}/edit/${MetacatUI.appModel.get(
                    "portalTermPlural",
                  )}/${encodeURIComponent(
                    searchResult.get("label") ||
                      searchResult.get("seriesId") ||
                      searchResult.get("id"),
                  )}`,
                )
                .text("Edit")
                .addClass("btn edit");
              editDiv.append(editButton);
            }
          }

          // Return the list item
          return listItem;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          return "";
        }
      },

      /**
       * Renders a "Create" button for the user to create a new portal
       */
      renderCreateButton() {
        // Portal limits depend on the unfiltered count, including while authorization loads.
        if (this.searchTerm && this.unfilteredPortalCount === undefined) return;
        try {
          // If the authorization hasn't been checked yet
          if (
            MetacatUI.appUserModel.get("isAuthorizedCreatePortal") !== true &&
            MetacatUI.appUserModel.get("isAuthorizedCreatePortal") !== false
          ) {
            // Check is this user is authorized to create a new portal
            this.listenToOnce(
              MetacatUI.appUserModel,
              "change:isAuthorizedCreatePortal",
              this.renderCreateButton,
            );
            MetacatUI.appUserModel.isAuthorizedCreatePortal();
          } else {
            // Create a New portal buttton
            const createButton = $(document.createElement("a"))
              .addClass("btn btn-primary")
              .append(
                $(document.createElement("i")).addClass(
                  "icon icon-plus icon-on-left",
                ),
                `New ${MetacatUI.appModel.get("portalTermSingular")}`,
              );

            const isNotAuthorizedNoBookkeeper =
              !MetacatUI.appModel.get("enableBookkeeperServices") &&
              MetacatUI.appUserModel.get("isAuthorizedCreatePortal") === false;
            const reachedLimitWithBookkeeper =
              MetacatUI.appModel.get("enableBookkeeperServices") &&
              MetacatUI.appUserModel.get("isAuthorizedCreatePortal") === false;
            const reachedLimitWithoutBookkeeper =
              !MetacatUI.appModel.get("enableBookkeeperServices") &&
              MetacatUI.appModel.get("portalLimit") <=
                (this.unfilteredPortalCount ?? this.searchResults.length) &&
              MetacatUI.appModel.get("portalLimit") >= 0;

            // If creating portals is disabled in the entire app, or is only limited to certain groups,
            // then don't show the Create button.
            if (isNotAuthorizedNoBookkeeper) {
              return;
            }
            // If creating portals is enabled, but this person is unauthorized because of Bookkeeper info,
            // then show the Create button as disabled.
            if (reachedLimitWithBookkeeper || reachedLimitWithoutBookkeeper) {
              // Disable the button
              createButton.addClass("disabled");

              // Add the create button to the view
              this.$(this.createBtnContainer).html(createButton);

              let message = `You've already reached the ${MetacatUI.appModel.get(
                "portalTermSingular",
              )} limit for your `;

              if (MetacatUI.appModel.get("enableBookkeeperServices")) {
                message += MetacatUI.appModel.get("dataonePlusName");

                if (MetacatUI.appModel.get("dataonePlusPreviewMode")) {
                  message += " free preview. ";
                } else {
                  message += " subscription. ";
                }

                const portalQuotas = MetacatUI.appUserModel.getQuotas("portal");
                if (portalQuotas.length) {
                  message += `(${portalQuotas[0].get("softLimit")} ${
                    portalQuotas[0].get("softLimit") > 1
                      ? MetacatUI.appModel.get("portalTermPlural")
                      : MetacatUI.appModel.get("portalTermSingular")
                  })`;
                }

                message += " Contact us to upgrade your subscription.";
              } else {
                message += " account. ";

                const portalLimit = MetacatUI.appModel.get("portalLimit");
                if (portalLimit > 0) {
                  message += `(${portalLimit} ${
                    portalLimit > 1
                      ? MetacatUI.appModel.get("portalTermPlural")
                      : MetacatUI.appModel.get("portalTermSingular")
                  })`;
                }
              }

              // Add the tooltip to the button
              createButton.tooltip({
                placement: "top",
                trigger: "hover click focus",
                delay: {
                  show: 500,
                },
                title: message,
              });
            } else {
              // Add the link URL to the button
              createButton.attr(
                "href",
                `${MetacatUI.root}/edit/${MetacatUI.appModel.get(
                  "portalTermPlural",
                )}`,
              );

              // Add the create button to the view
              this.$(this.createBtnContainer).html(createButton);
            }

            // Reset the isAuthorizedCreatePortal attribute
            MetacatUI.appUserModel.set("isAuthorizedCreatePortal", null);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
        }
      },

      /**
       * Cancels the request and removes the pager and list.
       * @returns {PortalListView} This view
       * @since 0.0.0
       */
      remove() {
        this.stopListening();
        this.searchRequest?.abort();
        this.pagerView?.remove();
        return Backbone.View.prototype.remove.call(this);
      },

      /**
       * Displays an error message when rendering this view has failed.
       */
      showError() {
        // Remove the loading elements
        this.$(this.listContainer).find(".loading").remove();

        if (this.$(this.listContainer).children("tr").length === 0) {
          // Show an error message
          MetacatUI.appView.showAlert(
            "Something went wrong while getting this list of portals.",
            "alert-error",
            this.$(this.listContainer),
          );
        }
      },
    },
  );
  return PortalListView;
});
