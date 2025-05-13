define([
  "jquery", // for semantic UI
  "underscore", // for alert template only
  "backbone",
  "semantic",
  "models/metadata/eml211/EMLAttributeList",
  "common/Utilities",
  "text!templates/alert.html",
], ($, _, Backbone, Semantic, EMLAttributeList, Utilities, AlertTemplate) => {
  /**
   * @class AutofillAttributesView
   * @classdesc
   * @classcategory Views/Metadata
   * @screenshot views/metadata/AutofillAttributesView.png
   * @augments Backbone.View
   */

  // Default timeout for the button to revert to its original state
  // after a successful action
  const BUTTON_TIMEOUT = 3000;

  // Class names used in this view
  const CLASS_NAMES = {
    view: "autofill-attributes",
    buttonContainer: "right-aligned-flex-container",
    tabDynamicContent: "autofill-attributes_tab-dynamic-content",
    notificationContainer: "autofill-attributes__notification",
    checkboxeContainer: "autofill-attributes__checkbox-list",
    copyFromSelect: "autofill-attributes__copy-from-select",
  };

  // Font awesome icon names
  const ICONS = {
    warning: "warning-sign",
    magic: "magic",
    from: "signin",
    to: "signout",
    onLeft: "on-left",
    file: "file",
    success: "check",
    processing: "spinner",
  };

  // Prefix to add ato all ICONS
  const ICON_PREFIX = "icon-";

  // Classnames the come from bootstrap used here
  const BOOTSTRAP_CLASS_NAMES = {
    warning: "warning",
    info: "alert-info",
    button: "btn",
    buttonPrimary: "btn-primary",
    active: "active",
    tabContent: "tab-content",
    navPills: "nav-pills",
    navPill: "nav-pill",
    tabPane: "tab-pane",
    well: "well",
    checkbox: "checkbox",
  };

  const AutofillAttributesView = Backbone.View.extend(
    /** @lends AutofillAttributesView.prototype */ {
      /**
       * The className to add to the view container
       * @type {string}
       */
      className: CLASS_NAMES.view,

      /**
       * A list of file formats that can be auto-filled with attribute
       * information
       * @type {string[]}
       */
      fillableFormats: ["text/csv"],

      /**
       * Settings for the semantic UI popup used to indicate that an attribute
       * will be removed when the remove button is clicked
       * @type {object}
       */
      buttonTooltipSettings: {
        content: "",
        position: "top center",
        variation: `${Semantic.CLASS_NAMES.variations.inverted} ${Semantic.CLASS_NAMES.variations.mini}`,
        delay: {
          show: 500,
          hide: 20,
        },
        exclusive: true,
      },

      /**
       * Generates the HTML template for the AutofillAttributesView.
       * @returns {DocumentFragment} The HTML template content for the
       * AutofillAttributesView.
       */
      template() {
        const template = document.createElement("template");
        const BC = BOOTSTRAP_CLASS_NAMES;
        template.innerHTML = `<div><ul class="${BC.navPills}"></ul><div class="${BC.tabContent}"></div></div>`;
        return template.content.querySelector("div");
      },

      /**
       * Creates a Bootstrap-styled navigation tab element.
       * @param {string} target - The ID of the target tab content to be
       * displayed when this tab is selected.
       * @param {string} icon - The CSS class name(s) for the icon to be
       * displayed on the tab.
       * @param {string} text - The text to be displayed on the tab.
       * @returns {HTMLLIElement} - The `<li>` element representing the
       * navigation tab.
       */
      actionTabTemplate(target, icon, text) {
        // Create the template
        const template = document.createElement("template");
        const BC = BOOTSTRAP_CLASS_NAMES;
        template.innerHTML = `
          <li class="${BC.navPill}">
            <a data-toggle="tab" data-target="#${target}">
              <i class="${icon} ${ICONS.onLeft}"></i>${text}
            </a>
          </li>`;
        return template.content.querySelector("li");
      },

      /**
       * Creates an action panel template as a DOM element.
       * @param {string} id - The unique identifier for the action panel.
       * @param {string} text - The text content to display in the panel.
       * @returns {HTMLDivElement} The generated action panel as a `div`
       * element.
       */
      actionPanelTemplate(id, text) {
        const template = document.createElement("template");
        const CN = CLASS_NAMES;
        const BC = BOOTSTRAP_CLASS_NAMES;
        template.innerHTML = `
          <div class="${BC.tabPane} ${BC.well}" id="${id}">
            <p>${text}</p>
            <div class="${CN.tabDynamicContent}"></div>
            <div class="${CN.buttonContainer}">
              <button class="${BC.button} ${BC.buttonPrimary}">
                <i class="${ICONS.onLeft}"></i><span></span>
              </button>
            </div>
          </div>`;
        return template.content.querySelector("div");
      },

      /**
       * The template for the alert message
       * @type {UnderscoreTemplate}
       */
      alertTemplate: _.template(AlertTemplate),

      /**
       * The configuration options and context for an auto-fill action available
       * in the view.
       * @typedef {object} Action
       * @property {string} label - The label for the action, displayed in the
       * UI.
       * @property {string} text - A description of the action's purpose.
       * @property {string} icon - The CSS class for the icon representing the
       * action.
       * @property {string} renderMethod - The name of the method that renders
       * the action's UI.
       * @property {string} buttonMethod - The name of the method that handles
       * the button's click event.
       * @property {HTMLElement|null} tabEl - The DOM element for the action's
       * tab (initialized as null).
       * @property {HTMLElement|null} actionEl - The DOM element for the
       * action's panel (initialized as null).
       * @property {ButtonState} buttonStates - An object containing the
       * different states of the button, each with its own properties.
       */

      /**
       * Properties of a button during a specific state.
       * @typedef {object} ButtonState
       * @property {string} message - The message to display on the button.
       * @property {string} icon - The Font Awesome icon name to display on the button.
       * @property {string} tooltip - The tooltip text to display when hovering over the button.
       * @property {boolean} active - Indicates whether the button is active or not.
       * @property {number} [timeout] - The timeout duration in milliseconds for reverting the button state.
       * @property {ButtonState} [afterTimeout] - The state to revert to after a timeout.
       */

      /**
       * The configuration options for the actions available in the view.
       * @type {object}
       * @property {Action} fillFromFile - The configuration for the "Fill from
       * file" action.
       * @property {Action} copyFrom - The configuration for the "Copy from"
       * action.
       * @property {Action} copyTo - The configuration for the "Copy to" action.
       */
      actionConfig: {
        fillFromFile: {
          label: "Fill from file",
          text:
            "Use the information provided in your tabular data file to fill " +
            "in the attribute names.",
          icon: ICONS.file,
          renderMethod: "renderFillFromFile",
          buttonMethod: "handleFill",
          tabEl: null,
          actionEl: null,
          buttonStates: {
            default: {
              message: "Fill attributes from file",
              icon: ICONS.magic,
              tooltip: "Click to fill attributes from the uploaded file",
              active: true,
            },
            loading: {
              message: "Please wait...",
              icon: ICONS.processing,
              tooltip: "Fetching file contents...",
              active: true,
            },
            success: {
              message: "Filled!",
              icon: ICONS.success,
              tooltip: "Attribute names filled successfully",
              active: true,
              timeout: BUTTON_TIMEOUT,
              afterTimeout: "default",
            },
            error: {
              message: "Failed to fill",
              icon: ICONS.warning,
              tooltip: "An error occurred while fetching the file.",
              active: false,
              timeout: BUTTON_TIMEOUT,
              afterTimeout: "default",
            },
            unsupportedFormat: (thisFormat, allowedFormats) => ({
              message: `Cannot fill attributes from ${thisFormat} files`,
              icon: ICONS.warning,
              tooltip: `Only ${allowedFormats} files are supported for autofill at this time.`,
              active: false,
            }),
          },
        },
        copyFrom: {
          label: "Copy from...",
          text:
            "Copy all attribute information from another file to this " +
            "one! Select a source file below",
          icon: ICONS.from,
          renderMethod: "renderCopyFrom",
          buttonMethod: "handleCopyFrom",
          tabEl: null,
          actionEl: null,
          buttonStates: {
            default: {
              message: "Copy attributes from file",
              icon: ICONS.magic,
              tooltip: "Select a file to copy attributes from",
              active: false,
            },
            selection: (selectedFile) => ({
              message: `Copy attributes from <b>${selectedFile}</b>`,
              icon: ICONS.magic,
              tooltip: `All attributes will be copied from ${selectedFile} to this file`,
              active: true,
            }),
            success: {
              message: "Attributes copied!",
              icon: ICONS.success,
              tooltip: "All attributes copied successfully",
              active: true,
              timeout: BUTTON_TIMEOUT,
              afterTimeout: "default",
            },
            error: {
              message: "Failed to copy",
              icon: ICONS.warning,
              tooltip: "An error occurred while copying attributes.",
              active: false,
              timeout: BUTTON_TIMEOUT,
              afterTimeout: "default",
            },
            cannotCopy: {
              message: "Cannot copy attributes from files",
              icon: ICONS.warning,
              tooltip:
                "Check that there are other files with valid attributes to copy from.",
              active: false,
            },
          },
        },
        copyTo: {
          label: "Copy to...",
          text:
            "Copy all attribute information from this file to other files in the " +
            "package! Select target files below",
          icon: ICONS.to,
          renderMethod: "renderCopyTo",
          buttonMethod: "handleCopyTo",
          tabEl: null,
          actionEl: null,
          buttonStates: {
            default: {
              message: "Copy attributes to files",
              icon: ICONS.magic,
              tooltip:
                "Select at least one file to copy this file's attributes to",
              active: false,
            },
            selection: (checkedValues) => {
              const numChecked = checkedValues.length;
              const fileNoun = numChecked > 1 ? "files" : "file";
              return {
                message: `Copy attributes to <b>${numChecked}</b> ${fileNoun}`,
                icon: ICONS.magic,
                tooltip: `Click to copy attributes to the following ${fileNoun}: ${checkedValues.join(
                  ", ",
                )}`,
                active: true,
              };
            },
            success: {
              message: "Attributes copied!",
              icon: ICONS.success,
              tooltip: "All attributes copied successfully",
              active: true,
              timeout: BUTTON_TIMEOUT,
              afterTimeout: "default",
            },
            error: {
              message: "Failed to copy",
              icon: ICONS.warning,
              tooltip:
                "Check that this file has valid attributes and that there are other files to copy to.",
              active: false,
              timeout: BUTTON_TIMEOUT,
              afterTimeout: "default",
            },
          },
        },
      },

      /**
       * The view will populate actions with a cloned copy of the action
       * options. It will be modified to add references to the elements created
       * for each action. See {@link actionConfig} for the options.
       * @type {object}
       */
      actions: {},

      /**
       * Records any errors that occur during the autofill process. This object
       * is used to store error messages and other relevant information.
       * @type {object}
       */
      errors: {},

      /** @inheritdoc */
      events() {
        const events = {};
        events[`change .${CLASS_NAMES.copyFromSelect}`] =
          "handleCopyFromSelectChange";
        events[`change .${CLASS_NAMES.checkboxeContainer}`] =
          "handleCopyToCheckboxChange";
        events[`click .${CLASS_NAMES.buttonContainer} button`] =
          "handleActionButtonClick";
        return events;
      },

      /**
       * Creates a new AutofillAttributesView
       * @param {object} options - A literal object with options to pass to the
       * view
       * @param {EMLAttributeList} options.model - The attributes model that
       * contains the attributes collection to autofill.
       * @param {EMLEntity} options.parentModel - The entity model to which
       * these attributes belong
       * @param {boolean} [options.isNew] - Set to true if this is a new
       * attribute
       */
      initialize(options = {}) {
        this.model = options.model || new EMLAttributeList();
        this.parentModel = options.parentModel;

        // Prefix all the icons
        if (!Object.values(ICONS)[0].startsWith(ICON_PREFIX)) {
          Object.keys(ICONS).forEach((key) => {
            ICONS[key] = `${ICON_PREFIX}${ICONS[key]}`;
          });
        }
        // Do the same for the icons in the actions objects' buttonStates
        Object.keys(this.actionConfig).forEach((action) => {
          const actionObj = this.actionConfig[action];
          // Add the prefix to the icon
          if (actionObj.icon && !actionObj.icon.startsWith(ICON_PREFIX)) {
            actionObj.icon = `${ICON_PREFIX}${actionObj.icon}`;
          }
          Object.keys(actionObj.buttonStates).forEach((state) => {
            const stateObj = actionObj.buttonStates[state];
            if (stateObj.icon && !stateObj.icon.startsWith(ICON_PREFIX)) {
              stateObj.icon = `${ICON_PREFIX}${stateObj.icon}`;
            }
          });
        });
      },

      /** @inheritdoc */
      render() {
        const BC = BOOTSTRAP_CLASS_NAMES;

        // Render the template
        this.el.innerHTML = "";
        this.el.append(this.template());

        this.els = {
          actionTabsContainer: this.el.querySelector(`.${BC.navPills}`),
          actionPanelsContainer: this.el.querySelector(`.${BC.tabContent}`),
        };

        this.renderActions();
        this.stopListening(this.parentModel?.collection, "update");
        this.listenTo(
          this.parentModel.collection,
          "update",
          this.handleEntityUpdate,
        );

        return this;
      },

      /**
       * Handles the update of entity panels by re-rendering all non-active panels.
       * This method identifies the currently active panel and iterates over the
       * available actions to re-render the panels that are not active.
       */
      handleEntityUpdate() {
        // Get the active panel and re-render the other two
        const activePanel = this.els.actionPanelsContainer.querySelector(
          `.${BOOTSTRAP_CLASS_NAMES.active}`,
        );
        const activeId = activePanel.id;
        // Iterate over the actions and re-render the non-active ones
        Object.keys(this.actions).forEach((action) => {
          if (action !== activeId) {
            const actionObj = this.actions[action];
            const renderMethod = this[actionObj.renderMethod];
            if (typeof renderMethod === "function") {
              renderMethod.call(this, actionObj);
            }
          }
        });
      },

      /**
       * Renders all actions defined in the actionConfig object. This method
       * creates tabs and panels for each action and sets up event listeners.
       */
      renderActions() {
        // Deep clone actionConfig to actions. Otherwise the changes may persist
        // in other instances of this view!
        this.actions = {};
        Object.entries(this.actionConfig).forEach((action, i) => {
          const name = action[0];
          const options = action[1];
          this.actions[name] = { ...options };
          const activate = i === 0;
          this.renderAction(name, activate);
        }, this);
      },

      /**
       * Renders an action tab and panel in the view, and sets up event
       * listeners for the action's button.
       * @param {string} name - The name of the action to render. Must match a
       * key in the actionConfig object.
       * @param {boolean} [activate] - If true, the action will be set as the
       * active tab.
       */
      renderAction(name, activate = false) {
        const BC = BOOTSTRAP_CLASS_NAMES;
        const action = this.actions[name];
        action.id = `${this.cid}-${name}`;

        // Create the pill tab & action contents
        action.panelEl = this.actionPanelTemplate(
          action.id,
          action.text,
          action.buttonIcon,
          action.buttonText,
        );
        action.tabEl = this.actionTabTemplate(
          action.id,
          action.icon,
          action.label,
        );
        action.dynamicContainer = action.panelEl.querySelector(
          `.${CLASS_NAMES.tabDynamicContent}`,
        );
        action.button = action.panelEl.querySelector("button");
        // Add the action name to the button
        action.button.dataset.action = name;
        // Set the button to the default state
        this.updateButton(action.button, action.buttonStates.default);

        // Append to view
        this.els.actionTabsContainer.append(action.tabEl);
        this.els.actionPanelsContainer.append(action.panelEl);
        if (activate) {
          action.tabEl.classList.add(BC.active);
          action.panelEl.classList.add(BC.active);
        }

        const renderMethod = this[action.renderMethod];

        if (typeof renderMethod === "function") {
          renderMethod.call(this, action);
        }
      },

      /**
       * Performs the action associated with the clicked button. This method
       * retrieves the action name from the button's data attribute and invokes
       * the corresponding method to handle the action.
       * @param {event} event - The event object containing the action name.
       */
      handleActionButtonClick(event) {
        const button = event.currentTarget;
        const actionName = button.dataset.action;
        const action = this.actions[actionName];
        if (!action) return;

        const buttonMethod = this[action.buttonMethod];
        if (action && typeof buttonMethod === "function") {
          buttonMethod.call(this, action);
        }
      },

      /**
       * Renders the "Copy to" action, which allows the user to copy attributes
       * from the current file to other files in the package.
       * @param {Action} action - The action object containing configuration for
       * the "Copy to" action.
       */
      renderCopyTo(action) {
        const canCopy = this.canCopyTo();
        if (canCopy !== true) {
          this.showCantCopyTo(canCopy);
          return;
        }

        const BC = BOOTSTRAP_CLASS_NAMES;
        const container = action.dynamicContainer;
        const fileNames = this.getOtherFileNames();

        // Generate checkboxes
        const checkboxes = fileNames.map((name) => {
          const id = `${this.cid}-copy-to-${name}`;
          return `<label class="${BC.checkbox}" html-for="${id}">
            <input type="checkbox" value="${name}" id="${id}"/>
            ${name}
          </label>`;
        });

        // Set the container's innerHTML
        container.innerHTML = `<div class="${CLASS_NAMES.checkboxeContainer}">${checkboxes.join("")}</div>`;
        // Start the button inactive
        this.updateButton(action.button, action.buttonStates.default);
        // Warn that this will overwrite existing attributes
        this.showNotification(
          "copyTo",
          "This will overwrite any existing attributes in the selected files.",
          [BOOTSTRAP_CLASS_NAMES.info],
          false,
        );
      },

      /**
       * Handles the change event for checkboxes in the "Copy To" action.
       * Updates the button state based on the number of selected checkboxes.
       * @param {Event} event - The change event triggered by a checkbox.
       */
      handleCopyToCheckboxChange(event) {
        if (
          event.target.tagName === "INPUT" &&
          event.target.type === "checkbox"
        ) {
          const action = this.actions.copyTo;
          const container = action.dynamicContainer;
          // Get all currently checked checkboxes
          const checkedValues = this.getCheckedValues(container);
          // Update the button state based on the number of selected items
          if (checkedValues.length > 0 && this.canCopyTo() === true) {
            this.updateButton(
              action.button,
              action.buttonStates.selection(checkedValues),
            );
          } else {
            this.updateButton(action.button, action.buttonStates.default);
          }
        }
      },

      /**
       * Checks whether attributes can be copied to other files.
       * @returns {"no attributes"|"invalid attributes"|"no other files"|true}
       * - "no attributes" if there are no attributes to copy
       * - "invalid attributes" if the attributes are invalid
       * - "no other files" if there are no other files to copy to
       * - true if all checks pass
       */
      canCopyTo() {
        const attributes = this.model.get("emlAttributes");

        // There must be attributes to copy
        if (!this.model.hasNonEmptyAttributes()) {
          return "no attributes";
        }
        // All the attributes must be valid before copying
        if (!attributes.isValid(attributes)) {
          return "invalid attributes";
        }
        // There must be other files to copy to
        const otherFileNames = this.getOtherFileNames();
        if (otherFileNames.length === 0) {
          return "no other files";
        }
        return true;
      },

      /**
       * Displays a warning message and updates the UI when attributes cannot be
       * copied to other files.
       * @param {"no attributes"|"invalid attributes"|"no other files"} reason -
       * The reason why attributes cannot be copied.
       */
      showCantCopyTo(reason) {
        const action = this.actions.copyTo;
        let { message } = action.buttonStates.error;
        let { tooltip } = action.buttonStates.error;
        if (reason === "no attributes") {
          message = "Add at least one attribute to this file before copying";
          tooltip = "One or more valid attributes are required to copy.";
        } else if (reason === "invalid attributes") {
          message =
            "All attributes must be valid before copying to other files";
          tooltip =
            "Please fix any invalid attributes in this file before copying";
        } else if (reason === "no other files") {
          message =
            "No other files to copy attributes to. Please add more files";
          tooltip = "At least one other file is required to copy attributes";
        }
        this.updateButton(action.button, {
          ...action.buttonStates.error,
          message,
          tooltip,
        });
        this.showNotification("copyTo", message, [
          BOOTSTRAP_CLASS_NAMES.warning,
        ]);
      },

      /**
       * Retrieves the values of all checked checkboxes within a specified
       * container.
       * @param {HTMLElement} container - The container element to search for
       * checked checkboxes.
       * @returns {string[]} An array of values from the checked checkboxes.
       */
      getCheckedValues(container) {
        // Find all checked checkboxes within the container
        const checkedCheckboxes = container.querySelectorAll(
          "input[type='checkbox']:checked",
        );
        // Map their values into an array
        return Array.from(checkedCheckboxes).map((checkbox) => checkbox.value);
      },

      /**
       * Handles the "Copy To" action for copying attributes from the current
       * entity to selected entities within the collection. This function
       * retrieves the selected entities, copies the attributes using the
       * `copyAttributeList` method, and provides feedback to the user via
       * button updates.
       */
      handleCopyTo() {
        const action = this.actions.copyTo;
        const selectedValues = this.getCheckedValues(action.dynamicContainer);

        const thisEntity = this.parentModel;
        const entities = thisEntity.collection;
        const selectedEntities = entities.filter((entity) =>
          selectedValues.includes(entity.getFileName()),
        );

        try {
          entities.copyAttributeList(thisEntity, selectedEntities, true);
          this.updateButton(action.button, action.buttonStates.success);
        } catch (error) {
          // Get the error type. and call if needed. Include errors
          // message in tooltip.
          this.errors.copyTo = error;
          this.updateButton(action.button, action.buttonStates.error);
        }
      },

      /**
       * Checks whether attributes can be copied from other files.
       * @returns {"no other files"|"no valid attributes"|true}
       * - "no other files" if there are no files to copy from
       * - "no valid attributes" if no valid attributes exist in other files
       * - true if all checks pass
       */
      canCopyFrom() {
        // There must be other files with attributes to copy from
        const otherFileNames = this.getOtherFileNames();
        const entities = this.parentModel.collection;
        if (otherFileNames.length === 0) {
          return "no other files";
        }
        if (entities.length === 0 || !entities.hasNonEmptyEntity()) {
          return "no other files";
        }
        if (entities.getEntitiesWithValidAttributes().length === 0) {
          return "no valid attributes";
        }
        return true;
      },

      /**
       * Renders the "Copy from" action, allowing the user to copy attributes
       * from another file to the current file.
       * @param {Action} action - The action object containing configuration for
       * the "Copy from" action.
       */
      renderCopyFrom(action) {
        const actionRef = action;
        const canCopy = this.canCopyFrom();
        if (canCopy !== true) {
          this.showCantCopyFrom(canCopy);
          return;
        }

        const entities = this.getOtherEntities();
        const id = `${this.cid}-copy-from`;
        const select = document.createElement("select");

        select.id = id;
        select.classList.add(CLASS_NAMES.copyFromSelect);

        // Add the default option
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Select a file";
        select.append(option);

        // Add an option for each file
        entities.forEach((entity) => {
          const opt = this.createOption(entity);
          select.append(opt);
        }, this);
        actionRef.dynamicContainer.innerHTML = "";
        actionRef.dynamicContainer.append(select);
        actionRef.select = select;

        const { button } = action;

        // Deactivate the button until a file is selected
        this.updateButton(button, action.buttonStates.default);

        // Warn that this will overwrite existing attributes
        this.showNotification(
          "copyFrom",
          "This will overwrite any existing attributes in this file.",
          [BOOTSTRAP_CLASS_NAMES.info],
          false,
        );
      },

      /**
       * Handles the change event for the "Copy from" select element. This
       * function updates the button state based on the selected file and
       * disables the button if no valid attributes are available for copying.
       */
      handleCopyFromSelectChange() {
        const { select, button } = this.actions.copyFrom;
        const selectedFile = select.options[select.selectedIndex].textContent;

        if (selectedFile) {
          this.updateButton(
            button,
            this.actions.copyFrom.buttonStates.selection(selectedFile),
          );
        } else {
          this.updateButton(button, this.actions.copyFrom.buttonStates.default);
        }
      },

      /**
       * Displays a message and disables the button when attributes cannot be
       * copied.
       * @param {string} reason - The reason why attributes cannot be copied.
       */
      showCantCopyFrom(reason) {
        const action = this.actions.copyFrom;
        let message = "Cannot copy attributes from files";
        let tooltip =
          "Check that there are other files with valid attributes to copy from";
        if (reason === "no other files") {
          message = "Add at least one other file to copy attributes from";
          tooltip = "One or more valid files are required to copy attributes";
        } else if (reason === "no valid attributes") {
          message =
            "All attributes in the selected file must be valid before copying";
          tooltip = "One or more invalid attributes are present.";
        }
        this.updateButton(action.button, {
          ...action.buttonStates.cannotCopy,
          message,
          tooltip,
        });
        this.showNotification("copyFrom", message, [
          BOOTSTRAP_CLASS_NAMES.warning,
        ]);
      },

      /**
       * Creates an option element for a file in the "Copy from" dropdown.
       * @param {object} entity - The entity model representing the file.
       * @returns {HTMLOptionElement} The created option element.
       */
      createOption(entity) {
        const name = entity.getFileName() || entity.getId();
        const modelId = entity.cid;
        const isValid = entity.get("attributeList").isValid();
        const isNonEmpty = entity.get("attributeList").hasNonEmptyAttributes();

        const opt = document.createElement("option");
        opt.value = modelId;
        opt.textContent = `${name}`;
        if (!isValid || !isNonEmpty) {
          let message = "Cannot copy attributes from this file";
          if (!isValid) {
            opt.textContent += " (INVALID ATTRIBUTES)";
            message = "This file has invalid attributes";
          } else if (!isNonEmpty) {
            opt.textContent += " (NO ATTRIBUTES TO COPY)";
            message = "This file has no attributes";
          }
          opt.disabled = true;
          opt.setAttribute("data-content", message);
        }

        return opt;
      },

      /**
       * Handles the "Copy From" action for copying attributes from a selected
       * file to the current file.
       * @param {Action} action - The action object containing configuration for
       * the "Copy from" action.
       */
      handleCopyFrom(action) {
        const { select } = action;
        // - get select value
        // - get matching entity model
        // - use copy attributes method in collection to copy here update button
        //   to indicate success
        const selectedValue = select.options[select.selectedIndex].value;
        const selectedEntity = this.parentModel.collection.get(selectedValue);
        const thisEntity = this.parentModel;
        const entities = thisEntity.collection;

        try {
          entities.copyAttributeList(selectedEntity, [thisEntity], true);
          this.updateButton(action.button, action.buttonStates.success);
        } catch (error) {
          this.errors.copyFrom = error;
          this.updateButton(action.button, action.buttonStates.error);
        }
      },

      /**
       * Retrieves the names of other files in the collection.
       * @returns {string[]} An array of file names.
       */
      getOtherFileNames() {
        return this.getOtherEntities().map(
          (entity) =>
            entity.get("entityName") || entity.get("physicalObjectName"),
        );
      },

      /**
       * Retrieves the entities representing other files in the collection.
       * @returns {object[]} An array of entity models.
       */
      getOtherEntities() {
        const entities = this.parentModel.collection;
        const thisEntity = this.parentModel;
        return entities.filter((entity) => entity !== thisEntity);
      },

      /**
       * Checks whether the current file format is supported for the "Fill from
       * file" action.
       * @returns {boolean} True if the format is supported, false otherwise.
       */
      isFillable() {
        const { parentModel } = this;
        this.formatGuess =
          parentModel.get("dataONEObject")?.get("formatId") ||
          parentModel.get("entityType");
        return this.fillableFormats.includes(this.formatGuess);
      },

      /**
       * Renders the "Fill from file" action, allowing the user to autofill
       * attributes from the uploaded file.
       * @param {Action} action - The action object containing configuration for
       * the "Fill from file" action.
       */
      renderFillFromFile(action) {
        if (!this.isFillable()) {
          this.showWrongFormat();
        } else {
          this.updateButton(action.button, action.buttonStates.default);
        }
      },

      /**
       * Displays a notification when the file format is not supported for
       * autofill.
       */
      showWrongFormat() {
        if (!this.formatGuess) this.isFillable();

        const { formatGuess } = this;
        const thisFile = formatGuess
          ? `a ${formatGuess} file`
          : "this filetype";
        const allowedFormats = this.fillableFormats.join(", ");

        const message = `Cannot fill attributes from ${thisFile}.
          Only ${allowedFormats} files are supported for autofill at this time.`;

        this.showNotification(
          "fillFromFile",
          message.replace("\n", ""),
          [BOOTSTRAP_CLASS_NAMES.warning],
          true,
        );

        const action = this.actions.fillFromFile;
        this.updateButton(
          action.button,
          action.buttonStates.unsupportedFormat(
            formatGuess,
            this.fillableFormats.join(", "),
          ),
        );
      },

      /**
       * Handles the "Fill from file" action by determining whether to use a
       * File object or fetch the file contents.
       */
      handleFill() {
        const d1Object = this.parentModel.get("dataONEObject");

        if (!d1Object) return;

        const file = d1Object.get("uploadFile");

        try {
          if (!file) {
            this.handleFillViaFetch();
          } else {
            this.handleFillViaFile(file);
          }
        } catch (error) {
          this.errors.fillFromFile = error;
          const action = this.actions.fillFromFile;
          this.updateButton(action.button, action.buttonStates.error);
        }
      },

      /**
       * Handles the "Fill from file" action using a File object.
       * @param {File} file - A File object to fill from.
       */
      handleFillViaFile(file) {
        const view = this;

        Utilities.readSlice(file, this, (event) => {
          if (event.target.readyState !== FileReader.DONE) {
            return;
          }

          view.tryParseAndFillAttributeNames.bind(view)(event.target.result);
        });
      },

      /**
       * Handles the "Fill from file" action by fetching the file contents.
       */
      handleFillViaFetch() {
        const view = this;
        const objServiceUrl = MetacatUI.appModel.get("objectServiceUrl");
        const fileId = this.parentModel.get("dataONEObject").get("id");
        const url = `${objServiceUrl}${encodeURIComponent(fileId)}`;

        this.updateButton(
          view.actions.fillFromFile.button,
          view.actions.fillFromFile.buttonStates.loading,
        );

        fetch(url, MetacatUI.appUserModel.createFetchSettings())
          .then((response) => {
            if (!response.ok) {
              throw new Error("Network response was not ok");
            }
            return response.text();
          })
          .then(view.tryParseAndFillAttributeNames.bind(this))
          .catch((e) => {
            this.errors.fetch = e;
            this.updateButton(
              view.actions.fillFromFile.button,
              view.actions.fillFromFile.buttonStates.error,
            );
          });
      },

      /**
       * Attempts to parse the header of a file and fill attribute names.
       * @param {string} content - The content of the file to parse.
       */
      tryParseAndFillAttributeNames(content) {
        const names = Utilities.tryParseCSVHeader(content);

        if (!names?.length) {
          this.updateButton(this.actions.fillFromFile.button, {
            ...this.actions.fillFromFile.buttonStates.error,
            message: "No attribute names found in file",
          });
          return;
        }

        this.listenToOnce(this.collection, "namesUpdated", () => {
          this.updateButton(
            this.actions.fillFromFile.button,
            this.actions.fillFromFile.buttonStates.success,
          );
          this.render();
          this.showNotification(
            "fillFromFile",
            "Attribute names filled successfully",
            [BOOTSTRAP_CLASS_NAMES.success],
          );
        });
        this.model.updateAttributeNames(names);
      },

      /**
       * Updates a button to show a new status.
       * @param {HTMLElement} buttonEl - The button to update.
       * @param {ButtonState} state - The new state to set for the button.
       */
      updateButton(buttonEl, state) {
        const button = buttonEl;
        // Store the default state if it doesn't already exist
        if (!button.dataset.defaultState) {
          button.dataset.defaultState = JSON.stringify(state);
        }
        const {
          message,
          icon,
          tooltip,
          active = true,
          timeout,
          afterTimeout,
        } = state;

        if (message && message !== "") {
          const messageEl = button.querySelector("span");
          messageEl.innerHTML = message;
        }

        if (icon) {
          const iconEl = button.querySelector("i");
          // Find the icon classes
          const iconClasses = Array.from(iconEl.classList).filter(
            (cls) => cls.startsWith(ICON_PREFIX) && cls !== ICONS.onLeft,
          );
          iconEl.classList.remove(...iconClasses);
          iconEl.classList.add(icon);
        }

        if (tooltip) {
          const tooltipSettings = {
            content: tooltip,
            ...this.buttonTooltipSettings,
          };
          button.setAttribute("data-content", tooltip);
          $(button).popup(tooltipSettings);
        } else if (tooltip === "") {
          button.removeAttribute("data-content");
          $(button).popup("destroy");
        }

        const buttonRef = button;
        if (active) buttonRef.disabled = false;
        else buttonRef.disabled = true;

        // Handle timeout and afterTimeout
        if (timeout > 0 && afterTimeout) {
          setTimeout(() => {
            let nextState = afterTimeout;
            if (afterTimeout === "default") {
              nextState = JSON.parse(button.dataset.defaultState);
            }
            this.updateButton(button, nextState);
          }, timeout);
        }
      },

      /**
       * Displays a notification message in the UI.
       * @param {string} actionName - The key of the action to show the
       * notification in.
       * @param {string} msg - The message to show in the notification.
       * @param {string[]} classes - The classes to add to the notification.
       * @param {boolean} emptyContainer - Set to true to remove any existing
       * notifications in the container.
       */
      showNotification(actionName, msg, classes, emptyContainer = true) {
        const action = this.actions[actionName];
        const { dynamicContainer } = action;
        const notification = this.alertTemplate({
          msg,
          classes,
          includeEmail: false,
          remove: false,
        });

        // Removing any existing notification
        const existingNotification = action.notification;

        if (existingNotification) existingNotification.remove();
        if (emptyContainer) dynamicContainer.innerHTML = "";
        // Add the notification to the start of the container
        dynamicContainer.insertAdjacentHTML("afterbegin", notification);
        action.notification = dynamicContainer.firstChild;
      },

      /**
       * Cleans up the view by removing all event listeners.
       */
      onClose() {
        // remove all listeners
        this.stopListening();
      },
    },
  );

  return AutofillAttributesView;
});
