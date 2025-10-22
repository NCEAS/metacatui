define(["backbone", "views/MetricModalView", "semantic"], (
  Backbone,
  MetricModalView,
  Semantic,
) => {
  "use strict";

  const METRIC_NAMES = ["Citations", "Downloads", "Views"];
  const SEM_VARIATIONS = Semantic.CLASS_NAMES.variations;

  const CLASS_NAMES = {
    metricButton: "btn metrics",
    icon: "icon",
    metricIcon: "metric-icon",
    metricName: "metric-name",
    metricValue: "metric-value",
    iconSpinner: "icon-spinner",
    iconSpin: "icon-spin",
    badge: "badge",
    iconExclamationSign: "icon-exclamation-sign",
    moreInfo: "more-info",
    metricsButtonDisabled: "metrics-button-disabled",
  };

  /**
   * @class MetricView
   * @classdesc the display of the dataset citation and usage metrics on the
   * dataset landing page
   * @classcategory Views
   * @screenshot views/MetricView.png
   * @augments Backbone.View
   */
  const MetricView = Backbone.View.extend(
    /** @lends MetricView.prototype */ {
      tagName: "a",

      /**
       * Class name to be applied to the metric buttons
       * @type {string}
       */
      className: CLASS_NAMES.metricButton,

      /**
       * Attribute to indicate the type of metric
       * @type {string}
       */
      metricName: null,

      /**
       * The Metric Model associated with this view
       * @type {MetricsModel}
       */
      model: null,

      /**
       * The font-awesome icons associated with each metric
       * @type {object}
       * @param {string} Citations - The icon for citations metric
       * @param {string} Downloads - The icon for downloads metric
       * @param {string} Views - The icon for views metric
       * @since 0.0.0
       */
      metricsIcons: {
        Citations: "quote-right",
        Downloads: "cloud-download",
        Views: "eye-open",
      },

      /**
       * The descriptions associated with each metric for tool-tips
       * @type {object}
       * @param {string} Citations - The description for citations metric
       * @param {string} Downloads - The description for downloads metric
       * @param {string} Views - The description for views metric
       * @since 0.0.0
       */
      metricsTooltips: {
        Citations:
          "For all the versions of this dataset, the number of times that all or part of this dataset was cited.",
        Downloads:
          "For all the versions of this dataset, the number of times that all or part of this dataset was downloaded.",
        Views:
          "For all the versions of this dataset, the number of times that all or part of this dataset was viewed.",
      },

      /**
       * Settings passed to the Formantic UI popup module to configure a tooltip
       * shown over the metric button.
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       * @type {object|boolean}
       * @since 0.0.0
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

      /**
       * The template for the metric button
       * @param {object} options - A literal object with options for the
       * template
       * @param {string} options.metricValue - The value of the metric to be
       * displayed
       * @param {string} options.metricIcon - The icon class for the metric
       * @param {string} options.metricName - The name of the metric
       * @returns {string} - The HTML string for the metric button
       */
      metricButtonTemplate: ({ metricValue, metricIcon, metricName }) => {
        const loaderIconClasses = [
          CLASS_NAMES.icon,
          CLASS_NAMES.metricIcon,
          CLASS_NAMES.iconSpinner,
          CLASS_NAMES.iconSpin,
        ].join(" ");
        const val = metricValue || `<i class='${loaderIconClasses}'></i>`;
        return `
          <span class='${CLASS_NAMES.metricIcon}'> <i class='${CLASS_NAMES.icon} ${metricIcon}'></i> </span>
          <span class='${CLASS_NAMES.metricName}'> ${metricName} </span>
          <span class='${CLASS_NAMES.metricValue}'> ${val} </span>
        `.trim();
      },

      /** @inheritdoc */
      events: {
        click: "showMetricModal",
      },

      /**
       * @param {object} options - A literal object with options to pass to the
       * view
       * @param {MetricsModel} options.model - The MetricsModel object
       * associated with this view
       * @param {string} options.metricName - The name of the metric view
       * @param {string} options.pid - Associated dataset identifier with this
       * view
       */
      initialize(options = {}) {
        let name = options.metricName || "";
        name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        this.metricName = name;
        this.model = options.model;
        this.pid = options.pid;
      },

      /**
       * Renders the apprpriate metric view on the UI
       * @returns {MetricView} - The MetricView object
       */
      render() {
        const icon = this.metricsIcons[this.metricName];

        if (!METRIC_NAMES.includes(this.metricName)) {
          this.el.innerHTML = "";
          this.removeTooltip();
          return this;
        }

        this.el.innerHTML = this.metricButtonTemplate({
          metricValue: "",
          metricIcon: `icon-${icon}`,
          metricName: this.metricName,
        });

        // Adding tool-tip for the buttons
        if (MetacatUI.appModel.get("displayDatasetMetricsTooltip")) {
          const tooltipText = this.metricsTooltips[this.metricName];
          this.addTooltip(tooltipText);
        } else {
          this.removeTooltip();
        }

        this.stopListening(this.model);

        // waiting for the fetch() call to succeed.
        this.listenTo(this.model, "sync", this.renderResults);
        // in case when there is an error for the fetch call.
        this.listenTo(this.model, "error", this.renderError);

        return this;
      },

      /**
       * Handles the click functions and displays appropriate modals on click
       * events
       * @param {Event} _e - The click event object
       */
      showMetricModal(_e) {
        if (MetacatUI.appModel.get("displayMetricModals")) {
          const modalView = new MetricModalView({
            metricName: this.metricName,
            metricsModel: this.model,
            pid: this.pid,
          });
          modalView.render();
          this.modalView = modalView;

          if (Array.isArray(this.subviews)) {
            this.subviews.push(modalView);
          } else {
            this.subviews = [modalView];
          }

          // Track this event
          MetacatUI.analytics?.trackEvent(
            "metrics",
            "Click metric",
            this.metricName,
          );
        }
      },

      /**
       * Displays the metrics count and badge on the landing page
       */
      renderResults() {
        const total = this.model.get(`total${this.metricName}`);
        // Check if the metric object exists in results obtained from the
        // service If it does, get its total value else set the total count to 0

        // Replacing the metric total count with the spinning icon.

        this.$(`.${CLASS_NAMES.metricValue}`).text(
          MetacatUI.appView.numberAbbreviator(total, 1),
        );
        this.$(`.${CLASS_NAMES.metricValue}`).addClass(CLASS_NAMES.badge);
      },

      /**
       * Manages error handling in case Metrics Service does not responsd
       */
      renderError() {
        // Replacing the spinning icon with a question-mark when the metrics are
        // not loaded
        const iconEl = this.$(`.${CLASS_NAMES.metricValue}`).find(
          `.${CLASS_NAMES.metricIcon}`,
        );
        iconEl.removeClass(CLASS_NAMES.iconSpinner);
        iconEl.removeClass(CLASS_NAMES.iconSpin);
        iconEl.addClass(CLASS_NAMES.iconExclamationSign);
        iconEl.addClass(CLASS_NAMES.moreInfo);

        this.$el.addClass(CLASS_NAMES.metricsButtonDisabled);

        // Setting the error tool-tip
        this.addTooltip(
          "Metrics are currently unavailable. Please try again later.",
        );
      },

      /**
       * Add a tooltip to the button with the given text
       * @param {string} tooltipText - The text to show in the tooltip
       */
      addTooltip(tooltipText) {
        this.tooltipSettings.content = tooltipText;
        this.$el.popup(this.tooltipSettings);
      },

      /** Remove any tooltip set on the button */
      removeTooltip() {
        this.$el.popup("destroy");
      },

      /**
       * Cleans up listeners from this view
       */
      onClose() {
        this.subviews?.forEach((view) => {
          if (typeof view.onClose === "function") {
            view.onClose();
          }
        });
        this.removeTooltip();
        this.stopListening();
      },
    },
  );

  return MetricView;
});
