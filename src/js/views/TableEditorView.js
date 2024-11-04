define([
  "underscore",
  "jquery",
  "backbone",
  "markdownTableFromJson",
  "markdownTableToJson",
  "papaParse",
  "text!templates/tableEditor.html",
  "text!templates/alert.html",
], (
  _,
  $,
  Backbone,
  markdownTableFromJson,
  markdownTableToJson,
  PapaParse,
  Template,
  AlertTemplate,
) => {
  // Classes used for elements we will manipulate
  const CLASS_NAMES = {
    button: "dropbtn",
    controls: "spreadsheet-controls",
    colOption: "col-dropdown-option",
    sortButton: "col-sort",
    rowHeader: "row-header",
  };
  // a utility function to check if a value is empty for sorting
  const valIsEmpty = (x) =>
    x === "" || x === undefined || x === null || Number.isNaN(x);
  // Alert message for too many cells
  const tooManyCellsMessage = (newRowCount, originalRowCount) =>
    `<strong>Note:</strong> This table has been truncated to ${newRowCount} rows (from the original ${originalRowCount} rows) to prevent performance issues.`;
  // The maximum number of cells allowed in the table
  const NUM_CELL_LIMIT = 50000;
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
       * The template for the alert message
       * @type {Underscore.Template}
       * @since 0.0.0
       */
      alertTemplate: _.template(AlertTemplate),

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
       * @param {string} [options.markdown] - A markdown table to edit.
       * @param {string} [options.csv] - A CSV table to edit.
       * @param {string} [options.tableData] - The table data as a stringified
       * JSON in the form of an array of arrays. Only used if markdown is not
       * provided.
       * @param {boolean} [options.viewMode] - Set this to true to inactivate
       * editing of the table.
       */
      initialize(options = {}) {
        const mergedOptions = { ...this.defaults, ...options };
        Object.keys(mergedOptions).forEach((key) => {
          this[key] = mergedOptions[key];
        });
      },

      /** @inheritdoc */
      render() {
        // Insert the template into the view
        this.$el
          .html(
            this.template({
              cid: this.cid,
              controlsClass: CLASS_NAMES.controls,
              viewMode: this.viewMode,
            }),
          )
          .data("view", this);

        // If initalized with markdown, convert to JSON and use as table data
        // Parse the table string into a javascript object so that we can pass
        // it into the table editor view to be edited by the user.
        if (this.markdown?.length) {
          this.renderFromMarkdown(this.markdown);
        } else if (this.csv?.length) {
          this.renderFromCSV(this.csv);
        } else {
          // defaults to empty table
          this.createSpreadsheet();
        }
        return this;
      },

      /**
       * Show the table from a configured markdown string
       * @param {string} markdown - The markdown string to render as a table
       * @since 0.0.0
       */
      renderFromMarkdown(markdown) {
        const tableArray = this.getJSONfromMarkdown(markdown);
        if (tableArray && Array.isArray(tableArray) && tableArray.length) {
          this.saveData(tableArray);
          this.createSpreadsheet();
          // Add the column that we use for row numbers in the editor
          this.addColumn(0, "left");
        }
      },

      /**
       * Show the table from a configured CSV file
       * @param {string} csv - The CSV string to render as a table
       * @since 0.0.0
       */
      renderFromCSV(csv) {
        const tableArray = this.getJSONfromCSV(csv);
        if (tableArray && Array.isArray(tableArray) && tableArray.length) {
          this.saveData(tableArray);
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

        if (this.rowCount * this.colCount > NUM_CELL_LIMIT) {
          const newRowCount = Math.ceil(NUM_CELL_LIMIT / this.colCount);
          this.originalRowCount = this.rowCount;
          this.rowCount = newRowCount;
          this.showMessage(
            tooManyCellsMessage(newRowCount, this.originalRowCount),
          );
        }

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
        this.createTableBody(tableBody);
      },

      /**
       * Turn off functionality that allows the user to edit the table values,
       * add or remove rows or columns.
       */
      deactivateEditing() {
        const tableCells = this.el.querySelectorAll("td, th > span");
        const controls = this.el.querySelectorAll(`.${CLASS_NAMES.controls}`);

        tableCells.forEach((td) => td.setAttribute("contentEditable", "false"));
        controls.forEach((control) =>
          control.style.setProperty("display", "none"),
        );

        // Hide every button except the sort button in the columns
        this.el
          .querySelectorAll(
            `.${CLASS_NAMES.colOption}:not(.${CLASS_NAMES.sortButton})`,
          )
          .forEach((btn) => {
            btn.style.setProperty("display", "none");
          });

        // Hide row controls
        this.$el
          .find(`.${CLASS_NAMES.rowHeader} .${CLASS_NAMES.button}`)
          .hide();
      },

      /**
       * Fill data in created table from saved data
       */
      populateTable() {
        const data = this.getData();
        if (!data?.length) return;

        const rows = this.rowCount + 1 || data.length;
        const cols = this.colCount + 1 || data[0].length;

        for (let i = 0; i < rows; i += 1) {
          for (let j = 1; j < cols; j += 1) {
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
        const headerData = this.getData()[0];
        const tr = document.createElement("tr");
        tr.setAttribute("id", "r-0");
        for (let i = 0; i <= this.colCount; i += 1) {
          const th = document.createElement("th");
          tr.appendChild(th);
          th.setAttribute("id", `r-0-${i}`);
          th.setAttribute("class", `${i === 0 ? "" : "column-header"}`);
          if (i !== 0) {
            const span = document.createElement("span");
            th.appendChild(span);
            span.innerHTML = headerData[i] || `Col ${i}`;
            span.setAttribute("class", "column-header-span");
            if (!this.viewMode) {
              span.setAttribute("contentEditable", "true");
            }
            th.appendChild(this.createColDropdown(i));
          }
        }
        return tr;
      },

      /**
       * Create a row for the table
       * @param {number} rowNum The table row number to add to the table, where
       * 0 is the header row
       * @param {Array} rowData The data for the row
       * @returns {HTMLElement} The row element
       */
      createTableBodyRow(rowNum, rowData) {
        const fragment = document.createDocumentFragment(); // Create a document fragment
        const tr = document.createElement("tr");
        tr.setAttribute("id", `r-${rowNum}`);

        for (let i = 0; i <= this.colCount; i += 1) {
          const cell = document.createElement(i === 0 ? "th" : "td");
          cell.setAttribute("id", `r-${rowNum}-${i}`);
          tr.appendChild(cell);
          cell.contentEditable = false;

          if (i === 0) {
            const span = document.createElement("span");
            span.textContent = rowNum;

            // Append elements to the cell
            cell.appendChild(span);
            cell.classList.add(CLASS_NAMES.rowHeader);

            if (!this.viewMode) {
              cell.appendChild(this.createRowDropdown(rowNum));
            }
          } else {
            cell.innerHTML = rowData[i] || "";
            if (!this.viewMode) {
              cell.contentEditable = true;
            }
          }
        }

        fragment.appendChild(tr);
        return fragment;
      },

      /**
       * Given a table element, add table rows
       * @param  {HTMLElement} tableBody A table HTML Element
       */
      createTableBody(tableBody) {
        const data = this.getData();
        if (!data?.length) return;
        const fragment = document.createDocumentFragment();

        for (let rowNum = 1; rowNum <= this.rowCount; rowNum += 1) {
          const rowData = data[rowNum];
          const rowFragment = this.createTableBodyRow(rowNum, rowData);
          fragment.appendChild(rowFragment);
        }

        tableBody.appendChild(fragment);
      },

      /**
       * Create a dropdown menu for the row
       * @param {number} rowNum The row number to add the dropdown to
       * @returns {HTMLElement} The dropdown element
       * @since 0.0.0
       */
      createRowDropdown(rowNum) {
        const dropDownDiv = document.createElement("div");
        dropDownDiv.classList.add("dropdown");

        const button = document.createElement("button");
        button.classList.add("dropbtn");
        button.id = `row-dropbtn${this.cid}-${rowNum}`;
        button.innerHTML = '<i class="icon pointer icon-caret-right"></i>';

        const dropdownContent = document.createElement("div");
        dropdownContent.id = `row-dropdown${this.cid}-${rowNum}`;
        dropdownContent.classList.add("dropdown-content");

        // Add the dropdown options
        const insertTop = document.createElement("button");
        insertTop.classList.add("row-dropdown-option", "row-insert-top");
        insertTop.innerHTML =
          '<i class="icon icon-long-arrow-up icon-on-left"></i>Insert 1 row above';

        const insertBottom = document.createElement("button");
        insertBottom.classList.add("row-dropdown-option", "row-insert-bottom");
        insertBottom.innerHTML =
          '<i class="icon icon-long-arrow-down icon-on-left"></i>Insert 1 row below';

        const deleteRow = document.createElement("button");
        deleteRow.classList.add("row-dropdown-option", "row-delete");
        deleteRow.innerHTML =
          '<i class="icon icon-remove icon-on-left"></i>Delete row';

        // Append the options to the dropdown
        dropdownContent.append(insertTop, insertBottom, deleteRow);
        dropDownDiv.append(button, dropdownContent);
        return dropDownDiv;
      },

      /**
       * Create a dropdown menu for the header row
       * @param {number} colNum The column number to add the dropdown to
       * @returns {HTMLElement} The dropdown element
       * @since 0.0.0
       */
      createColDropdown(colNum) {
        const dropDownDiv = document.createElement("div");
        dropDownDiv.setAttribute("class", "dropdown");
        let buttons = [
          {
            class: "col-insert-left",
            icon: "long-arrow-left",
            text: "Insert 1 column left",
            viewMode: false,
          },
          {
            class: "col-insert-right",
            icon: "long-arrow-right",
            text: "Insert 1 column right",
            viewMode: false,
          },
          {
            class: "col-delete",
            icon: "remove",
            text: "Delete column",
            viewMode: false,
          },
          {
            class: "col-sort",
            icon: "sort",
            text: "Sort column",
            viewMode: true,
          },
        ];
        if (this.viewMode) {
          buttons = buttons.filter((button) => button.viewMode);
        }
        const buttonEls = buttons.map(
          (button) =>
            `<button class="${CLASS_NAMES.colOption} ${button.class}"><i class="icon icon-${button.icon} icon-on-left"></i>${button.text}</button>`,
        );

        dropDownDiv.innerHTML = `
          <button class="${CLASS_NAMES.button}" id="col-dropbtn-${colNum}">
            <i class="icon pointer icon-caret-down"></i>
          </button>
            <div id="col-dropdown${this.cid}-${colNum}" class="dropdown-content">
              ${buttonEls.join("")}
            </div>
          `;
        return dropDownDiv;
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
       * @returns {Array} The markdown table as an array of arrays,
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
       * Converts data to an array of arrays from a CSV
       * @param  {string} csv The table data as a CSV string
       * @param {boolean} addRowNumbers - if true, adds a row number column to
       * the left of the table
       * @returns {Array} The table data as a CSV string
       * @since 0.0.0
       */
      getJSONfromCSV(csv, addRowNumbers = true) {
        const view = this;
        // https://www.papaparse.com/docs#config
        const parsedCSV = PapaParse.parse(csv, {
          skipEmptyLines: "greedy",
          error: (err) =>
            view.showMessage("error", err?.message || err, false, true),
        });
        if (!parsedCSV) return null;
        const { data, errors } = parsedCSV;

        if (addRowNumbers) {
          for (let i = 0; i < data.length; i += 1) {
            data[i].unshift(i);
          }
        }
        if (errors?.length) {
          const triggerError = !data?.length;
          this.showMessage(errors[0].message, "warning", false, triggerError);
        }
        return data;
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
       * Display an alert at the top of the table
       * @param {string} message The message to display
       * @param {string} [type] The class to apply to the alert
       * @param {boolean} [showEmail] Whether to show the email address
       * @param {boolean} [triggerError] Set to true to trigger an error event
       * on the view with the message
       * @since 0.0.0
       */
      showMessage(
        message,
        type = "info",
        showEmail = false,
        triggerError = false,
      ) {
        if (this.alert) {
          this.alert.remove();
        }
        this.alert = document.createElement("div");
        this.alert.innerHTML = this.alertTemplate({
          classes: `alert-${type}`,
          msg: message,
          includeEmail: showEmail,
        });
        this.el.prepend(this.alert);
        if (triggerError) {
          this.trigger("error", message);
        }
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
              .getElementById(`col-dropdown${this.cid}-${idArr[2]}`)
              .classList.toggle("show");
          } else if (classes.contains(CLASS_NAMES.colOption)) {
            const index = parseInt(e.target.parentNode.id.split("-")[2], 10);
            if (classes.contains("col-insert-left")) {
              view.addColumn(index, "left");
            } else if (classes.contains("col-insert-right")) {
              view.addColumn(index, "right");
            } else if (classes.contains(CLASS_NAMES.sortButton)) {
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
              .find(`#row-dropdown${this.cid}-${idArr[2]}`)[0]
              .classList.toggle("show");
          } else if (classes.contains("row-dropdown-option")) {
            const index = parseInt(e.target.parentNode.id.split("-")[2], 10);
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
