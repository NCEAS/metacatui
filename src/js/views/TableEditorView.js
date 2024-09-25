define([
  "underscore",
  "jquery",
  "backbone",
  "markdownTableFromJson",
  "markdownTableToJson",
  "text!templates/tableEditor.html",
], (_, $, Backbone, markdownTableFromJson, markdownTableToJson, Template) => {
  // a utility function to check if a value is empty for sorting
  const valIsEmpty = (x) =>
    x === "" || x === undefined || x === null || Number.isNaN(x);

  /**
   * @class TableEditorView
   * @classdesc A view of an HTML textarea with markdown editor UI and preview
   * tab
   * @classcategory Views
   * @augments Backbone.View
   * @class
   */
  const TableEditorView = Backbone.View.extend(
    /** @lends TableEditorView.prototype */
    {
      /**
       * The type of View this is
       * @type {string}
       * @readonly
       */
      type: "TableEditor",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "table-editor",

      /**
       * References to templates for this view. HTML files are converted to
       * Underscore.js templates
       * @type {Underscore.Template}
       */
      template: _.template(Template),

      /**
       * The current number of rows displayed in the spreadsheet, including the
       * header row
       * @type {number}
       */
      rowCount: 0,

      /**
       * The current number of columns displayed in the spreadsheet, including
       * the row number column
       * @type {number}
       */
      colCount: 0,

      /**
       * The same data shown in the table as a stringified JSON object.
       * @type {string}
       */
      tableData: "",

      /**
       * Map for storing the sorting history of every column
       * @type {map}
       */
      sortingHistory: new Map(),

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {object}
       */
      events: {
        "click #reset": "resetData",
        "focusout table": "updateData",
        "click .table-body": "handleBodyClick",
        "click .table-headers": "handleHeadersClick",
        "click *": "closeDropdown",
      },

      /**
       * Default row & column count for empty tables
       * @type {object}
       */
      defaults: {
        initialRowCount: 7,
        initialColCount: 3,
      },

      /**
       * Initialize is executed when a new tableEditor is created.
       * @constructs TableEditorView
       * @param {object} options - A literal object with options to pass to the
       * view
       * @param {string} options.markdown - A markdown table to edit.
       * @param {string} options.tableData - The table data as a stringified
       * JSON in the form of an array of arrays. Only used if markdown is not
       * provided.
       */
      initialize(options = {}) {
        const mergedOptions = { ...this.defaults, ...options };

        Object.keys(mergedOptions).forEach((key) => {
          this[key] = mergedOptions[key];
        });
      },

      /**
       * Renders the tableEditor - add UI for creating and editing tables
       */
      render() {
        // Insert the template into the view
        this.$el
          .html(
            this.template({
              cid: this.cid,
            }),
          )
          .data("view", this);

        // If initalized with markdown, convert to JSON and use as table data
        // Parse the table string into a javascript object so that we can pass
        // it into the table editor view to be edited by the user.
        if (this.markdown && this.markdown.length > 0) {
          const tableArray = this.getJSONfromMarkdown(this.markdown);
          if (tableArray && Array.isArray(tableArray) && tableArray.length) {
            this.saveData(tableArray);
            this.createSpreadsheet();
            // Add the column that we use for row numbers in the editor
            this.addColumn(0, "left");
          }
        } else {
          this.createSpreadsheet();
        }
      },

      /**
       * Creates or re-creates the table & headers with data, if there is any.
       */
      createSpreadsheet() {
        const spreadsheetData = this.getData();

        this.rowCount = spreadsheetData.length - 1 || this.initialRowCount;
        this.colCount = spreadsheetData[0].length - 1 || this.initialColCount;

        const tableHeaderElement = this.$el.find(".table-headers")[0];
        const tableBodyElement = this.$el.find(".table-body")[0];

        const tableBody = tableBodyElement.cloneNode(true);
        tableBodyElement.parentNode.replaceChild(tableBody, tableBodyElement);
        const tableHeaders = tableHeaderElement.cloneNode(true);
        tableHeaderElement.parentNode.replaceChild(
          tableHeaders,
          tableHeaderElement,
        );

        tableHeaders.innerHTML = "";
        tableBody.innerHTML = "";

        tableHeaders.appendChild(this.createHeaderRow(this.colCount));
        this.createTableBody(tableBody, this.rowCount, this.colCount);

        this.populateTable();
      },

      /**
       * Fill data in created table from saved data
       */
      populateTable() {
        const data = this.getData();
        if (data === undefined || data === null) return;

        for (let i = 0; i < data.length; i += 1) {
          for (let j = 1; j < data[i].length; j += 1) {
            const cell = this.$el.find(`#r-${i}-${j}`)[0];
            let value = data[i][j];
            if (i > 0) {
              cell.innerHTML = data[i][j];
            } else {
              // table headers
              if (!value) {
                value = `Col ${j}`;
              }
              // TODO: test this
              $(cell).find(".column-header-span").text(value);
            }
          }
        }
      },

      /**
       * Get the saved data and parse it. If there's no saved data, create it.
       * @returns {Array} The table data as an array of arrays
       */
      getData() {
        const data = this.tableData;
        if (!data) {
          return this.initializeData();
        }
        return JSON.parse(data);
      },

      /**
       * Create some empty arrays to hold data
       * @returns {Array} An array of arrays, each of which is an empty array
       */
      initializeData() {
        const data = [];
        for (let i = 0; i <= this.rowCount; i += 1) {
          const child = [];
          for (let j = 0; j <= this.colCount; j += 1) {
            child.push("");
          }
          data.push(child);
        }
        return data;
      },

      /**
       * When the user focuses out, presume they've changed the data, and
       * updated the saved data.
       * @param  {event} e The focus out event that triggered this function
       */
      updateData(e) {
        if (e.target) {
          let item;
          let newValue;
          if (e.target.nodeName === "TD") {
            item = e.target;
            newValue = item.textContent;
          } else if (e.target.classList.contains("column-header-span")) {
            item = e.target.parentNode;
            newValue = e.target.textContent;
          }
          if (item) {
            const indices = item.id.split("-");
            const spreadsheetData = this.getData();
            spreadsheetData[indices[1]][indices[2]] = newValue;
            this.saveData(spreadsheetData);
          }
        }
      },

      /**
       * Save the data as a string on the tableData property of the view
       * @param  {Array} data The table data as an array of arrays
       */
      saveData(data) {
        this.tableData = JSON.stringify(data);
      },

      /**
       * Clear the saved data and reset the table to the default number of rows
       * & columns
       * @param  {event} _e - the event that triggered this function
       */
      resetData(_e) {
        // eslint-disable-next-line no-restricted-globals, no-alert
        const confirmation = confirm(
          "This will erase all data and reset the table. Are you sure?",
        );
        if (confirmation === true) {
          this.tableData = "";
          this.rowCount = this.initialRowCount;
          this.colCount = this.initialColCount;
          this.createSpreadsheet();
        } else {
          // TODO?
        }
      },

      /**
       * Create a header row for the table
       * @returns {HTMLElement} The header row element
       */
      createHeaderRow() {
        const tr = document.createElement("tr");
        tr.setAttribute("id", "r-0");
        for (let i = 0; i <= this.colCount; i += 1) {
          const th = document.createElement("th");
          th.setAttribute("id", `r-0-${i}`);
          th.setAttribute("class", `${i === 0 ? "" : "column-header"}`);
          if (i !== 0) {
            const span = document.createElement("span");
            span.innerHTML = `Col ${i}`;
            span.setAttribute("class", "column-header-span");
            span.setAttribute("contentEditable", "true");
            const dropDownDiv = document.createElement("div");
            dropDownDiv.setAttribute("class", "dropdown");
            dropDownDiv.innerHTML = `
            <button class="dropbtn" id="col-dropbtn-${i}">
              <i class="icon pointer icon-caret-down"></i>
            </button>
              <div id="col-dropdown-${i}" class="dropdown-content">
                <button class="col-dropdown-option col-insert-left"><i class="icon icon-long-arrow-left icon-on-left"></i>Insert 1 column left</button>
                <button class="col-dropdown-option col-insert-right"><i class="icon icon-long-arrow-right icon-on-left"></i>Insert 1 column right</button>
                <button class="col-dropdown-option col-sort"><i class="icon icon-sort-by-attributes icon-on-left"></i>Sort column</button>
                <button class="col-dropdown-option col-delete"><i class="icon icon-remove icon-on-left"></i>Delete column</button>
              </div>
            `;
            th.appendChild(span);
            th.appendChild(dropDownDiv);
          }
          tr.appendChild(th);
        }
        return tr;
      },

      /**
       * Create a row for the table
       * @param {number} rowNum The table row number to add to the table, where
       * 0 is the header row
       * @returns {HTMLElement} The row element
       */
      createTableBodyRow(rowNum) {
        const tr = document.createElement("tr");
        tr.setAttribute("id", `r-${rowNum}`);
        for (let i = 0; i <= this.colCount; i += 1) {
          const cell = document.createElement(`${i === 0 ? "th" : "td"}`);
          // header
          if (i === 0) {
            cell.contentEditable = false;
            const span = document.createElement("span");
            const dropDownDiv = document.createElement("div");
            span.innerHTML = rowNum;
            dropDownDiv.setAttribute("class", "dropdown");
            dropDownDiv.innerHTML = `
            <button class="dropbtn" id="row-dropbtn-${rowNum}">
              <i class="icon pointer icon-caret-right"></i>
            </button>
              <div id="row-dropdown-${rowNum}" class="dropdown-content">
                <button class="row-dropdown-option row-insert-top"><i class="icon icon-long-arrow-up icon-on-left"></i>Insert 1 row above</button>
                <button class="row-dropdown-option row-insert-bottom"><i class="icon icon-long-arrow-down icon-on-left"></i>Insert 1 row below</button>
                <button class="row-dropdown-option row-delete"><i class="icon icon-remove icon-on-left"></i>Delete row</button>
              </div>
            `;
            cell.appendChild(span);
            cell.appendChild(dropDownDiv);
            cell.setAttribute("class", "row-header");
          } else {
            cell.contentEditable = true;
          }
          cell.setAttribute("id", `r-${rowNum}-${i}`);
          tr.appendChild(cell);
        }
        return tr;
      },

      /**
       * Given a table element, add table rows
       * @param  {HTMLElement} tableBody A table HTML Element
       */
      createTableBody(tableBody) {
        for (let rowNum = 1; rowNum <= this.rowCount; rowNum += 1) {
          tableBody.appendChild(this.createTableBodyRow(rowNum));
        }
      },

      /**
       * Utility function to add row
       * @param  {number} currentRow The row number at which to add a new row
       * @param  {string} direction  Can be "top" or "bottom", indicating
       * whether to new row should be above or below the current row
       */
      addRow(currentRow, direction) {
        const data = this.getData();
        const colCount = data[0].length;
        const newRow = new Array(colCount).fill("");
        if (direction === "top") {
          data.splice(currentRow, 0, newRow);
        } else if (direction === "bottom") {
          data.splice(currentRow + 1, 0, newRow);
        }
        this.rowCount += 1;
        this.saveData(data);
        this.createSpreadsheet();
      },

      /**
       * Utility function to delete row
       * @param  {number} currentRow The row number to delete
       */
      deleteRow(currentRow) {
        const data = this.getData();
        // Don't allow deletion of the last row
        if (data.length <= 2) {
          this.resetData();
          return;
        }
        data.splice(currentRow, 1);
        this.rowCount -= 1;
        this.saveData(data);
        this.createSpreadsheet();
      },

      /**
       * Utility function to add columns
       * @param  {number} currentCol The column number at which to add a new
       * column
       * @param  {string} direction  Can be "left" or "right", indicating
       * whether to new column should be to the left or right of the current
       * column
       */
      addColumn(currentCol, direction) {
        const data = this.getData();
        for (let i = 0; i <= this.rowCount; i += 1) {
          if (direction === "left") {
            data[i].splice(currentCol, 0, "");
          } else if (direction === "right") {
            data[i].splice(currentCol + 1, 0, "");
          }
        }
        this.colCount += 1;
        this.saveData(data);
        this.createSpreadsheet();
      },

      /**
       * Utility function to delete column
       * @param  {number} currentCol The number of the column to delete
       */
      deleteColumn(currentCol) {
        const data = this.getData();
        // Don't allow deletion of the last column
        if (data[0].length <= 2) {
          this.resetData();
          return;
        }
        for (let i = 0; i <= this.rowCount; i += 1) {
          data[i].splice(currentCol, 1);
        }
        this.colCount -= 1;
        this.saveData(data);
        this.createSpreadsheet();
      },

      /**
       * Utility function to sort columns
       * @param  {number} currentCol The column number of the column to delete
       */
      sortColumn(currentCol) {
        const spreadSheetData = this.getData();
        const data = spreadSheetData.slice(1);
        const headers = spreadSheetData.slice(0, 1)[0];
        if (!data.some((a) => a[currentCol] !== "")) return;
        if (this.sortingHistory.has(currentCol)) {
          const sortOrder = this.sortingHistory.get(currentCol);
          if (sortOrder === "desc") {
            data.sort(this.ascSort.bind(this, currentCol));
            this.sortingHistory.set(currentCol, "asc");
          } else {
            data.sort(this.dscSort.bind(this, currentCol));
            this.sortingHistory.set(currentCol, "desc");
          }
        } else {
          data.sort(this.ascSort.bind(this, currentCol));
          this.sortingHistory.set(currentCol, "asc");
        }
        data.splice(0, 0, headers);
        this.saveData(data);
        this.createSpreadsheet();
      },

      /**
       * Compare Functions for sorting - ascending
       * @param {number} currentCol The number of the column to sort
       * @param {*} a One of two items to compare
       * @param {*} b The second of two items to compare
       * @returns {number} A number indicating the order to place a vs b in the
       * list. It it returns less than zero, then a will be placed before b in
       * the list.
       */
      ascSort(currentCol, a, b) {
        try {
          let valA = a[currentCol];
          let valB = b[currentCol];

          if (valIsEmpty(valA)) return 1;
          if (valIsEmpty(valB)) return -1;

          // Check for strings and numbers
          if (typeof valA === "number" && typeof valB === "number") {
            return valA - valB;
          }
          valA = String(valA).toUpperCase();
          valB = String(valB).toUpperCase();
          if (valA < valB) return -1;
          if (valA > valB) return 1;
          return 0;
        } catch (e) {
          return 0;
        }
      },

      /**
       * Descending compare function
       * @param {number} currentCol The number of the column to sort
       * @param {*} a One of two items to compare
       * @param {*} b The second of two items to compare
       * @returns {number} A number indicating the order to place a vs
       * b in the list. It it returns less than zero, then a will be placed
       * before b in the list.
       */
      dscSort(currentCol, a, b) {
        try {
          let valA = a[currentCol];
          let valB = b[currentCol];
          if (valIsEmpty(valA)) return -1;
          if (valIsEmpty(valB)) return 1;

          // Check for strings and numbers
          if (typeof valA === "number" && typeof valB === "number") {
            return valB - valA;
          }
          valA = String(valA).toUpperCase();
          valB = String(valB).toUpperCase();
          if (valB < valA) return -1;
          if (valB > valA) return 1;
          return 0;
        } catch (e) {
          return 0;
        }
      },

      /**
       * Returns the table data as markdown
       * @returns {string}  The markdownified table as string
       */
      getMarkdown() {
        // Ensure there are at least two dashes below the table header, i.e. use
        // | -- | not | - | Showdown requries this to avoid ambiguous markdown.
        const minStringLength = (s) => (s.length <= 1 ? 2 : s.length);
        // Get the current table data
        const tableData = this.getData();
        // Remove the empty column that we use for row numbers first
        if (this.hasEmptyCol1(tableData)) {
          for (let i = 0; i <= tableData.length - 1; i += 1) {
            tableData[i].splice(0, 1);
          }
        }
        // Convert json data to markdown, for options see
        // https://github.com/wooorm/markdown-table TODO: Add alignment
        // information that we will store in view as an array Include in
        // markdownTableFromJson() options like this - align: ['l', 'c', 'r']
        const markdown = markdownTableFromJson(tableData, {
          stringLength: minStringLength,
        });
        // Add a new line to the end
        return `${markdown}\n`;
      },

      /**
       * Converts a given markdown table string to JSON.
       * @param  {string} markdown description
       * @returns {Array}          The markdown table as an array of arrays,
       * where the header is the first array and each row is an array that
       * follows.
       */
      getJSONfromMarkdown(markdown) {
        const parsedMarkdown = markdownTableToJson(markdown);
        if (!parsedMarkdown) return null;
        // TODO: Add alignment information to the view, returned as
        // parsedMarkdown.align
        return parsedMarkdown.table;
      },

      /**
       * Checks whether the first column is empty.
       * @param  {object} data The table data in the form of an array of arrays
       * @returns {boolean}   returns true if the first column is empty, false
       * if at least one cell in the first column contains a value
       */
      hasEmptyCol1(data) {
        let firstColEmpty = true;
        // Check if the first item in each row is blank
        for (let i = 0; i <= data.length - 1; i += 1) {
          if (data[i][0] !== "" && data[i][0] !== undefined) {
            firstColEmpty = false;
            break;
          }
        }
        return firstColEmpty;
      },

      /**
       * Close the dropdown menu if the user clicks outside of it
       * @param  {type} e The event that triggered this function
       */
      closeDropdown(e) {
        if (!e.target.matches(".dropbtn") || !e) {
          const dropdowns = document.getElementsByClassName("dropdown-content");
          let i;
          for (i = 0; i < dropdowns.length; i += 1) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains("show")) {
              openDropdown.classList.remove("show");
            }
          }
        }
      },

      /**
       * Called when the table header is clicked. Depending on what is clicked,
       * shows or hides the dropdown menus in the header, or calls one of the
       * functions listed in the menu (e.g. delete column).
       * @param  {event} e The event that triggered this function
       */
      handleHeadersClick(e) {
        const view = this;
        if (e.target) {
          const classes = e.target.classList;

          if (classes.contains("column-header-span")) {
            // If the header element is clicked...
          } else if (classes.contains("dropbtn")) {
            const idArr = e.target.id.split("-");
            document
              .getElementById(`col-dropdown-${idArr[2]}`)
              .classList.toggle("show");
          } else if (classes.contains("col-dropdown-option")) {
            const index = e.target.parentNode.id.split("-")[2];

            if (classes.contains("col-insert-left")) {
              view.addColumn(index, "left");
            } else if (classes.contains("col-insert-right")) {
              view.addColumn(index, "right");
            } else if (classes.contains("col-sort")) {
              view.sortColumn(index);
            } else if (classes.contains("col-delete")) {
              view.deleteColumn(index);
            }
          }
        }
      },

      /**
       * Called when the table body is clicked. Depending on what is clicked,
       * shows or hides the dropdown menus in the body, or calls one of the
       * functions listed in the menu (e.g. delete row).
       * @param  {type} e The event that triggered this function
       */
      handleBodyClick(e) {
        const view = this;
        if (e.target) {
          const classes = e.target.classList;

          if (classes.contains("dropbtn")) {
            const idArr = e.target.id.split("-");
            view.$el
              .find(`#row-dropdown-${idArr[2]}`)[0]
              .classList.toggle("show");
          } else if (classes.contains("row-dropdown-option")) {
            const index = parseInt(e.target.parentNode.id.split("-"), 10)[2];
            if (classes.contains("row-insert-top")) {
              view.addRow(index, "top");
            }
            if (classes.contains("row-insert-bottom")) {
              view.addRow(index, "bottom");
            }
            if (classes.contains("row-delete")) {
              view.deleteRow(index);
            }
          }
        }
      },
    },
  );

  return TableEditorView;
});
