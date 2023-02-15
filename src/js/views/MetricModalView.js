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
  SignInView
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
       * The name of the metric currently being displayed
       * @type {string}
       */
      metricName: null,

      /**
       * The model that contains the metrics data
       * @type {MetricsModel}
       */
      metricsModel: null,

      /**
       * The name of the metrics to display in the modal. These will be
       * displayed as a circular queue, so the first metric will be displayed
       * after the last metric.
       * @type {string[]}
       */
      metrics: ["Citations", "Downloads", "Views"],

      /**
       * The index of the current metric in the metrics array
       * @type {number}
       */
      metricIndex: null,

      /**
       * The name of the metric that comes before the current metric in the
       * circular queue
       * @type {string}
       */
      prevMetricName: null,

      /**
       * The name of the metric that comes after the current metric in the
       * circular queue
       * @type {string}
       */
      nextMetricName: null,
      subviews: [],

      /**
       * The events this view will listen for
       * @type {Object}
       * See {@link https://backbonejs.org/#View-events}
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
       * Get the previous metric name in the circular queue
       * @param {string} currentMetricName - The name of the metric currently
       * being displayed
       * @returns {string} The name of the previous metric
       */
      getPreviousMetric: function (currentMetricName) {
        if (currentMetricName != "undefined") {
          this.metricIndex = this.metrics.indexOf(currentMetricName);
        }

        // Implementing a circular queue to get the previous metric
        return this.metrics[
          (this.metricIndex + this.metrics.length - 1) % this.metrics.length
        ];
      },

      /**
       * Get the next metric name in the circular queue
       * @param {string} currentMetricName - The name of the metric currently
       * being displayed
       * @returns {string} The name of the next metric
       */
      getNextMetric: function (currentMetricName) {
        if (currentMetricName != "undefined") {
          this.metricIndex = this.metrics.indexOf(currentMetricName);
        }

        // Implementing a circular queue to get the next metric
        return this.metrics[
          (this.metricIndex + this.metrics.length + 1) % this.metrics.length
        ];
      },

      /**
       * Make the modal visible
       */
      show: function () {
        this.$el.modal("show");
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
       * Set a listener that will render the view when the modal is shown
       */
      render: function () {
        var thisView = this;

        this.$el.on("shown", function () {
          thisView.renderView();
          thisView.drawMetricsChart();
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
          this.metricNameLemma = this.metricName
            .toLowerCase()
            .substring(0, this.metricName.length - 1);

          if (this.metricName === "Citations") {
            var resultDetails = this.metricsModel.get("resultDetails"),
              citationCollection;

            if (resultDetails) {
              citationCollection = new Citations(resultDetails["citations"], {
                parse: true,
              });
            } else {
              citationCollection = new Citations();
            }

            this.citationCollection = citationCollection;

            // Checking if there are any citations available for the List display.
            if (this.metricsModel.get("totalCitations") == 0) {
              var citationList = new CitationList({
                citationsForDataCatalogView: true,
                pid: this.pid,
              });
            } else {
              var citationList = new CitationList({
                citations: this.citationCollection,
                citationsForDataCatalogView: true,
                pid: this.pid,
              });
            }

            this.citationList = citationList;

            this.$el.html(
              this.template({
                metricName: this.metricName,
                metricNameLemma: this.metricNameLemma,
                metricValue: this.metricsModel.get("totalCitations"),
                metricBody: "",
                hideReportCitationButton: MetacatUI.appModel.get(
                  "hideReportCitationButton"
                ),
              })
            );
            // Find the modal-body
            var modalBody = this.$el.find(".modal-body");
            // Insert the citation list
            modalBody.append(this.citationList.render().$el);
          } else {
            if (this.metricName === "Views") {
              this.$el.html(
                this.template({
                  metricName: this.metricName,
                  metricNameLemma: this.metricNameLemma,
                  metricValue: this.metricsModel.get("totalViews"),
                  metricBody: "<div class='metric-chart'></div>",
                })
              );
            }
            if (this.metricName === "Downloads") {
              this.$el.html(
                this.template({
                  metricName: this.metricName,
                  metricNameLemma: this.metricNameLemma,
                  metricValue: this.metricsModel.get("totalDownloads"),
                  metricBody: "<div class='metric-chart'></div>",
                })
              );
            }
          }
        } catch (e) {
          console.error("Failed to render the MetricModelView: ", e);

          let errorMessage = MetacatUI.appView.showAlert({
            message:
              "Something went wrong while displaying the " +
              this.metricNameLemma +
              "s for this dataset.",
            classes: "alert-info",
            container: this.$el,
            replaceContents: true,
            includeEmail: true,
          });
        } finally {
          this.$el.modal({ show: false }); // dont show modal on instantiation
        }
      },

      /**
       * Show the previous metric in the modal
       */
      showPreviousMetricModal: function () {
        this.nextMetricName = this.metricName;
        this.metricName = this.getPreviousMetric(this.metricName);
        this.nextMetricName = this.getPreviousMetric(this.metricName);

        this.metricNameLemma = this.metricName
          .toLowerCase()
          .substring(0, this.metricName.length - 1);
        if (this.metricName === "Citations") {
          var resultDetails = this.metricsModel.get("resultDetails");
          var citationCollection = new Citations(resultDetails["citations"], {
            parse: true,
          });

          this.citationCollection = citationCollection;

          // Checking if there are any citations available for the List display.
          if (this.metricsModel.get("totalCitations") == 0) {
            var citationList = new CitationList({
              citationsForDataCatalogView: true,
              pid: this.pid,
            });
          } else {
            var citationList = new CitationList({
              citations: this.citationCollection,
              citationsForDataCatalogView: true,
              pid: this.pid,
            });
          }

          this.citationList = citationList;

          this.$el.html(
            this.template({
              metricName: this.metricName,
              metricNameLemma: this.metricNameLemma,
              metricValue: this.metricsModel.get("totalCitations"),
              metricBody: this.citationList.render().$el.html(),
            })
          );
        }
        if (this.metricName === "Views") {
          this.$el.html(
            this.template({
              metricName: this.metricName,
              metricNameLemma: this.metricNameLemma,
              metricValue: this.metricsModel.get("totalViews"),
              metricBody: "<div class='metric-chart'></div>",
            })
          );
          this.drawMetricsChart();
        }
        if (this.metricName === "Downloads") {
          this.$el.html(
            this.template({
              metricName: this.metricName,
              metricNameLemma: this.metricNameLemma,
              metricValue: this.metricsModel.get("totalDownloads"),
              metricBody: "<div class='metric-chart'></div>",
            })
          );
          this.drawMetricsChart();
        }
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
            RegisterCitationView
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
          "container center"
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
          signInButtons
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
       * Show the next metric in the modal
       */
      showNextMetricModal: function () {
        this.prevMetricName = this.metricName;
        this.metricName = this.getNextMetric(this.metricName);
        this.nextMetricName = this.getNextMetric(this.metricName);

        this.metricNameLemma = this.metricName
          .toLowerCase()
          .substring(0, this.metricName.length - 1);
        if (this.metricName === "Citations") {
          var resultDetails = this.metricsModel.get("resultDetails");
          var citationCollection = new Citations(resultDetails["citations"], {
            parse: true,
          });

          this.citationCollection = citationCollection;

          // Checking if there are any citations available for the List display.
          if (this.metricsModel.get("totalCitations") == 0) {
            var citationList = new CitationList({
              citationsForDataCatalogView: true,
              pid: this.pid,
            });
          } else {
            var citationList = new CitationList({
              citations: this.citationCollection,
              citationsForDataCatalogView: true,
              pid: this.pid,
            });
          }

          this.citationList = citationList;

          this.$el.html(
            this.template({
              metricName: this.metricName,
              metricNameLemma: this.metricNameLemma,
              metricValue: this.metricsModel.get("totalCitations"),
              metricBody: this.citationList.render().$el.html(),
            })
          );
        }
        if (this.metricName === "Views") {
          this.$el.html(
            this.template({
              metricName: this.metricName,
              metricNameLemma: this.metricNameLemma,
              metricValue: this.metricsModel.get("totalViews"),
              metricBody: "<div class='metric-chart'></div>",
            })
          );
          this.drawMetricsChart();
        }
        if (this.metricName === "Downloads") {
          this.$el.html(
            this.template({
              metricName: this.metricName,
              metricNameLemma: this.metricNameLemma,
              metricValue: this.metricsModel.get("totalDownloads"),
              metricBody: "<div class='metric-chart'></div>",
            })
          );
          this.drawMetricsChart();
        }
      },

      /**
       * Draw the metrics chart
       */
      drawMetricsChart: function () {
        var metricCount = MetacatUI.appView.currentView.metricsModel.get(
          this.metricName.toLowerCase()
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
       * Cleans up and removes all artifacts created for view
       */
      onClose: function () {
        this.teardown();
      },
    }
  );

  return MetricModalView;
});
