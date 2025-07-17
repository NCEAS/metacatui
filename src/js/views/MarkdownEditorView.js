define([
  "underscore",
  "jquery",
  "backbone",
  "woofmark",
  "models/metadata/eml220/EMLText",
  "views/ImageUploaderView",
  "views/MarkdownView",
  "views/TableEditorView",
  "text!templates/markdownEditor.html",
], (
  _,
  $,
  Backbone,
  Woofmark,
  EMLText,
  ImageUploader,
  MarkdownView,
  TableEditor,
  Template,
) => {
  // So that we can assign properties to Woofmark
  const woofmark = Woofmark;

  // Set the default text for collapsible sections
  Woofmark.strings.placeholders.detailsSummary = "Click to expand/collapse";
  Woofmark.strings.placeholders.detailsContent = "Details here";
  Woofmark.strings.titles.details = "Collapsible section";

  /**
   * @class MarkdownEditorView
   * @classdesc A view of an HTML textarea with markdown editor UI and preview tab
   * @classcategory Views
   * @augments Backbone.View
   * @class
   */
  const MarkdownEditorView = Backbone.View.extend(
    /** @lends MarkdownEditorView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       * @readonly
       */
      type: "MarkdownEditor",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "markdown-editor",

      /**
       * References to templates for this view. HTML files are converted to
       * Underscore.js templates
       * @type {Underscore.Template}
       */
      template: _.template(Template),

      /*
       * Markdown to insert into the textarea when the view is first rendered
       * @type {string}
       */
      // markdown: "",

      /**
       * EMLText model that contains a markdown attribute to edit. The markdown is
       * inserted into the textarea when the view is first rendered. If there's no markdown,
       * then the view looks for markdown from the markdownExample attribute in the model.
       * Note that if there are multiple markdown strings in the model, only the first
       * is rendered/edited.
       * @type {EMLText}
       */
      model: null,

      /**
       * The placeholder text to display in the textarea when it's empty
       * @type {string}
       */
      markdownPlaceholder: "",

      /**
       * The placeholder text to display in the preview area when there's no
       * markdown
       * @type {string}
       */
      previewPlaceholder: "",

      /**
       * Indicates whether or not to render a table of contents for the markdown
       * preview. If set to true, a table of contents will be shown in the preview
       * if there two or more top-level headers are rendered from the markdown.
       * @type {boolean}
       */
      showTOC: false,

      /**
       * The maximum height for uploaded image files. If a file is taller than this, it
       * will be resized without warning before being uploaded. If set to null,
       * the image won't be resized based on height (but might be depending on
       * maxImageWidth).
       * @type {number}
       * @default 1200
       * @since 2.15.0
       */
      maxImageHeight: 1200,

      /**
       * The maximum width for uploaded image files. If a file is wider than this, it
       * will be resized without warning before being uploaded. If set to null,
       * the image won't be resized based on width (but might be depending on
       * maxImageHeight).
       * @type {number}
       * @default 1200
       * @since 2.15.0
       */
      maxImageWidth: 1200,

      /**
       * A jQuery selector for the HTML textarea element that will contain the
       * markdown text.
       * @type {string}
       */
      textarea: ".markdown-textarea",

      /**
       * The events this view will listen to and the associated function to call.
       * @type {object}
       */
      events: {
        "click #markdown-preview-link": "previewMarkdown",
        "focusout .markdown-textarea": "updateMarkdown",
      },

      /**
       * Initialize is executed when a new markdownEditor is created.
       * @param {object} options - A literal object with options to pass to the view
       */
      initialize(options) {
        if (typeof options !== "undefined") {
          this.model = options.model || new EMLText();
          this.markdownPlaceholder = options.markdownPlaceholder || "";
          this.previewPlaceholder = options.previewPlaceholder || "";
          this.showTOC = options.showTOC || false;
        }
      },

      /**
       * render - Renders the markdownEditor - add UI for adding and editing
       * markdown to a textarea
       */
      render() {
        // Save the view
        const view = this;

        // The markdown attribute in the model may be a string or an array of strings.
        // Although EML211 can comprise an array of markdown elements,
        // this view will only render/edit the first if there are multiple.
        let markdown = this.model.get("markdown");
        if (Array.isArray(markdown) && markdown.length) {
          [markdown] = markdown;
        }
        if (!markdown || !markdown.length) {
          markdown = this.model.get("markdownExample");
        }

        // Insert the template into the view
        this.$el
          .html(
            this.template({
              markdown: markdown || "",
              markdownPlaceholder: this.markdownPlaceholder || "",
              previewPlaceholder: this.previewPlaceholder || "",
              cid: this.cid,
            }),
          )
          .data("view", this);

        // The textarea element that the markdown editor buttons & functions will edit
        let textarea = this.$el.find(this.textarea);

        if (textarea && textarea.length) {
          textarea = textarea.get(0); // Get the DOM element from the jQuery object
        }

        if (!textarea) return;

        // Set woofmark options. See https://github.com/bevacqua/woofmark
        const woofmarkOptions = {
          fencing: true,
          html: false,
          wysiwyg: false,
          defaultMode: "markdown",
          render: {
            // Hide buttons that switch between markdown, WYSIWYG, & HTML for now
            modes(button, _id) {
              button.remove();
            },
          },
        };

        // Set options for all the buttons that will be shown in the toolbar.
        // Buttons will be shown in the order they are listed.
        // Defaults from Woofmark will be used unless they are replaced here,
        // see: https://github.com/bevacqua/woofmark/blob/master/src/strings.js.
        // They key is the ID for the button.
        //    remove: if set to true, the button will be removed (use this to hide default woofmark buttons)
        //    icon: the name of the font awesome icon to show in the button. If no button or svg is set, the ID/key will be displayed instead.
        //    svg: svg code to show in the button. If no button or svg is set, the ID/key will be displayed instead.
        //    title: The title to show on hover
        //    function: The function to call when the button is pressed. It will be passed chunks, cmd, e (see Woofmark docs), plus the ID/key. Called with view as the this (context).
        //    shortcut: The keyboard shortcut to use for the button. This will only work if there is also a custom function set.
        //    insertDividerAfter: If set to true, a visual divider will be placed after this button.
        const buttonOptions = {
          // Default woofmark buttons to remove
          attachment: {
            remove: true,
          },
          heading: {
            remove: true,
          },
          hr: {
            remove: true,
          },
          // Remove the default image uploader button so we can add our own that
          // uploads the image as a dataone object.
          image: {
            remove: true,
          },
          // Default woofmark buttons to keep, with custom properties, + custom buttons
          bold: {
            icon: "bold",
          },
          italic: {
            icon: "italic",
          },
          strike: {
            title: "Strikethrough",
            icon: "strikethrough",
            shortcut: "Ctrl+Shift+X",
            function: view.strikethrough,
            insertDividerAfter: true,
          },
          h1: {
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 2.9V0h7.8v2.9l-2 .5v7h7.7v-7l-2-.5V0h7.7v2.9l-2 .5v17.2l2 .5V24h-7.8v-2.9l2-.5V14H5.9v6.6l2 .5V24H0v-2.9l2-.5V3.4z"/><path fill-rule="nonzero" d="M24 16.4v-1.9h-1.4V5.8h-4.1v1.8H20v7h-1.4v1.8z"/></svg>`,
            title: "Top-level heading",
            function: view.addHeader,
          },
          h2: {
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="nonzero" d="M23.2 17.3l.1-3.1h-2v1.3H18c.1-.7.8-1.5 2-2.2L22 12a4 4 0 001-1l.3-1.5c0-.9-.3-1.6-1-2.1-.6-.5-1.5-.8-2.6-.8-1.3 0-2.2.3-2.9 1-.6.6-1 1.5-1 2.8l2.2.1c0-.8.2-1.3.4-1.7.3-.3.6-.5 1.1-.5.4 0 .7.1.9.3.2.2.3.5.3.8 0 .4-.1.7-.4 1-.2.4-.6.7-1.1 1a17 17 0 00-2.1 1.9c-.5.5-.8 1-1 1.6-.3.6-.4 1.4-.4 2.3h7.6z"/><path d="M.5 4.6V2.3h6.3v2.3L5.2 5v5.6h6.2V5l-1.6-.4V2.3H16v2.3l-1.6.4v14l1.6.4v2.3H9.8v-2.3l1.6-.4v-5.3H5.2V19l1.6.4v2.3H.5v-2.3l1.6-.4V5z"/></svg>`,
            title: "Second-level heading",
            function: view.addHeader,
          },
          h3: {
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="nonzero" d="M18.1 17.3c.7 0 1.4-.1 2-.4.6-.2 1-.6 1.4-1 .3-.6.5-1.1.5-1.7 0-1.2-.7-2-2-2.5 1-.5 1.6-1.2 1.6-2.2 0-.9-.4-1.6-1-2-.6-.6-1.5-.8-2.6-.8-1 0-1.9.3-2.5.8a3 3 0 00-1 2.2l2.1.1c0-.9.4-1.3 1.3-1.3.3 0 .6 0 .9.3.2.2.3.4.3.8s-.2.7-.5.9a3 3 0 01-1.5.3v1.9h.6c.5 0 1 0 1.2.3.3.3.5.7.5 1 0 .5-.2.8-.4 1.1-.3.3-.7.5-1.1.5-1 0-1.5-.6-1.5-1.8l-2.2.1c.1 2.3 1.4 3.4 4 3.4z"/><path d="M2 6.6V4.8h4.7v1.8l-1.2.3V11H10V6.9l-1.2-.3V4.8h4.6v1.8l-1.2.3V17l1.2.3v1.8H8.9v-1.8l1.2-.3v-3.9H5.5v4l1.2.2v1.8H2v-1.8l1.2-.3V7z"/></svg>`,
            title: "Tertiary heading",
            function: view.addHeader,
            insertDividerAfter: true,
          },
          divider: {
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="22" height="3" x="1" y="10.58" fill-rule="evenodd"/></svg>`,
            function: view.addDivider,
            title: "Top-level heading",
            shortcut: "Ctrl+Enter",
          },
          ol: {
            title: "Ordered list",
            icon: "list-ol",
          },
          ul: {
            title: "Un-ordered list",
            icon: "list-ul",
            insertDividerAfter: true,
          },
          quote: {
            icon: "quote-left",
          },
          code: {
            icon: "code",
            insertDividerAfter: true,
          },
          link: {
            icon: "link",
          },
          d1Image: {
            icon: "picture",
            function: view.addMdImage,
            title: "Image",
            // use Ctrl+G to overwrite the built-in woofmark image function
            shortcut: "Ctrl+G",
          },
          table: {
            icon: "table",
            function: view.addTable,
            insertDividerAfter: true,
          },
          details: {
            icon: "collapse",
            title: Woofmark.strings.titles.details,
            function(e, mode, chunks, _id) {
              // Add a collapsible section to the markdown
              const summary = Woofmark.strings.placeholders.detailsSummary;
              const content =
                chunks.selection ||
                Woofmark.strings.placeholders.detailsContent;
              const details = `<details>\n  <summary>${summary}</summary>\n  ${content}\n</details>`;
              chunks.selection = details;
              chunks.skip({ before: 0, after: 0 });
            },
          },
        };

        const buttonKeys = Object.keys(buttonOptions);

        // PRE-RENDER WOOFMARK Set titles on buttons before the Woofmark text
        // editor is rendered. This way we can use Woofmark's built-in
        // functionality to convert "Ctrl" to "Cmd" symbol if user is on mac.
        _.each(
          buttonKeys,
          (key, _i) => {
            const options = buttonOptions[key];
            const title =
              options.title || key.charAt(0).toUpperCase() + key.slice(1);

            const shortcuts = Woofmark.strings.titles[key]?.match(/Ctrl\+.*$/);
            const presetShortcut = shortcuts ? shortcuts[0] : "";
            const shortcut = options.shortcut || presetShortcut;

            if (title) {
              woofmark.strings.titles[key] = [title, shortcut].join(" ");
            }
            // So that we can identify buttons that we want to manipulate after
            // they are rendered, use the key as the button text for now.
            woofmark.strings.buttons[key] = key;
          },
          this,
        );

        // RENDER WOOFMARK
        // Initialize the woofmark markdown editor
        this.markdownEditor = new Woofmark(textarea, woofmarkOptions);

        // POST-RENDER WOOFMARK
        // After the markdown editor is initialized..

        // Add custom functions
        _.each(buttonKeys, (key, _i) => {
          const options = buttonOptions[key];
          if (options.function) {
            // addCommandButton uses cmd, not ctrl
            let shortcut = "";
            if (options.shortcut) {
              shortcut = options.shortcut.replace("Ctrl", "cmd");
            }
            view.markdownEditor.addCommandButton(
              key,
              shortcut,
              (e, mode, chunks) => {
                options.function.call(view, e, mode, chunks, key);
              },
            );
          }
        });

        // Modify the button order & appearance
        const buttonContainer = $(view.markdownEditor.textarea)
          .parent()
          .find(".wk-commands");

        _.each(buttonKeys, (key, _i) => {
          // Re-order buttons based on the order in buttonOptions, and remove
          // any that are marked for removal
          const options = buttonOptions[key];
          const buttonEl = buttonContainer
            .find(".wk-command")
            .filter(function filter() {
              return this.innerHTML === key;
            });
          if (options.remove !== true) {
            // Add tooltip
            buttonEl.tooltip({
              placement: "top",
              delay: 500,
              trigger: "hover",
            });
            // Add font awesome icon or SVG
            if (options.icon) {
              buttonEl.html(`<i class='icon-${options.icon}'></i>`);
            } else if (options.svg) {
              buttonEl.html(options.svg);
              buttonEl.find("svg").height("13px").width("auto");
            }
            buttonContainer.append(buttonEl);
            if (options.insertDividerAfter === true) {
              buttonContainer.append("<div class='wk-commands-divider'></div>");
            }
          } else {
            buttonEl.remove();
          }
        });
      },

      /**
       * addHeader - description
       * @param  {event}  e      is the original event object
       * @param  {string} mode   can be markdown, html, or wysiwyg
       * @param  {object} chunksObj is a chunks object, describing the current state of the editor, see https://github.com/bevacqua/woofmark#chunks
       * @param  {string} id     the ID of the function, set as they key in buttonOptions in the render function
       */
      addHeader(e, mode, chunksObj, id) {
        // Get the header level from the ID
        const levelToCreate = parseInt(id.replace(/^\D+/g, ""), 10);
        const chunks = chunksObj;

        chunks.selection = chunks.selection
          .replace(/\s+/g, " ")
          .replace(/(^\s+|\s+$)/g, "");

        if (!chunks.selection) {
          chunks.startTag = `${new Array(levelToCreate + 1).join("#")} `;
          chunks.selection = Woofmark.strings.placeholders.heading;
          chunks.endTag = "";
          chunks.skip({ before: 1, after: 1 });
          return;
        }

        chunks.findTags(/#+[ ]*/, /[ ]*#+/);

        chunks.startTag = "";
        chunks.endTag = "";
        chunks.findTags(null, /\s?(-+|=+)/);

        // chunks.startTag = chunks.endTag = "";
        chunks.skip({ before: 1, after: 1 });

        if (levelToCreate > 0) {
          chunks.startTag = `${new Array(levelToCreate + 1).join("#")} `;
        }
      },

      /**
       * addDivider – add or remove a horizontal-rule divider.
       * @param {Event}  e          original event (unused here)
       * @param {string} mode       'markdown' | 'html' | 'wysiwyg'  (unused here)
       * @param {object} chunksObj  Woofmark “chunks” describing the editor state
       */
      addDivider(e, mode, chunksObj) {
        const chunks = chunksObj;
        const markdown = `${chunks.before}${chunks.selection}${chunks.after}`;

        const startSel = chunks.before.length;
        const endSel = startSel + chunks.selection.length + 1;

        const dividerRE = /(?:\r\n|\r|\n){2}-{3,}/gm;

        // Collect all divider positions without loops / generators
        const dividers = [];
        markdown.replace(dividerRE, (fullMatch, _unused, offset) => {
          dividers.push({
            start: offset + 2,
            end: offset + fullMatch.length + 1,
          });
          return fullMatch; // leave text unchanged
        });

        // Does the current selection touch any divider?
        const hit = dividers.find(
          ({ start, end }) =>
            (endSel > start && endSel <= end) || // cursor end inside divider
            (startSel < end && startSel >= start), // cursor start inside divider
        );

        if (hit) {
          // remove the overlapping divider
          chunks.before = `${markdown.slice(0, hit.start - 2)}\n`;
          chunks.selection = "";
          chunks.after = markdown.slice(hit.end);
        } else {
          // insert a new divider
          const needsExtraNewline = /(\r\n|\r|\n){1}$/.test(chunks.before);
          const dividerToAdd = `${needsExtraNewline ? "\n" : "\n\n"}--------------------\n`;
          chunks.before += dividerToAdd;
        }
      },

      /**
       * addTable - Creates the UI for editing and adding tables to the textarea.
       * Detects whether the selection contained any part of a markdown table,
       * then opens a woofmark dialog box and inserts a table editor view. If a
       * table was selected, the table information is imported into the table
       * editor where the user can edit it. If no table was selected, then it
       * creates an empty table where the user can add data.
       * addTable – open the table-editor dialog and import or insert a markdown table
       * @param {Event}  e          Original click/command event (unused here)
       * @param {string} mode       'markdown' | 'html' | 'wysiwyg'  (unused)
       * @param {object} chunksObj  Woofmark “chunks” describing the editor state
       */
      addTable(e, mode, chunksObj) {
        const chunks = chunksObj;

        /* ---------- open the (link) dialog that we’ll repurpose ---------- */
        this.markdownEditor.showLinkDialog();

        const dialog = $(".wk-prompt");
        const dialogContent = dialog.find(".wk-prompt-input-container");
        const dialogTitle = dialog.find(".wk-prompt-title");
        const dialogDescription = dialog.find(".wk-prompt-description");
        const dialogOkBtn = dialog.find(".wk-prompt-ok");

        /* ---------- detect a table inside the current selection ---------- */
        const markdown = `${chunks.before}${chunks.selection}${chunks.after}`;
        const startSel = chunks.before.length;
        const endSel = startSel + chunks.selection.length + 1;

        const tableRE =
          /((\|[^|\r\n]*)+\|(?:\r?\n|\r)?)+((?:\s*\|\s*:?\s*[-=]+\s*:?\s*)+\|)(\n\s*(?:\|[^\n]+\|\r?\n?)*)?/gm;

        // Harvest every table match (no loops, no generators)
        const tables = [];
        markdown.replace(tableRE, (full, _1, _2, _3, _4, offset) => {
          tables.push({ start: offset, end: offset + full.length, text: full });
          return full; // leave source untouched
        });

        // First table whose span intersects the cursor/selection
        const hit = tables.find(
          ({ start, end }) =>
            (endSel > start && endSel <= end) ||
            (startSel < end && startSel >= start),
        );

        let tableString = "";
        if (hit) {
          ({ text: tableString } = hit);
          chunks.before = markdown.slice(0, hit.start);
          chunks.selection = markdown.slice(hit.start, hit.end);
          chunks.after = markdown.slice(hit.end);
        }

        /* ---------- launch the TableEditor view ---------- */
        const tableEditor = new TableEditor({ markdown: tableString });
        tableEditor.render();

        dialogContent.html(tableEditor.el);
        dialogDescription.remove();
        dialogTitle.text("Insert Table");

        /* ---------- when user clicks OK, insert/replace the table ---------- */
        dialogOkBtn.off("click").on("click", () => {
          const tableMarkdown = tableEditor.getMarkdown();
          // Use Woofmark's runCommand so undo/redo work as expected
          this.markdownEditor.runCommand((chnks /* current */, _md) => {
            const c = chnks || {};
            c.before = chunks.before;
            c.after = chunks.after;
            c.selection = tableMarkdown;
          });
        });
      },

      /**
       * addMdImage - The function that gets called when a user clicks the custom
       * add image button added to the markdown editor. It uses the UI created by
       * the ImageUploaderView to allow a user to select & upload an image to the
       * repository, and uses Woofmark's built-in add image functionality to
       * insert the correct markdown into the textarea. This function must be
       * called such that "this" is the markdownEditor view.
       */
      addMdImage() {
        const view = this;

        // Show woofmark's default image upload dialog, inserted at the end of body
        view.markdownEditor.showImageDialog();

        // Select the image upload dialog elements so that we can customize it
        const imageDialog = $(".wk-prompt");
        const imageDialogInput = imageDialog.find(".wk-prompt-input");
        const imageDialogDescription = imageDialog.find(
          ".wk-prompt-description",
        );
        const imageDialogOkBtn = imageDialog.find(".wk-prompt-ok");
        // Save the inner HTML of the button for when we replace it
        // temporarily during image upload
        const imageDialogOkBtnTxt = imageDialogOkBtn.html();

        // Create an ImageUploaderView and insert into this view.
        const mdImageUploader = new ImageUploader({
          uploadInstructions: "Drag & drop an image here or click to upload",
          imageTagName: "img",
          height: "175",
          width: "300",
          maxHeight: view.maxImageHeight || null,
          maxWidth: view.maxImageWidth || null,
        });

        // Show when image is uploading; temporarily disable the OK button
        view.stopListening(mdImageUploader, "addedfile");
        view.listenTo(mdImageUploader, "addedfile", () => {
          // Disable the button during upload;
          imageDialogOkBtn.prop("disabled", true);
          imageDialogOkBtn.css({ opacity: "0.5", cursor: "not-allowed" });
          imageDialogOkBtn.html(
            "<i class='icon-spinner icon-spin icon-large loading icon'></i> " +
              "Uploading...",
          );
        });

        // Update the image input URL when the image is successfully uploaded
        view.stopListening(mdImageUploader, "successSaving");
        view.listenTo(mdImageUploader, "successSaving", (dataONEObject) => {
          // Execute the DataONEObject function that performs various functions after
          // a successful save
          dataONEObject.onSuccessfulSave();

          // Re-enable the button
          imageDialogOkBtn.prop("disabled", false);
          imageDialogOkBtn.html(imageDialogOkBtnTxt);
          imageDialogOkBtn.css({ opacity: "1", cursor: "pointer" });

          // Get the uploaded image's url.
          // var url = dataONEObject.url();
          let url = "";

          if (MetacatUI.appModel.get("isCN")) {
            let sourceRepo;

            // Use the object service URL from the origin MN/datasource
            if (dataONEObject.get("datasource")) {
              sourceRepo = MetacatUI.nodeModel.getMember(
                dataONEObject.get("datasource"),
              );
            }
            // Use the object service URL from the alt repo
            if (!sourceRepo) {
              sourceRepo = MetacatUI.appModel.getActiveAltRepo();
            }

            if (sourceRepo) {
              url = sourceRepo.objectServiceUrl;
            }
          }

          // If this MetacatUI deployment is pointing to a MN, use the meta service URL from the AppModel
          if (!url) {
            url =
              MetacatUI.appModel.get("objectServiceUrl") ||
              MetacatUI.appModel.get("resolveServiceUrl");
          }

          url += dataONEObject.get("id");

          // Create title out of file name without extension.
          let title = dataONEObject.get("fileName");
          if (title && title.lastIndexOf(".") > 0) {
            title = title.substring(0, title.lastIndexOf("."));
          }

          // Add the url + title to the input
          imageDialogInput.val(`${url} "${title}"`);
        });

        // Clear the input when the image is removed
        view.stopListening(mdImageUploader, "removedfile");
        view.listenTo(mdImageUploader, "removedfile", () => {
          imageDialogInput.val("");
        });

        // Render the image uploader and insert it just after the upload
        // instructions in the image upload dialog box.
        mdImageUploader.render();
        // The instructions for uploading in image that displays in the prompt/dialog
        imageDialogDescription.text("Click or drag & drop to upload an image");
        $(mdImageUploader.el).insertAfter(imageDialogDescription);
        // Hide the input box for now, to keep the uploader simple
        imageDialogInput.hide();
      },

      /**
       * strikethrough - Add or remove the markdown syntax for strike through to
       * the textarea. If there is text selected, then strike through formatting
       * will be added or removed from that selection. If no selection,
       * some placeholder text will be added surrounded by the strikethrough
       * delimiters.
       * @param  {event} e      is the original event object
       * @param  {string} mode   can be markdown, html, or wysiwyg
       * @param  {object} chunksObj is a chunks object, describing the current state of the editor, see https://github.com/bevacqua/woofmark#chunks
       */
      strikethrough(e, mode, chunksObj) {
        const chunks = chunksObj;
        const markup = "~~";
        // exactly two tiles
        // const tildes = "\\~{2}";
        // 2 tildes at the start of a string
        const rleading = /^(~{2})/;
        // 2 tildes at the end of a string
        const rtrailing = /(~{2}$)/;
        // 0-1 spaces at the end of a string
        // const rtrailingspace = /(\s?)$/;
        // 2+ line breaks
        const rnewlines = /\n{2,}/g;
        // the text to add when no text is selected
        const placeholder = "strikethrough text";

        // Remove leading & trailing white space from selection
        // (but do not remove from the user's text)
        chunks.trim();
        // Replace 2+ consecutive line breaks with 1 linebreak, otherwise
        // strikethrough syntax is incorrect and won't render HTML as expected
        chunks.selection = chunks.selection.replace(rnewlines, "\n");

        // See if the text before or after already contains ~~ at the start/end
        const leadTildes = rtrailing.exec(chunks.before);
        const trailTildes = rleading.exec(chunks.after);
        // See if the selected text already contains ~~ at start or end
        const selectLeadTildes = rleading.exec(chunks.selection);
        const selectTrailTildes = rtrailing.exec(chunks.selection);

        // If the selection is already surrounded by ~~, remove them
        if (leadTildes && trailTildes) {
          chunks.before = chunks.before.replace(rtrailing, "");
          chunks.after = chunks.after.replace(rleading, "");
          // If the selection starts & ends with ~~, remove them
        } else if (selectLeadTildes && selectTrailTildes) {
          chunks.selection = chunks.selection.replace(rleading, "");
          chunks.selection = chunks.selection.replace(rtrailing, "");
          // Otherwise, add a set of ~~
        } else {
          chunks.before += markup;
          chunks.after = markup + chunks.after;
          // Add the placeholder text if there was no selection
          if (chunks.selection.length <= 0) {
            chunks.selection = placeholder;
          }
        }
      },

      /**
       * updateMarkdown - Update the markdown attribute in this view using the
       * value of the markdown textarea
       */
      updateMarkdown() {
        const newMarkdown = this.$(this.textarea).val();
        // The markdown attribute in the model may be a string or an array of
        // strings. Although EML211 can comprise an array of markdown elements,
        // this view will only edit the first if there are multiple.
        const currentMarkdown = this.model.get("markdown");

        if (Array.isArray(currentMarkdown) && currentMarkdown.length) {
          // Clone then update arary before setting it on the model so that the
          // backbone "change" event is fired. See
          // https://stackoverflow.com/a/10240697
          const newMarkdownArray = _.clone(currentMarkdown);
          newMarkdownArray[0] = newMarkdown;
          this.model.set("markdown", newMarkdownArray);
        } else {
          this.model.set("markdown", newMarkdown);
        }
      },

      /**
       * previewMarkdown - render the markdown preview.
       */
      previewMarkdown() {
        let markdown = this.model.get("markdown");
        if (Array.isArray(markdown)) {
          if (markdown.length === 0) {
            markdown = this.markdownPlaceholder;
          } else {
            [markdown] = markdown;
          }
        }

        const markdownPreview = new MarkdownView({
          markdown: markdown || this.previewPlaceholder,
          showTOC: this.showTOC || false,
        });

        // Render the preview
        markdownPreview.render();
        // Add the rendered markdown to the preview tab
        this.$(`#markdown-preview-${this.cid}`).html(markdownPreview.el);
      },
    },
  );

  return MarkdownEditorView;
});
