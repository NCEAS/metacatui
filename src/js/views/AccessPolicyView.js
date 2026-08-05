define([
  "underscore",
  "jquery",
  "backbone",
  "models/AccessRule",
  "collections/AccessPolicy",
  "views/AccessRuleView",
  "text!templates/accessPolicy.html",
  "text!templates/filters/toggleFilter.html",
], function (
  _,
  $,
  Backbone,
  AccessRule,
  AccessPolicy,
  AccessRuleView,
  Template,
  ToggleTemplate,
) {
  const SPINNER_HTML =
    '<i class="icon icon-spinner icon-spin icon-on-left"></i>';

  /**
   * @class AccessPolicyView
   * @classdesc Edits access policies through the legacy Backbone rule views.
   *
   * This view accepts two types of access policy inputs. Legacy `DataONEObject`
   * callers pass a `collections/AccessPolicy` through `options.collection`. The
   * view derives context from `collection.dataONEObject` and uses the existing
   * save path. The newer DataPackage callers pass a typed System Metadata
   * policy, explicit display context, and an apply callback.
   *
   * The editing controls still operate on `collections/AccessPolicy`. In the
   * typed policy mode, the view copies the typed rules into that legacy
   * collection and returns the edited collection through `onApply`. This keeps
   * `PortalEditorView` on its current `DataONEObject` path during the
   * migration. Once portal access policy editing uses typed System Metadata,
   * remove the legacy collection mode and its save and broadcast branches.
   * @classcategory Views
   * @extends Backbone.View
   * @screenshot views/AccessPolicyView.png
   * @constructor
   */
  var AccessPolicyView = Backbone.View.extend(
    /** @lends AccessPolicyView.prototype */
    {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "AccessPolicy",

      /**
       * The type of object/resource that this AccessPolicy is for. This is used for display purposes only.
       * @example "dataset", "portal", "data file"
       * @type {string}
       */
      resourceType: "resource",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "access-policy-view",

      /**
       * The AccessPolicy collection that is displayed in this View
       * @type {AccessPolicy}
       */
      collection: undefined,

      /**
       * References to templates for this view. HTML files are converted to Underscore.js templates
       * @type {Underscore.Template}
       */
      template: _.template(Template),
      toggleTemplate: _.template(ToggleTemplate),

      /**
       * Used to track the collection of models set on the view in order to handle
       * undoing all changes made when we either hit Cancel or click otherwise
       * hide the modal (such as clicking outside of it).
       * @type {AccessRule[]}
       * @since 2.15.0
       */
      cachedModels: null,

      /**
       * Whether this view edits package level sharing. Package level views show
       * the apply to all control; legacy DataONEObject views also broadcast
       * their policy through the legacy package collection.
       * @type {boolean}
       * @since 2.15.0
       */
      broadcast: false,

      /**
       * A selector for the element in this view that contains the public/private toggle section
       * @type {string}
       * @since 2.15.0
       */
      publicToggleSection: "#public-toggle-section",

      /**
       * Explicit rendering and apply context for this policy editor. This
       * replaces the old assumption that the collection carries a target
       * similar to a DataONEObject on `collection.dataONEObject`.
       * @type {object}
       */
      policyContext: null,

      /**
       * Async apply callback supplied with an explicit policy.
       * @type {Function|null}
       */
      onApply: null,

      /**
       * Whether this view is currently applying changes.
       * @type {boolean}
       */
      isApplying: false,

      /**
       * Cached rightsHolder so cancelling or hiding restores edits made in the
       * view.
       * @type {string|null|undefined}
       */
      cachedRightsHolder: undefined,

      /**
       * The events this view will listen to and the associated function to call.
       * @type {Object}
       */
      events: {
        "change .public-toggle-container input": "togglePrivacy",
        "click .apply": "apply",
        "click .cancel": "reset",
        "click .access-rule .remove": "handleRemove",
        hide: "handleHide",
      },

      /**
       * Creates a view in legacy collection or explicit policy mode.
       * @param {object} options View options
       * @param {AccessPolicy} [options.collection] Legacy Backbone policy
       * collection owned by a `DataONEObject`
       * @param {Array<object>} [options.policy] Typed System Metadata policy
       * copied into an editable legacy collection
       * @param {object} [options.policyContext] Explicit display/editor context
       * @param {Function} [options.onApply] Applies edits from explicit policy
       * mode
       */
      initialize(options = {}) {
        this.hasExplicitPolicy = Object.prototype.hasOwnProperty.call(
          options,
          "policy",
        );
        this.collection = this.hasExplicitPolicy
          ? this.normalizeAccessPolicy(options.policy)
          : options.collection;
        this.onApply = this.hasExplicitPolicy ? options.onApply || null : null;

        if (this.hasExplicitPolicy) {
          this.policyContext = _.extend({}, options.policyContext);
        } else {
          const { dataONEObject } = this.collection;
          this.policyContext = dataONEObject
            ? {
                fileName: dataONEObject.get("fileName"),
                rightsHolder: dataONEObject.get("rightsHolder"),
                canChangePermission: dataONEObject.get(
                  "isAuthorized_changePermission",
                ),
                type: dataONEObject.type,
              }
            : {};
        }

        this.cachedRightsHolder = this.getRightsHolder();
        this.cachedModels = this.collection.map((model) => model.clone());
      },

      /**
       * Adapt a typed System Metadata policy to the Backbone collection
       * consumed by the existing `AccessRuleView` editing UI.
       * @param {Array<object>} policy System Metadata access policy
       * @returns {AccessPolicy} Legacy access policy collection
       * @since 0.0.0
       */
      normalizeAccessPolicy(policy) {
        const collection = new AccessPolicy();

        _.each(policy, (rule) => {
          _.each(rule.subjects, (subject) => {
            collection.add({
              subject,
              read: rule.permissions.includes("read"),
              write: rule.permissions.includes("write"),
              changePermission: rule.permissions.includes("changePermission"),
            });
          });
        });

        return collection;
      },

      /**
       * Get the rightsHolder for the policy target.
       * @returns {string|null|undefined} Current rightsHolder subject
       * @since 0.0.0
       */
      getRightsHolder() {
        return this.policyContext.rightsHolder;
      },

      /**
       * Update the current rightsHolder and the legacy model when present.
       * @param {string|null|undefined} subject New rightsHolder subject
       * @since 0.0.0
       */
      setRightsHolder(subject) {
        this.policyContext.rightsHolder = subject || null;
        if (this.collection.dataONEObject) {
          this.collection.dataONEObject.set("rightsHolder", subject || null);
        }
      },

      /**
       * Get the resource label used in modal copy.
       * @returns {string} Display resource type
       * @since 0.0.0
       */
      getResourceType() {
        switch (this.policyContext?.type) {
          case "Portal":
            return MetacatUI.appModel.get("portalTermSingular");
          case "DataPackage":
            return "dataset";
          case "EML":
          case "ScienceMetadata":
            return "metadata record";
          case "DataONEObject":
            return "data file";
          case "Collection":
            return "collection";
          default:
            return "resource";
        }
      },

      /**
       * Promote another owner access rule into the rightsHolder slot.
       * @since 0.0.0
       */
      replaceRightsHolder() {
        const owner = this.collection.findWhere({ changePermission: true });

        if (!owner) {
          return;
        }

        this.setRightsHolder(owner.get("subject"));
        this.collection.remove(owner);
      },

      /**
       * Renders this view
       */
      render: function () {
        try {
          this.resourceType = this.getResourceType();

          const showApplyToAll = this.broadcast && this.hasExplicitPolicy;
          const disableApplyToAll =
            showApplyToAll &&
            MetacatUI.rootDataPackage?.getNestedResourceMapMembers?.().length >
              0;

          //Insert the template into this view
          this.$el.html(
            this.template({
              resourceType: this.resourceType,
              fileName: this.policyContext?.fileName,
              showApplyToAll,
              disableApplyToAll,
              applyToDraft: this.hasExplicitPolicy,
            }),
          );

          if (disableApplyToAll) {
            this.$(".apply-to-all-members-option").popup({
              content:
                "Apply to all members is unavailable because this dataset contains a nested package, which is read-only in the editor.",
              position: "top center",
            });
          }

          //If the user is not authorized to change the permissions of this object,
          // then skip rendering the rest of the AccessPolicy.
          if (this.policyContext?.canChangePermission === false) {
            this.showUnauthorized();
            return;
          }

          //Show the rightsHolder as an AccessRuleView
          this.showRightsholder();

          var modelsToRemove = [];

          //Iterate over each AccessRule in the AccessPolicy and render a AccessRuleView
          this.collection.each(function (accessRule) {
            //Don't display access rules for the public since these are controlled via the public/private toggle
            if (accessRule.get("subject") == "public") {
              return;
            }

            //If this AccessRule is a duplicate of the rightsHolder, remove it from the policy and don't display it
            if (accessRule.get("subject") === this.getRightsHolder()) {
              modelsToRemove.push(accessRule);
              return;
            }

            //Create an AccessRuleView
            const accessRuleView = new AccessRuleView({ model: accessRule });
            accessRuleView.accessPolicyView = this;

            //Add the AccessRuleView to this view
            this.$(".access-rules-container").append(accessRuleView.el);

            //Render the view
            accessRuleView.render();

            //Listen to changes on the access rule, to check that there is at least one owner
            this.listenTo(
              accessRule,
              "change:read change:write change:changePermission",
              this.checkForOwners,
            );
          }, this);

          //Remove each AccessRule from the AccessPolicy that should be removed.
          // We don't remove these during the collection.each() function because it
          // messes up the .each() iteration.
          this.collection.remove(modelsToRemove);

          //Get the subject info for each subject in the AccessPolicy, so we can display names
          this.collection.getSubjectInfo();

          //Show a blank row at the bottom of the table for adding a new Access Rule.
          this.addEmptyRow();

          //Render various help text for this view
          this.renderHelpText();

          //Render the public/private toggle, if it's enabled in the app config
          this.renderPublicToggle();
        } catch (e) {
          MetacatUI.appView.showAlert(
            "Something went wrong while trying to display the " +
              MetacatUI.appModel.get("accessPolicyName") +
              ". <p>Technical details: " +
              e.message +
              "</p>",
            "alert-error",
            this.$el,
            null,
          );
          console.error(e);
        }
      },

      /**
       * Renders a public/private toggle that toggles the public readability of the given resource.
       */
      renderPublicToggle: function () {
        //Check if the public/private toggle is enabled. Default to enabling it.
        var isEnabled = true,
          enabledSubjects = [];

        //Get the DataONEObject that this AccessPlicy is about
        // If there is a target type, use it to choose the right app config.
        if (this.policyContext?.type) {
          //Get the Portal configs from the AppConfig
          if (this.policyContext.type === "Portal") {
            isEnabled = MetacatUI.appModel.get("showPortalPublicToggle");
            enabledSubjects = MetacatUI.appModel.get(
              "showPortalPublicToggleForSubjects",
            );
          }
          //Get the Dataset configs from the AppConfig
          else {
            isEnabled = MetacatUI.appModel.get("showDatasetPublicToggle");
            enabledSubjects = MetacatUI.appModel.get(
              "showDatasetPublicToggleForSubjects",
            );
          }
        }

        //Get the public/private help text
        let helpText = this.getPublicToggleHelpText();

        // Or if the public toggle is limited to a set of users and/or groups, and the current user is
        // not in that list, then display a message instead of the toggle
        if (
          !isEnabled ||
          (Array.isArray(enabledSubjects) &&
            enabledSubjects.length &&
            !_.intersection(
              enabledSubjects,
              MetacatUI.appUserModel.get("allIdentitiesAndGroups"),
            ).length)
        ) {
          const isPublicClass = this.collection.isPublic()
            ? "public"
            : "private";
          this.$(".public-toggle-container").html(
            $(document.createElement("p"))
              .addClass("public-toggle-disabled-text " + isPublicClass)
              .text(helpText),
          );
          this.$(this.publicToggleSection).find("p.help").remove();
          return;
        }

        //Render the private/public toggle
        this.$(".public-toggle-container")
          .html(
            this.toggleTemplate({
              label: "",
              id: this.cid,
              trueLabel: "Public",
              falseLabel: "Private",
            }),
          )
          .tooltip({
            placement: "top",
            trigger: "hover",
            title: helpText,
            container: this.$(".public-toggle-container"),
            delay: {
              show: 800,
            },
          });

        //If the dataset is public, check the checkbox
        this.$(".public-toggle-container input").prop(
          "checked",
          this.collection.isPublic(),
        );
      },

      /**
       * Constructs and returns a message that explains if this resource is public or private. This message is displayed
       * in the tooltip for the public/private toggle or in place of the toggle when the toggle is disabled. Override this
       * function to create a custom message.
       * @returns {string}
       * @since 2.15.0
       */
      getPublicToggleHelpText: function () {
        if (this.collection.isPublic()) {
          return (
            "Your " +
            this.resourceType +
            " is public. Anyone can see this " +
            this.resourceType +
            " in searches or by a direct link."
          );
        } else {
          return (
            "Your " +
            this.resourceType +
            " is private. Only people you approve can see this " +
            this.resourceType +
            "."
          );
        }
      },

      /**
       * Render a row with input elements for adding a new AccessRule
       */
      addEmptyRow: function () {
        try {
          //Create a new AccessRule model and add to the collection
          var accessRule = new AccessRule({
            read: true,
          });

          //Create a new AccessRuleView
          const accessRuleView = new AccessRuleView({ model: accessRule });
          accessRuleView.accessPolicyView = this;
          accessRuleView.isNew = true;

          this.listenTo(accessRule, "change", this.addAccessRule);

          //Add the new row to the table
          this.$(".access-rules-container").append(accessRuleView.el);

          //Render the AccessRuleView
          accessRuleView.render();
        } catch (e) {
          console.error(
            "Something went wrong while adding the empty access policy row ",
            e,
          );
        }
      },

      /**
       * Adds the given AccessRule model to the AccessPolicy collection associated with this view
       * @param {AccessRule} accessRule - The AccessRule to add
       */
      addAccessRule: function (accessRule) {
        //If this AccessPolicy already contains this AccessRule, then exit
        if (this.collection.contains(accessRule)) {
          return;
        }

        //If there is no subject set on this AccessRule, exit
        if (!accessRule.get("subject")) {
          return;
        }

        //Add the AccessRule to the AccessPolicy
        this.collection.push(accessRule);

        //Get the name for this new person or group
        accessRule.getSubjectInfo();

        //Render a new empty row
        this.addEmptyRow();
      },

      /**
       * Adds an AccessRuleView that represents the rightsHolder of the object.
       *  The rightsHolder needs to be handled specially because it's not a regular access rule in the system metadata.
       */
      showRightsholder: function () {
        //If the app is configured to hide the rightsHolder, then exit now
        if (!MetacatUI.appModel.get("displayRightsHolderInAccessPolicy")) {
          return;
        }

        // If there is no rightsHolder associated with this access policy, then exit
        if (!this.getRightsHolder()) {
          return;
        }

        //Create an AccessRule model that represents the rightsHolder
        var accessRuleModel = new AccessRule({
          subject: this.getRightsHolder(),
          read: true,
          write: true,
          changePermission: true,
        });

        //Create an AccessRuleView
        const accessRuleView = new AccessRuleView({ model: accessRuleModel });
        accessRuleView.accessPolicyView = this;
        accessRuleView.allowChanges = MetacatUI.appModel.get(
          "allowChangeRightsHolder",
        );

        //Add the AccessRuleView to this view
        if (this.$(".access-rules-container .new").length) {
          this.$(".access-rules-container .new").before(accessRuleView.el);
        } else {
          this.$(".access-rules-container").append(accessRuleView.el);
        }

        //Render the view
        accessRuleView.render();

        //Get the name for this subject
        accessRuleModel.getSubjectInfo();

        //When the access type is changed, check that there is still at least one owner.
        this.listenTo(
          accessRuleModel,
          "change:read change:write change:changePermission",
          this.checkForOwners,
        );
      },

      /**
       * Checks that there is at least one owner of this resource, and displays a warning message if not.
       * @param {AccessRule} accessRuleModel
       */
      checkForOwners: function (accessRuleModel) {
        try {
          if (!accessRuleModel) {
            return;
          }

          //If changing the rightsHolder is disabled, we don't need to check for owners,
          // since the rightsHolder will always be the owner.
          if (
            !MetacatUI.appModel.get("allowChangeRightsHolder") ||
            !MetacatUI.appModel.get("displayRightsHolderInAccessPolicy")
          ) {
            return;
          }

          //Get the rightsHolder for this resource
          const rightsHolder = this.getRightsHolder();

          //Check if any priveleges have been removed
          if (
            !accessRuleModel.get("read") ||
            !accessRuleModel.get("write") ||
            !accessRuleModel.get("changePermission")
          ) {
            //If there is no owner of this resource
            if (!this.collection.hasOwner()) {
              //If there is no rightsHolder either, then make this person the rightsHolder
              // or if this is the rightsHolder, keep them the rightsHolder
              if (
                !rightsHolder ||
                rightsHolder == accessRuleModel.get("subject")
              ) {
                //Change this access rule back to an ownership level, since there needs to be at least one owner per object
                accessRuleModel.set({
                  read: true,
                  write: true,
                  changePermission: true,
                });

                this.showOwnerWarning();

                if (!rightsHolder) {
                  this.setRightsHolder(accessRuleModel.get("subject"));
                  this.collection.remove(accessRuleModel);
                }
              }
              //If there is a rightsHolder, we don't need to do anything
              else {
                return;
              }
            }
            //If the AccessRule model that was just changed was the rightsHolder,
            // demote that subject as the rightsHolder, and replace with another subject
            else if (rightsHolder == accessRuleModel.get("subject")) {
              //Replace the rightsHolder with a different subject with ownership permissions
              this.replaceRightsHolder();

              //Add the old rightsHolder AccessRule to the AccessPolicy
              this.collection.add(accessRuleModel);
            }
          }
        } catch (e) {
          console.error(
            "Could not check that there are owners in this access policy: ",
            e,
          );
        }
      },

      /**
       * Checks that there is at least one owner of this resource, and displays a warning message if not.
       * @param {Event} event Click event
       */
      handleRemove(event) {
        event.preventDefault();
        if (this.isApplying) {
          return;
        }

        const accessRuleRow = $(event.target).parents(".access-rule");
        const accessRuleModel = accessRuleRow.data("model");
        const accessRuleView = accessRuleRow.data("view");

        //Get the rightsHolder for this resource
        const rightsHolder = this.getRightsHolder();

        //If the rightsHolder was just removed,
        if (rightsHolder === accessRuleModel.get("subject")) {
          //If changing the rightsHolder is disabled, we don't need to check for owners,
          // since the rightsHolder will always be the owner.
          if (
            !MetacatUI.appModel.get("allowChangeRightsHolder") ||
            !MetacatUI.appModel.get("displayRightsHolderInAccessPolicy")
          ) {
            return;
          }

          //If there is another owner of this resource
          if (this.collection.hasOwner()) {
            //Replace the rightsHolder with a different subject with ownership permissions
            this.replaceRightsHolder();

            if (accessRuleView) {
              accessRuleView.remove();
            }
          }
          //If there are no other owners of this dataset, keep this person as the rightsHolder
          else {
            this.showOwnerWarning();
          }
        } else {
          //Remove the AccessRule from the AccessPolicy
          this.collection.remove(accessRuleModel);
        }
      },

      /**
       * Displays a warning message in this view that the object needs at least one owner.
       */
      showOwnerWarning: function () {
        //Show warning message
        var msgContainer = this.$(".modal-body").length
          ? this.$(".modal-body")
          : this.$el;
        MetacatUI.appView.showAlert(
          "At least one person or group needs to be an owner of this " +
            this.resourceType +
            ".",
          "alert-warning",
          msgContainer,
          2000,
          { remove: true },
        );
      },

      /**
       * Renders help text for the form in this view
       */
      renderHelpText: function () {
        try {
          //Create HTML that shows the access policy help text
          var accessExplanationEl = $(document.createElement("div")),
            listEl = $(document.createElement("ul")).addClass("unstyled");

          accessExplanationEl.append(listEl);

          //Get the AccessRule options names
          var accessRuleOptionNames = MetacatUI.appModel.get(
            "accessRuleOptionNames",
          );
          if (
            typeof accessRuleOptionNames !== "object" ||
            !Object.keys(accessRuleOptionNames).length
          ) {
            accessRuleOptionNames = {};
          }

          //Create HTML that shows an explanation of each enabled access rule option
          _.mapObject(
            MetacatUI.appModel.get("accessRuleOptions"),
            function (isEnabled, accessType) {
              //If this access type is disabled, exit
              if (!isEnabled) {
                return;
              }

              var accessTypeExplanation = "",
                accessTypeName = accessRuleOptionNames[accessType];

              //Get explanation text for the given access type
              switch (accessType) {
                case "read":
                  accessTypeExplanation =
                    " - can view this content, even when it's private.";
                  break;
                case "write":
                  accessTypeExplanation =
                    " - can view and edit this content, even when it's private.";
                  break;
                case "changePermission":
                  accessTypeExplanation =
                    " - can view and edit this content, even when it's private. In addition, can add and remove other people from these " +
                    MetacatUI.appModel.get("accessPolicyName") +
                    ".";
                  break;
              }

              //Add this to the list
              listEl.append(
                $(document.createElement("li")).append(
                  $(document.createElement("h5")).text(accessTypeName),
                  $(document.createElement("span")).text(accessTypeExplanation),
                ),
              );
            },
          );

          //Add a popover to the Access column header to give more help text about the access types
          this.$(".access-icon.popover-this").popover({
            title: 'What does "Access" mean?',
            delay: {
              show: 800,
            },
            placement: "top",
            trigger: "hover focus click",
            container: this.$el,
            html: true,
            content: accessExplanationEl,
          });
        } catch (e) {
          console.error("Could not render help text", e);
        }
      },

      /**
       * Toggles the public-read AccessRule for this resource
       */
      togglePrivacy(event) {
        if (this.isApplying) {
          return;
        }

        this.syncPublicToggle(event.currentTarget);
      },

      /**
       * Sync the public/private toggle state into the access policy collection.
       * @param {HTMLElement|jQuery} [input] Public toggle input
       * @since 0.0.0
       */
      syncPublicToggle(input) {
        const publicToggle = input
          ? $(input)
          : this.$(".public-toggle-container input");
        if (!publicToggle.length) {
          return;
        }

        if (publicToggle.is(":checked")) {
          this.collection.makePublic();
        } else {
          this.collection.makePrivate();
        }
      },

      /**
       * Apply the edited policy through the explicit callback or legacy target.
       * @returns {Promise<void>} Resolves when the apply operation completes
       * @since 0.0.0
       */
      async apply() {
        if (this.isApplying) {
          return;
        }

        //Remove any alerts that are currently displayed
        this.$(".alert-container").remove();

        const { dataONEObject } = this.collection;

        if (!this.onApply && !dataONEObject) {
          return;
        }

        try {
          this.setApplying(true);
          this.syncPublicToggle();
          const propagate = this.$(".apply-to-all-members").is(":checked");
          const rightsHolder = this.getRightsHolder();
          const applyOptions = { propagate };
          if (rightsHolder !== this.cachedRightsHolder) {
            applyOptions.rightsHolder = rightsHolder;
          }
          if (propagate) {
            applyOptions.onProgress = ({ completed, total }) => {
              if (!this.isApplying) {
                return;
              }

              const message =
                total > 0
                  ? `Updating ${completed}/${total} files...`
                  : "Updating files...";
              this.$(".apply.btn").html(`${SPINNER_HTML}${message}`);
            };
          }
          if (typeof this.onApply === "function") {
            await this.onApply(this.collection, applyOptions);
          } else {
            await this.applyDataONEObjectPolicy(dataONEObject);
            return;
          }
          this.cachedRightsHolder = this.getRightsHolder();
          this.cachedModels = this.collection.map((model) => model.clone());
          this.setApplying(false);
          this.$el.modal("hide");
          MetacatUI.appView.showAlert(
            "Sharing changes have been applied to this draft. Submit the dataset to save them.",
            "alert-success",
            null,
            null,
            { remove: true },
          );
        } catch (error) {
          this.showApplyError(error?.message || String(error));
        }
      },

      /**
       * Enable or disable the permission modal while changes are applied.
       * @param {boolean} isApplying Whether apply work is in progress
       * @since 0.0.0
       */
      setApplying(isApplying) {
        this.isApplying = isApplying;
        this.$el.toggleClass("applying", this.isApplying);

        if (this.isApplying) {
          this.$el.attr("aria-busy", "true");
          this.$(".apply.btn")
            .html(`${SPINNER_HTML}Updating files...`)
            .attr("disabled", "disabled")
            .addClass("disabled");
          this.$(".cancel.btn, .modal-header .close")
            .attr("disabled", "disabled")
            .addClass("disabled")
            .removeAttr("data-dismiss");
          this.$(".modal-body :input, .modal-footer :input")
            .filter(":disabled")
            .attr("data-disabled-before-applying", "true")
            .end()
            .attr("disabled", "disabled");
          return;
        }

        this.$el.removeAttr("aria-busy");
        this.$(".apply.btn")
          .text(this.hasExplicitPolicy ? "Done" : "Save")
          .removeAttr("disabled")
          .removeClass("disabled");
        this.$(".cancel.btn")
          .removeAttr("disabled")
          .removeClass("disabled")
          .attr("data-dismiss", "modal");
        this.$(".modal-header .close")
          .removeAttr("disabled")
          .removeClass("disabled")
          .attr("data-dismiss", "modal");
        this.$(".modal-body :input, .modal-footer :input")
          .not("[data-disabled-before-applying]")
          .removeAttr("disabled")
          .end()
          .removeAttr("data-disabled-before-applying");
      },

      /**
       * Apply this policy through the legacy DataONEObject system metadata path.
       * @param {Backbone.Model} dataONEObject Object whose policy is being edited
       * @returns {Promise<void>} Resolves when the save completes
       * @since 0.0.0
       */
      applyDataONEObjectPolicy(dataONEObject) {
        if (this.broadcast) {
          MetacatUI.rootDataPackage.broadcastAccessPolicy(this.collection);
        }

        if (dataONEObject.isNew()) {
          this.cachedRightsHolder = this.getRightsHolder();
          this.cachedModels = this.collection.map((model) => model.clone());
          this.setApplying(false);
          this.$el.modal("hide");
          return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
          const handleProgress = (changedModel) => {
            const status = changedModel.get("uploadStatus");
            if (status === "p") {
              this.$(".apply.btn")
                .html(`${SPINNER_HTML}Saving...`)
                .attr("disabled", "disabled");
              return;
            }

            this.stopListening(
              dataONEObject,
              "change:uploadStatus",
              handleProgress,
            );

            if (status === "e") {
              reject(new Error("Your changes could not be saved."));
              return;
            }

            if (status !== "c") {
              return;
            }

            this.cachedRightsHolder = this.getRightsHolder();
            this.cachedModels = this.collection.map((model) => model.clone());
            this.setApplying(false);
            this.$el.modal("hide");
            MetacatUI.appView.showAlert(
              "Sharing changes have been saved.",
              "alert-success",
              null,
              null,
              { remove: true },
            );
            resolve();
          };

          this.listenTo(dataONEObject, "change:uploadStatus", handleProgress);
          try {
            dataONEObject.updateSysMeta();
          } catch (error) {
            this.stopListening(
              dataONEObject,
              "change:uploadStatus",
              handleProgress,
            );
            reject(error);
          }
        });
      },

      /**
       * Show an apply failure message and restore the modal controls.
       * @param {string} message Error message to display
       * @since 0.0.0
       */
      showApplyError(message) {
        this.setApplying(false);

        const msgContainer = this.$(".modal-body").length
          ? this.$(".modal-body")
          : this.$el;

        MetacatUI.appView.showAlert(message, "alert-error", msgContainer, 0, {
          remove: true,
        });
      },

      /**
       * Reset edits when the modal closes, unless an apply operation is active.
       * @param {Event} event Bootstrap modal hide event
       * @returns {boolean} Whether the hide can continue
       * @since 0.0.0
       */
      handleHide(event) {
        if (event.target !== this.el) {
          return true;
        }

        if (this.isApplying) {
          event.preventDefault();
          return false;
        }

        this.reset();
        return true;
      },

      /**
       * Resets the state of the models stored in the view's collection to the
       * latest cached copy. Triggered either when the Cancel button is hit or
       * the modal containing this view is hidden.
       * @since 2.15.0
       */
      reset: function () {
        if (this.isApplying) {
          return;
        }

        this.stopListening();
        this.collection.reset(this.cachedModels.map((model) => model.clone()));
        this.setRightsHolder(this.cachedRightsHolder);
        this.render();
      },

      /**
       * Adds messaging to this view to tell the user they are unauthorized to change the AccessPolicy
       * of this object(s)
       */
      showUnauthorized: function () {
        //Get the container element for the message
        var msgContainer = this.$(".modal-body").length
          ? this.$(".modal-body")
          : this.$el;

        //Empty the container element
        msgContainer.empty();

        //Show the info message
        MetacatUI.appView.showAlert(
          "The person who owns this " +
            this.resourceType +
            " has not given you permission to change the " +
            MetacatUI.appModel.get("accessPolicyName") +
            ". Contact the owner to be added as another owner of this " +
            this.resourceType +
            ".",
          "alert-info subtle",
          msgContainer,
          null,
          { remove: false },
        );

        //Add an unauthorized class to this view for further styling options
        this.$el.addClass("unauthorized");
      },
    },
  );

  return AccessPolicyView;
});
