/*global define */
define(['jquery', 'underscore', 'backbone', 'MetricsChart', 'text!templates/metricModalTemplate.html', 'collections/Citations', 'views/CitationListView', "views/SignInView"],
    function($, _, Backbone, MetricsChart, MetricModalTemplate, Citations, CitationList, SignInView) {
    'use strict';

    /**
    * @class MetricModalView
    * @classdesc A Bootstrap Modal that displays a DataONE dataset usage metric,
    * such as downloads, views, or citations.
    * @classcategory Views
    * @extends Backbone.View
    */
    var MetricModalView = Backbone.View.extend(
      /** @lends MetricModalView.prototype */ {

        id: 'metric-modal',
        className: 'modal fade hide',
        template: _.template(MetricModalTemplate),
        metricName: null,
        metricsModel: null,
        metrics: ['Citations', 'Downloads', 'Views'],
        metricIndex: null,
        prevMetricName: null,
        nextMetricName: null,
        subviews: [],

        events: {
          'hidden': 'teardown',
          'click .left-modal-footer'  : 'showPreviousMetricModal',
          'click .right-modal-footer' : 'showNextMetricModal',
          'click .register-citation'  : 'showCitationForm',
          "click .login"              : "showSignInViewPopUp"
        },

        initialize: function(options) {
          _.bindAll(this, 'show', 'teardown', 'render', 'renderView');
          if((typeof options == "undefined")){
              var options = {};
          }

          this.metricName = options.metricName;
          this.metricsModel = options.metricsModel;
          this.pid = options.pid;

        },

        getPreviousMetric : function(currentMetricName) {
            if(currentMetricName != 'undefined') {
                    this.metricIndex = this.metrics.indexOf(currentMetricName);
            }

            // Implementing a circular queue to get the previous metric
            return(this.metrics[((this.metricIndex + this.metrics.length - 1) % this.metrics.length)]);
        },

        getNextMetric : function(currentMetricName) {
            if(currentMetricName != 'undefined') {
                    this.metricIndex = this.metrics.indexOf(currentMetricName);
            }

            // Implementing a circular queue to get the next metric
            return(this.metrics[((this.metricIndex + this.metrics.length + 1) % this.metrics.length)]);
        },

        show: function() {
          this.$el.modal('show');
        },

        teardown: function() {
          this.$el.modal('hide');
          this.$el.data('modal', null);

          _.invoke(this.subviews, "onClose");

          this.remove();


        },

        render: function() {

          var thisView = this;

          this.$el.on('shown', function(){
            thisView.renderView();
            thisView.drawMetricsChart();
            thisView.trigger("renderComplete");
          });

          this.$el.modal('show');


          return;
        },

        renderView: function() {
            this.metricNameLemma = this.metricName.toLowerCase().substring(0, this.metricName.length - 1);

            if ( this.metricName === "Citations") {
                var resultDetails = this.metricsModel.get("resultDetails");
                var citationCollection = new Citations(resultDetails["citations"], {parse:true});

                this.citationCollection = citationCollection;


                // Checking if there are any citations available for the List display.
                if(this.metricsModel.get("totalCitations") == 0) {
                    var citationList = new CitationList({citationsForDataCatalogView: true});
                }
                else {
                    var citationList = new CitationList({citations: this.citationCollection, citationsForDataCatalogView: true});
                }

                this.citationList = citationList;

                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalCitations"), metricBody:this.citationList.render().$el.html(), hideReportCitationButton: MetacatUI.appModel.get("hideReportCitationButton")}));
            }
            else {
                if (this.metricName === "Views") {
                    this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalViews"), metricBody:"<div class='metric-chart'></div>"}));
                }
                if (this.metricName === "Downloads") {
                    this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalDownloads"), metricBody:"<div class='metric-chart'></div>"}));
                }

            }

            this.$el.modal({show:false}); // dont show modal on instantiation

        },

        showPreviousMetricModal: function() {

            this.nextMetricName = this.metricName;
            this.metricName = this.getPreviousMetric(this.metricName);
            this.nextMetricName = this.getPreviousMetric(this.metricName);


            this.metricNameLemma = this.metricName.toLowerCase().substring(0, this.metricName.length - 1);
            if ( this.metricName === "Citations") {
                var resultDetails = this.metricsModel.get("resultDetails")
                var citationCollection = new Citations(resultDetails["citations"], {parse:true});

                this.citationCollection = citationCollection;

                // Checking if there are any citations available for the List display.
                if(this.metricsModel.get("totalCitations") == 0) {
                    var citationList = new CitationList({citationsForDataCatalogView: true});
                }
                else {
                    var citationList = new CitationList({citations: this.citationCollection, citationsForDataCatalogView: true});
                }

                this.citationList = citationList;

                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalCitations"), metricBody:this.citationList.render().$el.html()}));
            }
            if (this.metricName === "Views") {
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalViews"), metricBody:"<div class='metric-chart'></div>"}));
                this.drawMetricsChart();
            }
            if (this.metricName === "Downloads") {
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalDownloads"), metricBody:"<div class='metric-chart'></div>"}));
                this.drawMetricsChart();
            }
        },

        /**
         * Display the Citation registration form
         */
        showCitationForm: function(){

            var viewRef = this;

            // if the user is not currently signed in
            if(!MetacatUI.appUserModel.get("loggedIn")){
                this.showSignIn();
            }
            else {
                // close the current modal
                this.teardown();

                require(['views/RegisterCitationView'], function(RegisterCitationView){
                    // display a register citation modal
                    var registerCitationView = new RegisterCitationView({pid: viewRef.pid});
                    registerCitationView.render();
                    registerCitationView.show();
                });
            }
        },

        /**
        * Show Sign In buttons
        */
        showSignIn: function(){
            var container = $(document.createElement("div")).addClass("container center");
            this.$el.html(container);

            //Create a SignInView
            let signInView = new SignInView();
            signInView.redirectQueryString = "registerCitation=true";

            //Get the Sign In buttons elements
            var signInButtons = signInView.render().el;
            this.signInButtons = signInButtons;

            //Add the elements to the page
            $(container).append('<h1>Sign in to register citations</h1>', signInButtons);
        },

        /**
         * Handle the sign in click event
         */
        showSignInViewPopUp: function(){
            // close the current modal
            this.teardown();

            // display the pop up
            this.signInButtons.showSignInViewPopUp();
        },

        showNextMetricModal: function() {
            this.prevMetricName = this.metricName;
            this.metricName = this.getNextMetric(this.metricName);
            this.nextMetricName = this.getNextMetric(this.metricName);


            this.metricNameLemma = this.metricName.toLowerCase().substring(0, this.metricName.length - 1);
            if ( this.metricName === "Citations") {
                var resultDetails = this.metricsModel.get("resultDetails")
                var citationCollection = new Citations(resultDetails["citations"], {parse:true});

                this.citationCollection = citationCollection;

                // Checking if there are any citations available for the List display.
                if(this.metricsModel.get("totalCitations") == 0) {
                    var citationList = new CitationList({citationsForDataCatalogView: true});
                }
                else {
                    var citationList = new CitationList({citations: this.citationCollection, citationsForDataCatalogView: true});
                }

                this.citationList = citationList;

                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalCitations"), metricBody:this.citationList.render().$el.html()}));
            }
            if (this.metricName === "Views") {
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalViews"), metricBody:"<div class='metric-chart'></div>"}));
                this.drawMetricsChart();
            }
            if (this.metricName === "Downloads") {
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalDownloads"), metricBody:"<div class='metric-chart'></div>"}));
                this.drawMetricsChart();
            }
        },

        drawMetricsChart: function(){

            var metricCount         = MetacatUI.appView.currentView.metricsModel.get(this.metricName.toLowerCase());
            var metricMonths        = MetacatUI.appView.currentView.metricsModel.get("months");
            var metricName          = this.metricName;

            //Draw a metric chart
            var modalMetricChart = new MetricsChart({
                            id: "metrics-chart",
                            metricCount: metricCount,
                            metricMonths: metricMonths,
                            metricName: metricName,
                            height: 370
                        });

            this.$('.metric-chart').html(modalMetricChart.el);
            modalMetricChart.render();

            this.subviews.push(modalMetricChart);
        },

        /**
        * Cleans up and removes all artifacts created for view
        */
        onClose: function(){
          this.teardown();
        }

    });

     return MetricModalView;
  });
