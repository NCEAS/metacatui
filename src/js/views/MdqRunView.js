"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "d3",
  "models/SolrResult",
  "DonutChart",
  "views/CitationView",
  "text!templates/mdqRun.html",
  "text!templates/loading-metrics.html",
  "collections/QualityReport",
  "views/MarkdownView",
], (
  $,
  _,
  Backbone,
  d3,
  SolrResult,
  DonutChart,
  CitationView,
  MdqRunTemplate,
  LoadingTemplate,
  QualityReport,
  MarkdownView,
) => {
  const MSG_ERROR_GENERATING_REPORT =
    "There was an error generating the assessment report.";
  const MSG_QUEUED_REPORT =
    "The assessment report is in the Assessment Server queue to be generated.";
  const MSG_REPORT_NOT_READY =
    "The assessment report for this dataset is not ready yet. Try checking back in 24 hours to see these results.";
  const MSG_ERROR_GENERAL =
    "There was an error retrieving the assessment report for this dataset.";
  const MSG_ERROR_DETAILS = "The Assessment Server reported this error: ";
  const QUEUE_ERROR_DETAILS = " It was queued at: ";

  /**
   * @class MdqRunView
   * @classdesc A view that fetches and displays a Metadata Assessment Report
   * @classcategory Views
   * @name MdqRunView
   * @augments Backbone.View
   * @constructs
   */
  const MdqRunView = Backbone.View.extend(
    /** @lends MdqRunView.prototype */ {
      /** @inheritdoc */
      el: "#Content",

      /** @inheritdoc */
      events: {
        "change #suiteId": "switchSuite",
      },

      /**
       * The identifier of the object to be assessed
       * @type {string}
       */
      pid: null,

      /**
       * The currently selected/requested suite
       * @type {string}
       */
      suiteId: null,

      /**
       * The list of all potential suites for this theme
       * @type {string[]}
       */
      suiteIdList: [],

      /**
       * The template to use to indicate that the view is loading
       * @type {Function}
       */
      loadingTemplate: _.template(LoadingTemplate),

      /**
       * The main template for this view
       * @type {Function}
       */
      template: _.template(MdqRunTemplate),

      /**
       * The selector for the element that will contain the breadcrumbs
       * @type {string}
       */
      breadcrumbContainer: "#breadcrumb-container",

      /**
       * A JQuery selector for the element in the template that will contain the loading
       * image
       * @type {string}
       * @since 2.15.0
       */
      loadingContainer: "#mdqResult",

      /**
       * Handles the event when the user selects a different suite
       * @param {Event} event The event object
       * @returns {boolean} False, to prevent the default action
       */
      switchSuite(event) {
        const select = $(event.target);
        const suiteId = $(select).val();
        MetacatUI.uiRouter.navigate(
          `quality/s=${suiteId}/${encodeURIComponent(this.pid)}`,
          { trigger: false },
        );
        this.suiteId = suiteId;
        this.render();
        return false;
      },

      /** @inheritdoc */
      render() {
        const viewRef = this;

        // The suite use for rendering can initially be set via the theme AppModel.
        // If a suite id is request via the metacatui route, then we have to display that
        // suite, and in addition have to display all possible suites for this theme in
        // a selection list, if the user wants to view a different one.
        this.suiteIdList = MetacatUI.appModel.get("mdqSuiteIds");
        if (!this.suiteId) {
          this.suiteId = this.suiteIdList?.[0];
        }

        this.suiteLabels = MetacatUI.appModel.get("mdqSuiteLabels");

        // Insert the basic template
        this.$el.html(this.template({}));
        // Show breadcrumbs leading back to the dataset & data search
        this.insertBreadcrumbs();
        // Insert the loading image
        this.showLoading();

        if (!this.pid) {
          const searchLink = $(document.createElement("a"))
            .attr("href", `${MetacatUI.root}/data`)
            .text("Search our database");
          const message = $(document.createElement("span"))
            .text(" to see an assessment report for a dataset")
            .prepend(searchLink);
          this.showMessage(message, true, false);
          return;
        }

        const root = MetacatUI.appModel.get("mdqRunsServiceUrl");

        const qualityUrl = `${root}${viewRef.suiteId}/${viewRef.pid}`;
        const qualityReport = new QualityReport([], {
          url: qualityUrl,
          pid: viewRef.pid,
        });
        this.qualityReport = qualityReport;

        this.listenToOnce(
          qualityReport,
          "fetchError",
          this.handleQualityReportError,
        );
        this.listenToOnce(
          qualityReport,
          "fetchComplete",
          this.renderQualityReport,
        );

        qualityReport.fetch({ url: qualityUrl });
      },

      /**
       * Render the quality report once it has been fetched
       */
      async renderQualityReport() {
        const viewRef = this;
        const { qualityReport } = this;
        if (qualityReport?.runStatus?.toUpperCase() !== "SUCCESS") {
          this.handleQualityReportError();
          return;
        }
        viewRef.hideLoading();

        // Filter out the checks with level 'METADATA', as these checks are intended
        // to pass info to metadig-engine indexing (for search, faceting), and not intended for display.
        qualityReport.reset(
          _.reject(qualityReport.models, (model) => {
            const check = model.get("check");
            if (check.level === "METADATA") {
              return true;
            }
            return false;
          }),
        );

        const groupedResults = qualityReport.groupResults(qualityReport.models);
        const groupedByType = qualityReport.groupByType(qualityReport.models);

        const checkCount = qualityReport.length;
        const blueCount = groupedResults.BLUE?.length || 0;
        const greenCount = groupedResults.GREEN?.length || 0;
        const orangeCount = groupedResults.ORANGE?.length || 0;
        const redCount = groupedResults.RED?.length || 0;
        const extraRedText =
          redCount > 0 ? " Please correct these issues." : "";
        const extraOrangeText =
          orangeCount > 0 ? " Please review these warnings." : "";
        const totalPassable = checkCount - blueCount;

        const checkWord = (num) => (num === 1 ? "check" : "checks");
        const greenText = `Passed ${greenCount} ${checkWord(greenCount)} out of ${totalPassable} (excluding informational checks).`;
        const orangeText = `Warning for ${orangeCount} ${checkWord(orangeCount)}. ${extraOrangeText}`;
        const redText = `Failed ${redCount} ${checkWord(redCount)}. ${extraRedText}`;
        const blueText = `${blueCount} informational ${checkWord(blueCount)}.`;

        const data = {
          objectIdentifier: qualityReport.id,
          suiteId: viewRef.suiteId,
          suiteIdList: viewRef.suiteIdList,
          suiteLabels: viewRef.suiteLabels,
          timestamp: _.now(),
          id: viewRef.pid,
          groupedResults,
          groupedByType,
          checkCount,
          greenText,
          orangeText,
          redText,
          blueText,
        };

        viewRef.$el.html(viewRef.template(data));
        await viewRef.addCheckItems(groupedResults);
        viewRef.insertBreadcrumbs();
        viewRef.drawScoreChart(qualityReport.models, groupedResults);
        viewRef.showCitation();
        viewRef.show();
        // Make sure the DOM is updated before initializing the popover
        requestAnimationFrame(() => {
          viewRef.$(".popover-this").popover();
        });
      },

      /**
       * Add the check result item els to the view
       * @param {object} groupedResults - The results grouped by status
       * @since 0.0.0
       */
      async addCheckItems(groupedResults) {
        const viewRef = this;

        const types = {
          GREEN: {
            className: "pass",
            iconClass: "icon-check-sign success",
            headerClass: "success",
          },
          ORANGE: {
            className: "warn",
            iconClass: "icon-exclamation",
            headerClass: "warning",
          },
          RED: {
            className: "fail",
            iconClass: "icon-remove",
            headerClass: "danger",
          },
          BLUE: {
            className: "info-check",
            iconClass: "icon-info",
            headerClass: "info",
          },
        };

        Object.keys(types).forEach(async (type) => {
          const { className, iconClass, headerClass } = types[type];
          const results = groupedResults[type];
          if (results) {
            // Use `map` to handle promises
            const itemEls = await Promise.all(
              results.map(async (result) =>
                viewRef.createCheckItem(result, className, iconClass),
              ),
            );

            // Join the resolved HTML strings and append them
            viewRef
              .$(`.list-group-item.${headerClass}`)
              .after(itemEls.join(""));
          }
        });
      },

      /**
       * Create a check item element
       * @param {object} result - The check result
       * @param {string} className - The class name for the check item
       * @param {string} iconClass - The class
       * @returns {string} The HTML for the check item
       * @since 0.0.0
       */
      async createCheckItem(result, className, iconClass) {
        const outputs = await this.getOutputHTML(result.get("output"));

        return `
          <li class="list-group-item check ${className} collapse row-fluid">
            <span class="icon-stack span1">
              <i class="${iconClass}"></i>
            </span>
            <span class="span6">${outputs}</span>
            <span class="span1">
              <a tabindex="0"
                 role="button"
                 class="popover-this"
                 data-container="body"
                 data-trigger="hover focus"
                 data-html="true"
                 data-title="${result.get("check").name}"
                 data-content="${result.get("check").description}">
                 <i class="icon icon-question-sign subtle"></i>
              </a>
            </span>
            <span class="span4">
              <span class="badge pull-right">${result.get("status")}</span>
              <span class="badge pull-right">${result.get("check").level}</span>
              <span class="badge pull-right">${result.get("check").type}</span>
            </span>
          </li>
        `;
      },

      /**
       * Get the HTML for the output
       * @param {Array} outputs - The outputs from the quality service
       * @returns {string} The HTML for the output
       */
      async getOutputHTML(outputs) {
        const outputHTMLs = await Promise.all(
          outputs.map(async (output) => {
            if (output?.type?.includes("image")) {
              return `<img src="data:${output.type};base64,${output.value}" />`;
            }
            if (output.type === "markdown") {
              return this.getHTMLFromMarkdown(output.value);
            }
            return `<div class="check-output">${output.value}</div>`;
          }),
        );

        return outputHTMLs.join("");
      },

      /**
       * Get the HTML from markdown
       * @param {string} markdown - The markdown to convert to HTML
       * @returns {Promise} A promise that resolves with the HTML
       */
      getHTMLFromMarkdown(markdown) {
        const markdownView = new MarkdownView({
          markdown,
          showTOC: false,
        }).render();

        return new Promise((resolve) => {
          this.listenToOnce(markdownView, "mdRendered", () => {
            resolve(markdownView.el.innerHTML);
          });
        });
      },

      /**
       * Handles errors that occur when fetching the quality report
       */
      handleQualityReportError() {
        const { qualityReport } = this;
        let status =
          qualityReport.runStatus || qualityReport.fetchResponse?.status;

        if (typeof status === "string") {
          status = status.toUpperCase();
        }

        const description =
          qualityReport.errorDescription ||
          qualityReport.fetchResponse?.statusText ||
          "";
        const time = qualityReport.timestamp;

        const errorReport = description
          ? `${MSG_ERROR_DETAILS}${description}`
          : "";
        const queueTime = time ? `${QUEUE_ERROR_DETAILS} ${time}` : "";

        let msgText = "";

        if (status === "FAILURE") {
          msgText = `${MSG_ERROR_GENERATING_REPORT}`;
          if (errorReport) {
            msgText += ` ${errorReport}`;
          }
        } else if (status === "QUEUED" || status === "PROCESSING") {
          msgText = `${MSG_QUEUED_REPORT} `;
          if (queueTime) {
            msgText += ` ${queueTime}`;
          }
        } else if (status === 404) {
          msgText = MSG_REPORT_NOT_READY;
        } else {
          msgText = MSG_ERROR_GENERAL;
          if (errorReport) {
            msgText += ` ${errorReport}`;
          }
        }
        this.showMessage(msgText);
      },

      /**
       * Updates the message in the loading image
       * @param {string} message The new message to display
       * @param {boolean} [showHelp] If set to true, and an email contact is configured
       * in MetacatUI, then the contact email will be shown at the bottom of the message.
       * @param {boolean} [showLink] If set to true, a link back to the dataset will be
       * appended to the end of the message.
       * @since 2.15.0
       */
      showMessage(message, showHelp = true, showLink = true) {
        const view = this;
        const messageEl = this.loadingEl.find(".message");

        if (!messageEl) {
          return;
        }

        // Update the message
        messageEl.html(message);

        // Create a link back to the data set
        if (showLink) {
          const viewURL = `/view/${encodeURIComponent(this.pid)}`;
          const backLink = $(document.createElement("a")).text(
            " Return to the dataset",
          );
          backLink.on("click", () => {
            view.hideLoading();
            MetacatUI.uiRouter.navigate(viewURL, {
              trigger: true,
              replace: true,
            });
          });
          messageEl.append(backLink);
        }

        // Show how the user can get more help
        if (showHelp) {
          const emailAddress = MetacatUI.appModel.get("emailContact");
          // Don't show help if there's no contact email configured
          if (emailAddress) {
            const helpEl = $(
              "<p class='webmaster-email' style='margin-top:20px'>" +
                "<i class='icon-envelope-alt icon icon-on-left'></i>" +
                "Need help? Email us at </p>",
            );
            const emailLink = $(document.createElement("a"))
              .attr("href", `mailto:${emailAddress}`)
              .text(emailAddress);
            helpEl.append(emailLink);
            messageEl.append(helpEl);
          }
        }
      },

      /**
       * Render a loading image with message
       */
      showLoading() {
        const loadingEl = this.loadingTemplate({
          message: "Retrieving assessment report...",
          character: "none",
          type: "barchart",
        });
        this.loadingEl = $(loadingEl);
        this.$el.find(this.loadingContainer).html(this.loadingEl);
      },

      /**
       * Remove the loading image and message.
       */
      hideLoading() {
        this.loadingEl.remove();
      },

      /** Render a citation view for the object and display it in the view */
      showCitation() {
        const solrResultModel = new SolrResult({
          id: this.pid,
        });

        this.listenTo(solrResultModel, "sync", () => {
          const citationView = new CitationView({
            model: solrResultModel,
            createLink: false,
            createTitleLink: true,
          });

          citationView.render();

          this.$("#mdqCitation").prepend(citationView.el);
        });
        solrResultModel.getInfo();
      },

      /** Show the view */
      show() {
        this.$el.hide();
        this.$el.fadeIn({ duration: "slow" });
      },

      /**
       * Draw a donut chart showing the distribution of checks by status
       * @param {Array} results - The array of check results
       * @param {object} groupedResults - The results grouped by status
       */
      drawScoreChart(results, groupedResults) {
        const dataCount = results.length;
        const data = [
          {
            label: "Pass",
            count: groupedResults.GREEN.length,
            perc: groupedResults.GREEN.length / results.length,
          },
          {
            label: "Warn",
            count: groupedResults.ORANGE.length,
            perc: groupedResults.ORANGE.length / results.length,
          },
          {
            label: "Fail",
            count: groupedResults.RED.length,
            perc: groupedResults.RED.length / results.length,
          },
          {
            label: "Info",
            count: groupedResults.BLUE.length,
            perc: groupedResults.BLUE.length / results.length,
          },
        ];

        const svgClass = "data";

        // If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
        if (!d3) {
          this.$(".format-charts-data").html(
            `<h2 class='${svgClass} fallback'>${MetacatUI.appView.commaSeparateNumber(
              dataCount,
            )} data files</h2>`,
          );

          return;
        }

        // Draw a donut chart
        const donut = new DonutChart({
          id: "data-chart",
          data,
          total: dataCount,
          titleText: "checks",
          titleCount: dataCount,
          svgClass,
          countClass: "data",
          height: 250,
          width: 250,
          keepOrder: true,
          formatLabel(name) {
            return name;
          },
        });
        this.$(".format-charts-data").html(donut.render().el);
      },

      /**
       * Insert breadcrumbs into the view
       */
      insertBreadcrumbs() {
        const encodedPid = encodeURIComponent(this.pid);
        const root = MetacatUI.root || "/";
        const breadcrumbs = `
          <ol class="breadcrumb">
            <li class="home"><a href="${root || "/"}" class="home">Home</a></li>
            <li class="search"><a href="${root}/data" class="search">Search</a></li>
            <li class="inactive"><a href="${root}/view/${encodedPid}" class="inactive">Metadata</a></li>
            <li class="inactive"><a href="${root}/quality/${encodedPid}" class="inactive">Assessment Report</a></li>
          </ol>
        `;
        this.el.querySelector(this.breadcrumbContainer).innerHTML = breadcrumbs;
      },
    },
  );
  return MdqRunView;
});
