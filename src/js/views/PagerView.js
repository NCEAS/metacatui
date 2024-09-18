define(["jquery"], function ($) {
  var PagerView = Backbone.View.extend({
    tagName: "div",

    className: "pager",

    pageLinkTemplate: _.template(
      "<a href='<%=url%>' class='pager-link <%=classes%>' data-page='<%=num%>'><%=num%><a>",
    ),

    initialize: function (options) {
      if (!options) return;
      if (!options.pages) return;

      this.items = options.pages;
      this.$items = $(this.items);

      this.itemsPerPage =
        options.itemsPerPage || Math.round(this.$items.length / 3);
      this.numPages = Math.ceil(this.$items.length / this.itemsPerPage);
      this.currentPage = options.currentPage || 1;

      if (options.classes) this.$el.addClass(options.classes);
    },

    events: {
      "click .pager-link.num": "goToPage",
      "click .pager-link.first": "goToFirst",
      "click .pager-link.last": "goToLast",
    },

    render: function () {
      //Reset the pager and page items first in case we are refreshing the pager
      this.$el.empty();
      this.$items.show();
      this.$items.removeAttr("data-page");
      this.$items.removeClass("current-page");

      this.$el.append(
        this.pageLinkTemplate({ url: "", num: "First", classes: "first" }),
      );

      for (var i = 1; i <= this.numPages; i++) {
        var classes = "num";
        if (this.currentPage == i) classes += " current-page";
        this.$el.append(
          this.pageLinkTemplate({
            url: "",
            num: i,
            classes: classes,
          }),
        );
      }

      this.$el.append(
        this.pageLinkTemplate({ url: "", num: "Last", classes: "last" }),
      );

      var page = 1;
      for (var i = 0; i < this.$items.length; i++) {
        $(this.items[i]).attr("data-page", page);

        if (page != this.currentPage) $(this.items[i]).hide();
        else $(this.items[i]).addClass("current-page");

        if (i == page * this.itemsPerPage - 1) page++;
      }

      return this;
    },

    goToPage(e, newPageNum) {
      if (e) e.preventDefault();

      if (!newPageNum) {
        var link = $(e.target),
          newPage = link.attr("data-page");
      } else {
        var link = this.$(".pager-link[data-page='" + newPageNum + "']"),
          newPage = newPageNum;
      }

      //Reset the first and last links
      this.$(".pager-link.first, .pager-link.last").removeClass("unactive");

      if (newPage == this.numPages)
        this.$(".pager-link.last").addClass("unactive");
      else if (newPage == 1) this.$(".pager-link.first").addClass("unactive");

      //Find the current page elements
      var newPageEl = this.$items.filter("[data-page='" + newPage + "']");

      //If nothing was found, exit
      if (!newPageEl.length) return false;

      //Hide the current page items
      this.$items.filter(".current-page").hide().removeClass("current-page");

      //Show the new current page items
      $(newPageEl).show().addClass("current-page");

      //Update the pager links
      this.$(".pager-link.current-page").removeClass("current-page");
      link.addClass("current-page");

      this.currentPage = newPage;
    },

    goToFirst(e) {
      if (e) e.preventDefault();

      this.$(".pager-link.last").removeClass("unactive");
      this.$(".pager-link.first").addClass("unactive");

      this.goToPage(null, 1);
    },

    goToLast(e) {
      if (e) e.preventDefault();

      this.$(".pager-link.first").removeClass("unactive");
      this.$(".pager-link.last").addClass("unactive");

      this.goToPage(null, this.numPages);
    },

    update: function (items) {
      if (!items) return false;

      this.items = items;
      this.$items = $(items);

      this.numPages = Math.ceil(items.length / this.itemsPerPage);

      if (this.currentPage > this.numPages) {
        this.currentPage = this.numPages;
        this.goToPage(null, this.currentPage);
      }

      this.render();
    },
  });

  return PagerView;
});
