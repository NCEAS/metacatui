define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/provEntitySelect.html",
], function ($, _, Backbone, provEntitySelectTemplate) {
  "use strict";

  // Obtain a list of provenance entities from the DataPackage and display to the
  // user for selection. The selected package members will be added to the provenance
  // of the package member being edited.
  var ProvEntitySelectView = Backbone.View.extend({
    initialize: function (options) {
      if (typeof options === "undefined" || !options) var options = {};
      this.parentView = options.parentView || null; // This 'parentView' is really ghe grandparent, i.e. metadataview
      this.title = options.title || "Add provenance";
      this.selectLabel =
        options.selectLabel || "Choose from the files in this dataset";
      this.selectEntityType = options.selectEntityType || "data";
      this.dataPackage = options.dataPackage || null;
      this.context = options.context || null;
      this.displayRows = options.displayRows || 0;
      this.additionalElements = options.additionalElements || "";

      this.selectEntityType == "program"
        ? (this.selectMode = "")
        : (this.selectMode = "multiple");
    },

    tagName: "div",

    className: "prov-entity-select",

    template: _.template(provEntitySelectTemplate),

    events: {},

    render: function () {
      var members = this.dataPackage.toArray();
      // Reset the rendered view
      this.$el.html("");

      if (!members) return false;
      var view = this;
      // Remove the current package member from the list of prov entities to select
      // (a package member can't be related to itself).
      members = _.filter(members, function (item) {
        return item.get("id") != view.context.get("id");
      });

      // Don't include metadata package members
      members = _.filter(members, function (item) {
        return item.get("type").toLowerCase() != "metadata";
      });

      // A package member that is of type program can only be selected once,
      // otherwise we could have loops created in the provenance graph. Data
      // members can be selected multiple times (as one program could created
      // the item and another read it, so just highlight them if they have
      // been used before.
      members = _.reject(members, function (item) {
        if (item.selectedInEditor == true && item.getType() == "program")
          return true;
      });

      if (this.selectEntityType == "program") {
        // If a program is being selected, display in the list if
        // first it is a program type, or if the type isn't defined, or
        // if it is not data.
        members = _.filter(members, function (item) {
          /*if(item.getType() == "program") return true;
					if(typeof item.getType() === "undefined") return true;
					if(item.getType() === null) return true;
					if(!item.isData()) return true;
					return false;
					*/

          //Just filter out metadata and annotation objects
          if (item.getType() == "metadata" || item.getType() == "annotation")
            return false;
          else return true;
        });
      } else if (this.selectEntityType == "data") {
        // Don't display metadata in the selection view
        members = _.filter(members, function (item) {
          if (item.getType() == "data") return true;
          if (typeof item.getType() === "undefined") return true;
          if (item.getType() === null) return true;
          if (!item.isSoftware()) return true;
          return false;
        });
      }

      //Sort members so that the already-used objects are at the bottom
      var selectedMembers = _.where(members, { selectedInEditor: true }),
        unselectedMembers = _.difference(members, selectedMembers),
        sortedMembers = _.union(unselectedMembers, selectedMembers);

      // Create a list of styles to apply to the selection box options. Currently
      // this includes gray background for previously selected items, white for new
      // ones.
      // The selection list should at this point contain unused program items
      // or data items that are new or used (previously selected).
      var optionStyles = {};
      _.each(sortedMembers, function (item) {
        if (item.selectedInEditor == true) {
          optionStyles[item.get("id")] = "background-color: lightgray";
        } else {
          optionStyles[item.get("id")] = "background-color: white";
        }
      });

      // Set the number of items to display in the select list
      if (this.displayRows == 0)
        this.displayRows == Math.min(10, sortedMembers.length);

      this.$el.html(
        this.template({
          title: this.title,
          selectLabel: this.selectLabel,
          selectMode: this.selectMode,
          members: sortedMembers,
          displayRows: this.displayRows,
          optionStyles: optionStyles,
        }),
      );

      if (this.additionalElements) {
        this.$(".modal-body").prepend(this.additionalElements);
      }

      return this;
    },

    readSelected: function () {
      // First see if a pid value was entered in the text box.
      // If yes then this value will be used instead of the
      // select list.
      var values = $("#pidValue").val();
      if (typeof values !== undefined && values != "") {
        return values;
      } else {
        values = $("#select-prov-entity").val();
      }
      return values;
    },

    onClose: function () {
      this.remove();
      this.unbind();
    },
  });

  return ProvEntitySelectView;
});
