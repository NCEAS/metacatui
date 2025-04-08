define([
  "jquery",
  "underscore",
  "backbone",
  "views/searchSelect/SearchSelectView",
  "models/metadata/eml211/EMLTaxonCoverage",
  "text!templates/metadata/taxonomicCoverage.html",
  "text!templates/metadata/taxonomicClassificationTable.html",
  "text!templates/metadata/taxonomicClassificationRow.html",
], (
  $,
  _,
  Backbone,
  SearchSelect,
  EMLTaxonCoverage,
  TaxonomicCoverageTemplate,
  TaxonomicClassificationTableTemplate,
  TaxonomicClassificationRowTemplate,
) => {
  /**
   * @class EMLTaxonView
   * @classdesc A Backbone View that renders the taxonomic coverage section of
   * an EML model. This view is used to create, edit, and delete taxonomic
   * classifications in the EML model. It also provides a "quick add" interface
   * for adding common taxa to the taxonomic coverage section. Logic oiginally
   * included in the EML211EditorView.
   * @augments Backbone.View
   * @since 2.33.0
   */
  const EMLTaxonView = Backbone.View.extend(
    /** @lends EMLTaxonView.prototype */ {
      /** @inheritdoc */
      events: {
        "change .taxonomic-coverage": "updateTaxonCoverage",
        "keyup .taxonomic-coverage .new input": "addNewTaxon",
        "keyup .taxonomic-coverage .new select": "addNewTaxon",
        "focusout .taxonomic-coverage tr": "showTaxonValidation",
        "click .taxonomic-coverage-row .remove": "removeTaxonRank",
        "mouseover .taxonomic-coverage .remove": "previewTaxonRemove",
        "mouseout .taxonomic-coverage .remove": "previewTaxonRemove",
      },

      /**
       * The template for the taxonomic coverage section
       * @type {UnderscoreTemplate}
       */
      taxonomicCoverageTemplate: _.template(TaxonomicCoverageTemplate),

      /**
       * The template for the taxonomic classification table
       * @type {UnderscoreTemplate}
       */
      taxonomicClassificationTableTemplate: _.template(
        TaxonomicClassificationTableTemplate,
      ),

      /**
       * The template for the taxonomic classification row
       * @type {UnderscoreTemplate}
       */
      taxonomicClassificationRowTemplate: _.template(
        TaxonomicClassificationRowTemplate,
      ),

      /** @inheritdoc */
      initialize(options = {}) {
        this.parentModel = options.parentModel;
        this.taxonArray = this.getTaxonArray(options);
        this.edit = options.edit || false;

        // If duplicates are removed while saving, make sure to re-render the
        // taxa
        const view = this;
        this.taxonArray.forEach((taxonCov) => {
          this.stopListening(taxonCov);
          this.listenTo(
            taxonCov,
            "duplicateClassificationsRemoved",
            this.render,
          );
        }, view);
      },

      /**
       * Get the taxon coverage array from the options or the parent model
       * @param {object} options - The options passed to the view
       * @returns {EMLTaxonCoverage[]} An array of EMLTaxonCoverage models
       */
      getTaxonArray(options = {}) {
        const taxonArray = options?.taxonArray;

        // Don't need  to make a new taxon array if we already have one
        if (
          taxonArray?.length &&
          Array.isArray(taxonArray) &&
          taxonArray[0] instanceof EMLTaxonCoverage
        ) {
          return taxonArray;
        }

        // Try getting the taxon coverage from the parent model or adding one to
        // the parent model
        if (options.parentModel) {
          return options.parentModel.hasTaxonomicCoverage()
            ? options.parentModel.get("taxonCoverage")
            : options.parentModel.addTaxonomicCoverage(true);
        }

        // If we have no parent EML model, then just create a new taxon coverage
        return [new EMLTaxonCoverage()];
      },

      /** @inheritdoc */
      render() {
        const view = this;
        const { el } = this;
        const { $el } = this;

        el.innerHTML = `<h2>Taxa</h2>`;

        this.taxonArray.forEach((coverage) => {
          $el.append(this.createTaxonomicCoverage(coverage));
        });

        this.updateTaxaNumbering();

        // Insert the quick-add taxon options, if any are configured for this
        // theme. See {@link AppModel#quickAddTaxa}
        view.renderTaxaQuickAdd();

        return this;
      },

      /**
       * Update the numbering of the taxa in the taxonomic coverage section
       * @returns {HTMLElement[]} An array of the taxon numbering elements
       * @since 2.33.0
       */
      updateTaxaNumbering() {
        const taxaNums = this.el.querySelectorAll(".editor-header-index");
        taxaNums.forEach((taxaNum, i) => {
          const element = taxaNum;
          element.textContent = i + 1;
        });

        return taxaNums;
      },

      /**
       * Creates a table to hold a single EMLTaxonCoverage element (table) for
       * each root-level taxonomicClassification
       * @param {EMLTaxonCoverage} coverage - An EMLTaxonCoverage model
       * @returns {jQuery} A jQuery object containing the HTML for the taxonomic
       * coverage section
       */
      createTaxonomicCoverage(coverage) {
        const finishedEls = $(
          this.taxonomicCoverageTemplate({
            generalTaxonomicCoverage:
              coverage.get("generalTaxonomicCoverage") || "",
          }),
        );
        const coverageEl = finishedEls.filter(".taxonomic-coverage");

        coverageEl.data({ model: coverage });

        const classifications = coverage.get("taxonomicClassification");

        // Makes a table... for the root level
        classifications.forEach((classification) => {
          coverageEl.append(
            this.createTaxonomicClassificationTable(classification),
          );
        }, this);

        // Create a new, blank table for another taxonomicClassification
        const newTableEl = this.createTaxonomicClassificationTable();

        coverageEl.append(newTableEl);

        return finishedEls;
      },

      /**
       * Create the HTML for a taxonomic coverage table
       * @param {EMLTaxonCoverage} classification - An EMLTaxonCoverage model
       * @returns {jQuery} A jQuery object containing the HTML for a taxonomic
       * coverage table
       */
      createTaxonomicClassificationTable(classification) {
        const taxaNums = this.updateTaxaNumbering();

        // Adding the taxoSpeciesCounter to the table header for enhancement of the view
        const finishedEl = $(
          '<div class="row-striped root-taxonomic-classification-container"></div>',
        );
        $(finishedEl).append(
          `<h6>Species <span class="editor-header-index">${
            taxaNums.length + 1
          }</span> </h6>`,
        );

        // Add a remove button if this is not a new table
        if (!(typeof classification === "undefined")) {
          $(finishedEl).append(
            this.createRemoveButton(
              "taxonCoverage",
              "taxonomicClassification",
              ".root-taxonomic-classification-container",
              ".taxonomic-coverage",
            ),
          );
        }

        const tableEl = $(this.taxonomicClassificationTableTemplate());
        const tableBodyEl = $(document.createElement("tbody"));

        const queue = [classification];
        const rows = [];
        let cur;

        while (queue.length > 0) {
          cur = queue.pop();

          // I threw this in here so I can this function without an
          // argument to generate a new table from scratch
          if (cur) {
            cur.taxonRankName = cur.taxonRankName?.toLowerCase();
            rows.push(cur);
            if (cur.taxonomicClassification) {
              Object.entries(cur.taxonomicClassification).forEach(
                ([_taxonRank, taxonClass]) => {
                  queue.push(taxonClass);
                },
              );
            }
          }
        }

        rows.forEach((row) => {
          tableBodyEl.append(this.makeTaxonomicClassificationRow(row));
        });

        const newRowEl = this.makeNewTaxonomicClassificationRow();

        $(tableBodyEl).append(newRowEl);
        $(tableEl).append(tableBodyEl);

        // Add the new class to the entire table if it's a new one
        if (typeof classification === "undefined") {
          $(tableEl).addClass("new");
        }

        $(finishedEl).append(tableEl);

        return finishedEl;
      },

      /**
       * @external TaxonomicClassification
       * @see EMLTaxonCoverage.TaxonomicClassification
       */

      /**
       * Create the HTML for a single row in a taxonomicClassification table
       * @param {TaxonomicClassification} classification A classification object
       * from an EMLTaxonCoverage model, may include a taxonRank, taxonValue,
       * taxonId, commonName, and nested taxonomicClassification objects
       * @returns {jQuery} A jQuery object containing the HTML for a single row
       * in a taxonomicClassification table
       * @since 2.24.0
       */
      makeTaxonomicClassificationRow(classification = {}) {
        const finishedEl = $(
          this.taxonomicClassificationRowTemplate({
            taxonRankName: classification.taxonRankName || "",
            taxonRankValue: classification.taxonRankValue || "",
          }),
        );
        // Save a reference to other taxon attributes that we need to keep
        // when serializing the model
        if (classification.taxonId) {
          $(finishedEl).data("taxonId", classification.taxonId);
        }
        if (classification.commonName) {
          $(finishedEl).data("commonName", classification.commonName);
        }
        return finishedEl;
      },

      /**
       * Create the HTML for a new row in a taxonomicClassification table
       * @returns {jQuery} A jQuery object containing the HTML for a new row
       * in a taxonomicClassification table
       * @since 2.24.0
       */
      makeNewTaxonomicClassificationRow() {
        const row = this.makeTaxonomicClassificationRow({});
        $(row).addClass("new");
        return row;
      },

      /**
       * Update the underlying model and DOM for an EML TaxonomicCoverage
       * section. This method handles updating the underlying TaxonomicCoverage
       * models when the user changes form fields as well as inserting new
       * form fields automatically when the user needs them.
       *
       * Since a dataset has multiple TaxonomicCoverage elements at the dataset
       * level, each Taxonomic Coverage is represented by a table element and
       * all taxonomicClassifications within are rows in that table.
       *
       * TODO: Finish this function
       * TODO: Link this function into the DOM
       * @param {object} options - An object with the following properties:
       * - target: The target element that was changed
       * - coverage: The taxonomic coverage element that was changed
       */
      updateTaxonCoverage(options) {
        let coverage;
        let model;
        let value;
        let e;
        let classificationEl;

        if (options.target) {
          // Ignore the event if the target is a quick add taxon UI element.
          const quickAddEl = $(this.taxonQuickAddEl);
          if (quickAddEl && quickAddEl.has(options.target).length) {
            return;
          }

          e = options;

          // Getting `model` here is different than in other places because the
          // thing being updated is an `input` or `select` element which is part
          // of a `taxonomicClassification`. The model is `TaxonCoverage` which
          // has one or more `taxonomicClassifications`. So we have to walk up
          // to the hierarchy from input < td < tr < tbody < table < div to get
          // at the underlying TaxonCoverage model.

          coverage = $(e.target).parents(".taxonomic-coverage");
          classificationEl = $(e.target).parents(
            ".root-taxonomic-classification",
          );
          model = $(coverage).data("model") || this.parentModel;
          const category = $(e.target).attr("data-category");
          value = this.parentModel?.cleanXMLText($(e.target).val());

          // We can't update anything without a coverage, or
          // classification
          if (!coverage) return;
          if (!classificationEl) return;

          // Use `category` to determine if we're updating the generalTaxonomicCoverage or
          // the taxonomicClassification
          if (category && category === "generalTaxonomicCoverage") {
            model.set("generalTaxonomicCoverage", value);

            return;
          }
        } else {
          coverage = options.coverage;
          model = $(coverage).data("model");
        }

        // Find all of the root-level taxonomicClassifications
        const classificationTables = $(coverage).find(
          ".root-taxonomic-classification",
        );

        if (!classificationTables) return;

        // TODO: This should be refactored into tidy functions.

        let rows;
        const collectedClassifications = [];

        Array.from(classificationTables).forEach((classificationTable) => {
          rows = $(classificationTable).find("tbody tr");

          if (!rows) return;

          const topLevelClassification = {};
          let classification = topLevelClassification;
          let currentRank;
          let currentValue;

          Array.from(rows).forEach((row, j) => {
            const thisRow = row;

            currentRank =
              this.parentModel?.cleanXMLText($(thisRow).find("select").val()) ||
              "";
            currentValue =
              this.parentModel?.cleanXMLText($(thisRow).find("input").val()) ||
              "";

            // Maintain classification attributes that exist in the EML but are not visible in the editor
            const taxonId = $(thisRow).data("taxonId");
            const commonName = $(thisRow).data("commonName");

            // Skip over rows with empty Rank or Value
            if (!currentRank.length || !currentValue.length) {
              return;
            }

            // After the first row, start nesting taxonomicClassification objects
            if (j > 0) {
              classification.taxonomicClassification = [{}];
              [classification] = classification.taxonomicClassification;
            }

            // Add it to the classification object
            classification.taxonRankName = currentRank;
            classification.taxonRankValue = currentValue;
            classification.taxonId = taxonId;
            classification.commonName = commonName;
          });

          // Add the top level classification to the array
          if (Object.keys(topLevelClassification).length) {
            collectedClassifications.push(topLevelClassification);
          }
        });

        if (
          !_.isEqual(
            collectedClassifications,
            model.get("taxonomicClassification"),
          )
        ) {
          model.set("taxonomicClassification", collectedClassifications);
          this.parentModel?.trigger("change");
        }

        // Handle adding new tables and rows
        // Do nothing if the value isn't set
        if (value) {
          // Add a new row if this is itself a new row
          if ($(e.target).parents("tr").first().is(".new")) {
            const newRowEl = this.makeNewTaxonomicClassificationRow();
            $(e.target).parents("tbody").first().append(newRowEl);
            $(e.target).parents("tr").first().removeClass("new");
          }

          // Add a new classification table if this is itself a new table
          if ($(classificationEl).is(".new")) {
            $(classificationEl).removeClass("new");
            $(classificationEl).append(
              this.createRemoveButton(
                "taxonCoverage",
                "taxonomicClassification",
                ".root-taxonomic-classification-container",
                ".taxonomic-coverage",
              ),
            );
            $(coverage).append(this.createTaxonomicClassificationTable());
          }
        }

        // update the quick add interface
        this.updateQuickAddTaxa();
      },

      /**
       * Update the options for the quick add taxon select interface. This
       * ensures that only taxonomic classifications that are not already
       * included in the taxonomic coverage are available for selection.
       * @since 2.24.0
       */
      updateQuickAddTaxa() {
        const selects = this.taxonSelects;
        if (!selects || !selects.length) return;
        const taxa = this.getTaxonQuickAddOptions();
        if (!taxa || !taxa.length) return;
        selects.forEach((select, i) => {
          select.updateOptions(taxa[i].options);
        });
      },

      /**
       * Adds a new row and/or table to the taxonomic coverage section
       * @param {Event} e - The event that triggered this function
       */
      addNewTaxon(e) {
        // Don't do anything if the current classification doesn't have new content
        if ($(e.target).val().trim() === "") return;

        // If the row is new, add a new row to the table
        if ($(e.target).parents("tr").is(".new")) {
          const newRow = this.makeNewTaxonomicClassificationRow();
          // Append the new row and remove the new class from the old row
          $(e.target).parents("tr").removeClass("new").after(newRow);
        }
      },

      /**
       * Insert the "quick add" interface for adding common taxa to the
       * taxonomic coverage section. Only renders if there is a list of taxa
       * configured in the appModel.
       */
      renderTaxaQuickAdd() {
        const view = this;
        // To render the taxon select, the view must be in editor mode and we
        // need a list of taxa configured for the theme
        if (!view.edit) return;

        // remove any existing quick add interface:
        if (view.taxonQuickAddEl) view.taxonQuickAddEl.remove();

        const quickAddTaxa = view.getTaxonQuickAddOptions();

        if (!quickAddTaxa || !quickAddTaxa.length) {
          // If the taxa are configured as SID for a dataObject, then wait
          // for the dataObject to be loaded
          this.listenToOnce(
            MetacatUI.appModel,
            "change:quickAddTaxa",
            this.renderTaxaQuickAdd,
          );
          return;
        }

        // Create & insert the basic HTML for the taxon select interface
        const template = `<div class="taxa-quick-add">
              <p class="taxa-quick-add__text">
                <b>⭐️ Quick Add Taxa:</b> Select one or more common taxa. Click "Add" to add them to the list.
              </p>
              <div class="taxa-quick-add__controls">
              <div class="taxa-quick-add__selects"></div>
              <button class="btn btn-primary taxa-quick-add__button">Add Taxa</button>
              </div>
            </div>`;
        const parser = new DOMParser();
        const doc = parser.parseFromString(template, "text/html");
        const quickAddEl = doc.body.firstChild;
        const button = quickAddEl.querySelector("button");
        const container = quickAddEl.querySelector(".taxa-quick-add__selects");
        const rowSelector = ".root-taxonomic-classification-container";
        const firstRow = document.querySelector(rowSelector);
        firstRow.parentNode.insertBefore(quickAddEl, firstRow);
        view.taxonQuickAddEl = quickAddEl;

        // Update the taxon coverage when the button is clicked
        const onButtonClick = () => {
          const { taxonSelects } = view;
          if (!taxonSelects || !taxonSelects.length) return;
          const selectedItems = taxonSelects
            .map((select) => select.model.get("selected"))
            .flat();
          if (!selectedItems || !selectedItems.length) return;
          const selectedItemObjs = selectedItems.map((item) => {
            try {
              // It will be encoded JSON if it's a pre-defined taxon
              return JSON.parse(decodeURIComponent(item));
            } catch (e) {
              // Otherwise it will be a string a user typed in
              return {
                taxonRankName: "",
                taxonRankValue: item,
              };
            }
          });
          view.addTaxa(selectedItemObjs);
          taxonSelects.forEach((select) =>
            select.model.setSelected([], { silent: true }),
          );
        };
        button.removeEventListener("click", onButtonClick);
        button.addEventListener("click", onButtonClick);

        // Create the search selects
        view.taxonSelects = [];
        quickAddTaxa.forEach((taxaList) => {
          try {
            const taxaInput = new SearchSelect({
              options: taxaList.options,
              placeholderText: taxaList.placeholder,
              inputLabel: taxaList.label,
              allowMulti: true,
              allowAdditions: true,
              separatorTextOptions: false,
              selected: [],
            });
            container.appendChild(taxaInput.el);
            taxaInput.render();
            view.taxonSelects.push(taxaInput);
          } catch (e) {
            // Skip this taxa list if it can't be rendered
            view.taxonSelects.push(`Error: ${e}`);
          }
        });
      },

      /**
       * Get the list of options for the taxon quick add interface. Filter
       * out any that have already been added to the taxonomic coverage.
       * @returns {object[]} An array of search select options
       * @since 2.24.0
       */
      getTaxonQuickAddOptions() {
        const quickAddTaxa = MetacatUI.appModel.getQuickAddTaxa();
        if (!quickAddTaxa || !quickAddTaxa.length) return null;

        const coverages = this.parentModel?.get("taxonCoverage");
        const quickAddTaxaOpts = quickAddTaxa.map((taxaList) => {
          const opts = [];
          taxaList.taxa.forEach((taxon) => {
            // check that it is not a duplicate in any coverages
            const isDuplicate = coverages.some((cov) => cov.isDuplicate(taxon));
            if (!isDuplicate) {
              opts.push(this.taxonOptionToSearchSelectItem(taxon));
            }
          });
          // clone so we don't modify the original
          const newTaxaList = { ...taxaList };
          newTaxaList.options = opts;
          return newTaxaList;
        });
        return quickAddTaxaOpts;
      },

      /**
       * Reformats a taxon option, as provided in the appModel
       * {@link AppModel#quickAddTaxa}, as a search select item.
       * @param {object} option A single taxon classification with at least a
       * taxonRankValue and taxonRankName. It may also have a taxonId (object
       * with provider and value) and a commonName.
       * @returns {object} A search select item with label, value, and
       * description properties.
       */
      taxonOptionToSearchSelectItem(option) {
        // option must have a taxonRankValue and taxonRankName or it is invalid
        if (!option.taxonRankValue || !option.taxonRankName) {
          return null;
        }
        // Create a description
        let description = `${option.taxonRankName}: ${option.taxonRankValue}`;
        if (option.taxonId) {
          description += ` (${option.taxonId.provider}: ${option.taxonId.value})`;
        }
        // search select doesn't work with some of the json characters
        const val = encodeURIComponent(JSON.stringify(option));
        return {
          label: option.commonName || option.taxonRankValue,
          value: val,
          description,
        };
      },

      /**
       * Add new taxa to the EML model and re-render the taxa section. The new
       * taxa will be added to the first <taxonomicCoverage> element in the EML
       * model. If there is no <taxonomicCoverage> element, one will be created.
       * @param {object[]} newClassifications - An array of objects with any of
       * the following properties:
       *  - taxonRankName: (sting) The name of the taxonomic rank, e.g.
       *    "Kingdom"
       *  - taxonRankValue: (string) The value of the taxonomic rank, e.g.
       *    "Animalia"
       *  - commonName: (string) The common name of the taxon, e.g. "Animals"
       *  - taxonId: (object) The official ID of the taxon, including "provider"
       *    and "value".
       *  - taxonomicClassification: (array) An array of nested taxonomic
       *    classifications
       * @since 2.24.0
       * @example
       * this.addTaxon([{
       *  taxonRankName: "Kingdom",
       *  taxonRankValue: "Animalia",
       *  commonName: "Animals",
       *  taxonId: {
       *    provider: "https://www.itis.gov/",
       *    value: "202423"
       *  }]);
       */
      addTaxa(newClassifications) {
        // TODO: validate the new taxon before adding it to the model?
        const taxonCoverages = this.parentModel?.get("taxonCoverage");
        // We expect that there is already a taxonCoverage array on the model.
        // If the EML was made in the editor, there can only be one
        // <taxonomicCoverage> element. Add the new taxon to its
        // <taxonomicClassification> array. If there is more than one, then the
        // new taxon will be added to the first <taxonomicCoverage> element.
        if (taxonCoverages && taxonCoverages.length >= 1) {
          const taxonCoverage = taxonCoverages[0];
          const classifications = taxonCoverage.get("taxonomicClassification");
          const allClass = classifications.concat(newClassifications);
          taxonCoverage.set("taxonomicClassification", allClass);
        } else {
          // If there is no <taxonomicCoverage> element for some reason,
          // create one and add the new taxon to its <taxonomicClassification>
          // array.
          const newCov = new EMLTaxonCoverage({
            taxonomicClassification: newClassifications,
            parentModel: this.parentModel,
          });
          this.parentModel?.set("taxonCoverage", [newCov]);
        }
        // Re-render the taxa section
        this.render();
      },

      /**
       * Remove a taxonomic classification from the EML model
       * @param {Event} e - The event that triggered this function
       */
      removeTaxonRank(e) {
        const row = $(e.target).parents(".taxonomic-coverage-row");
        const coverageEl = $(row).parents(".taxonomic-coverage");
        const view = this;

        // Animate the row away and then remove it
        row.slideUp("fast", () => {
          row.remove();
          view.updateTaxonCoverage({ coverage: coverageEl });
        });
      },

      /**
       * After the user focuses out, show validation help, if needed
       * @param {Event} e - The event that triggered this function
       */
      showTaxonValidation(e) {
        // Get the text inputs and select menus
        const row = $(e.target).parents("tr");
        const allInputs = row.find("input, select");
        const tableContainer = $(e.target).parents("table");
        const errorInputs = [];

        // If none of the inputs have a value and this is a new row, then do nothing
        if (_.every(allInputs, (i) => !i.value) && row.is(".new")) return;

        // Add the error styling to any input with no value
        _.each(allInputs, (input) => {
          // Keep track of the number of clicks of each input element so we only show the
          // error message after the user has focused on both input elements
          if (!input.value) errorInputs.push(input);
        });

        if (errorInputs.length) {
          // Show the error message after a brief delay
          setTimeout(() => {
            // If the user focused on another element in the same row, don't do anything
            if (_.contains(allInputs, document.activeElement)) return;

            // Add the error styling
            $(errorInputs).addClass("error");

            // Add the error message
            if (!tableContainer.prev(".notification").length) {
              tableContainer.before(
                $(document.createElement("p"))
                  .addClass("error notification")
                  .text("Enter a rank name AND value in each row."),
              );
            }
          }, 200);
        } else {
          allInputs.removeClass("error");

          if (!tableContainer.find(".error").length)
            tableContainer.prev(".notification").remove();
        }
      },

      /**
       * Indicate that a taxonomic classification is about to be removed if the
       * button is clicked
       * @param {Event} e - The event that triggered this function
       */
      previewTaxonRemove(e) {
        const removeBtn = $(e.target);

        if (removeBtn.parent().is(".root-taxonomic-classification")) {
          removeBtn.parent().toggleClass("remove-preview");
        } else {
          removeBtn
            .parents(".taxonomic-coverage-row")
            .toggleClass("remove-preview");
        }
      },

      /**
       * Creates "Remove" buttons for removing non-required sectionsof the EML
       * from the DOM
       * @param {string} submodel - The name of the submodel to remove
       * @param {string} attribute - The name of the attribute to remove
       * @param {string} selector - The selector for the element to remove
       * @param {string} container - The selector for the container element
       * @returns {jQuery} A jQuery object containing the remove button
       * // TODO: duplicate of EML211EditorView#createRemove
       */
      createRemoveButton(submodel, attribute, selector, container) {
        return $(document.createElement("span"))
          .addClass("icon icon-remove remove pointer")
          .attr("title", "Remove")
          .data({
            submodel,
            attribute,
            selector,
            container,
          });
      },
    },
  );

  return EMLTaxonView;
});
