define([
  "jquery",
  "underscore",
  "backbone",
  "views/CitationView",
  "text!templates/citations/citationHeader.html",
], function ($, _, Backbone, CitationView, HeaderTemplate) {
  "use strict";

  /**
   * @class CitationHeaderView
   * @classdesc The CitationHeaderView shows a citation information displayed as
   * a header, with expandable author list (if there are more than a certain
   * number of authors).
   * @classcategory Views
   * @extends CitationView
   * @screenshot views/CitationHeaderView.png
   * @since x.x.x
   * @constructor
   */
  var CitationHeaderView = CitationView.extend(
    /** @lends CitationHeaderView.prototype */ {
      /**
       * The name of this type of view
       * @type {string}
       */
      type: "CitationHeader",

      /**
       * See {@link CitationView#className}
       */
      className: "citation header",

      /**
       * When there are more than this many authors, then this number of authors
       * will always be displayed, and the rest will be viewable with a click.
       * The last author will always be displayed.
       * @type {number}
       * @default 20
       */
      maxAuthors: 20,

      /**
       * See {@link CitationView#styles}. This view only uses the header style.
       * @type {Object}
       */
      styles: {
        header: {
          full: {
            template: _.template(HeaderTemplate), //
            render: "renderHeader",
          },
        },
      },

      /**
       * Override the CitationView style to use the header style.
       * @see {@link CitationView#style}
       */
      style: "header",

      /**
       * Override the CitationView context to use the full context.
       * @see {@link CitationView#context}
       */
      context: "full",

      /**
       * Never create a link for the citation header.
       * See {@link CitationView#createLink}
       */
      createLink: false,

      /**
       * Never create a link for the citation header title.
       * See {@link CitationView#createTitleLink}
       */
      createTitleLink: false,

      /**
       * IDs used in the template to identify the elements that will be
       * manipulated by this view to make the author list collapsible.
       * @type {Object}
       * @property {string} grp1 - The ID of the first group of authors
       * @property {string} grp2 - The ID of the second group of authors
       * @property {string} btn - The ID of the button that will toggle the
       *  visibility of the second group of authors
       * @property {string} last - The ID of the last author
       * @property {string} ellipsis - The ID of the ellipsis that will be
       * displayed when the second group of authors is hidden
       */
      classes: {
        grp1: "CV_authors1",
        grp2: "CV_authors2",
        btn: "CV_show-authors",
        last: "CV_last-author",
        ellipsis: "CV_ellipsis",
      },

      /**
       * Tracks whether the list of authors is open or closed. This will be set
       * automatically when the button is clicked. Set to true when initializing
       * the view to initially render the list open.
       * @type {boolean}
       */
      authorListIsOpen: false,

      /**
       * Render the citation header. Called by {@link CitationView#render}.
       * @param {Object} options - Options to pass to the render method
       * @param {string} options.style - The style to use for rendering
       */
      renderHeader: function (options, template) {
        const authors = options.originArray.map((author) => {
          return this.CSLNameToFullNameStr(author);
        });
        // Split the authors into two groups, one with the maximum number of
        // authors configured (including the last author), and one with the
        // rest.
        const numAuthors = (this.numAuthors = authors.length);
        const maxAuthors = (this.maxAuthors = this.maxAuthors || numAuthors);
        const authorsGrp1 = (this.authorsGrp1 = authors.slice(0, maxAuthors));
        const authorsGrp2 = (this.authorsGrp2 = authors.slice(maxAuthors));
        const numAuthorsGrp2 = (this.numAuthorsGrp2 = authorsGrp2.length);

        // Create a text string for both groups of authors.
        let grp1Str = "";
        let grp2Str = "";
        let lastAuthStr = "";

        if (numAuthors === 1) {
          // If there is only one author, just show the name.
          grp1Str = authorsGrp1[0];
        } else if (numAuthors === 2) {
          // If there are two authors, separate with and.
          grp1Str = authorsGrp1.join(" and ");
        } else if (numAuthors <= maxAuthors) {
          // If there are less than maxAuthors, separate with commas and and.
          grp1Str = authorsGrp1.slice(0, -1).join(", ");
          grp1Str += ", and " + authorsGrp1.slice(-1);
        } else {
          // Move the last author from grp2 into its own variable
          const lastAuthor = authorsGrp2.pop();
          // Move the last author from grp1 to the start of grp2
          authorsGrp2.unshift(authorsGrp1.pop());
          // Grp1 string should be separated by just commas, including a comma
          // at the very end.
          grp1Str = authorsGrp1.join(", ") + ", ";
          // Store the "and" with the last author
          lastAuthStr = " and " + lastAuthor;
          // grp2 also just commas
          grp2Str = authorsGrp2.join(", ");
        }
        options.authorsGrp1 = grp1Str;
        options.authorsGrp2 = grp2Str;
        options.lastAuthor = lastAuthStr;

        // Pass classes that we can use to refer to all the elements we need to
        // manipulate.
        options.classes = this.classes;

        this.el.innerHTML = template(options);

        // Select all the elements
        const els = (this.els = {});
        Object.keys(options.classes).forEach((key) => {
          els[key] = this.el.querySelector(`.${options.classes[key]}`);
        });

        // If there are fewer than maxAuthors, then the template will not render
        // a button or ellipsis. Otherwise, set the open/close behavior
        if (els.btn) {
          els.btn.addEventListener("click", this.toggleList.bind(this));
        }
        if (els.ellipsis) {
          els.ellipsis.addEventListener("click", this.openList.bind(this));
        }
        if (els.ellipsis || els.btn) {
          // Set the list to be open or closed based on the initial setting of
          // in the view
          if (this.authorListIsOpen) {
            this.openList();
          } else {
            this.closeList();
          }
        }
      },

      /**
       * Open the list of authors, showing all authors.
       */
      openList: function () {
        try {
          const els = this.els;
          els.grp2.style.display = "";
          els.btn.innerHTML = "- Show fewer authors";
          els.ellipsis.style.display = "none";
          // Reorder the elements
          els.btn.parentNode.append(
            els.grp1,
            els.grp2,
            els.last,
            els.btn,
            els.ellipsis
          );
          this.authorListIsOpen = true;
        } catch (error) {
          console.log(
            "Failed to expand an author list in the citation view.",
            error
          );
        }
      },

      /**
       * Close the list of authors, showing only the first group of authors. The
       * last author will always be shown.
       */
      closeList: function () {
        try {
          const els = this.els;
          const no = this.numAuthorsGrp2 || "";
          els.grp2.style.display = "none";
          els.btn.innerHTML = `+ Show ${no} more authors`;
          els.ellipsis.style.display = "";
          // Reorder elements
          els.btn.parentNode.append(
            els.grp1,
            els.ellipsis,
            els.last,
            els.btn,
            els.grp2
          );
          this.authorListIsOpen = false;
        } catch (error) {
          console.log(
            "Failed to collapse an author list in the citation view.",
            error
          );
        }
      },

      /**
       * Toggle the visibility of the second group of authors. If the second
       * group is visible, then it will be hidden. If the second group is
       * hidden, then it will be shown.
       */
      toggleList: function () {
        if (this.authorListIsOpen) {
          this.closeList();
        } else {
          this.openList();
        }
      },
    }
  );

  return CitationHeaderView;
});
