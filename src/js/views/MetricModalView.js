/*global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "MetricsChart",
  "text!templates/metricModalTemplate.html",
  "collections/Citations",
  "views/CitationListView",
  "views/SignInView",
], function (
  $,
  _,
  Backbone,
  MetricsChart,
  MetricModalTemplate,
  Citations,
  CitationList,
  SignInView,
) {
  "use strict";

  /**
   * @class MetricModalView
   * @classdesc A Bootstrap Modal that displays a DataONE dataset usage metric,
   * such as downloads, views, or citations.
   * @classcategory Views
   * @extends Backbone.View
   */
  var MetricModalView = Backbone.View.extend(
    /** @lends MetricModalView.prototype */ {
      /**
       * An ID for this view
       * @type {string}
       */
      id: "metric-modal",

      /**
       * Classes to add to the modal
       * @type {string}
       */
      className: "modal fade hide",

      /**
       * The underscore template for this view
       * @type {Underscore.Template}
       */
      template: _.template(MetricModalTemplate),

      /**
       * The model that contains the metrics data
       * @type {MetricsModel}
       */
      metricsModel: null,

      /**
       * A metric option is an object with properties that define how to display
       * a metric in the modal.
       * @typedef {Object} MetricOption
       * @property {string} name - The name of the metric, as it will be
       * displayed in the modal.
       * @property {string} icon - The font awesome icon class for the metric
       * @property {string} metricValue - The name of the property in the
       * metrics model that contains the value for this metric. This will be
       * displayed in the title of the modal.
       * @property {string} render - The name of the method within this view
       * that will render the metric. This method will be called after the
       * basic modal template has been rendered.
       */

      /**
       * The metrics to include in the modal, in the order they will be
       * displayed.
       * @type {MetricOption[]}
       */
      metrics: [
        {
          name: "Downloads",
          icon: "icon-cloud-download",
          metricValue: "totalDownloads",
          render: "drawMetricsChart",
        },
        {
          name: "Citations",
          icon: "icon-quote-left",
          metricValue: "totalCitations",
          render: "showCitations",
        },
        {
          name: "Views",
          icon: "icon-eye-open",
          metricValue: "totalViews",
          render: "drawMetricsChart",
        },
      ],

      /**
       * The name of the metric currently being displayed
       * @type {string}
       */
      metricName: null,

      /**
       * Views that are subviews of this view
       * @type {Backbone.View[]}
       */
      subviews: [],

      /**
       * The events this view will listen for. See
       * {@link https://backbonejs.org/#View-events}
       * @type {Object}
       */
      events: {
        hidden: "teardown",
        "click .left-modal-footer": "showPreviousMetricModal",
        "click .right-modal-footer": "showNextMetricModal",
        "click .register-citation": "showCitationForm",
        "click .login": "showSignInViewPopUp",
      },

      /**
       * Initialize a new MetricModalView
       * @param {Object} options - A literal object with options to pass to the
       * view. The options can include:
       * @param {string} options.metricName - The name of the metric to display
       * in the modal
       * @param {MetricsModel} options.metricsModel - The model that contains
       * the metrics data
       * @param {string} options.pid - The DataONE PID of the dataset that the
       * metrics are for
       */
      initialize: function (options) {
        _.bindAll(this, "show", "teardown", "render", "renderView");
        if (typeof options == "undefined") {
          var options = {};
        }

        this.metricName = options.metricName;
        this.metricsModel = options.metricsModel;
        this.pid = options.pid;
      },

      /**
       * Set a listener that will render the view when the modal is shown
       */
      render: function () {
        var thisView = this;

        this.$el.on("shown", function () {
          thisView.renderView();
          thisView.trigger("renderComplete");
        });

        this.$el.modal("show");

        return this;
      },

      /**
       * Render the view
       * @returns {MetricModalView} - Returns this view
       */
      renderView: function () {
        try {
          // Get the current metric name and associated options
          const metric = this.metricName || this.metrics[0].name;
          const metricOpts = this.metrics.find(
            (metric) => metric.name === this.metricName,
          );

          // Get the name in the singular form in lower case.
          this.metricNameLemma = metric.slice(0, -1).toLowerCase();

          // Render the template
          this.el.innerHTML = this.template({
            metricName: this.metricName,
            metricNameLemma: this.metricNameLemma,
            nextMetric: this.getNextMetric() || "",
            prevMetric: this.getPreviousMetric() || "",
            metricIcon: metricOpts.icon,
            metricValue: this.metricsModel.get(metricOpts.metricValue),
          });

          // Call the specific render function for the metric
          if (typeof this[metricOpts.render] === "function") {
            this[metricOpts.render]();
          }
        } catch (e) {
          console.error("Failed to render the MetricModelView: ", e);
          MetacatUI.appView.showAlert({
            message:
              `Something went wrong displaying the ${this.metricNameLemma}s ` +
              `for this dataset.`,
            classes: "alert-info",
            container: this.$el,
            replaceContents: true,
            includeEmail: true,
          });
        } finally {
          this.$el.modal({ show: false }); // don't show modal on instantiation
        }
      },

      /**
       * Get the previous metric name in the circular queue
       * @returns {string} The name of the previous metric
       */
      getNextMetric: function () {
        return this.getMetricAtOffset(1);
      },

      /**
       * Get the next metric name in the circular queue
       * @returns {string} The name of the next metric
       */
      getPreviousMetric: function () {
        return this.getMetricAtOffset(-1);
      },

      /**
       * Get the metric name at the given offset from the current metric
       * @param {number} n - The offset from the current metric
       * @returns {string} The name of the metric at the given offset
       * @since 2.23.0
       */
      getMetricAtOffset: function (n) {
        const currentMetricName = this.metricName || this.metrics[0].name;
        const currentMetricIndex = this.metrics.findIndex(
          (metric) => metric.name === currentMetricName,
        );
        let metricIndex = (currentMetricIndex + n) % this.metrics.length;
        if (metricIndex < 0) {
          metricIndex = this.metrics.length + metricIndex;
        }
        return this.metrics[metricIndex].name;
      },

      /**
       * Make the modal visible
       */
      show: function () {
        this.$el.modal("show");
      },

      /**
       * Show the previous metric in the modal
       */
      showPreviousMetricModal: function () {
        this.metricName = this.getPreviousMetric();
        this.renderView();
      },

      /**
       * Show the next metric in the modal
       */
      showNextMetricModal: function () {
        this.metricName = this.getNextMetric();
        this.renderView();
      },

      /**
       * Show the citations in the modal. Replace current content.
       */
      showCitations: function () {
        var resultDetails = this.metricsModel.get("resultDetails");
        let citationCollection;

        if (resultDetails) {
          citationCollection = new Citations(resultDetails["citations"], {
            parse: true,
          });
        } else {
          citationCollection = new Citations();
        }

        this.citationCollection = citationCollection;

        var modalBody = this.el.querySelector(".modal-body");

        // Checking if there are any citations available for the List display.
        if (this.metricsModel.get("totalCitations") == 0) {
          var citationList = new CitationList({
            citationsForDataCatalogView: true,
            pid: this.pid,
            el: modalBody,
          });
        } else {
          var citationList = new CitationList({
            citations: this.citationCollection,
            citationsForDataCatalogView: true,
            pid: this.pid,
            el: modalBody,
          });
        }
        citationList.render();
        this.citationList = citationList;
        this.subviews.push(citationList);
      },

      /**
       * Display the Citation registration form
       */
      showCitationForm: function () {
        var viewRef = this;

        // if the user is not currently signed in
        if (!MetacatUI.appUserModel.get("loggedIn")) {
          this.showSignIn();
        } else {
          // close the current modal
          this.teardown();

          require(["views/RegisterCitationView"], function (
            RegisterCitationView,
          ) {
            // display a register citation modal
            var registerCitationView = new RegisterCitationView({
              pid: viewRef.pid,
            });
            registerCitationView.render();
            registerCitationView.show();
          });
        }
      },

      /**
       * Show Sign In buttons
       */
      showSignIn: function () {
        var container = $(document.createElement("div")).addClass(
          "container center",
        );
        this.$el.html(container);

        //Create a SignInView
        let signInView = new SignInView();
        signInView.redirectQueryString = "registerCitation=true";

        //Get the Sign In buttons elements
        var signInButtons = signInView.render().el;
        this.signInButtons = signInButtons;

        //Add the elements to the page
        $(container).append(
          "<h1>Sign in to register citations</h1>",
          signInButtons,
        );
      },

      /**
       * Handle the sign in click event
       */
      showSignInViewPopUp: function () {
        // close the current modal
        this.teardown();

        // display the pop up
        this.signInButtons.showSignInViewPopUp();
      },

      /**
       * Draw the metrics chart
       */
      drawMetricsChart: function () {
        // Create <div class='metric-chart'></div>
        const chartContainer = document.createElement("div");
        chartContainer.className = "metric-chart";
        // Prepend to modal-body
        this.$el.find(".modal-body").prepend(chartContainer);
        var metricCount = MetacatUI.appView.currentView.metricsModel.get(
          this.metricName.toLowerCase(),
        );
        var metricMonths =
          MetacatUI.appView.currentView.metricsModel.get("months");
        var metricName = this.metricName;

        //Draw a metric chart
        var modalMetricChart = new MetricsChart({
          id: "metrics-chart",
          metricCount: metricCount,
          metricMonths: metricMonths,
          metricName: metricName,
          height: 370,
        });

        this.$(".metric-chart").html(modalMetricChart.el);
        modalMetricChart.render();

        this.subviews.push(modalMetricChart);
      },

      /**
       * Remove the modal from the DOM
       */
      teardown: function () {
        this.$el.modal("hide");
        this.$el.data("modal", null);

        _.invoke(this.subviews, "onClose");

        this.remove();
      },

      /**
       * Cleans up and removes all artifacts created for view
       */
      onClose: function () {
        this.teardown();
      },
    },
  );

  return MetricModalView;
});
