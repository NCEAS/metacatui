/*global define */
define(['jquery', 'underscore', 'backbone', 'views/MetricModalView'],
    function($, _, Backbone, MetricModalView) {
    'use strict';

    /**
    * @class MetricView
    * @classdesc the display of the dataset citation and usage metrics on the dataset landing page
    * @classcategory Views
    * @screenshot views/MetricView.png
    * @extends Backbone.View
    */
    var MetricView = Backbone.View.extend(
        /** @lends MetricView.prototype */{

        tagName: 'a',
        // id: 'metrics-button',

        /**
        * Class name to be applied to the metric buttons
        * @type {string}
        */
        className: 'btn metrics',

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

        //Templates
        metricButtonTemplate:  _.template( "<span class='metric-icon'> <i class='icon" +
                            " <%=metricIcon%>'></i> </span>" +
                            "<span class='metric-name'> <%=metricName%> </span>" +
                            "<span class='metric-value'> <i class='icon metric-icon icon-spinner icon-spin'>" +
                            "</i> </span>"),

        events: {
            "click" : "showMetricModal",
        },

        /**
        * @param {Object} options - A literal object with options to pass to the view
        * @property {MetricsModel} options.model - The MetricsModel object associated with this view
        * @property {string} options.metricName - The name of the metric view
        * @property {string} options.pid - Associated dataset identifier with this view
        */
        initialize: function(options){
            if((typeof options == "undefined")){
                var options = {};
            }

            this.metricName = options.metricName;
            this.model = options.model;
            this.pid = options.pid;
        },

        /**
        * Renders the apprpriate metric view on the UI
        */
        render: function () {
            // Generating the Button view for the given metric
            if  (this.metricName == 'Citations') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-quote-right', metricName:this.metricName}));
            } else if (this.metricName == 'Downloads') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-cloud-download', metricName:this.metricName}));
            } else if (this.metricName == 'Views') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-eye-open', metricName:this.metricName}));
            } else {
                this.$el.html('');
            };

            // Adding tool-tip for the buttons
            // TODO: Change to 'Show metricName', once you've the modals working.
            if (MetacatUI.appModel.get("displayDatasetMetricsTooltip")) {
                this.$el.addClass("tooltip-this")
                        .attr("data-placement", "top")
                        .attr("data-trigger", "hover")
                        .attr("data-delay", "700")
                        .attr("data-container", "body");
                if  (this.metricName == 'Citations') {
                    this.$el.attr("data-title", "For all the versions of this dataset, the number of times that all or part of this dataset was cited.");
                } else if (this.metricName == 'Downloads') {
                    this.$el.attr("data-title", "For all the versions of this dataset, the number of times that all or part of this dataset was downloaded.");
                } else if (this.metricName == 'Views') {
                    this.$el.attr("data-title", "For all the versions of this dataset, the number of times that all or part of this dataset was viewed.");
                } else {
                    this.$el.attr("data-title", "");
                }
            };

            // waiting for the fetch() call to succeed.
            this.listenTo(this.model, "sync", this.renderResults);

            // in case when there is an error for the fetch call.
            this.listenTo(this.model, "error", this.renderError);

            return this;
        },


        /**
        * Handles the click functions and displays appropriate modals on click events
        */
        showMetricModal: function(e) {
            if (MetacatUI.appModel.get("displayMetricModals") ) {
                var modalView = new MetricModalView({metricName: this.metricName, metricsModel: this.model, pid: this.pid});
                modalView.render();
                this.modalView = modalView;

                if( Array.isArray(this.subviews) ){
                  this.subviews.push(modalView);
                }
                else{
                  this.subviews = [modalView];
                }

                //Track this event
                MetacatUI.analytics?.trackEvent("metrics", "Click metric", this.metricName);
            }
        },

        /**
         * Displays the metrics count and badge on the landing page
         */
        renderResults: function() {
            var total = this.model.get("total"+this.metricName);
            // Check if the metric object exists in results obtained from the service
            // If it does, get its total value else set the total count to 0

            // Replacing the metric total count with the spinning icon.

            this.$('.metric-value').text(MetacatUI.appView.numberAbbreviator(total, 1));
            this.$('.metric-value').addClass("badge");

        },

        /**
         * Manages error handling in case Metrics Service does not responsd
         */
        renderError: function() {
            // Replacing the spinning icon with a question-mark
            // when the metrics are not loaded
            var iconEl = this.$('.metric-value').find('.metric-icon');
            iconEl.removeClass('icon-spinner');
            iconEl.removeClass('icon-spin');
            iconEl.addClass("icon-exclamation-sign more-info");

            // Setting the error tool-tip
            this.$el.removeAttr("data-title");

            this.$el.addClass("metrics-button-disabled");
            this.$el.attr("data-title", "The number of " + this.metricName + " could not be retreived at this time.");
        },

        /**
         * Cleans up listeners from this view
         */
        onClose: function(){
          _.each(this.subviews, function(view){
            if( view.onClose ){
              view.onClose();
            }
          }, this);
        }

    });

    return MetricView;
});
