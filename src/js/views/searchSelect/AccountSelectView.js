define([
    "jquery",
    "underscore",
    "backbone",
    "views/searchSelect/SearchableSelectView",
    "models/LookupModel"
  ],
  function($, _, Backbone,  SearchableSelect, LookupModel) {

    /**
     * @class AccountSelectView
     * @classdesc A select interface that allows the user to search from within
     * the options, and optionally select multiple items. Also allows the items
     * to be grouped, and to display an icon or image for each item.
     * @classcategory Views/SearchSelect
     * @extends Backbone.View
     * @constructor
     * @since 2.15.0
     */
    var AccountSelectView = SearchableSelect.extend(
      /** @lends SearchableSelectView.prototype */
      {
        /**
         * The type of View this is
         * @type {string}
         */
        type: "AccountSelect",

        /**
         * The HTML class names for this view element
         * @type {string}
         */
        className: SearchableSelect.prototype.className + " account-select",

        /**
         * Text to show in the input field before any value has been entered
         * @type {string}
         * @default "Start typing a name"
         */
        placeholderText: "Start typing a name",

        /**
         * Label for the input element
         * @type {string}
         * @default "Search for a person or group"
         */
        inputLabel: "Search for a person or group",

        /**
         * Whether to allow users to select more than one value
         * @type {boolean}
         * @default true
         */
        allowMulti: true,

        /**
         * Setting to true gives users the ability to add their own options that
         * are not listed in this.options. This can work with either single
         * or multiple search select dropdowns
         * @type {boolean}
         * @default true
         */
        allowAdditions: true,

        /**
         * Can be set to an object to specify API settings for retrieving remote selection
         * menu content from an API endpoint. Details of what can be set here are
         * specified by the Semantic-UI / Fomantic-UI package. Set to false if not
         * retrieving remote content.
         * @type {Object|booealn}
         * @since 2.15.0
         * @see {@link https://fomantic-ui.com/modules/dropdown.html#remote-settings}
         * @see {@link https://fomantic-ui.com/behaviors/api.html#/settings}
         */
        apiSettings: {

          // Use the Accounts lookup to search for a person or group when the user types
          // something into the input
          responseAsync: function(settings, callback){

            var view = $(this).data("view");

            // The search term that the user has typed into the input
            var searchTerm = settings.urlData.query

            // Only use the account lookup service is the user has typed at least two
            // characters. Otherwise, the callback function is never called.
            if(searchTerm.length < 2){
              callback({
                success: false,
              })
              return
            }

            // For search terms at least 2 characters long, use the Lookup Model
            MetacatUI.appLookupModel.getAccountsAutocomplete({ term: searchTerm }, function(results){

              // If no match was found to the search term
              if(results && results.length < 1){
                callback({
                  success: false,
                })
                return
              }

              // If there were results, format for the semantic UI dropdown function
              results = view.formatResults(results);

              callback({
                success: true,
                results: results
              })

            })
          }
          
        },

        /**
         * Creates a new SearchableSelectView
         * @param {Object} options - A literal object with options to pass to the view
         */
        initialize: function(options) {

          try {

            var view = this;

            // Ensure there is a lookup model ready for this view to use.
            if(MetacatUI.appLookupModel === "undefined"){
              MetacatUI.appLookupModel = new LookupModel();
            }

            SearchableSelect.prototype.initialize.call(view, options);

          } catch (e) {
            console.log("Failed to initialize an Account Select view, error message:",
            e);
          }
        },

        /**
         * Takes the results returned from from
         * {@link LookupModel#getAccountsAutocomplete} and re-formats them for other
         * functions. When the forTemplate argument is false, the results are formatted as
         * a list mapping dropdown content specifically for the FomanticUI API. When
         * forTemplate is true, then the results are formatted for use in the
         * SearchableSelectView template: {@link SearchableSelectView#template}.
         * 
         * @param  {Object[]} results The response from
         * {@link LookupModel#getAccountsAutocomplete}
         * @param  {boolean} forTemplate=false Whether or not to format the results for
         * the {@link SearchableSelectView#template}
         * @return {Object[]} The re-formatted results
         *
         * @see {@link https://fomantic-ui.com/modules/dropdown.html#remote-settings}
         */
        formatResults: function(results, forTemplate = false){
          
          results = _.map(results, function(result){

            if(forTemplate){
              // Get the ID which is saved in the parentheses
              var regExp = /\(([^)]+)\)$/;
              var matches = regExp.exec(result.label);
              //matches[1] contains the value between the parentheses
              result.description = "Account ID: " + matches[1];
              result.label = result.label.replace(regExp, "")
              result.label = result.label.trim()

            } else {
              result.label = result.label.replace("(", '<span class="description">')
              result.label = result.label.replace(")", '</span>')
            }
            
            var icon = ""

            if(result.type === "person"){
              icon = "user"
            }
            if(result.type === "group"){
              icon = "group"
            }

            if(icon){
              if(forTemplate){
                result.icon = icon;
              } else {
                result.label = '<i class="icon icon-on-left icon-' + icon + '"></i>' + result.label
              }
            }

            if(!forTemplate) {
              result = {
                name: result.label,
                value: result.value,
              }
            }
            return result

          })

          return results
        },

        /**
         * Render the view
         *
         * @return {AccountSelectView}  Returns the view
         */
        render: function(){

          var view = this;

          // Use the account lookup service to match the pre-selected values to 
          // the account holder's name to use as a label.

          // If we haven't started looking up user/organization names yet...
          if(typeof view.labelsToFetch === "undefined"){

            // Keep a count of the number of accounts we need to lookup
            view.labelsToFetch = this.selected ? this.selected.length : 0;

            if(view.labelsToFetch > 0){

              view.options = [];

              view.selected.forEach(function(accountId){
                MetacatUI.appLookupModel.getAccountsAutocomplete({ term: accountId }, function(results){
                  
                  // The value should match only one account (since the value is an
                  // account ID). If we found the match, format it for the
                  // SearchableSelectView, and the icon and tooltip will automatically be
                  // added to the pre-selected labels.
                  if(results && results.length === 1){
                    results = view.formatResults(results, true);
                    view.options.push(results[0])
                  }
                  // Whether or not we found a match, count this lookup as complete
                  --view.labelsToFetch

                  // Once we've looked up all of the accounts, call this render function
                  // again
                  if(view.labelsToFetch === 0 ){
                    view.render();
                  }

                })
              })

              return
  
            }

          }

          // Once we've fetched the labels for any pre-selected account IDs,
          // render as usual
          SearchableSelect.prototype.render.call(view);

        },

        /**
         * addTooltip - Add a tooltip to a given element using the description in the
         * options object that's set on the view.
         *
         * @param  {HTMLElement} element The HTML element a tooltip should be added
         * @param  {string} position how to position the tooltip - top | bottom | left |
         * right
         * @return {jQuery} The element with a tooltip wrapped by jQuery
         */
        addTooltip: function(element, position = "bottom"){

          try {
            if(!element){
              return
            }

            // The account ID is saved in a <span> element in the label with the
            // description class when the label is added from the list of search results
            var descEl = $(element).find(".description");
            var id = descEl.text();
            descEl.remove();

            // Otherwise, the ID is always saved as a data attribute
            if(!id){
              id = $(element).attr("data-value")
            }

            // Show the account ID as a tooltip rather than in the label. Otherwise
            // the input gets too crowded.
            $(element).tooltip({
              title: id ? "Account ID: " + id : "",
              placement: position,
              container: "body",
              delay: {
                show: 900,
                hide: 50
              }
            })
            .on("show.bs.popover",
              function(){
                var $el = $(this);
                // Allow time for the popup to be added to the DOM
                setTimeout(function () {
                  // Then add a special class to identify
                  // these popups if they need to be removed.
                  $el.data('tooltip').$tip.addClass("search-select-tooltip")
                }, 10);
            });

            return $(element)
          } catch (e) {
            console.log("Failed to add tooltips in a searchable select view, error message: " + e);
          }

        },

        // TODO: We may want to add a custom is valid option to warn the user when 
        // a value entered cannot be found in the accounts lookup service.

        // /**
        //  * isValidOption - Checks if a value is one of the values given in view.options
        //  *
        //  * @param  {string} value The value to check
        //  * @return {boolean}      returns true if the value is one of the values given in
        //  * view.options
        //  */
        // isValidOption: function(value){
        // },
        

      });

      return AccountSelectView
  });
