define([
  "jquery",
  "underscore",
  "backbone",
  "clipboard",
  "collections/UserGroup",
  "models/UserModel",
  "models/Stats",
  "views/StatsView",
  "views/DataCatalogView",
  "views/UserGroupView",
  "text!templates/userProfile.html",
  "text!templates/alert.html",
  "text!templates/loading.html",
  "text!templates/userProfileMenu.html",
  "text!templates/userSettings.html",
  "text!templates/noResults.html",
], (
  $,
  _,
  Backbone,
  Clipboard,
  UserGroup,
  UserModel,
  Stats,
  StatsView,
  DataCatalogView,
  UserGroupView,
  userProfileTemplate,
  AlertTemplate,
  LoadingTemplate,
  ProfileMenuTemplate,
  SettingsTemplate,
  NoResultsTemplate,
) => {
  "use strict";

  const TEXT_TO_HTML_EL = (txt) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = txt;
    return tmp.firstChild;
  };

  /**
   * @class UserView
   * @classdesc A major view that displays a public profile for the user and a settings page for the logged-in user
   * to manage their account info, groups, identities, and API tokens.
   * @classcategory Views
   * @screenshot views/UserView.png
   * @augments Backbone.View
   */
  const UserView = Backbone.View.extend(
    /** @lends UserView.prototype */ {
      el: "#Content",

      // Templates
      profileTemplate: _.template(userProfileTemplate),
      alertTemplate: _.template(AlertTemplate),
      loadingTemplate: _.template(LoadingTemplate),
      settingsTemplate: _.template(SettingsTemplate),
      menuTemplate: _.template(ProfileMenuTemplate),
      noResultsTemplate: _.template(NoResultsTemplate),

      /**
       * A jQuery selector for the element that the PortalListView should be inserted into
       * @type {string}
       */
      portalListContainer: ".my-portals-container",

      events: {
        "click .section-link": "switchToSection",
        "click .subsection-link": "switchToSubSection",
        "click .token-generator": "getToken",
        "click #mod-save-btn": "saveUser",
        "click [highlight-subsection]": "highlightSubSection",
        "keypress #add-group-name": "preventSubmit",
        "click .token-tab": "switchTabs",
      },

      initialize() {
        this.subviews = [];
      },

      // ------------------------------------------ Rendering the main parts of the view ------------------------------------------------//
      render(options) {
        // Don't render anything if the user profiles are turned off
        if (MetacatUI.appModel.get("enableUserProfiles") === false) {
          return this;
        }

        this.stopListening();
        if (this.model) this.model.stopListening();

        // Create a Stats model
        this.statsModel = new Stats();

        this.activeSection =
          options && options.section ? options.section : "profile";
        this.activeSubSection =
          options && options.subsection ? options.subsection : "";
        this.username =
          options && options.username ? options.username : undefined;

        // Add the container element for our profile sections
        this.sectionHolder = $(document.createElement("section")).addClass(
          "user-view-section",
        );
        this.$el.html(this.sectionHolder);

        // Show the loading sign first
        $(this.sectionHolder).html(this.loadingTemplate());
        this.$el.show();

        // set the header type
        MetacatUI.appModel.set("headerType", "default");

        // Render the user profile only after the app user's info has been checked
        // This prevents the app from rendering the profile before the login process has completed - which would
        // cause this profile to render twice (first before the user is logged in then again after they log in)
        if (MetacatUI.appUserModel.get("checked")) this.renderUser();
        else MetacatUI.appUserModel.on("change:checked", this.renderUser, this);

        return this;
      },

      /**
       * Update the window location path to route to /portals path
       * @param {string} username - Short identifier for the member node
       */
      forwardToPortals(username) {
        const pathName = decodeURIComponent(window.location.pathname)
          .substring(MetacatUI.root.length)
          // remove trailing forward slash if one exists in path
          .replace(/\/$/, "");

        // Routes the /profile/{node-id} to /portals/{node-id}
        const pathRE = /\/profile(\/[^/]*)?$/i;
        const newPathName = `${pathName.replace(
          pathRE,
          "",
        )}/${MetacatUI.appModel.get("portalTermPlural")}/${username}`;

        // Update the window location
        MetacatUI.uiRouter.navigate(newPathName, {
          trigger: true,
          replace: true,
        });
      },

      renderUser() {
        const view = this;
        this.model = MetacatUI.appUserModel;

        const username =
          MetacatUI.appModel.get("profileUsername") || view.username;
        const currentUser = MetacatUI.appUserModel.get("username") || "";

        if (username.toUpperCase() === currentUser.toUpperCase()) {
          // Case-insensitive matching of usernames
          this.model = MetacatUI.appUserModel;
          this.model.set("type", "user");

          // If the user is logged in, display the settings options
          if (this.model.get("loggedIn")) {
            this.insertMenu();
            this.renderProfile();
            this.renderSettings();
            this.resetSections();
          }
        }

        // If this isn't the currently-logged in user, then let's find out more info about this account
        else {
          // Create a UserModel with the username given
          this.model = new UserModel({
            username,
          });

          // Is this a member node?
          if (MetacatUI.nodeModel.get("checked") && this.model.isNode()) {
            this.model.saveAsNode();
            this.model.set(
              "nodeInfo",
              _.find(
                MetacatUI.nodeModel.get("members"),
                (nodeModel) =>
                  nodeModel.identifier.toLowerCase() ===
                  `urn:node:${username.toLowerCase()}`,
              ),
            );
            this.forwardToPortals(username);
            return;
          }
          // If the node model hasn't been checked yet
          if (!MetacatUI.nodeModel.get("checked")) {
            const user = this.model;
            this.listenTo(MetacatUI.nodeModel, "change:checked", () => {
              if (user.isNode()) view.render();
            });
          }

          // When we get the infomration about this account, then crender the profile
          this.model.once("change:checked", this.renderProfile, this);
          this.model.once("change:checked", this.resetSections, this);
          // Get the info
          this.model.getInfo();
        }

        // When the model is reset, refresh the page
        this.listenTo(this.model, "reset", this.render);
      },

      renderProfile() {
        // Insert the template first
        const profileEl = $.parseHTML(
          this.profileTemplate({
            type: this.model.get("type"),
            logo: this.model.get("logo") || "",
            description: this.model.get("description") || "",
            user: this.model.toJSON(),
          }).trim(),
        );

        // If the profile is being redrawn, then replace it
        if (this.$profile && this.$profile.length) {
          // If the profile section is currently hidden, make sure we hide our new profile rendering too
          if (!this.$profile.is(":visible")) $(profileEl).hide();

          this.$profile.replaceWith(profileEl);
        }
        // If this is a fresh rendering, then append it to the page and save it
        else this.sectionHolder.append(profileEl);

        this.$profile = $(profileEl);

        // If this user hasn't uploaded anything yet, display so
        this.listenTo(this.statsModel, "change:totalCount", () => {
          if (!this.statsModel.get("totalCount")) this.noActivity();
        });

        // Insert the user data statistics
        this.insertStats();

        // Insert the user's basic information
        this.listenTo(this.model, "change:fullName", this.insertUserInfo);
        this.insertUserInfo();

        // Listen to changes in the user's search terms
        this.listenTo(this.model, "change:searchModel", this.renderProfile);

        // Insert this user's data content
        this.insertContent();

        // create the UserGroupView to generate the membership list
        // this is the first call to UserGroupView so we instantiate it here
        const groupView = new UserGroupView({ model: this.model });
        this.subviews.push(groupView);
        this.renderMembershipList();
      },

      renderMembershipList() {
        // List the groups this user is in by creating usergroupview subview
        // List the groups this user is in by creating usergroupview subview
        const groupView = _.where(this.subviews, { type: "UserGroupView" }).at(
          0,
        );

        if (this.model.get("type") === "group") {
          // Create the User Group collection
          const options = {
            name: this.model.get("fullName"),
            groupId: this.model.get("username"),
            rawData: this.model.get("rawData") || null,
          };
          const userGroup = new UserGroup([], options);
          // Create the group list and add it to the page
          const viewOptions = { collapsable: false, showGroupName: false };
          const groupList = groupView.createGroupList(userGroup, viewOptions);
          this.$("#user-membership-container").html(groupList);
        } else {
          const groups = _.sortBy(this.model.get("isMemberOf"), "name");
          if (!groups.length) {
            this.$("#user-membership-header").hide();
            return;
          }
          this.sectionHolder.append(
            groupView
              .insertMembership(groups, this.$("#user-membership-container"))
              .html(),
          );
        }
      },

      renderGroupsSection() {
        const groupView = _.where(this.subviews, { type: "UserGroupView" }).at(
          0,
        );
        const container = this.$("#groups-container");
        container.append(groupView.render().el);
      },

      renderSettings() {
        // Don't render anything if the user profile settings are turned off
        if (MetacatUI.appModel.get("enableUserProfileSettings") === false) {
          return;
        }

        if (this.settingsEl) {
          this.settingsEl.remove();
          this.settingsEl = null;
        }

        const settingsText = this.settingsTemplate({
          ...this.model.toJSON(),
          emailContact: MetacatUI.appModel.get("emailContact") || "",
        });
        this.settingsEl = TEXT_TO_HTML_EL(settingsText.trim());

        // Insert the template first
        this.sectionHolder.append(this.settingsEl);
        this.$settings = this.$("[data-section='settings']");

        // Draw the group list
        this.renderGroupsSection();

        // Listen for the identity list
        this.listenTo(this.model, "change:identities", this.insertIdentityList);
        this.insertIdentityList();

        // Listen for the pending list

        // Render the portals subsection
        this.renderMyPortals();

        // Listen for updates to person details
        this.listenTo(
          this.model,
          "change:lastName change:firstName change:email change:registered",
          this.updateModForm,
        );
        this.updateModForm();

        // init autocomplete fields
        this.setUpAutocomplete();

        // Get the token right away
        this.getToken();
      },

      /*
       * Displays a menu for the user to switch between different views of the user profile
       */
      insertMenu() {
        if (this.menu) {
          this.menu.remove();
          this.menu = null;
        }
        // If the user is not logged in, then remove the menu
        if (!MetacatUI.appUserModel.get("loggedIn")) {
          this.$(".nav").remove();
          return;
        }

        // Otherwise, insert the menu
        const menuText = this.menuTemplate({
          username: this.model.get("username"),
        });
        this.menu = TEXT_TO_HTML_EL(menuText.trim());
        this.el.prepend(this.menu);
      },

      // ------------------------------------------ Navigating sections of view ------------------------------------------------//
      switchToSection(e, sectionName) {
        if (e) e.preventDefault();

        const label = sectionName || $(e.target).attr("data-section");

        // Hide all the sections first
        $(this.sectionHolder).children().slideUp().removeClass(".active");

        // Display the specified section
        let activeSection = this.$(`.section[data-section='${label}']`);
        if (!activeSection.length)
          activeSection = this.$(".section[data-section='profile']");
        $(activeSection).addClass("active").slideDown();

        // Change the navigation tabs
        this.$(".nav-tab").removeClass("active");
        $(`.nav-tab[data-section='${label}']`).addClass("active");

        // Find all the subsections, if there are any
        if ($(activeSection).find(".subsection").length > 0) {
          // Find any item classified as "active"
          const activeItem = $(activeSection).find(".active");
          if (activeItem.length > 0) {
            // Find the data section this active item is referring to
            if ($(activeItem).children("[data-subsection]").length > 0) {
              // Get the section name
              const subsectionName = $(activeItem)
                .find("[data-subsection]")
                .first()
                .attr("data-subsection");
              // If we found a section name, find the subsection element and display it
              if (subsectionName) this.switchToSubSection(null, subsectionName);
            } else
              this.switchToSubSection(
                null,
                $(activeSection)
                  .children("[data-section]")
                  .first()
                  .attr("data-section"),
              );
          }
        }
      },

      /**
       * Activate (show) a sub-section and hide all others
       * @param {Event} e - The click event that triggered this function
       * @param {string} subsectionName - The name of the sub-section to show,
       * if an event did not trigger this function
       */
      switchToSubSection(e, subsectionName) {
        let label = subsectionName;

        if (e) {
          e.preventDefault();
          label = $(e.target).attr("data-section");
          if (!label) {
            label = $(e.target)
              .parents("[data-section]")
              .first()
              .attr("data-section");
          }
        }

        this.hideActiveSubSections();
        this.showSubSection(label);
      },

      /** Hide contents of all sub-sections that are active */
      hideActiveSubSections() {
        // Unactivate all the subsection links
        const activeLinks = document.querySelectorAll(
          ".subsection-link.active",
        );

        activeLinks.forEach((link) => link.classList.remove("active"));

        // Hide all the subsections
        const activeSubsections = document.querySelectorAll(
          ".section.active .subsection",
        );

        activeSubsections.forEach((subsection) => {
          const el = subsection;
          el.style.display = "none";
        });
      },

      /**
       * Activate (show) a sub-section
       * @param {string} label - The data-section label of the sub-section to show
       */
      showSubSection(label) {
        const sectionLink = document.querySelector(
          `.subsection-link[data-section='${label}']`,
        );
        if (sectionLink) sectionLink.classList.add("active");

        const subsection = document.querySelector(
          `.subsection[data-section='${label}']`,
        );
        if (subsection) subsection.style.display = "block";
      },

      resetSections() {
        // Hide all the sections first, then display the section specified in the URL (or the default)
        this.$(".subsection, .section").hide();
        this.switchToSection(null, this.activeSection);

        // Show the subsection
        if (this.activeSubSection)
          this.switchToSubSection(null, this.activeSubSection);
      },

      highlightSubSection(e, subsectionName) {
        let label = subsectionName;

        if (e) e.preventDefault();

        if (!label && e) {
          // Get the subsection name
          label = $(e.target).attr("highlight-subsection");
          if (!label) return;
        } else if (!label && !e) return;

        // Find the subsection
        let subsection = this.$(`.subsection[data-section='${label}']`);
        if (!subsection.length)
          subsection = this.$("[data-subsection='add-account']");
        if (!subsection.length) return;

        // Visually highlight the subsection
        subsection.addClass("highlight");
        MetacatUI.appView.scrollTo(subsection);
        // Wait about a second and then remove the highlight style
        window.setTimeout(() => {
          subsection.removeClass("highlight");
        }, 1500);
      },

      // ------------------------------------------ Inserting public profile UI elements ------------------------------------------------//
      insertStats() {
        if (this.model.noActivity && this.statsView) {
          this.statsView.$el.addClass("no-activity");
          this.$("#total-download-wrapper, section.downloads").hide();
          return;
        }

        const view = this;

        // Insert a couple stats into the profile
        this.listenToOnce(
          this.statsModel,
          "change:firstUpload",
          this.insertFirstUpload,
        );

        this.listenToOnce(this.statsModel, "change:totalCount", () => {
          view
            .$("#total-upload-container")
            .text(
              MetacatUI.appView.commaSeparateNumber(
                view.statsModel.get("totalCount"),
              ),
            );
        });

        // Create a base query for the statistics
        const statsSearchModel = this.model.get("searchModel").clone();
        statsSearchModel
          .set("exclude", [], { silent: true })
          .set("formatType", [], { silent: true });
        this.statsModel.set("query", statsSearchModel.getQuery());
        this.statsModel.set("isSystemMetadataQuery", true);
        this.statsModel.set("searchModel", statsSearchModel);

        // Create the description for this profile
        let description;

        switch (this.model.get("type")) {
          case "node":
            description = `A summary of all datasets from the ${this.model.get(
              "fullName",
            )} repository`;
            break;
          case "group":
            description = `A summary of all datasets from the ${this.model.get(
              "fullName",
            )} group`;
            break;
          case "user":
            description = `A summary of all datasets from ${this.model.get("fullName")}`;
            break;
          default:
            description = "";
            break;
        }

        // Render the Stats View for this person
        this.statsView = new StatsView({
          title: "Statistics and Figures",
          description,
          userType: "user",
          el: this.$("#user-stats"),
          model: this.statsModel,
        });
        this.subviews.push(this.statsView);
        this.statsView.render();
        if (this.model.noActivity) this.statsView.$el.addClass("no-activity");
      },

      /*
       * Insert the name of the user
       */
      insertUserInfo() {
        // Don't try to insert anything if we haven't gotten all the user info yet
        if (!this.model.get("fullName")) return;

        // Insert the name into this page
        const usernameLink = $(document.createElement("a"))
          .attr(
            "href",
            `${MetacatUI.root}/profile/${this.model.get("username")}`,
          )
          .text(this.model.get("fullName"));
        this.$(".insert-fullname").append(usernameLink);

        // Insert the username
        if (this.model.get("type") !== "node") {
          if (!this.model.get("usernameReadable"))
            this.model.createReadableUsername();
          this.$(".insert-username").text(this.model.get("usernameReadable"));
        } else {
          $("#username-wrapper").hide();
        }

        // Show or hide ORCID logo
        if (this.model.isOrcid()) this.$(".show-orcid").removeClass("hidden");
        else this.$(".show-orcid").addClass("hidden");

        // Show the email
        if (this.model.get("email")) {
          this.$(".email-wrapper").show();
          const parts = this.model.get("email").split("@");
          this.$(".email-container").attr("data-user", parts[0]);
          this.$(".email-container").attr("data-domain", parts[1]);
        } else this.$(".email-wrapper").hide();
      },

      // Creates an HTML element to display in front of the user identity/subject.
      // Only used for the ORCID logo right now
      createIdPrefix() {
        if (this.model.isOrcid())
          return $(document.createElement("img"))
            .attr("src", `${MetacatUI.root}/img/orcid_64x64.png`)
            .addClass("orcid-logo");
        return "";
      },

      /*
       * Insert the first year of contribution for this user
       */
      insertFirstUpload() {
        if (this.model.noActivity || !this.statsModel.get("firstUpload")) {
          this.$(
            "#first-upload-container, #first-upload-year-container",
          ).hide();
          return;
        }

        // Get the first upload or first operational date
        let firstUpload;
        if (this.model.get("type") === "node") {
          // Get the member node object
          const node = _.findWhere(MetacatUI.nodeModel.get("members"), {
            identifier: `urn:node:${this.model.get("username")}`,
          });

          // If there is no memberSince date, then hide this statistic and exit
          if (!node.memberSince) {
            this.$(
              "#first-upload-container, #first-upload-year-container",
            ).hide();
            return;
          }
          firstUpload = node.memberSince
            ? new Date(
                node.memberSince.substring(0, node.memberSince.indexOf("T")),
              )
            : new Date();
        } else {
          firstUpload = new Date(this.statsModel.get("firstUpload"));
        }

        // Construct the first upload date sentence
        const monthNames = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        const m = monthNames[firstUpload.getUTCMonth()];
        const y = firstUpload.getUTCFullYear();
        const d = firstUpload.getUTCDate();

        // For Member Nodes, start all dates at July 2012, the beginning of DataONE
        if (this.model.get("type") === "node") {
          this.$("#first-upload-container").text(
            `DataONE Member Node since ${y}`,
          );
        } else
          this.$("#first-upload-container").text(
            `Contributor since ${m} ${d}, ${y}`,
          );

        // Construct the time-elapsed sentence
        const now = new Date();
        const msElapsed = now - firstUpload;
        const years = msElapsed / 31556952000;
        const months = msElapsed / 2629746000;
        const weeks = msElapsed / 604800000;
        const days = msElapsed / 86400000;
        let time = "";

        // If one week or less, express in days
        if (weeks <= 1) {
          time = `${Math.round(days) || 1} day`;
          if (days > 1.5) time += "s";
        }
        // If one month or less, express in weeks
        else if (months < 1) {
          time = `${Math.round(weeks) || 1} week`;
          if (weeks > 1.5) time += "s";
        }
        // If less than 12 months, express in months
        else if (months <= 11.5) {
          time = `${Math.round(months) || 1} month`;
          if (months > 1.5) time += "s";
        }
        // If one year or more, express in years and months
        else {
          let yearsOnly = Math.floor(years) || 1;
          let monthsOnly = Math.round((years % 1) * 12);

          if (monthsOnly === 12) {
            yearsOnly += 1;
            monthsOnly = 0;
          }

          time = `${yearsOnly} year`;
          if (yearsOnly > 1) time += "s";

          if (monthsOnly) time += `, ${monthsOnly} month`;
          if (monthsOnly > 1) time += "s";
        }

        this.$("#first-upload-year-container").text(time);
      },

      /*
       * Insert a list of this user's content
       */
      insertContent() {
        if (this.model.noActivity) {
          this.$("#data-list").html(
            this.noResultsTemplate({
              fullName: this.model.get("fullName"),
              username:
                this.model === MetacatUI.appUserModel &&
                MetacatUI.appUserModel.get("loggedIn")
                  ? this.model.get("username")
                  : null,
            }),
          );
          return;
        }

        const view = new DataCatalogView({
          el: this.$("#data-list")[0],
          searchModel: this.model.get("searchModel"),
          searchResults: this.model.get("searchResults"),
          mode: "list",
          isSubView: true,
          filters: false,
        });
        this.subviews.push(view);
        view.render();
        view.$el.addClass("list-only");
        view.$(".auto-height").removeClass("auto-height").css("height", "auto");
        $("#metacatui-app").removeClass("DataCatalog mapMode");
      },

      /*
       * When this user has not uploaded any content, render the profile differently
       */
      noActivity() {
        this.model.noActivity = true;
        this.insertContent();
        this.insertFirstUpload();
        this.insertStats();
      },

      // ------------------------------------------------ Identities/Accounts -------------------------------------------------------//
      /**
       *  @deprecated since 2.36.0. Users should contact support to link
       * accounts.
       */
      sendMapRequest() {},

      /**
       * @deprecated since 2.36.0. Users should contact support to unlink
       * accounts.
       */
      removeMap() {},

      /** @deprecated since 2.36.0. */
      confirmMapRequest() {},

      /** @deprecated since 2.36.0. */
      rejectMapRequest() {},

      insertIdentityList() {
        const identities = this.model.get("identities");

        // Remove the equivalentIdentities list if it was drawn already so we don't do it twice
        this.$("#identity-list-container").empty();

        if (!identities) return;

        // Create the list element
        let identityList;
        if (identities.length < 1) {
          identityList = $(document.createElement("p")).text(
            "You have no linked accounts.",
          );
          identityList.addClass("well");
        } else
          identityList = $(document.createElement("ul"))
            .addClass("list-identity")
            .attr("id", "identity-list");

        const view = this;
        // Create a list item for each identity
        _.each(identities, (identity) => {
          const listItem = view.createUserListItem(identity, {
            confirmed: true,
          });

          // When/if the info from the equivalent identities is retrieved, update the item
          view.listenToOnce(identity, "change:fullName", (id) => {
            const newListItem = view.createUserListItem(id, {
              confirmed: true,
            });
            listItem.replaceWith(newListItem);
          });

          $(identityList).append(listItem);
        });

        // Add to the page
        this.$("#identity-list-container").append(identityList);
      },

      /** @deprecated since 2.36.0 */
      insertPendingList() {},

      createUserListItem(user) {
        const username = user.get("username");
        const fullName = user.get("fullName") || username;

        const listItem = $(document.createElement("li")).addClass(
          "list-group-item identity",
        );
        const link = $(document.createElement("a"))
          .attr("href", `${MetacatUI.root}/profile/${username}`)
          .attr("data-identity", username)
          .text(fullName);
        const details = $(document.createElement("span"))
          .addClass("subtle details")
          .text(username);

        listItem.append(link, details);

        if (user.isOrcid()) {
          details.prepend(this.createIdPrefix(), " ORCID: ");
        } else details.prepend(" Username: ");

        return listItem;
      },

      updateModForm() {
        this.$("#mod-givenName").val(this.model.get("firstName"));
        this.$("#mod-familyName").val(this.model.get("lastName"));
        this.$("#mod-email").val(this.model.get("email"));

        if (!this.model.get("email")) {
          this.$("#mod-email").parent(".form-group").addClass("has-warning");
          this.$("#mod-email")
            .parent(".form-group")
            .find(".help-block")
            .text("Please provide an email address.");
        } else {
          this.$("#mod-email").parent(".form-group").removeClass("has-warning");
          this.$("#mod-email")
            .parent(".form-group")
            .find(".help-block")
            .text("");
        }

        if (this.model.get("registered")) {
          this.$("#registered-user-container").show();
        } else {
          this.$("#registered-user-container").hide();
        }
      },

      /*
       * Gets the user account settings, updates the UserModel and saves this new info to the server
       */
      saveUser(e) {
        e.preventDefault();

        const view = this;
        const container =
          this.$('[data-subsection="edit-account"] .content') ||
          $(e.target).parent();

        const success = () => {
          $(container).find(".loading").detach();
          $(container).children().show();
          view.showAlert(
            "Success! Your profile has been updated.",
            "alert-success",
            container,
          );
        };
        const error = (data) => {
          $(container).find(".loading").detach();
          $(container).children().show();
          const msg =
            data && data.responseText
              ? data.responseText
              : "Sorry, updating your profile failed. Please try again.";
          if (!data.responseText) view.showAlert(msg, "alert-error", container);
        };

        // Get info entered into form
        const givenName = this.$("#mod-givenName").val();
        const familyName = this.$("#mod-familyName").val();
        const email = this.$("#mod-email").val();

        // Update the model
        this.model.set("firstName", givenName);
        this.model.set("lastName", familyName);
        this.model.set("email", email);

        // Loading icon
        $(container).children().hide();
        $(container).prepend(this.loadingTemplate());

        // Send the update
        this.model.update(success, error);
      },

      // ---------------------------------- Token -----------------------------------------//
      getToken() {
        const { model } = this;

        // Show loading sign
        this.$("#token-generator-container").html(this.loadingTemplate());

        // When the token is retrieved, then show it
        this.listenToOnce(this.model, "change:token", this.showToken);

        // Get the token from the CN
        this.model.getToken((data, _textStatus, _xhr) => {
          model.getTokenExpiration();
          model.set("token", data);
          model.trigger("change:token");
        });
      },

      showToken() {
        const token = this.model.get("token");

        if (!token || !this.model.get("loggedIn")) return;

        const expires = this.model.get("expires");
        const rTokenName =
          MetacatUI.appModel.get("d1CNBaseUrl").indexOf("cn.dataone.org") > -1
            ? "dataone_token"
            : "dataone_test_token";
        const rToken = `options(${rTokenName} = "${token}")`;
        const matlabToken = `import org.dataone.client.run.RunManager; mgr = RunManager.getInstance(); mgr.configuration.authentication_token = '${token}';`;
        const tokenInput = $(document.createElement("textarea"))
          .attr("type", "text")
          .attr("rows", "5")
          .addClass("token copy")
          .text(token);
        const copyButton = $(document.createElement("a"))
          .addClass("btn btn-primary copy")
          .text("Copy")
          .attr("data-clipboard-text", token);
        const copyRButton = $(document.createElement("a"))
          .addClass("btn btn-primary copy")
          .text("Copy")
          .attr("data-clipboard-text", rToken);
        const copyMatlabButton = $(document.createElement("a"))
          .addClass("btn btn-primary copy")
          .text("Copy")
          .attr("data-clipboard-text", matlabToken);
        const successIcon = $(document.createElement("i")).addClass(
          "icon icon-ok",
        );
        const copySuccess = $(document.createElement("div"))
          .addClass("notification success copy-success hidden")
          .append(successIcon, " Copied!");
        const expirationMsg = expires
          ? `<strong>Note:</strong> Your authentication token expires on ${expires.toLocaleDateString()} at ${expires.toLocaleTimeString()}`
          : "";
        let usernameMsg = "<div class='footnote'>Your user identity: ";
        const usernamePrefix = this.createIdPrefix();
        const tabs = $(document.createElement("ul"))
          .addClass("nav nav-tabs")
          .append(
            $(document.createElement("li"))
              .addClass("active")
              .append(
                $(document.createElement("a"))
                  .attr("href", "#token-code-panel")
                  .addClass("token-tab")
                  .text("Token"),
              ),
          )
          .append(
            $(document.createElement("li")).append(
              $(document.createElement("a"))
                .attr("href", "#r-token-code-panel")
                .addClass("token-tab")
                .text("Token for DataONE R"),
            ),
          )
          .append(
            $(document.createElement("li")).append(
              $(document.createElement("a"))
                .attr("href", "#matlab-token-code-panel")
                .addClass("token-tab")
                .text("Token for Matlab DataONE Toolbox"),
            ),
          );
        const tokenRInput = $(document.createElement("textarea"))
          .attr("type", "text")
          .attr("rows", "5")
          .addClass("token copy")
          .text(rToken);
        const tokenRText = $(document.createElement("p")).text(
          "Copy this code snippet to use your token with the DataONE R package.",
        );
        const tokenMatlabInput = $(document.createElement("textarea"))
          .attr("type", "text")
          .attr("rows", "5")
          .addClass("token copy")
          .text(matlabToken);
        const tokenMatlabText = $(document.createElement("p")).text(
          "Copy this code snippet to use your token with the Matlab DataONE toolbox.",
        );
        const tokenInputContain = $(document.createElement("div"))
          .attr("id", "token-code-panel")
          .addClass("tab-panel active")
          .append(tokenInput, copyButton, copySuccess);
        const rTokenInputContain = $(document.createElement("div"))
          .attr("id", "r-token-code-panel")
          .addClass("tab-panel")
          .append(tokenRText, tokenRInput, copyRButton, copySuccess.clone())
          .addClass("hidden");
        const matlabTokenInputContain = $(document.createElement("div"))
          .attr("id", "matlab-token-code-panel")
          .addClass("tab-panel")
          .append(
            tokenMatlabText,
            tokenMatlabInput,
            copyMatlabButton,
            copySuccess.clone(),
          )
          .addClass("hidden");

        if (typeof usernamePrefix === "object")
          usernameMsg += usernamePrefix[0].outerHTML;
        else if (typeof usernamePrefix === "string")
          usernameMsg += usernamePrefix;

        usernameMsg += `${this.model.get("username")}</div>`;

        const successMessage = $.parseHTML(
          this.alertTemplate({
            msg: `Copy your authentication token: <br/> ${expirationMsg}${usernameMsg}`,
            classes: "alert-success",
            containerClasses: "well",
          }),
        );
        $(successMessage).append(
          tabs,
          tokenInputContain,
          rTokenInputContain,
          matlabTokenInputContain,
        );
        this.$("#token-generator-container").html(successMessage);

        $(".token-tab").tab();

        // Create clickable "Copy" buttons to copy text (e.g. token) to the user's clipboard
        const clipboard = new Clipboard(".copy");

        clipboard.on("success", () => {
          $(".copy-success").show().delay(3000).fadeOut();
        });

        clipboard.on("error", (e) => {
          const textarea = $(e.trigger).parent().children("textarea.token");
          textarea.trigger("focus");
          textarea.tooltip({
            title: "Press Ctrl+c to copy",
            placement: "bottom",
          });
          textarea.tooltip("show");
        });
      },

      setUpAutocomplete() {
        const input = this.$(".account-autocomplete");
        if (!input || !input.length) return;

        // look up registered identities
        $(input).hoverAutocomplete({
          source(request, response) {
            const term = $.ui.autocomplete.escapeRegex(request.term);

            const list = [];

            // Ids/Usernames that we want to ignore in the autocompelte
            const ignoreEquivIds =
              $(this.element).attr("id") === "map-request-field";
            const ignoreIds = ignoreEquivIds
              ? MetacatUI.appUserModel.get("identitiesUsernames")
              : [];
            ignoreIds.push(
              MetacatUI.appUserModel.get("username").toLowerCase(),
            );

            const url = `${MetacatUI.appModel.get(
              "accountsUrl",
            )}?query=${encodeURIComponent(term)}`;
            const requestSettings = {
              url,
              success(data, _textStatus, _xhr) {
                _.each($(data).find("person"), (person) => {
                  const item = {};
                  item.value = $(person).find("subject").text();

                  // Don't display yourself in the autocomplete dropdown (prevents users from adding themselves as an equivalent identity or group member)
                  // Also don't display your equivalent identities in the autocomplete
                  if (_.contains(ignoreIds, item.value.toLowerCase())) return;

                  item.label =
                    $(person).find("fullName").text() ||
                    `${$(person).find("givenName").text()} ${$(person)
                      .find("familyName")
                      .text()}`;
                  list.push(item);
                });

                response(list);
              },
            };
            $.ajax(
              _.extend(
                requestSettings,
                MetacatUI.appUserModel.createAjaxSettings(),
              ),
            );

            // Send an ORCID search when the search string gets long enough
            if (request.term.length > 3)
              MetacatUI.appLookupModel.orcidSearch(
                request,
                response,
                false,
                ignoreIds,
              );
          },
          select(e, ui) {
            e.preventDefault();

            // set the text field
            $(e.target).val(ui.item.value);
            $(e.target)
              .parents("form")
              .find("input[name='fullName']")
              .val(ui.item.label);
          },
          position: {
            my: "left top",
            at: "left bottom",
            collision: "none",
          },
        });
      },

      /**
       * Renders a list of portals that this user is an owner of.
       */
      renderMyPortals() {
        // If my portals has been disabled, don't render the list
        if (MetacatUI.appModel.get("showMyPortals") === false) {
          return;
        }

        const view = this;

        // If Bookkeeper services are enabled, render the Portals via a PortalUsagesView,
        // which queries Bookkeeper for portal Usages
        if (MetacatUI.appModel.get("enableBookkeeperServices")) {
          // eslint-disable-next-line import/no-dynamic-require
          require(["views/portals/PortalUsagesView"], (PortalUsagesView) => {
            const portalListView = new PortalUsagesView();
            // Render the Portal list view and insert it in the page
            portalListView.render();
            view.$(view.portalListContainer).html(portalListView.el);
          });
        }
        // If Bookkeeper services are disabled, render the Portals via a PortalListView,
        // which queries Solr for portal docs
        else {
          // eslint-disable-next-line import/no-dynamic-require
          require(["views/portals/PortalListView"], (PortalListView) => {
            // Create a PortalListView
            const portalListView = new PortalListView();
            // Render the Portal list view and insert it in the page
            portalListView.render();
            view.$(view.portalListContainer).html(portalListView.el);
          });
        }
      },

      // ---------------------------------- Misc. and Utilities -----------------------------------------//

      showAlert(msg, classes, container) {
        const classesFinal = classes || "alert-success";
        const containerFinal =
          container && $(container).length ? container : this.$el;

        // Remove any alerts that are already in this container
        if ($(containerFinal).children(".alert-container").length > 0)
          $(containerFinal).children(".alert-container").remove();

        $(containerFinal).prepend(
          this.alertTemplate({
            msg,
            classesFinal,
          }),
        );
      },

      switchTabs(e) {
        e.preventDefault();
        $(e.target).tab("show");
        this.$(".tab-panel").hide();
        this.$(`.tab-panel${$(e.target).attr("href")}`).show();
        this.$("#token-generator-container .copy-button").attr(
          "data-clipboard-text",
        );
      },

      preventSubmit(e) {
        if (e.keyCode !== 13) return;

        e.preventDefault();
      },

      onClose() {
        // Clear the template
        this.$el.html("");

        // Reset the active section and subsection
        this.activeSection = "profile";
        this.activeSubSection = "";

        // Reset the model
        if (this.model) {
          this.model.noActivity = null;
          this.stopListening(this.model);
        }

        // Remove saved elements
        this.$profile = null;

        // Stop listening to changes in models
        this.stopListening(this.statsModel);
        this.stopListening(MetacatUI.appUserModel);

        // Close the subviews
        _.each(this.subviews, (view) => {
          view.onClose();
        });
        this.subviews = [];
      },
    },
  );

  return UserView;
});
