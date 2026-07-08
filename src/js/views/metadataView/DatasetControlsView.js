define([
  "jquery",
  "backbone",
  "semantic",
  "models/MetricsModel",
  "views/MetricView",
  "views/citations/CitationModalView",
  "views/notifications/NotificationModalView",
  "common/Utilities",
  "common/ValueUtilities",
], (
  $,
  Backbone,
  Semantic,
  MetricsModel,
  MetricView,
  CitationModalView,
  NotificationModalView,
  Utilities,
  ValueUtilities,
) => {
  "use strict";

  // Semantic UI variation class names.
  const SEM_VARIATIONS = Semantic.CLASS_NAMES.variations;

  // CSS class names used in this view, grouped by semantic purpose.
  const CLASS_NAMES = {
    // Containers for each button/metric
    analyzeContainer: "dataset-analyze-container",
    citeContainer: "dataset-cite-container",
    notificationsContainer: "dataset-notifications-container",
    publishContainer: "dataset-publish-container",
    editContainer: "dataset-edit-metadata-container",
    downloadsContainer: "dataset-downloads-container",
    viewsContainer: "dataset-views-container",
    citationsContainer: "dataset-citations-container",
    reportsContainer: "dataset-reports-container",

    // Containers to separate button types
    metricsContainer: "dataset-metrics-container",
    actionsContainer: "dataset-actions-container",

    // Visual separator
    separator: "dataset-metrics-actions-separator",

    // share Feature is added to share/upload/edit/login features so repo can
    // easily hide them and make the repository ~ "read only"
    shareFeature: "share-feature",

    // Bootstrap classes
    icon: "icon",
    button: "btn",
    primaryButton: "btn-primary",
    dropdown: "dropdown",
    dropdownMenu: "dropdown-menu",
    caret: "caret",

    // Borrowed from MetricView for consistent styling
    metricButton: "metrics",
    buttonLink: "btn-link",
    buttonLinkNeutral: "btn-link--neutral",

    // Other
    iconOnLeft: "icon-on-left",
    hideBelow1200: "hide-below-1200",
    hideAbove1200: "hide-above-1200",
  };

  // Helper to get AppModel properties
  const APP_GET = (prop) => MetacatUI.appModel.get(prop);

  /**
   * @typedef {object} ButtonConfig
   * @property {string} [icon] - Icon name to display on the button.
   * @property {string} [text] - Button label text.
   * @property {string} [id] - Optional DOM id for the button element.
   * @property {string[]} [classes] - Additional CSS classes for styling.
   * @property {string} [tooltip] - Tooltip content.
   * @property {boolean} [dropdown] - True if the button renders a dropdown.
   * @property {string} container - CSS class name of the container element.
   * @property {string} render - Name of the render method on the view.
   */

  /**
   * @class DatasetControls
   * @classdesc A view that displays dataset metrics (views, downloads,
   * citations) and action buttons (download, share, cite) for a dataset
   * metadata view.
   * @classcategory Views/MetadataView
   * @augments Backbone.View
   * @class
   * @screenshot views/metadataView/DatasetControls.png // TODO
   * @since 2.36.0
   */
  const DatasetControls = Backbone.View.extend(
    /** @lends DatasetControls.prototype */
    {
      /**
       * Button configuration map keyed by logical button name.
       * @type {Object<string, ButtonConfig>}
       */
      buttons: {
        mdq: {
          icon: "dashboard",
          text: "Assessment Reports",
          textOnSmallScreen: "Reports",
          singularText: "Assessment Report",
          singularTextOnSmallScreen: "Report",
          classes: [
            CLASS_NAMES.metricButton,
            CLASS_NAMES.buttonLink,
            CLASS_NAMES.buttonLinkNeutral,
          ],
          tooltip:
            "View detailed Assessment Reports about this dataset's metadata and file information.",
          container: CLASS_NAMES.reportsContainer,
          render: "renderMDQ",
        },
        wholetale: {
          icon: "bar-chart",
          text: "Analyze",
          classes: [],
          tooltip:
            "Choose an analysis environment to interactively explore this dataset online using Whole Tale.",
          dropdown: true,
          container: CLASS_NAMES.analyzeContainer,
          render: "renderWholetale",
        },
        cite: {
          icon: "copy",
          text: "Cite",
          id: "cite-this-dataset-btn",
          classes: [],
          tooltip: "View and copy the citation for this dataset.",
          container: CLASS_NAMES.citeContainer,
          render: "renderCite",
        },
        edit: {
          icon: "pencil",
          text: "Edit",
          classes: [CLASS_NAMES.primaryButton],
          tooltip: "Edit this dataset's metadata.",
          container: CLASS_NAMES.editContainer,
          render: "renderEdit",
        },
        publish: {
          icon: "star",
          text: "Publish with DOI",
          textOnSmallScreen: "Publish",
          classes: [CLASS_NAMES.primaryButton],
          id: "publish",
          tooltip:
            "Publish this dataset's metadata with a DOI (Digital Object Identifier).",
          container: CLASS_NAMES.publishContainer,
          render: "renderPublish",
        },
        // Metrics render their own buttons, but we still configure the
        // containers here.
        downloads: {
          container: CLASS_NAMES.downloadsContainer,
          render: "renderDownloads",
        },
        views: {
          container: CLASS_NAMES.viewsContainer,
          render: "renderViews",
        },
        citations: {
          container: CLASS_NAMES.citationsContainer,
          render: "renderCitations",
        },
        // placeholder for future implementation
        notifications: {
          container: CLASS_NAMES.notificationsContainer,
          id: "notifications-btn",
          render: "renderNotifications",
          text: "Watch",
          icon: "bell",
          tooltip: "Be notified of changes to this dataset.",
        },
      },

      /**
       * References to rendered button root elements keyed by name. These will
       * be added during render().
       * @type {Object<string, HTMLElement>}
       */
      buttonEls: {},

      /**
       * Subviews created by this view (MetricView, CitationModalView, etc.).
       * These will be added during render().
       * @type {Backbone.View[]}
       */
      subviews: [],

      /**
       * Render the container structure for metrics and actions.
       * @returns {string} HTML string for the view root content.
       */
      template() {
        return `
          <span class="${CLASS_NAMES.metricsContainer}">
            <span class="${CLASS_NAMES.downloadsContainer}"></span>
            <span class="${CLASS_NAMES.viewsContainer}"></span>
            <span class="${CLASS_NAMES.citationsContainer}"></span>
            <span class="${CLASS_NAMES.separator}"></span>
            <span class="${CLASS_NAMES.reportsContainer}"></span>
          </span>
          <span class="${CLASS_NAMES.actionsContainer}">
            <span class="${CLASS_NAMES.notificationsContainer}"></span>
            <span class="${CLASS_NAMES.analyzeContainer}"></span>
            <span class="${CLASS_NAMES.citeContainer}"></span>
            <span class="${CLASS_NAMES.publishContainer}"></span>
            <span class="${CLASS_NAMES.editContainer}"></span>
          </span>
        `;
      },

      /**
       * Settings passed to the Formantic UI popup module to configure a tooltip
       * shown over the metric button.
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       * @type {object|boolean}
       * @since 2.36.0
       */
      tooltipSettings: {
        variation: `${SEM_VARIATIONS.mini} ${SEM_VARIATIONS.inverted}`,
        position: "top center",
        on: "hover",
        hoverable: true,
        delay: {
          show: 500,
          hide: 40,
        },
      },

      /** @inheritdoc */
      events() {
        const events = {};
        events[`click #${this.buttons.cite.id}`] = "openCitationModal";
        events[`click #${this.buttons.notifications.id}`] =
          "openNotificationsModal";
        events[`click #${this.buttons.publish.id}`] = "publish";
        return events;
      },

      /**
       * Initialize the DatasetControls view.
       * @param {object} [options] - Options to configure the view.
       * @param {string} [options.pid] - Dataset identifier for this view.
       * @param {SolrResults|EML211} [options.metadataModel] - Associated
       * metadata model.
       * @param {boolean} [options.hasWritePermission] - Whether the current
       * user has write permission for the dataset.
       * @param {Function} [options.publishMethod] - Function to publish the
       * dataset. It must return a Promise that resolves when publishing is
       * complete, throwing an error if publishing fails.
       */
      initialize(options = {}) {
        const { metadataModel } = options;

        const pid =
          options.pid ||
          metadataModel?.get("id") ||
          MetacatUI.appModel.get("pid");

        // Immediately create the metricsModel so external views like the
        // CanoncialDatasetHandlerView can access it.
        const metricsModel =
          options.metricsModel ||
          new MetricsModel({
            pid_list: [pid],
            type: "dataset",
          });

        /**
         * @typedef {object} DatasetControlsViewModel
         * @property {string} [pid] - The dataset identifier for this page.
         * @property {SolrResults|EML211} [metadataModel] - The associated
         * metadata model.
         * @property {Function} [publishMethod] - Method to publish the dataset.
         * @property {boolean} [hasWritePermission] - Whether the current user
         * has write permission for the dataset.
         * @property {MetricsModel} [metricsModel] - The metrics model for this
         * dataset.
         */
        this.viewModel = new Backbone.Model({
          pid,
          metadataModel: options.metadataModel,
          publishMethod: options.publishMethod,
          hasWritePermission: options.hasWritePermission === true,
          metricsModel,
        });
        this.notificationsSavedTimer = null;
      },

      /**
       * Render the view content and all configured buttons/metrics.
       * @returns {this} This view instance for chaining.
       */
      render() {
        this.el.innerHTML = this.template();
        this.reset();

        // Re-render when the metadata model or pid changes
        this.listenTo(this.viewModel, "change", this.render);

        if (!this.viewModel.get("pid")) return this;
        const buttons = { ...this.buttons };
        Object.entries(buttons).forEach(([name, config]) => {
          try {
            this[config.render].call(this);
          } catch (error) {
            this.removeButton(name);
            // eslint-disable-next-line no-console
            console.error(`Error rendering the ${name} button:`, error);
          }
        });
        return this;
      },

      /**
       * Clear the view content and remove subviews and event listeners.
       * @param {boolean} [destroyCitationModal] If true, also destroy the
       * citation modal subview. We avoid this unless the entire view is being
       * destroyed because the modal is modified externally (see renderCite()).
       */
      reset(destroyCitationModal = false) {
        this.clearNotificationsSavedIndicator();

        // Remove all the subviews
        this.subviews.forEach((subview) => {
          if (typeof subview.onClose === "function") {
            subview.onClose();
          }
          subview.remove();
        });
        this.subviews = [];
        this.notificationsModal = null;

        // Remove all the buttons
        Object.entries(this.buttons).forEach(([name]) =>
          this.removeButton(name),
        );

        // Remove and close all subviews
        if (destroyCitationModal && this.citationModal) {
          this.citationModal.onClose();
          this.citationModal.remove();
          this.citationModal = null;
        }
        this.stopListening();
      },

      /**
       * Get the container element where a button should be inserted.
       * @param {string} name - Logical button name.
       * @returns {HTMLElement|null} The container element or null if not found.
       */
      getButtonContainer(name) {
        const configedButton = this.buttons[name];
        if (!configedButton) return null;
        const containerClass = configedButton.container;
        return this.el.querySelector(`.${containerClass}`);
      },

      /**
       * Get a previously rendered button element by name.
       * @param {string} name - Logical button name.
       * @returns {HTMLElement|null} The button element if it exists.
       */
      getExistingButtonEl(name) {
        return this.buttonEls?.[name] || null;
      },

      /**
       * Remove a button and clear its container.
       * @param {string} name - Logical button name to remove.
       */
      removeButton(name) {
        const buttonEl = this.getExistingButtonEl(name);
        const container = this.getButtonContainer(name);
        if (buttonEl) {
          $(buttonEl).popup("destroy");
          buttonEl.remove();
          delete this.buttonEls?.[name];
        }
        if (container) {
          container.innerHTML = "";
          container.style.display = "none";
        }
      },

      /**
       * Get or create the metrics model used to fetch dataset metrics.
       * @returns {MetricsModel} The metrics model instance for this view.
       */
      getMetricsModel() {
        const model = this.viewModel.get("metricsModel");

        // Check if the model's been fetched yet
        if (!model.get("synced") && !model.get("fetching")) {
          model.fetch();
        }

        return model;
      },

      /** Render the downloads metric view if enabled. */
      renderDownloads() {
        this.renderMetric.call(this, "downloads");
      },

      /** Render the views metric view if enabled. */
      renderViews() {
        this.renderMetric.call(this, "views");
      },

      /** Render the citations metric view if enabled. */
      renderCitations() {
        this.renderMetric.call(this, "citations");
      },

      /**
       * Render a specific metric widget by name and insert into its container.
       * @param {"downloads"|"views"|"citations"} name - The metric to render.
       */
      renderMetric(name) {
        const pid = this.viewModel.get("pid");

        const metricTypes = {
          downloads: APP_GET("displayDatasetDownloadMetric"),
          citations: APP_GET("displayDatasetCitationMetric"),
          views: APP_GET("displayDatasetViewMetric"),
        };

        if (!metricTypes[name]) return;

        const metrics = this.getMetricsModel();
        const metricView = new MetricView({
          metricName: name,
          model: metrics,
          pid,
        }).render();

        this.buttonEls[name] = metricView.el;
        this.subviews.push(metricView);

        const container = this.getButtonContainer(name);
        container.appendChild(metricView.el);
        // Make sure the container is visible
        container.style.display = "";
      },

      async canEdit() {
        if (this.isObsoleteOrArchived()) return false;
        return this.viewModel.get("hasWritePermission") === true;
      },

      /**
       * Render the Edit Metadata button if the user is authorized and the
       * metadata format is editable.
       */
      async renderEdit() {
        // Do not render the edit button if user does not have permission or the
        // app is configured to hide it.
        if (!APP_GET("displayDatasetEditButton")) return;
        const canEdit = await this.canEdit();

        if (!canEdit) return;

        const editableFormat = this.isEditableFormat();
        // The share-feature class is added to share/upload/edit/login features
        // so repo can easily hide them if needed
        const href = editableFormat ? this.createEditUrl() : null;
        const options = { href };
        if (!editableFormat) {
          options.disabled = true;
          options.href = "#";
          options.tooltip = "This metadata format is not editable.";
        }
        this.renderButton("edit", options);
      },

      /**
       * Render the Publish with DOI button if user is authorized and publishing
       * is allowed.
       */
      async renderPublish() {
        const canEdit = await this.canEdit();
        if (!canEdit) return;
        const canPublish = await this.canPublish();
        if (!canPublish) return;
        this.renderButton("publish");
      },

      /** Render the metadata quality report button */
      renderMDQ() {
        if (!this.canDisplayMDQ()) {
          // hide the separator if no reports are available
          const separator = this.el.querySelector(`.${CLASS_NAMES.separator}`);
          if (separator) separator.style.display = "none";
          return;
        }
        const pid = this.viewModel.get("pid");
        const mdqUrl = `${MetacatUI.root}/quality/${encodeURIComponent(pid)}`;
        // get the number of available reports from the MDQ service
        const numReports = APP_GET("mdqSuiteIds")?.length || 0;

        const options = { href: mdqUrl };
        if (numReports === 1) {
          // use singular text if only one report is available
          options.text = this.buttons.mdq.singularText;
          options.textOnSmallScreen =
            this.buttons.mdq.singularTextOnSmallScreen;
        }
        const button = this.renderButton("mdq", options);

        // show a badge w/ number of reports like the metric buttons
        const badge = document.createElement("span");
        badge.classList.add("metric-value");
        badge.textContent = numReports;
        // place it after the icon and before the text
        const iconEl = button.querySelector("i");
        iconEl.insertAdjacentElement("afterend", badge);

        // add the metric class names to the icon for consistent styling
        iconEl.classList.add("metric-icon");
      },

      /** Render the WholeTale Analyze dropdown button when configured. */
      renderWholetale() {
        if (
          !APP_GET("displayDatasetAnalyzeButton") ||
          !APP_GET("taleEnvironments")?.length
        ) {
          return;
        }
        const button = this.renderButton("wholetale");
        const dropdownMenu = this.createWholetaleMenu();
        button.appendChild(dropdownMenu);
      },

      /**
       * Show the citation modal with the ability to copy the citation text
       */
      renderCite() {
        this.renderButton("cite");
        if (!this.citationModal) {
          this.citationModal = new CitationModalView({
            model: this.viewModel.get("metadataModel"),
            createLink: true,
          }).render();
        }
        // Don't re-create the citation modal on re-render, and don't add it to
        // subviews to be destroyed during reset(), because the
        // CanonicalDatasetHandlerView modifies it. Destroying it would lose
        // changes. Eventually, the canonical citation should live in the
        // metadata model so the CitationModalView can update itself
        // automatically.
      },

      /**
       * Build the WholeTale dropdown menu element from configured environments.
       * @returns {HTMLUListElement} The populated unordered list element.
       */
      createWholetaleMenu() {
        const dropdownMenu = document.createElement("ul");
        dropdownMenu.classList.add(CLASS_NAMES.dropdownMenu);
        APP_GET("taleEnvironments").forEach((env) => {
          const menuItem = document.createElement("li");
          const link = document.createElement("a");
          link.href = this.createWholetaleUrl(env);
          link.textContent = env;
          link.target = "_blank";
          menuItem.appendChild(link);
          dropdownMenu.appendChild(menuItem);
        });
        return dropdownMenu;
      },

      /**
       * Render the notifications button when the feature is enabled.
       * @returns {HTMLElement|null} The rendered button, or null if skipped.
       */
      renderNotifications() {
        if (!APP_GET("enableNotificationService")) return null;

        const button = this.renderButton("notifications");
        if (!button) return null;

        if (!this.notificationsModal) {
          const notificationView = new NotificationModalView({
            pid: this.viewModel.get("pid"),
            metadataModel: this.viewModel.get("metadataModel"),
            buttonEl: button,
          }).render();
          this.subviews.push(notificationView);
          this.notificationsModal = notificationView;
          this.stopListening(notificationView);
          this.listenTo(
            notificationView,
            "subscriptions:saved",
            this.showNotificationsSavedIndicator,
          );
        }

        return button;
      },

      /**
       * Render a button by name into its configured container.
       * @param {string} name - Logical button key.
       * @param {object} [options] - Button option
       * @param {string} [options.href] - URL for the button link.
       * @param {boolean} [options.disabled] - Whether to disable the button.
       * overrides.
       * @returns {HTMLElement|null} The root element for the button, or null if
       * skipped.
       */
      renderButton(
        name,
        options = {
          href: null,
          disabled: false,
        },
      ) {
        // Remove the button if it already exists
        this.removeButton(name);

        // Get the container to insert the button into
        const container = this.getButtonContainer(name);
        if (!container) return null;

        // Get the button configuration
        const configedButton = this.buttons[name];
        if (!configedButton) return null;
        const opts = { ...configedButton, ...options };

        // Create the button element
        let button = document.createElement("a");
        const classes = Array.isArray(opts.classes) ? opts.classes : [];
        button.classList.add(...["btn", ...classes]);
        if (opts.id) button.id = opts.id;

        if (opts.href) button.href = opts.href;

        if (opts.disabled) button.classList.add("disabled");

        if (opts.icon) {
          const icon = document.createElement("i");
          icon.className = `${CLASS_NAMES.icon} icon-${opts.icon} ${CLASS_NAMES.iconOnLeft}`;
          button.appendChild(icon);
        }

        const { text, textOnSmallScreen } = opts;
        if (text) {
          const textSpan = document.createElement("span");
          if (textOnSmallScreen) {
            const mobileSpan = document.createElement("span");
            mobileSpan.classList.add(CLASS_NAMES.hideAbove1200);
            mobileSpan.textContent = textOnSmallScreen;
            textSpan.classList.add(CLASS_NAMES.hideBelow1200);
            textSpan.textContent = text;
            button.appendChild(mobileSpan);
          } else {
            textSpan.textContent = text;
          }
          button.appendChild(textSpan);
        }

        if (opts.tooltip) {
          $(button).popup({
            ...this.tooltipSettings,
            content: opts.tooltip,
          });
        }

        if (opts.dropdown) {
          button.setAttribute("data-toggle", "dropdown");
          button.href = "#";
          const caretSpan = document.createElement("span");
          caretSpan.classList.add("caret");
          button.appendChild(caretSpan);
          const dropdownButton = button;
          button = document.createElement("a");
          button.classList.add(CLASS_NAMES.dropdown);
          button.appendChild(dropdownButton);
        }

        // Store a reference to the button element
        if (!this.buttonEls) this.buttonEls = {};
        this.buttonEls[name] = button;

        // Insert the button into the container
        container.appendChild(button);
        // Make sure the container is visible (set to display:none; when button
        // is removed);
        container.style.display = "";

        return button;
      },

      /**
       * Update a button's inner content and classes for a given state.
       * @param {string} name Button key
       * @param {string} [text] Text label to display
       * @param {"default"|"progress"|"success"|"error"} state Visual state
       */
      updateButtonState(name, text, state = "default") {
        const buttonEl = this.getExistingButtonEl(name);
        if (!buttonEl) return;

        // Save the original HTML for restoration later
        if (!buttonEl.dataset.originalHtml) {
          buttonEl.dataset.originalHtml = buttonEl.innerHTML;
        }

        // Reset to clean state first
        buttonEl.classList.remove("disabled", "success", "error");
        buttonEl.disabled = false;

        // Choose icon/text by state
        const states = {
          progress: {
            icon: "spinner icon-spin",
            text: text || "Processing...",
          },
          success: {
            icon: "check",
            text: text || "Success!",
            buttonClass: "success",
          },
          error: {
            icon: "exclamation",
            text: text || "Error",
            buttonClass: "error",
          },
          default: { restore: true },
        };

        const config = states[state];
        if (!config) return;

        if (config.restore) {
          buttonEl.innerHTML = buttonEl.dataset.originalHtml;
          delete buttonEl.dataset.originalHtml;
          return;
        }

        // Apply new markup
        buttonEl.innerHTML = `<i class='icon icon-${config.icon}'></i> ${config.text}`;
        buttonEl.classList.add(state === "progress" ? "disabled" : state);
        if (config.buttonClass) buttonEl.classList.add(config.buttonClass);
        if (state === "progress") buttonEl.disabled = true;
      },

      /**
       * Temporarily show that notification changes were saved.
       * @since 2.37.0
       */
      showNotificationsSavedIndicator() {
        this.clearNotificationsSavedIndicator(true);
        this.updateButtonState("notifications", "Saved", "success");

        this.notificationsSavedTimer = setTimeout(() => {
          this.updateButtonState("notifications", null, "default");
          this.notificationsSavedTimer = null;
        }, 2500);
      },

      /**
       * Clear the temporary saved indicator timeout.
       * @param {boolean} [restore] Whether to restore the Watch button now.
       * @since 2.37.0
       */
      clearNotificationsSavedIndicator(restore = false) {
        if (this.notificationsSavedTimer) {
          clearTimeout(this.notificationsSavedTimer);
          this.notificationsSavedTimer = null;
        }

        if (restore) {
          this.updateButtonState("notifications", null, "default");
        }
      },

      /** Open the citation modal, creating and rendering it if needed. */
      openCitationModal() {
        this.citationModal?.show();
      },

      openNotificationsModal() {
        this.clearNotificationsSavedIndicator(true);
        this.notificationsModal?.show();
      },

      // --------------------------------------------------------
      // MODEL LOGIC: Methods below belong in a model (TODO)
      // --------------------------------------------------------

      /**
       * Check if the current formatId is supported by the metadata quality
       * suite
       * @returns {boolean} True if the formatId is supported by MDQ, false
       * otherwise
       */
      formatIsMDQSupported() {
        const metadataModel = this.viewModel.get("metadataModel");
        const formatId = metadataModel.get("formatId");
        const mdqFormatIds = MetacatUI.appModel.get("mdqFormatIds") || [];

        return mdqFormatIds.some((pattern) =>
          ValueUtilities.wildcardToRegex(pattern).test(formatId),
        );
      },

      /**
       * Determine if MDQ button should be displayed based on configuration.
       * @returns {boolean} True if MDQ can be displayed, false otherwise.
       */
      canDisplayMDQ() {
        return (
          APP_GET("mdqBaseUrl") &&
          this.formatIsMDQSupported() &&
          APP_GET("displayDatasetQualityMetric") &&
          MetacatUI.appModel.get("mdqSuiteIds")?.length > 0
        );
      },

      /**
       * Determine if this metadata can be published with a DOI, assuming the
       * user has permission to edit it and it is not obsolete or archived.
       * @returns {boolean} True if the metadata can be published, false
       * otherwise
       */
      async canPublish() {
        // The Publish feature has to be enabled for the repo & the model cannot
        // already have a DOI
        const metadata = this.viewModel.get("metadataModel");
        if (!APP_GET("enablePublishDOI") || metadata.isDOI()) {
          return false;
        }

        // Need a publish method to call
        const publishMethod = this.viewModel.get("publishMethod");
        if (typeof publishMethod !== "function") {
          return false;
        }

        // Check if only certain users and groups can publish metadata

        // Get the list of authorized publishers from the AppModel
        const authorizedPublishers = APP_GET("enablePublishDOIForSubjects");
        // If the logged-in user is one of the subjects in the list or is in a
        // group that is in the list, then this metadata can be published.
        // Otherwise, it cannot.
        if (
          Array.isArray(authorizedPublishers) &&
          authorizedPublishers.length
        ) {
          if (MetacatUI.appUserModel.hasIdentityOverlap(authorizedPublishers)) {
            return true;
          }
        } else {
          return true;
        }

        return false;
      },

      /**
       * Determine if the dataset is obsolete or archived.
       * @returns {boolean} True if obsolete or archived, otherwise false.
       */
      isObsoleteOrArchived() {
        const metadata = this.viewModel.get("metadataModel");
        if (!metadata) return false;

        if (
          (metadata.get("obsoletedBy") &&
            metadata.get("obsoletedBy").length > 0) ||
          metadata.get("archived")
        ) {
          return true;
        }

        return false;
      },

      /**
       * Determine if the metadata format is editable in this repository.
       * @returns {boolean} True if the current formatId is allowed to edit.
       */
      isEditableFormat() {
        const metadata = this.viewModel.get("metadataModel");
        if (!metadata) return false;
        const format = metadata.get("formatId");
        const editableFormats = APP_GET("editableFormats") || [];
        return editableFormats.includes(format);
      },

      /**
       * Construct a WholeTale URL for the given environment targeting this
       * dataset.
       * @param {string} env - The WholeTale environment name.
       * @returns {string} The generated WholeTale dashboard URL.
       */
      createWholetaleUrl(env) {
        const baseUrl = MetacatUI.appModel.get("d1CNBaseUrl");
        const dashboardUrl = MetacatUI.appModel.get("dashboardUrl");
        const currentUrl = encodeURIComponent(window.location.href);
        const service = MetacatUI.appModel.get("d1CNService");
        const title = encodeURIComponent(
          this.viewModel.get("metadataModel")?.get("title") ||
            "Untitled Dataset",
        );
        const queryParams = `?uri=${currentUrl}&title=${title}&api=${baseUrl}${service}`;
        return `${dashboardUrl}${queryParams}&environment=${env}`;
      },

      /**
       * Build the URL to edit this dataset in the submit workflow.
       * @returns {string} The edit URL.
       */
      createEditUrl() {
        const pid = this.viewModel.get("pid");
        return `${MetacatUI.root}/submit/${encodeURIComponent(pid)}`;
      },

      /**
       * Publish the data package with a DOI. Calls the publishMethod passed to
       * the view during initialization. Updates the button to show progress,
       * success, or error states.
       * @param {Event} event - The click event
       * @returns {Promise|null} A promise that resolves/rejects when publishing
       * is complete, or undefined if publishing did not start.
       */
      publish(event) {
        event?.preventDefault?.();

        const publishButton =
          event?.currentTarget || event?.target?.closest("a");
        if (
          !publishButton ||
          publishButton.disabled ||
          publishButton.classList.contains("disabled")
        ) {
          return null;
        }

        const pubMethod = this.viewModel.get("publishMethod");
        if (typeof pubMethod !== "function") return null;

        // Disable the publish button to prevent multiple clicks
        this.updateButtonState("publish", "Publishing...", "progress");

        return pubMethod()
          .then(() => {
            this.updateButtonState("publish", "Published!", "success");
            // after a timeout, remove the button. You can't republish
            setTimeout(() => {
              this.removeButton("publish");
            }, 1500);
          })
          .catch(() => {
            this.updateButtonState("publish", "Publish Failed", "error");
          });
      },

      /** Methods to run when the view is closed and removed */
      onClose() {
        this.reset(true);
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return DatasetControls;
});
