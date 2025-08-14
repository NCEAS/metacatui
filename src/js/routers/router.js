"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/sysmeta/VersionTracker",
  "models/resourceMap/ResourceMapResolver",
], function ($, _, Backbone, VersionTracker, ResourceMapResolver) {
  /**
   * @class UIRouter
   * @classdesc MetacatUI Router
   * @classcategory Router
   * @extends Backbone.Router
   * @constructor
   */
  var UIRouter = Backbone.Router.extend(
    /** @lends UIRouter.prototype */ {
      routes: {
        "": "renderIndex", // the default route
        "about(/:anchorId)(/)": "renderAbout", // about page
        "help(/:page)(/:anchorId)(/)": "renderHelp",
        "tools(/:anchorId)(/)": "renderTools", // tools page
        "data/my-data(/page/:page)(/)": "renderMyData", // data search page
        "data(/mode=:mode)(/query=:query)(/page/:page)(/)": "renderData", // data search page
        "data/my-data(/)": "renderMyData",
        "profile(/*username)(/s=:section)(/s=:subsection)(/)": "renderProfile",
        "my-profile(/s=:section)(/s=:subsection)(/)": "renderMyProfile",
        "logout(/)": "logout", // logout the user
        "signout(/)": "logout", // logout the user
        "signin(/)": "renderSignIn", // signin the user
        "signinsuccess(/)": "renderSignInSuccess",
        "signinldaperror(/)": "renderLdapSignInError",
        "signinLdap(/)": "renderLdapSignIn",
        "signinSuccessLdap(/)": "renderLdapSignInSuccess",
        "signin-help": "renderSignInHelp", //The Sign In troubleshotting page
        "share(/*pid)(/)": "renderEditor", // registry page
        "submit(/*pid)(/)": "renderEditor", // registry page
        "quality(/s=:suiteId)(/:pid)(/)": "renderMdqRun", // MDQ page
        "api(/:anchorId)(/)": "renderAPI", // API page
        "edit/:portalTermPlural(/:portalIdentifier)(/:portalSection)(/)":
          "renderPortalEditor",
        drafts: "renderDrafts",
        versionTracker: "versionTracker", // version tracker page
        resourceMapResolverTest: "resourceMapResolverTest", // Test the ResourceMapResolver
      },

      async versionTracker() {
        const vt = new VersionTracker({
          metaServiceUrl: MetacatUI.appModel.get("metaServiceUrl"),
        });
        let token = await MetacatUI.appUserModel.getTokenPromise();
        this.listenTo(MetacatUI.appUserModel, "change:loggedIn", () => {
          MetacatUI.appUserModel.getTokenPromise().then((t) => {
            token = t;
          });
        });
        // Build a UI for users to test inputting a PID and getting the version
        // history.
        const SPINNER = `<i class="icon-spinner icon-spin icon-large loading icon"></i>`;
        const VersionTrackerTesterView = Backbone.View.extend({
          template: _.template(
            `<h1 style="margin-bottom:30px;font-weight:400;">🧪 The <code style="font-size:inherit;color:inherit;">VersionTracker</code> Test Page 🔬</h1>
            <h4>Enter a PID to get its version history:</h4>
            <input type="text" id="pidInput" placeholder="Enter PID here..." style="margin-bottom: 0; height: 26px; width:100%; max-width:500px;">
            <button id="getVersionsButton" class="btn btn-primary">Get Versions</button>
            <div id="status" class="well alert alert-info" style="margin-top: 20px">Waiting for a pid</div>
            <div id="result" class="well" style="margin-top: 20px">Results will show here</div>`,
          ),

          versionTemplate: _.template(/* html */ `
            <div class="version" style="margin:1em 0;padding:.75em;border:1px solid #ddd;border-radius:4px;background:#f1f6f9;">
              <!-- PID -->
              <p style="margin:0 0 .5em 0;">
                <strong>PID:</strong>
                <code><%= pid %></code>
              </p>

              <!-- Quick link bar -->
              <p style="margin:0 0 1em 0;font-size:.9em;">
                <strong>Links:</strong>
                <a href="<%= viewUrl %>"   target="_blank" rel="noopener">view</a> |
                <a href="<%= objectUrl %>" target="_blank" rel="noopener">object</a> |
                <a href="<%= sysMetaUrl %>"target="_blank" rel="noopener">sysmeta</a>
              </p>

              <!-- Details -->
              <table style="width:100%;border-collapse:collapse;font-size:.9em;">
                <thead>
                  <tr style="background:#f7f7f7;">
                    <th style="text-align:left;padding:4px 6px;">Uploaded</th>
                    <th style="text-align:left;padding:4px 6px;">SysMeta Modified</th>
                    <th style="text-align:left;padding:4px 6px;">File&nbsp;name</th>
                    <th style="text-align:left;padding:4px 6px;">Size</th>
                    <th style="text-align:left;padding:4px 6px;">Format</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:4px 6px;"><%= dateUploaded || "—" %></td>
                    <td style="padding:4px 6px;"><%= dateModified || "—" %></td>
                    <td style="padding:4px 6px;"><%= fileName     || "—" %></td>
                    <td style="padding:4px 6px;"><%= size         || "—" %></td>
                    <td style="padding:4px 6px;"><%= formatId     || "—" %></td>
                  </tr>
                </tbody>
              </table>
            </div>
          `),
          events: {
            "click #getVersionsButton": "getVersions",
          },

          render: function () {
            this.$el.html(this.template());
            return this;
          },

          updateResult: function (html) {
            this.$("#result").html(html);
          },

          updateStatus: function (message, type = "info") {
            this.$("#status").html(message);
            this.$("#status").removeClass("alert-info alert-danger");
            this.$("#status").addClass(`alert-${type}`);
          },

          showLoading: function (pid) {
            this.updateStatus(
              `${SPINNER} Getting versions for PID: <strong>${pid}</strong>...`,
            );
          },

          showError: function (message) {
            this.updateStatus(
              `<p class="text-danger">❌ Error: ${message}</p>`,
              "danger",
            );
          },

          showComplete: function (numNext, numPrev, pid) {
            this.updateStatus(
              `Found <strong>${numNext}</strong> next versions and <strong>${numPrev}</strong> previous versions for PID: <strong>${pid}</strong>`,
              "success",
            );
          },

          showVersions: function (record) {
            console.log(record);
            const next = record.next;
            const prev = record.prev;
            const thisPid = record.sysMeta.data.identifier;

            let html = `<h3>Version History for PID: <strong>${thisPid}</strong></h3>`;
            let nextVersionsHtml = "<p>No next versions found.</p>";
            let prevVersionsHtml = "<p>No previous versions found.</p>";

            if (next?.length) {
              nextVersionsHtml = next
                .map((v) => this.createVersionEl(v))
                .join("");
            }

            if (prev?.length) {
              prevVersionsHtml = prev
                .map((v) => this.createVersionEl(v))
                .join("");
            }

            const thisVersionHtml = this.createVersionEl(record);

            html += `<h4>Next Versions:</h4>${nextVersionsHtml}`;
            html += `<h4>Previous Versions:</h4>${prevVersionsHtml}`;
            html += `<h4>This Version:</h4>${thisVersionHtml}`;
            this.updateResult(html);
          },

          createVersionEl: function (record) {
            const sysMetaData = record.sysMeta?.data || {};

            const pid = sysMetaData.identifier;
            return this.versionTemplate({
              pid: pid,
              created: sysMetaData?.dateCreated || "N/A",
              dateUploaded: sysMetaData?.dateUploaded || "N/A",
              dateModified: sysMetaData?.dateSysMetadataModified || "N/A",
              fileName: sysMetaData?.fileName || "N/A",
              size: sysMetaData?.size || "N/A",
              formatId: sysMetaData?.formatId || "N/A",
              viewUrl: `${MetacatUI.root}/view/${encodeURIComponent(pid)}`,
              objectUrl: `${MetacatUI.appModel.get("objectServiceUrl")}${encodeURIComponent(pid)}`,
              sysMetaUrl: `${MetacatUI.appModel.get("metaServiceUrl")}${encodeURIComponent(pid)}`,
            });
          },

          onRecordUpdate(record) {
            if (!record || !record.sysMeta) {
              this.showError("No record found for the given PID.");
            }
            const numNext = record.next?.length || 0;
            const numPrev = record.prev?.length || 0;
            const complete = record.endNext && record.endPrev;
            const pid = record.sysMeta.data.identifier;

            if (complete) {
              this.showComplete(numNext, numPrev, pid);
            } else {
              this.updateStatus(
                `${SPINNER} Found ${numNext} next versions and ${numPrev} previous versions for PID: <strong>${record.sysMeta.data.identifier}</strong>. Still loading...`,
              );
            }

            this.showVersions(record);
          },

          getVersions: async function () {
            // clear cache
            await vt.clear();
            const pid = this.$("#pidInput").val().trim();
            this.showLoading(pid);
            try {
              // vt.subscribe(pid, this.onRecordUpdate.bind(this));
              this.stopListening(vt, `update:${pid}`, this.onRecordUpdate);
              this.listenTo(vt, `update:${pid}`, this.onRecordUpdate);
              const record = await vt.getFullChain(pid, token, true, true);
              if (record) {
                this.showComplete(record.next.length, record.prev.length, pid);
                this.showVersions(record);
              } else {
                this.showError(
                  `No version history found for PID: <strong>${pid}</strong>.`,
                );
              }
            } catch (error) {
              console.error("Error getting version history:", error);
              this.showError(error.message || error);
            }
            // TODO - track errors - handle not found, not authorized, server error, etc.
          },
        });

        const el = $("#Content");
        const view = new VersionTrackerTesterView({
          el: el,
        });
        view.render();
      },

      // temporary
      async resourceMapResolverTest() {
        const ResourceMapResolverTesterView = Backbone.View.extend({
          template: _.template(
            `<h1 style="margin-bottom:30px;font-weight:400;">🧪 The <code style="font-size:inherit;color:inherit;">ResourceMapResolver</code> Test Page 🔬</h1>
            <h4>Enter a PID to resolve:</h4>
            <input type="text" id="pidInput" placeholder="Enter PID here..." style="margin-bottom: 0; height: 26px; width:100%; max-width:500px;">
            <button id="resolveButton" class="btn btn-primary">Resolve</button>
            <div id="result" class="well alert alert-info" style="margin-top: 20px">Results will show here</div>
            <pre class="markdown"><code id="trace">The log of events will show here</code></pre>`,
          ),

          events: {
            "click #resolveButton": "resolvePid",
          },

          render: async function () {
            this.$el.html(this.template());
            this.resolver = new ResourceMapResolver();

            await this.resolver.clearStorage();
            await this.resolver.versionTracker.clear();

            this.stopListening(this.resolver);
            this.stopListening(this.resolver.versionTracker);

            this.listenTo(
              this.resolver,
              "update",
              ({ pid, rm, status, meta } = {}) => {
                this.$("#result").html(
                  `<i class="icon-spinner icon-spin icon-large loading icon"></i> Resolving PID: <strong>${this.pid}</strong>... ${status}...`,
                );
              },
            );

            this.listenTo(this.resolver.versionTracker, "update", (rec) => {
              console.log("VersionTracker update event:", rec);

              const numVerBack = rec.prev.length;
              const numVerForward = rec.next.length;
              const pid = rec.sysMeta?.data?.identifier;
              if (!pid) return;

              const forward = numVerForward > 0 ? "forward" : "backward";
              const steps = numVerForward > 0 ? numVerForward : numVerBack;
              const message = `Walking sysmeta ${forward} <strong>${steps}</strong> steps from <strong>${pid}</strong>...`;

              this.$("#result").html(
                `<i class="icon-spinner icon-spin icon-large loading icon"></i> Resolving PID: <strong>${this.pid}</strong>... ${message}`,
              );
            });

            return this;
          },

          resolvePid: async function () {
            const objectServiceUrl = MetacatUI.appModel.get("objectServiceUrl");
            const viewUrl = `${MetacatUI.root}/view/`;
            const token = await MetacatUI.appUserModel.getTokenPromise();
            const user = token ? MetacatUI.appUserModel.get("fullName") : "";
            const pid = this.$("#pidInput").val().trim();
            this.pid = pid;
            if (!pid) {
              this.$("#result").text("Please enter a PID.");
              return;
            }

            this.$("#result").html(
              `<i class="icon-spinner icon-spin icon-large loading icon"></i> Resolving PID: <strong>${pid}</strong>...`,
            );
            this.$("#trace").text("");

            const authText = user
              ? `You are logged in as <strong>${user}</strong>.`
              : "You are not logged in.";
            const authnDiv = `<p><strong>ℹ️ Authorization:</strong> ${authText}</p>`;

            try {
              const results = await this.resolver.resolve(pid);

              if (results.success) {
                this.$("#result").html(
                  `<p>✅ Resource Map resolved successfully!</p>
                  <p><strong>EML PID:</strong> 
                   <a href="${objectServiceUrl}${encodeURIComponent(pid)}" target="_blank">${pid}</a>
                  </p>
                  <p><strong>Resource Map PID:</strong>
                    <a href="${objectServiceUrl}${encodeURIComponent(results.rm)}" target="_blank">${results.rm}</a>
                  </p>
                  <p><strong>Data Package Landing Page:</strong>
                    <a href="${viewUrl}${encodeURIComponent(pid)}" target="_blank">Data Package View</a>
                  </p>
                  ${authnDiv}`,
                );
              } else {
                this.$("#result").html(`
                  <p>❌ No resouce map found for PID: <strong>${pid}</strong></p>${authnDiv}
                `);
              }
              this.$("#trace").text(JSON.stringify(results.log, null, 2));
            } catch (error) {
              // const { UnauthorizedError, SysMetaError } =
              //   ResourceMapResolver.Errors;
              console.log("error message", error.message);
              console.log("error status", error.status);

              let message = "An error occurred while resolving the PID.";
              if (error) {
                console.log("ERROR IN ResourceMapResolverTesterView", error);

                // console.log("UnauthorizedError", error);

                // message = `You are not authorized to access the PID: <strong>${pid}</strong>. Please log in.`;
              } else if (error instanceof SysMetaError) {
                message = `An error occurred while fetching the sysmeta for PID: <strong>${pid}</strong>.`;
              } else if (error.status === 404) {
                message = `The PID: <strong>${pid}</strong> was not found.`;
              } else if (error.status === 500) {
                message = `An internal server error occurred while resolving the PID: <strong>${pid}</strong>.`;
              }

              this.$("#result").html(
                `<p class="text-danger">❌ Error resolving PID: <strong>${pid}</strong></p>${authnDiv}`,
              );
              this.$("#trace").text(
                `Error: ${error.message}\nStatus: ${error.status}\nStack: ${error.stack}`,
              );
            }
          },
        });
        const el = $("#Content");
        const view = new ResourceMapResolverTesterView({
          el: el,
        });
        console.log("Rendering ResourceMapResolverTesterView...", view);
        view.render();
      },

      helpPages: {
        search: "searchTips",
        defaultPage: "searchTips",
      },

      initialize: function () {
        // Add routes to portal dynamically using the appModel portal term
        var portalTermPlural = MetacatUI.appModel.get("portalTermPlural");
        this.route(
          portalTermPlural + "(/:portalId)(/:portalSection)(/)",
          ["portalId", "portalSection"],
          this.renderPortal,
        );

        this.listenTo(
          Backbone.history,
          "routeNotFound",
          this.navigateToDefault,
        );

        // This route handler replaces the route handler we had in the
        // routes table before which was "view/*pid". The * only finds URL
        // parts until the ? but DataONE PIDs can have ? in them so we need
        // to make this route more inclusive.
        this.route(/^view\/(.*)$/, "renderMetadata");

        this.on("route", this.trackPathName);

        // Clear stale JSONLD and meta tags
        this.on("route", this.clearJSONLD);
        this.on("route", this.clearHighwirePressMetaTags);
      },

      //Keep track of navigation movements
      routeHistory: new Array(),
      pathHistory: new Array(),

      // Will return the last route, which is actually the second to last item in the route history,
      // since the last item is the route being currently viewed
      lastRoute: function () {
        if (
          typeof this.routeHistory === "undefined" ||
          this.routeHistory.length <= 1
        )
          return false;
        else return this.routeHistory[this.routeHistory.length - 2];
      },

      trackPathName: function (e) {
        if (_.last(this.pathHistory) != window.location.pathname)
          this.pathHistory.push(window.location.pathname);
      },

      //If the user or app cancelled the last route, call this function to revert
      // the window location pathname back to the correct value
      undoLastRoute: function () {
        this.routeHistory.pop();

        // Remove the last route and pathname from the history
        if (_.last(this.pathHistory) == window.location.pathname)
          this.pathHistory.pop();

        //Change the pathname in the window location back
        this.navigate(_.last(this.pathHistory), { replace: true });
      },

      renderIndex: function (param) {
        this.routeHistory.push("index");

        if (!MetacatUI.appView.indexView) {
          require(["views/IndexView"], function (IndexView) {
            MetacatUI.appView.indexView = new IndexView();
            MetacatUI.appView.showView(MetacatUI.appView.indexView);
          });
        } else MetacatUI.appView.showView(MetacatUI.appView.indexView);
      },

      renderText: function (options) {
        if (!MetacatUI.appView.textView) {
          require(["views/TextView"], function (TextView) {
            MetacatUI.appView.textView = new TextView();
            MetacatUI.appView.showView(MetacatUI.appView.textView, options);
          });
        } else MetacatUI.appView.showView(MetacatUI.appView.textView, options);
      },

      renderHelp: function (page, anchorId) {
        this.routeHistory.push("help");
        MetacatUI.appModel.set("anchorId", anchorId);

        if (page) var pageName = this.helpPages[page];
        else var pageName = this.helpPages["defaultPage"]; //default

        var options = {
          pageName: pageName,
          anchorId: anchorId,
        };

        this.renderText(options);
      },

      renderSignInHelp: function () {
        this.routeHistory.push("signin-help");
        this.renderText({ pageName: "signInHelp" });
      },

      renderAbout: function (anchorId) {
        this.routeHistory.push("about");
        MetacatUI.appModel.set("anchorId", anchorId);
        var options = {
          pageName: "about",
          anchorId: anchorId,
        };

        this.renderText(options);
      },

      renderAPI: function (anchorId) {
        this.routeHistory.push("api");
        MetacatUI.appModel.set("anchorId", anchorId);
        var options = {
          pageName: "api",
          anchorId: anchorId,
        };

        this.renderText(options);
      },

      renderProjects: function () {
        require(["views/projects/ProjectView"], function (ProjectView) {
          MetacatUI.appView.projectView = new ProjectView();
          MetacatUI.appView.showView(MetacatUI.appView.projectView);
        });
      },

      /*
       * Renders the editor view given a root package identifier,
       * or a metadata identifier.  If the latter, the corresponding
       * package identifier will be queried and then rendered.
       */
      renderEditor: function (pid) {
        //If there is no EML211EditorView yet, create one
        if (!MetacatUI.appView.eml211EditorView) {
          var router = this;

          //Load the EML211EditorView file
          require(["views/metadata/EML211EditorView"], function (
            EML211EditorView,
          ) {
            //Add the submit route to the router history
            router.routeHistory.push("submit");

            //Create a new EML211EditorView
            MetacatUI.appView.eml211EditorView = new EML211EditorView({
              pid: pid,
            });

            //Set the pid from the pid given in the URL
            MetacatUI.appView.eml211EditorView.pid = pid;

            //Render the EML211EditorView
            MetacatUI.appView.showView(MetacatUI.appView.eml211EditorView);
          });
        } else {
          //Set the pid from the pid given in the URL
          MetacatUI.appView.eml211EditorView.pid = pid;

          //Add the submit route to the router history
          this.routeHistory.push("submit");

          //Render the Editor View
          MetacatUI.appView.showView(MetacatUI.appView.eml211EditorView);
        }
      },

      /**
       * Renders the Drafts view which is a simple view backed by LocalForage that
       * lists drafts created in the Editor so users can recover any failed
       * submissions.
       */
      renderDrafts: function () {
        require(["views/DraftsView"], function (DraftsView) {
          MetacatUI.appView.draftsView = new DraftsView();
          MetacatUI.appView.showView(MetacatUI.appView.draftsView);
        });
      },

      renderMdqRun: function (suiteId, pid) {
        this.routeHistory.push("quality");

        if (!MetacatUI.appView.mdqRunView) {
          require(["views/MdqRunView"], function (MdqRunView) {
            MetacatUI.appView.mdqRunView = new MdqRunView();
            MetacatUI.appView.mdqRunView.suiteId = suiteId;
            MetacatUI.appView.mdqRunView.pid = pid;
            MetacatUI.appView.showView(MetacatUI.appView.mdqRunView);
          });
        } else {
          MetacatUI.appView.mdqRunView.suiteId = suiteId;
          MetacatUI.appView.mdqRunView.pid = pid;
          MetacatUI.appView.showView(MetacatUI.appView.mdqRunView);
        }
      },

      renderTools: function (anchorId) {
        this.routeHistory.push("tools");
        MetacatUI.appModel.set("anchorId", anchorId);

        var options = {
          pageName: "tools",
          anchorId: anchorId,
        };

        this.renderText(options);
      },

      renderMyData: function (page) {
        //Only display this is the user is logged in
        if (
          !MetacatUI.appUserModel.get("loggedIn") &&
          MetacatUI.appUserModel.get("checked")
        )
          this.navigate("data", { trigger: true });
        else if (!MetacatUI.appUserModel.get("checked")) {
          var router = this;

          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            function () {
              if (MetacatUI.appUserModel.get("loggedIn"))
                router.renderMyData(page);
              else this.navigate("data", { trigger: true });
            },
          );

          return;
        }

        this.routeHistory.push("data");

        ///Check for a page URL parameter
        if (typeof page === "undefined") MetacatUI.appModel.set("page", 0);
        else MetacatUI.appModel.set("page", page);

        if (!MetacatUI.appView.dataCatalogView) {
          require(["views/DataCatalogView"], function (DataCatalogView) {
            MetacatUI.appView.dataCatalogView = new DataCatalogView();
            MetacatUI.appView.dataCatalogView.searchModel =
              MetacatUI.appUserModel.get("searchModel").clone();
            MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
          });
        } else {
          MetacatUI.appView.dataCatalogView.searchModel = MetacatUI.appUserModel
            .get("searchModel")
            .clone();
          MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
        }
      },

      renderData: function (mode, query, page) {
        this.routeHistory.push("data");
        // Check for a page URL parameter
        page = parseInt(page);
        page = isNaN(page) || page < 1 ? 1 : page;
        MetacatUI.appModel.set("page", page - 1);

        // Check if we are using the new CatalogSearchView
        if (!MetacatUI.appModel.get("useDeprecatedDataCatalogView")) {
          require(["views/search/CatalogSearchView"], function (
            CatalogSearchView,
          ) {
            MetacatUI.appView.catalogSearchView = new CatalogSearchView({
              initialQuery: query,
            });
            MetacatUI.appView.showView(MetacatUI.appView.catalogSearchView);
          });
          return;
        }

        // Check for a query URL parameter
        if (typeof query !== "undefined" && query) {
          MetacatUI.appSearchModel.set("additionalCriteria", [query]);
        }

        require(["views/DataCatalogView"], function (DataCatalogView) {
          if (!MetacatUI.appView.dataCatalogView) {
            MetacatUI.appView.dataCatalogView = new DataCatalogView();
          }
          if (mode) MetacatUI.appView.dataCatalogView.mode = mode;
          MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
        });
      },

      /**
       * Renders the Portals Search view.
       */
      renderPortalsSearch: function () {
        require(["views/portals/PortalsSearchView"], function (
          PortalsSearchView,
        ) {
          MetacatUI.appView.showView(new PortalsSearchView({ el: "#Content" }));
        });
      },

      /**
       * renderPortal - Render the portal view based on the given name or id, as
       * well as optional section
       *
       * @param  {string} label         The portal ID or name
       * @param  {string} portalSection A specific section within the portal
       */
      renderPortal: function (label, portalSection) {
        //If no portal was specified, go to the portal search view
        if (!label) {
          this.renderPortalsSearch();
          return;
        }

        // Add the overall class immediately so the navbar is styled correctly right away
        $("body").addClass("PortalView");
        // Look up the portal document seriesId by its registered name if given
        if (portalSection) {
          this.routeHistory.push(
            MetacatUI.appModel.get("portalTermPlural") +
              "/" +
              label +
              "/" +
              portalSection,
          );
        } else {
          this.routeHistory.push(
            MetacatUI.appModel.get("portalTermPlural") + "/" + label,
          );
        }

        require(["views/portals/PortalView"], function (PortalView) {
          MetacatUI.appView.portalView = new PortalView({
            label: label,
            activeSectionLabel: portalSection,
          });
          MetacatUI.appView.showView(MetacatUI.appView.portalView);
        });
      },

      /**
       * Renders the PortalEditorView
       * @param {string} [portalTermPlural] - This should match the `portalTermPlural` configured in the AppModel.
       * @param {string} [portalIdentifier] - The id or labebl of the portal
       * @param {string} [portalSection] - The name of the section within the portal to navigate to (e.g. "data")
       */
      renderPortalEditor: function (
        portalTermPlural,
        portalIdentifier,
        portalSection,
      ) {
        //If the user navigated to a route with a portal term other than the one supported, then this is not a portal editor route.
        if (portalTermPlural != MetacatUI.appModel.get("portalTermPlural")) {
          this.navigateToDefault();
          return;
        }

        // Add the overall class immediately so the navbar is styled correctly right away
        $("body").addClass("Editor").addClass("Portal");

        // Look up the portal document seriesId by its registered name if given
        if (portalSection) {
          this.routeHistory.push(
            "edit/" +
              MetacatUI.appModel.get("portalTermPlural") +
              "/" +
              portalIdentifier +
              "/" +
              portalSection,
          );
        } else {
          if (!portalIdentifier) {
            this.routeHistory.push(
              "edit/" + MetacatUI.appModel.get("portalTermPlural"),
            );
          } else {
            this.routeHistory.push(
              "edit/" +
                MetacatUI.appModel.get("portalTermPlural") +
                "/" +
                portalIdentifier,
            );
          }
        }

        require(["views/portals/editor/PortalEditorView"], function (
          PortalEditorView,
        ) {
          MetacatUI.appView.portalEditorView = new PortalEditorView({
            activeSectionLabel: portalSection,
            portalIdentifier: portalIdentifier,
          });
          MetacatUI.appView.showView(MetacatUI.appView.portalEditorView);
        });
      },

      renderMetadata: function (pid) {
        pid = decodeURIComponent(pid);

        this.routeHistory.push("metadata");
        MetacatUI.appModel.set("lastPid", MetacatUI.appModel.get("pid"));

        var seriesId;

        //Check for a seriesId
        if (pid.indexOf("version:") > -1) {
          seriesId = pid.substr(0, pid.indexOf(", version:"));

          pid = pid.substr(pid.indexOf(", version: ") + ", version: ".length);
        }

        //Save the id in the app model
        MetacatUI.appModel.set("pid", pid);

        if (!MetacatUI.appView.metadataView) {
          require(["views/MetadataView"], function (MetadataView) {
            MetacatUI.appView.metadataView = new MetadataView();

            //Send the id(s) to the view
            MetacatUI.appView.metadataView.seriesId = seriesId;
            MetacatUI.appView.metadataView.pid = pid;

            MetacatUI.appView.showView(MetacatUI.appView.metadataView);
          });
        } else {
          //Send the id(s) to the view
          MetacatUI.appView.metadataView.seriesId = seriesId;
          MetacatUI.appView.metadataView.pid = pid;

          // MetacatUI resets the dataPackage and dataPackageSynced
          // attributes before rendering the view. These attributes are
          // initialized on a per-dataset basis to prevent displaying the
          // same dataset repeatedly.

          MetacatUI.appView.metadataView.dataPackage = null;
          MetacatUI.appView.metadataView.dataPackageSynced = false;

          MetacatUI.appView.showView(MetacatUI.appView.metadataView);
        }
      },

      renderProfile: function (username, section, subsection) {
        this.closeLastView();

        var viewChoice;

        //If there is a username specified and user profiles are disabled,
        // forward to the entire repo profile view.
        if (username && !MetacatUI.appModel.get("enableUserProfiles")) {
          this.navigate("profile", { trigger: true, replace: true });
          return;
        }

        if (!username) {
          this.routeHistory.push("summary");

          // flag indicating /profile view
          var viewOptions = { nodeSummaryView: true };

          if (!MetacatUI.appView.statsView) {
            require(["views/StatsView"], function (StatsView) {
              MetacatUI.appView.statsView = new StatsView({
                userType: "repository",
              });

              MetacatUI.appView.showView(
                MetacatUI.appView.statsView,
                viewOptions,
              );
            });
          } else
            MetacatUI.appView.showView(
              MetacatUI.appView.statsView,
              viewOptions,
            );
        } else {
          this.routeHistory.push("profile");
          MetacatUI.appModel.set("profileUsername", username);

          if (section || subsection) {
            var viewOptions = { section: section, subsection: subsection };
          }

          if (!MetacatUI.appView.userView) {
            require(["views/UserView"], function (UserView) {
              MetacatUI.appView.userView = new UserView();

              MetacatUI.appView.showView(
                MetacatUI.appView.userView,
                viewOptions,
              );
            });
          } else
            MetacatUI.appView.showView(MetacatUI.appView.userView, viewOptions);
        }
      },

      renderMyProfile: function (section, subsection) {
        if (
          MetacatUI.appUserModel.get("checked") &&
          !MetacatUI.appUserModel.get("loggedIn")
        )
          this.renderSignIn();
        else if (!MetacatUI.appUserModel.get("checked")) {
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            function () {
              if (MetacatUI.appUserModel.get("loggedIn"))
                this.renderProfile(
                  MetacatUI.appUserModel.get("username"),
                  section,
                  subsection,
                );
              else this.renderSignIn();
            },
          );
        } else if (
          MetacatUI.appUserModel.get("checked") &&
          MetacatUI.appUserModel.get("loggedIn")
        ) {
          this.renderProfile(
            MetacatUI.appUserModel.get("username"),
            section,
            subsection,
          );
        }
      },

      logout: function (param) {
        //Clear our browsing history when we log out
        this.routeHistory.length = 0;

        if (
          (typeof MetacatUI.appModel.get("tokenUrl") == "undefined" ||
            !MetacatUI.appModel.get("tokenUrl")) &&
          !MetacatUI.appView.registryView
        ) {
          require(["views/RegistryView"], function (RegistryView) {
            MetacatUI.appView.registryView = new RegistryView();
            if (MetacatUI.appView.currentView.onClose)
              MetacatUI.appView.currentView.onClose();
            MetacatUI.appUserModel.logout();
          });
        } else {
          if (
            MetacatUI.appView.currentView &&
            MetacatUI.appView.currentView.onClose
          )
            MetacatUI.appView.currentView.onClose();
          MetacatUI.appUserModel.logout();
        }
      },

      renderSignIn: function () {
        var router = this;

        //If there is no SignInView yet, create one
        if (!MetacatUI.appView.signInView) {
          require(["views/SignInView"], function (SignInView) {
            MetacatUI.appView.signInView = new SignInView({
              el: "#Content",
              fullPage: true,
            });
            router.renderSignIn();
          });

          return;
        }

        //If the user status has been checked and they are already logged in, we will forward them to their profile
        if (
          MetacatUI.appUserModel.get("checked") &&
          MetacatUI.appUserModel.get("loggedIn")
        ) {
          this.navigate("my-profile", { trigger: true });
          return;
        }
        //If the user status has been checked and they are NOT logged in, show the SignInView
        else if (
          MetacatUI.appUserModel.get("checked") &&
          !MetacatUI.appUserModel.get("loggedIn")
        ) {
          this.routeHistory.push("signin");
          MetacatUI.appView.showView(MetacatUI.appView.signInView);
        }
        //If the user status has not been checked yet, wait for it
        else if (!MetacatUI.appUserModel.get("checked")) {
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            this.renderSignIn,
          );
          MetacatUI.appView.showView(MetacatUI.appView.signInView);
        }
      },

      renderSignInSuccess: function () {
        $("body").html("Sign-in successful.");
        setTimeout(window.close, 1000);
      },

      renderLdapSignInSuccess: function () {
        //If there is an LDAP sign in error message
        if (
          window.location.pathname.indexOf(
            "error=Unable%20to%20authenticate%20LDAP%20user",
          ) > -1
        ) {
          this.renderLdapOnlySignInError();
        } else {
          this.renderSignInSuccess();
        }
      },

      renderLdapSignInError: function () {
        this.routeHistory.push("signinldaperror");

        if (!MetacatUI.appView.signInView) {
          require(["views/SignInView"], function (SignInView) {
            MetacatUI.appView.signInView = new SignInView({ el: "#Content" });
            MetacatUI.appView.signInView.ldapError = true;
            MetacatUI.appView.signInView.ldapOnly = true;
            MetacatUI.appView.signInView.fullPage = true;
            MetacatUI.appView.showView(MetacatUI.appView.signInView);
          });
        } else {
          MetacatUI.appView.signInView.ldapError = true;
          MetacatUI.appView.signInView.ldapOnly = true;
          MetacatUI.appView.signInView.fullPage = true;
          MetacatUI.appView.showView(MetacatUI.appView.signInView);
        }
      },

      renderLdapOnlySignInError: function () {
        this.routeHistory.push("signinldaponlyerror");

        if (!MetacatUI.appView.signInView) {
          require(["views/SignInView"], function (SignInView) {
            var signInView = new SignInView({ el: "#Content" });
            signInView.ldapError = true;
            signInView.ldapOnly = true;
            signInView.fullPage = true;
            MetacatUI.appView.showView(signInView);
          });
        } else {
          var signInView = new SignInView({ el: "#Content" });
          signInView.ldapError = true;
          signInView.ldapOnly = true;
          signInView.fullPage = true;
          MetacatUI.appView.showView(signInView);
        }
      },

      renderLdapSignIn: function () {
        this.routeHistory.push("signinLdap");

        if (!MetacatUI.appView.signInView) {
          require(["views/SignInView"], function (SignInView) {
            MetacatUI.appView.signInView = new SignInView({ el: "#Content" });
            MetacatUI.appView.signInView.ldapOnly = true;
            MetacatUI.appView.signInView.fullPage = true;
            MetacatUI.appView.showView(MetacatUI.appView.signInView);
          });
        } else {
          var signInLdapView = new SignInView({ el: "#Content" });
          MetacatUI.appView.signInView.ldapOnly = true;
          MetacatUI.appView.signInView.fullPage = true;
          MetacatUI.appView.showView(signInLdapView);
        }
      },

      navigateToDefault: function () {
        //Navigate to the default view
        this.navigate(MetacatUI.appModel.defaultView, { trigger: true });
      },

      /*
       * Gets an array of route names that are set on this router.
       * @return {Array} - An array of route names, not including any special characters
       */
      getRouteNames: function () {
        var router = this;

        var routeNames = _.map(Object.keys(this.routes), function (routeName) {
          return router.getRouteName(routeName);
        });

        //The "view" and portals routes are not included in the route hash (they are set up during initialize),
        // so we have to manually add it here.
        routeNames.push("view");
        if (!routeNames.includes(MetacatUI.appModel.get("portalTermPlural"))) {
          routeNames.push(MetacatUI.appModel.get("portalTermPlural"));
        }

        return routeNames;
      },

      /*
       * Gets the route name based on the route pattern given
       * @param {string} routePattern - A string that represents the route pattern e.g. "view(/pid)"
       * @return {string} - The name of the route without any pattern special characters e.g. "view"
       */
      getRouteName: function (routePattern) {
        var specialChars = ["/", "(", "*", ":"];

        _.each(specialChars, function (specialChar) {
          var substring = routePattern.substring(
            0,
            routePattern.indexOf(specialChar),
          );

          if (substring && substring.length < routePattern.length) {
            routePattern = substring;
          }
        });

        return routePattern;
      },

      closeLastView: function () {
        //Get the last route and close the view
        var lastRoute = _.last(this.routeHistory);

        if (lastRoute == "summary") MetacatUI.appView.statsView.onClose();
        else if (lastRoute == "profile") MetacatUI.appView.userView.onClose();
      },

      clearJSONLD: function () {
        MetacatUI.appView.schemaOrg.removeExistingJsonldEls();
        MetacatUI.appView.schemaOrg.setSchemaFromTemplate();
      },

      clearHighwirePressMetaTags: function () {
        $("head > meta[name='citation_title']").remove();
        $("head > meta[name='citation_authors']").remove();
        $("head > meta[name='citation_publisher']").remove();
        $("head > meta[name='citation_date']").remove();
      },
    },
  );

  return UIRouter;
});
