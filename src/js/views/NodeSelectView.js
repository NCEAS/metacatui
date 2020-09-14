define([
    "jquery",
    "underscore",
    "backbone",
    "views/SearchableSelectView",
    "models/NodeModel"
  ],
  function($, _, Backbone, SearchableSelect, NodeModel) {

    /**
     * @class NodeSelect
     * @classdesc A select interface that allows the user to search for and
     * select a member node
     * @extends SearchableSelect
     * @constructor
     */
    var NodeSelect = SearchableSelect.extend(
      /** @lends NodeSelectView.prototype */
      {
        /**
         * The type of View this is
         * @type {string}
         */
        type: "NodeSelect",
        
        /**        
         * className - Returns the class names for this view element
         *          
         * @return {string}  class names
         */         
        className: SearchableSelect.prototype.className + " node-select",
        
        /**       
         * Text to show in the input field before any value has been entered
         * @type {string}        
         */ 
        placeholderText: "Search for or select a DataONE member repository",
        
        /**       
         * Label for the input element
         * @type {string}        
         */ 
        inputLabel: "Select a member repository",
        
        /**        
         * Whether to allow users to select more than one value        
         * @type {boolean}
         */         
        allowMulti: true,
        
        /**        
         * Setting to true gives users the ability to add their own options that
         * are not listed in this.options. This can work with either single
         * or multiple search select dropdowns        
         * @type {boolean}
         */         
        allowAdditions: false,
        
        /**
         * Creates a new NodeSelectView
         * @param {Object} options - A literal object with options to pass to the view
         */ 
        initialize: function(options){
          try {
            // Ensure the query fields are cached
            if ( typeof MetacatUI.nodeModel === "undefined" ) {
              MetacatUI.nodeModel = new NodeModel();
            }
            
            var members = MetacatUI.nodeModel.get("members");
            
            // Maps the nodeModel member attributes (keys) to the searchSelect
            // dropdown options properties (values) 
            var map = Object.entries({
              logo: "image",
              name: "label",
              description: "description",
              identifier: "value"
            });
            
            this.options = [];
            
            // Convert nodeModel members to options of searchSelect
            members.forEach((member, i) => {
              this.options[i] = {};
              for (const [oldName, newName] of map) {
                this.options[i][newName] = member[oldName]
              }
            });
            
            SearchableSelect.prototype.initialize.call(this, options);
          } catch (e) {
            console.log("Failed to initialize a Node Select View, error message: " + e);
          }
        }

      });
      return NodeSelect;
  });
