define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  "use strict";

  var ExpandCollapseListView = Backbone.View.extend({
    initialize: function (options) {
      if (options === undefined || !options) var options = {};

      this.max = options.max || 3;
      this.list = options.list || [];
      this.prependText = options.prependText || "";
      this.appendText = options.appendText || "";
      this.id = options.id || null;
      this.attributes = options.attributes || null;
      this.className += options.className || "";
    },

    name: "ExpandCollapseList",

    tagName: "span",

    className: "expand-collapse",

    events: {
      "click .control": "toggle",
    },

    /*
     * Makes a list of object ID links that collapses after a max X amount
     */
    render: function () {
      //If there is nothing in the list, there is nothing to make
      if (this.list.length == 0) return this;

      var view = this,
        text = "",
        collapse = this.list.length > this.max ? true : false,
        numCollapsed = this.list.length - this.max,
        containerEl = this.el;

      var expandLink = $(document.createElement("a"))
          .attr("href", "#")
          .addClass("control expand")
          .text(" (and " + numCollapsed + " more "),
        collapseLink = $(document.createElement("a"))
          .attr("href", "#")
          .addClass("control collapse")
          .text(" (collapse "),
        expandIcon = $(document.createElement("i")).addClass("icon-expand-alt"),
        collapseIcon = $(document.createElement("i")).addClass(
          "icon-collapse-alt",
        ),
        expandedList = $(document.createElement("span")),
        collapsedList = $(document.createElement("span")).addClass("collapsed"),
        and = $(document.createElement("span")).text(" and  "),
        comma = $(document.createElement("span")).addClass("spacer").text(", "),
        space = $(document.createElement("span")).text("  ");

      $(expandLink)
        .append(expandIcon)
        .append($(document.createElement("span")).text(" )"));
      $(collapseLink)
        .append(collapseIcon)
        .append($(document.createElement("span")).text(" )"));

      _.each(this.list, function (listItem, i) {
        //Put the link in the collapsed list if this is past the max to be displayed
        var listEl = i + 1 > view.max ? collapsedList : expandedList;

        //Make an anchor tag out of strings (assuming its an ID)
        if (typeof listItem === "string")
          $(listEl).append(view.makeIDLink(listItem));
        else $(listEl).append(listItem);

        //Do we need a comma or and "and"?
        if (i == view.list.length - 2) $(listEl).append($(and).clone());
        else if (view.list.length > 1 && i < view.list.length - 1)
          $(listEl).append($(comma).clone());
      });

      this.$el.append(expandedList);

      if (numCollapsed > 0) {
        $(collapsedList).append(collapseLink);
        this.$el.append(expandLink, collapsedList);
      }

      if (this.prependText)
        this.$el.prepend(
          $(document.createElement("span")).text(this.prependText),
        );
      if (this.appendText)
        this.$el.append(
          $(document.createElement("span")).text(this.appendText),
        );

      return this;
    },

    makeIDLink: function (id) {
      return $(document.createElement("a"))
        .attr(
          "href",
          MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(id),
        )
        .text(id);
    },

    toggle: function (e) {
      e.preventDefault();

      var collapsed = this.$(".collapsed");
      var expanded = this.$(".expanded");

      if ($(collapsed).length > 0) {
        $(collapsed).fadeIn();
        $(collapsed).removeClass("collapsed").addClass("expanded");
      }

      if ($(expanded).length > 0) {
        $(expanded).fadeOut();
        $(expanded).removeClass("expanded").addClass("collapsed");
      }

      this.$(".control.expand").toggleClass("hidden");

      return false;
    },

    onClose: function () {
      this.remove();
    },
  });

  return ExpandCollapseListView;
});
