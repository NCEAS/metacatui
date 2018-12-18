/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/ToggleFilter',
        'views/filters/FilterView',
        'text!templates/filters/toggleFilter.html'],
  function($, _, Backbone, ToggleFilter, FilterView, Template) {
  'use strict';

  // Render a view of a single ToggleFilter model
  var ToggleFilterView = FilterView.extend({

    // @type {ToggleFilter} - A ToggleFilter model to be rendered in this view
    model: null,

    className: "filter toggle",

    template: _.template(Template),

    events: {
      "change input[type='checkbox']" : "setToggleWidth"
    },

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new ToggleFilter();

    },

    render: function () {

      var modelJSON = this.model.toJSON();
      modelJSON.id = this.model.cid;

      this.$el.html( this.template( modelJSON ) );

    },

    /*
    * Actions to perform after the render() function has completed and this view's
    * element is added to the webpage.
    */
    postRender: function(){
      console.log(this.$(".true-label").width(), this.$(".false-label").width());

      this.setToggleWidth();
    },

    /*
    * Gets the width of the toggle labels and sets the various CSS attributes
    * necessary for the switch to fully display each label
    */
    setToggleWidth: function(){
      //Get the padding and widths of the switch elements
      var switchPadding    = 24,
          onSwitchWidth = this.$(".true-label").width(),
          offSwitchWidth  = this.$(".false-label").width(),
          totalSwitchWidth = onSwitchWidth + offSwitchWidth + (switchPadding * 2) + 1,
          isChecked = this.$("input[type='checkbox']").prop("checked");

      //Set the width on the whole view
      this.$el.width(totalSwitchWidth + "px");

      //Get the toggle switch element
      var toggleSwitch = this.$(".can-toggle-switch");

      //Add an identifier to the toggle switch element
      toggleSwitch.attr("id", "toggle-" + this.model.cid);

      //Change the width of the toggle switch
      toggleSwitch.css("flex", "0 0 " + totalSwitchWidth + "px");

      //Create CSS for the :before and :after pseudo elements, which is best done
      // by adding a style tag directly to the DOM
      if( isChecked ){
        var newCSS = "#" + "toggle-" + this.model.cid + ":before{ " +
                       "width: " + (offSwitchWidth + switchPadding) + "px ;" +
                      "left: 0px;" +
                     "}" +
                     "#" + "toggle-" + this.model.cid + ":after{ " +
                      "width: " + (onSwitchWidth + switchPadding) + "px ;" +
                      "left: 0px;" +
                      "transform: translate3d(" + (offSwitchWidth + switchPadding) + "px, 0, 0)"
                    "}";
      }
      else{
        var newCSS = "#" + "toggle-" + this.model.cid + ":before{ " +
                       "width: " + (onSwitchWidth + switchPadding) + "px ;" +
                       "left: " + (offSwitchWidth + switchPadding) + "px ;" +
                     "}" +
                     "#" + "toggle-" + this.model.cid + ":after{ " +
                      "width: " + (offSwitchWidth + switchPadding) + "px ;" +
                    "}";
      }

      //Get or create a style tag
      var styleTag = toggleSwitch.children("style");
      if( !styleTag.length ){
        styleTag = $(document.createElement("style"));
        toggleSwitch.append(styleTag);
      }

      //Add the CSS to the style tag
      styleTag.html(newCSS);
    }

  });
  return ToggleFilterView;
});
