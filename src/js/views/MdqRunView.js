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
  "views/accordion/AccordionView",
  "models/accordion/Accordion",
  "semantic",
  `!text!${MetacatUI.root}/css/mdq.css`,
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
  AccordionView,
  AccordionModel,
  _Semantic,
  ReportCSS,
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

  const CLASS_NAMES = {
    detailsContainer: "mdq-results",
    detailsItem: "mdq-results__item",
    detailsRootItem: "mdq-results__item--root",
    detailsTitleOnly: "mdq-results__item--title-only",
    detailsScrollable: "mdq-results__item--srollable",
  };

  // The maximum length of an item in the accordion before it is considered
  // "long" and will be displayed as a collapsible item.
  const MAX_ITEM_LENGTH = 500;

  // A function to return the plural form of "check" based on the count
  const PLURAL = (n) => (n === 1 ? "check" : "checks");

  // Icons and strings for the categories in the detailed report. The order of
  // categories will match the order of this array.
  const REPORT_CATEGORIES = [
    {
      status: "GREEN",
      icon: "check-sign",
      buildTitle: ({ count, totalPassable }) =>
        `Passed ${count} ${PLURAL(count)} out of ${totalPassable} (excluding informational checks).`,
    },
    {
      status: "ORANGE",
      icon: "exclamation",
      buildTitle: ({ count }) =>
        `Warning for ${count} ${PLURAL(count)}.${count ? " Please review these warnings." : ""}`,
    },
    {
      status: "RED",
      icon: "remove",
      buildTitle: ({ count }) =>
        `Failed ${count} ${PLURAL(count)}.${count ? " Please correct these issues." : ""}`,
    },
    {
      status: "BLUE",
      icon: "info-sign",
      buildTitle: ({ count }) => `${count} informational ${PLURAL(count)}.`,
    },
  ];

  MetacatUI.appModel.addCSS(ReportCSS, "mdq");

  /**
   * @class MdqRunView
   * @classdesc A view that fetches and displays a Dataset Assessment
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
       * Settings passed to the Formantic UI popup module to configure a tooltip
       * shown over item titles.
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       * @type {object}
       */
      tooltipSettings: {
        position: "top center",
        on: "hover",
        variation: "tiny",
        delay: {
          show: 250,
          hide: 40,
        },
      },

      /** @inheritdoc */
      initialize(options = {}) {
        if (options.pid) {
          this.pid = options.pid;
        }
        // Set up models for showing the detailed report in an accordion
        this.accordionModel = new AccordionModel({ exclusive: true });
        this.accordionItems = this.accordionModel.get("items");
      },

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
          return this;
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

        return this;
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

        // Filter out the checks with level 'METADATA', as these checks are
        // intended to pass info to metadig-engine indexing (for search,
        // faceting), and not intended for display.
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

        const data = {
          objectIdentifier: qualityReport.id,
          suiteId: viewRef.suiteId,
          suiteIdList: viewRef.suiteIdList,
          suiteLabels: viewRef.suiteLabels,
          timestamp: _.now(),
          id: viewRef.pid,
          groupedByType,
        };

        viewRef.$el.html(viewRef.template(data));
        viewRef.insertBreadcrumbs();
        viewRef.drawScoreChart(qualityReport.models, groupedResults);
        viewRef.showCitation();
        viewRef.show();
        // TODO: Consider moving detail report to its own view
        viewRef.renderDetailedReport(groupedResults);
      },

      /**
       * Show each result and its outputs in a collapsible accordion grouped by
       * result status (GREEN, ORANGE, RED, BLUE).
       * @param {object} groupedResults - The results grouped by status
       */
      async renderDetailedReport(groupedResults) {
        const container = this.el.querySelector(
          `.${CLASS_NAMES.detailsContainer}`,
        );
        if (this.accordionView) {
          this.accordionView.remove();
        }
        if (this.accordionItems) {
          this.accordionItems.reset();
        }
        container.innerHTML = "";

        this.accordionView = new AccordionView({
          model: this.accordionModel,
          el: container,
          tooltipSettings: this.tooltipSettings,
        });
        this.accordionView.render();

        // Add items to the accordion as they are created
        this.addResultItems(groupedResults);

        // While results are being added to the accordion, query the names of
        // any result outputs with identifiers. Show the title as the filename
        // rather than the uuid.
        const ids = await this.qualityReport.getAllOutputNames();
        this.updateOutputIdTitles(ids);
        this.stopListening(this.accordionItems, "add");
        this.listenTo(this.accordionItems, "add", (item) =>
          this.updateOutputIdTitles(ids, [item]),
        );
      },

      /**
       * Update the titles of items in the accordion that have an identifier
       * in their output. The identifier will be used as the title of the item
       * instead of the uuid.
       * @param {object} ids - An object mapping identifiers to titles
       * @param {Array} [models] - An optional array of models to update.
       * If not provided, all models in the accordion will be updated.
       * @since 0.0.0
       */
      updateOutputIdTitles(ids, models) {
        const toUpdate = models || this.accordionItems.models;
        toUpdate.forEach((item) => {
          const title = item.get("title");
          if (title && ids[title]) {
            item.set("title", ids[title]);
          }
        });
      },

      /**
       * Add the result items to the accordion, including the categories (GREEN,
       * ORANGE, RED, BLUE), and the individual results within each category,
       * and their outputs.
       * @param {object} groupedResults - The results grouped by status
       * @since 0.0.0
       */
      async addResultItems(groupedResults) {
        const { qualityReport } = this;

        // Generate text for each status (GREEN, ORANGE, RED, BLUE)
        const counts = qualityReport.getCountsPerGroup(groupedResults);

        let totalPassable = counts.total - (counts.blue || counts.BLUE || 0);
        if (totalPassable < 0) totalPassable = 0;

        REPORT_CATEGORIES.forEach((category) => {
          const count = counts[category.status] || 0;
          const categoryItem = {
            status: category.status,
            title: category.buildTitle({
              count,
              totalPassable,
            }),
            icon: category.icon,
          };
          this.addCategoryItem(categoryItem, groupedResults);
        });
      },

      /**
       * Add a category item to the accordion, which represents a
       * category of checks (GREEN, ORANGE, RED, BLUE).
       * @param {object} category - The category object containing status, title, and icon
       * @param {object} groupedResults - The results grouped by status
       * @since 0.0.0
       */
      async addCategoryItem(category, groupedResults) {
        // Root items are the main categories of checks, such as GREEN, ORANGE, RED, BLUE
        const CN = CLASS_NAMES;
        const { status, title, icon } = category;
        const results = groupedResults[status] || [];
        const statusClass = `${CN.detailsItem}--${status.toLowerCase()}`;
        const rootClass = CN.detailsRootItem;
        const baseClass = CN.detailsItem;
        const classes = [baseClass, rootClass, statusClass];
        const itemId = status.toLowerCase();
        const item = { classes, title, itemId, icon };
        // Add the item to the accordion items
        this.accordionItems.add(item);

        // Add an item to the accordion for each result in this category
        results?.forEach((result) => this.addResultItem(result, item));
      },

      /**
       * Calculate statistics for the outputs of a result.
       * @param {Array} outputs - The outputs for a single result
       * @returns {object} An object containing the total length of all outputs
       * and the maximum length of a single output
       * @since 0.0.0
       */
      outputStats(outputs) {
        let total = 0;
        let max = 0;
        outputs.forEach((o) => {
          const len = o?.value?.length || 0;
          total += len;
          if (len > max) max = len;
        });
        const count = outputs.length;
        return { total, max, count };
      },

      /**
       * Add an item to the accordion for a result. There are three display
       * options for the result, depending on the length of the outputs:
       *   1. If any one output is very long, all outputs will be displayed as
       *      collapsible items in the accordion.
       *   2. If the outputs combined are very short, the output will be
       *      displayed as the title of the item, and no content will be shown.
       *   3. If the outputs combined are long, but not too long, the output
       *      will be displayed as the content of the item, and the item will be
       *      scrollable if the content is too long.
       * @param {object} result - The result model containing the check and
       * outputs
       * @param {object} parentItem - The parent item in the accordion to which
       * this item belongs.
       * @since 0.0.0
       */
      async addResultItem(result, parentItem) {
        const CN = CLASS_NAMES;
        const outputs = result.get("output") || [];
        if (!outputs.length) return;

        const check = result.get("check") || {};
        const itemId = check.name;
        const item = {
          itemId,
          title: check.name,
          parent: parentItem.itemId,
          icon: parentItem.icon,
          classes: [CN.detailsItem],
          description: this.getDescriptionHtml(result),
        };

        const { max, total, count } = this.outputStats(outputs);

        if (max <= MAX_ITEM_LENGTH || count <= 1) {
          // When the content is displayed without child elements, then limit
          // the height of the content section.
          item.classes.push(CN.detailsScrollable);
          const content = await this.getOutputHTML(outputs);
          if (total < MAX_ITEM_LENGTH) {
            // Very short content => display as title, no content
            item.title = content;
            item.classes.push(CN.detailsTitleOnly);
          } else {
            // Long content => display as content collapsed under title
            item.content = content;
          }
          this.accordionItems.add(item);
          return;
        }
        this.accordionItems.add(item);

        // Multiple & long outputs => create child items
        outputs.forEach(async (output) => this.addOutputItem(output, item));
      },

      /**
       * Add an output item to the accordion. This is used when there are
       * multiple outputs that are too long to display as a single item.
       * @param {object} output - The output object containing identifier, name,
       * and value
       * @param {object} parentItem - The parent item in the accordion to which
       * this output belongs.
       * @returns {Promise<object>} A promise that resolves with the output item
       * @since 0.0.0
       */
      async addOutputItem(output, parentItem) {
        const content = await this.getOutputHTML([output]);
        const outputItem = {
          title:
            output.identifier ||
            output.name ||
            `${content.substring(0, 100)}...`,
          content,
          parent: parentItem.itemId,
          classes: [CLASS_NAMES.detailsItem],
          icon: parentItem.icon,
        };
        this.accordionItems.add(outputItem);
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
        return outputHTMLs.join(" ");
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
       * Get the HTML description for a result to include in a tooltip in the
       * detail report accordion.
       * @param {object} result - The result model containing the check and
       * outputs
       * @returns {string} The HTML description for the result
       * @since 0.0.0
       */
      getDescriptionHtml(result) {
        const status = result.get("status");
        const check = result.get("check");
        const description = check?.description || "";
        const level = check?.level || "";
        const type = check?.type || "";
        const name = check?.name || "";

        const labelClasses = {
          REQUIRED: "inverse",
          OPTIONAL: "warning",
          FAILURE: "important",
          SUCCESS: "success",
          INFO: "info",
        };

        const statusClass = labelClasses[status] || "default";
        const statusLabel = `<span class="label label-${statusClass}">${status}</span>`;
        const levelClass = labelClasses[level] || "default";
        const levelLabel = `<span class="label label-${levelClass}">${level}</span>`;
        const typeLabel = `<span class="label">FAIR Type: <strong>${type}</strong></span>`;

        const descriptionHtml = `
          <div class="mdq-results__item-description text-left">
            <div class="mdq-results__labels">${statusLabel} ${levelLabel} ${typeLabel}</div>
            <h5><strong>${name}</strong></h5>
            <div class=""><small>${description}</small></div>
          </div>
        `;

        return descriptionHtml;
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
