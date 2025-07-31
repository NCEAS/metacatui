define([
  "jquery",
  "underscore",
  "backbone",
  "localforage",
  "clipboard",
  "text!templates/draftsTemplate.html",
  "common/Utilities",
], function (
  $,
  _,
  Backbone,
  LocalForage,
  Clipboard,
  draftsTemplate,
  Utilities,
) {
  /**
   * @class DraftsView
   * @classdesc A view that lists the local submission drafts for this user
   * @classcategory Views
   * @extends Backbone.View
   */
  var view = Backbone.View.extend(
    /** @lends DraftsView.prototype */ {
      type: "DraftsView",
      el: "#Content",
      className: "div",
      template: _.template(draftsTemplate),

      initialize: function () {
        return this;
      },

      render: function () {
        var view = this;
        var drafts = [];

        LocalForage.iterate(function (value, key, _i) {
          // Extract each draft
          let fileName = "draft";
          if (value?.title) {
            fileName = Utilities.trimToFullWords(value.title, 50);
            fileName = Utilities.sanitizeStrict(fileName);
          }
          drafts.push({
            key: key,
            value: value,
            fileName,
            friendlyTimeDiff: view.friendlyTimeDiff(value.datetime),
          });
        })
          .then(function () {
            // Sort by datetime
            drafts = _.sortBy(drafts, function (draft) {
              return draft.value.datetime.toString();
            }).reverse();
          })
          .then(function () {
            // Render
            view.$el.html(
              view.template({
                drafts: drafts,
              }),
            );

            // Insert downloadables
            view.insertDownloadables();
            // Insert copiables
            view.insertCopiables();
          })
          .catch(function (err) {
            console.log(err);
            view.$el.html("<div>There was an error listing drafts.</div>");
          });

        return this;
      },

      /** Attach a click handler for download buttons that triggers a draft
       * or all drafts to be downloaded
       */
      insertDownloadables: function () {
        var view = this;

        // Build handlers for single downloaders
        _.each(this.$el.find(".draft-download"), function (el) {
          var a = $(el).find("a.download");

          var text = $(el).find("textarea")[0].value;
          var fileName = a.data("filename") || "draft.xml";

          $(a).on("click", view.createDownloader(text, fileName));
        });

        // Build handler for Download All button
        this.$el.find(".download-all").on("click", this.createDownloadAll());
      },

      /** Creates a function for use as an event handler in insertDownloadables
       * that creates a closure around the content (text) and filename and
       * causes the browser to download the draft when clicked
       */
      createDownloader: function (text, fileName) {
        return function () {
          var blob = new Blob([text], { type: "application/xml" });
          var url = window.URL.createObjectURL(blob);

          var a = document.createElement("a");
          a.style = "display: none;";
          a.href = url;
          a.download = fileName;
          a.click();
          a.remove();
        };
      },

      createDownloadAll: function () {
        var drafts = [];

        _.each(this.$el.find("textarea"), function (textarea) {
          drafts.push(textarea.value);
        });

        var doc =
          '<?xml version="1.0" encoding="utf-8"?>\n<drafts>\n' +
          _.map(drafts, function (draft) {
            return "\t<draft>\n\t\t" + draft + "\n\t</draft>\n";
          }).join("") +
          "</drafts>";

        return function () {
          var blob = new Blob([doc], { type: "application/xml" });
          var url = window.URL.createObjectURL(blob);

          var a = document.createElement("a");
          a.style = "display: none;";
          a.href = url;
          a.download = "drafts.xml";
          a.click();
          a.remove();
        };
      },

      insertCopiables: function () {
        var copiables = $(".copy-to-clipboard");

        _.each(copiables, function (copiable, i) {
          var clipboard = new Clipboard(copiable, {
            text: function (trigger) {
              return $("#draft-" + i).text();
            },
          });

          clipboard.on("success", function (e) {
            var el = $(e.trigger);

            $(el).html(
              $(document.createElement("span")).addClass(
                "icon icon-ok success",
              ),
            );

            // Use setTimeout instead of jQuery's built-in Events system because
            // it didn't look flexible enough to allow me update innerHTML in
            // a chain
            setTimeout(function () {
              $(el).html('<i class="icon icon-copy"></i> Copy to Clipboard');
            }, 500);
          });
        });
      },

      /**
       * Formats a time difference, in milliseconds, in a human-friendly way
       * @param {string} datetime: A datetime as a string which needs to be
       * parsed before working with
       */
      friendlyTimeDiff: function (datetime) {
        var friendly,
          now = new Date(),
          then = new Date(datetime),
          diff = now - then;

        // Fall through from largest to smallest, finding the largest unit
        // that describes the difference with a unit value of one or greater
        if (diff > 2678400000) {
          friendly = {
            value: Math.round(diff / 2678400000),
            unit: "month",
          };
        } else if (diff > 604800000) {
          friendly = {
            value: Math.round(diff / 604800000),
            unit: "week",
          };
        } else if (diff > 86400000) {
          friendly = {
            value: Math.round(diff / 86400000),
            unit: "day",
          };
        } else if (diff > 3600000) {
          friendly = {
            value: Math.round(diff / 3600000),
            unit: "hour",
          };
        } else if (diff > 60000) {
          friendly = {
            value: Math.round(diff / 60000),
            unit: "minute",
          };
        } else if (diff > 1000) {
          friendly = {
            value: Math.round(diff / 1000),
            unit: "second",
          };
        } else {
          // Shortcircuit if really small and return...
          return "just now";
        }

        // Pluralize
        if (friendly.value !== 1) {
          friendly.unit = friendly.unit + "s";
        }

        return friendly.value + " " + friendly.unit + " ago";
      },
    },
  );

  return view;
});
