define([
  "backbone",
  "jquery",
  "semantic",
  "collections/metadata/eml/EMLAttributes",
  "views/metadata/EMLAttributeView",
  "views/metadata/AutofillAttributesView",
], (
  Backbone,
  $,
  Semantic,
  EMLAttributes,
  EMLAttributeView,
  AutofillAttributesView,
) => {
  /**
   * @class EMLAttributesView
   * @classdesc An EMLAttributesView displays the info about all attributes in
   * an EML document.
   * @classcategory Views/Metadata
   * @screenshot views/metadata/EMLAttributesView.png
   * @augments Backbone.View
   */

  const STRINGS = {
    addAttribute: "Add Attribute",
    newAttribute: "New Attribute",
  };

  // TODO: remove class names that are in autofill

  const CLASS_NAMES = {
    menuContainer: "attribute-menu-container",
    fillButtonContainer: "fill-button-container",
    copyButtonContainer: "copy-button-container",
    actionButtonsContainer: "action-buttons",

    attributeList: "attribute-list",
    menu: "attribute-menu",
    fillButton: "fill-button",
    copyButton: "copy-button",
    menuItem: "attribute-menu-item",
    menuItemName: "name",
    ellipsis: "ellipsis",

    iconRemove: "icon-remove",
    iconAdd: "icon-plus",
    iconMagic: "icon-magic",
    iconError: "icon-exclamation-sign",
    iconWarning: "icon-warning-sign",
    iconOnLeft: "icon-on-left",
    iconProcessing: "icon-time",
    iconSuccess: "icon-ok",

    new: "new",
    add: "add",
    error: "error",
    remove: "remove",
    previewRemove: "remove-preview",

    autofillButton: "autofill-button",
    autofillContainer: "autofill-attributes",
  };

  const BOOTSTRAP_CLASS_NAMES = {
    sideNavItems: "side-nav-items",
    sideNavItem: "side-nav-item",
    pointer: "pointer",
    icon: "icon",
    hidden: "hidden",
    active: "active",
    button: "btn",
    buttonPrimary: "btn-primary",
  };

  // TODO
  const ICONS = {
    warning: "warning-sign",
    remove: "remove",
    add: "plus",
    magic: "magic",
    error: "exclamation-sign",
    onLeft: "on-left",
    processing: "time",
    success: "ok",
  };

  // Prefix to add ato all ICONS
  const ICON_PREFIX = "icon-";

  const EMLAttributesView = Backbone.View.extend(
    /** @lends EMLAttributesView.prototype */ {
      /**
       * The className to add to the view container
       * @type {string}
       */
      className: "attribute-container",

      /**
       * Settings for the semantic UI popup used to indicate that an attribute
       * will be removed when the remove button is clicked
       * @type {object}
       */
      removeTooltipSettings: {
        content: "Remove",
        position: "top center",
        variation: `${Semantic.CLASS_NAMES.variations.inverted} ${Semantic.CLASS_NAMES.variations.mini}`,
        delay: {
          show: 400,
          hide: 20,
        },
        exclusive: true,
      },

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {object}
       */
      events() {
        const e = {};
        const CN = CLASS_NAMES;
        e[`click .${CN.fillButton}`] = "handleFill";
        e[`click .${CN.copyButton}`] = "showCopyTo";
        e[`mouseover .${CN.menuItem} .${CN.remove}`] = "previewAttrRemove";
        e[`mouseout .${CN.menuItem} .${CN.remove}`] = "previewAttrRemove";
        e[`click .${CN.menuItem}`] = "handleMenuItemClick";
        e[`click .${CN.autofillButton}`] = "showAutofill";
        return e;
      },

      /**
       * Generates the HTML template for the EMLAttributesView.
       * @returns {DocumentFragment} The HTML template content for the
       * EMLAttributesView.
       */
      template() {
        const template = document.createElement("template");
        const CN = CLASS_NAMES;
        const BC = BOOTSTRAP_CLASS_NAMES;
        template.innerHTML = `
          <div class="${CN.menuContainer}">
            <div class="${CN.actionButtonsContainer}">
              <div class="${CN.copyButtonContainer}">
              </div>
              <a href="#" class="${BC.button} ${BC.buttonPrimary} ${CN.autofillButton}"><i class="${ICONS.magic} ${ICONS.onLeft}"></i>Auto-Fill...</a>
            </div>
            <ul class="${CN.menu} ${BC.sideNavItems}">
            </ul>
          </div>
          <div class="${CN.attributeList}"></div>
          <div class="${CN.autofillContainer}" style="display: none;"></div>`;
        return template.content;
      },

      /**
       * The HTML template for an attribute
       * @type {Function}
       * @param {object} attrs - The attributes to render in the template
       * @param {string} attrs.classes - Extra classes to add to the menu item
       * separated by spaces
       * @param {string} attrs.attrId - The if of the attribute
       * @param {string} attrs.attributeName - The name of the attribute
       * @param {string} attrs.attributeDescription - The description of the
       * attribute
       * @returns {HTMLElement} The HTML template for an attribute
       */
      menuItemTemplate(attrs) {
        const CN = CLASS_NAMES;
        const BC = BOOTSTRAP_CLASS_NAMES;
        const template = document.createElement("template");
        const extraClasses = attrs.classes ? ` ${attrs.classes}` : "";
        template.innerHTML = `
          <li class="${CN.menuItem} ${BC.sideNavItem} pointer ${extraClasses}" data-id="${attrs.attrId}">
            <a class="${CN.ellipsis}">
              <i class="${BC.icon} ${CN.iconOnLeft} ${CN.iconAdd} ${CN.add} ${BC.hidden}"></i>
              <span class="name">${attrs.attributeName}</span>
              <i class="${BC.icon} ${CN.iconRemove} ${CN.remove}"></i>
            </a>
          </li>`;
        return template.content.querySelector("li");
      },

      /**
       * Creates a new EMLAttributesView
       * @param {object} options - A literal object with options to pass to the
       * view
       * @param {EMLAttributes} options.collection - The collection of
       * EMLAttribute models to display
       * @param {EMLEntity} options.parentModel - The entity model to which
       * these attributes belong
       * @param {boolean} [options.isNew] - Set to true if this is a new
       * attribute
       */
      initialize(options = {}) {
        this.collection = options.collection || new EMLAttributes();
        this.parentModel = options.parentModel;

        // Prefix all the icons
        // TODO - fix all instances that were using CLASS_NAMES, use ICONS
        if (!Object.values(ICONS)[0].startsWith(ICON_PREFIX)) {
          Object.keys(ICONS).forEach((key) => {
            ICONS[key] = `${ICON_PREFIX}${ICONS[key]}`;
          });
        }
      },

      /**
       * Renders this view
       * @returns {EMLAttributesView} A reference to this view
       */
      render() {
        // Render the template
        this.el.innerHTML = "";
        this.el.append(this.template());

        // Select the items we will update
        const CN = CLASS_NAMES;
        this.els = {
          menu: this.el.querySelector(`.${CN.menu}`),
          fillButtonContainer: this.el.querySelector(
            `.${CN.fillButtonContainer}`,
          ),
          copyButtonContainer: this.el.querySelector(
            `.${CN.copyButtonContainer}`,
          ),
          list: this.el.querySelector(`.${CN.attributeList}`),
          autofill: this.el.querySelector(`.${CN.autofillContainer}`),
          autofillButton: this.el.querySelector(`.${CN.autofillButton}`),
        };

        this.renderAttributes();
        this.renderAutofill();

        return this;
      },

      /**
       * Create an attribute view & menu item for each attribute in the
       * collection, set up event listeners on the attributes, and set the first
       * attribute as active. Creates a new attribute for the user to fill out.
       * This function can be used to re-render the attributes.
       */
      renderAttributes() {
        // Reset elements and event listeners in case of a re-render
        this.stopListeningToAttributes();
        this.attrEls = {};
        this.els.list.innerHTML = "";
        this.els.menu.innerHTML = "";
        this.collection.each((attr) => {
          attr.set("isNew", false, { silent: true });
        });

        // Add a new attribute for editing if there isn't one already
        this.collection.addNewAttribute(this.parentModel);
        // Render Attribute views for each model
        this.collection.models.forEach(this.renderAttribute, this);

        // Show the first view, the others will be hidden
        if (this.collection.length > 1) {
          this.showAttribute(this.collection.at(0));
        }

        this.listenToAttributes();
      },

      /** Set up event listeners for the collection and its models */
      listenToAttributes() {
        this.listenTo(this.collection, "add", this.renderAttribute);
        this.listenTo(this.collection, "remove", this.removeAttribute);
        this.listenTo(this.collection, "sort", this.orderAttributeMenu);
        this.listenTo(this.collection, "namesUpdated", this.renderAttributes);
      },

      stopListeningToAttributes() {
        this.collection.models.forEach((attr) => {
          this.stopListening(attr);
        });
        this.stopListening(this.collection);
      },

      /**
       * Render an attribute
       * @param {EMLAttribute} attributeModel - The attribute model to render
       */
      renderAttribute(attributeModel) {
        if (!attributeModel) return;

        // Don't render the same attribute twice
        if (this.attrEls?.[attributeModel.cid]) return;
        const { menu, list } = this.els;

        const listItem = new EMLAttributeView({
          model: attributeModel,
          parentModel: this.parentModel,
        }).render();
        list.append(listItem.el);

        const menuItem = this.createMenuItem(attributeModel);
        menu.append(menuItem);

        // Track the list and menu item elements
        if (!this.attrEls) this.attrEls = {};
        this.attrEls[attributeModel.cid] = {
          listItem,
          menuItem,
        };

        // Make sure the new status is reflected
        this.displayNewStatus(attributeModel);

        // Always scroll to the bottom of the menu so that the add attribute
        // button is always visible
        menuItem.scrollIntoView();

        // Indicate in menu item if there's a validation error; keep name of
        // attribute in sync with the model
        this.stopListening(attributeModel);
        this.listenTo(attributeModel, "invalid", this.showAttributeValidation);
        this.listenTo(attributeModel, "valid", this.hideAttributeValidation);
        this.listenTo(attributeModel, "change:isNew", this.displayNewStatus);
        this.listenTo(
          attributeModel,
          "change:attributeName",
          (_model, value) => {
            this.updateMenuItemLabel(menuItem, value);
          },
        );

        // Hide the attribute when to start
        this.hideAttribute(attributeModel);
      },

      /**
       * Render the autofill view and save a reference to it
       * @returns {AutofillAttributesView} The autofill view
       */
      renderAutofill() {
        const autofillContainer = this.els.autofill;
        autofillContainer.innerHTML = "<div></div>";
        const el = autofillContainer.querySelector("div");
        this.autoFill = new AutofillAttributesView({
          el,
          collection: this.collection,
          parentModel: this.parentModel,
        }).render();
        return this.autoFill;
      },

      /**
       * Create a menu item for an attribute
       * @param {EMLAttribute} attributeModel - The attribute model
       * @returns {HTMLElement} The menu item element
       */
      createMenuItem(attributeModel) {
        if (!attributeModel) return null;
        const item = this.menuItemTemplate({
          attrId: attributeModel.cid,
          attributeName: attributeModel.get("attributeName") || "",
        });

        const removeIcon = item.querySelector(`.${CLASS_NAMES.iconRemove}`);

        $(removeIcon).popup(this.removeTooltipSettings);
        return item;
      },

      /**
       * Display the new status for an attribute
       * @param {EMLAttribute} attributeModel - The attribute model
       */
      displayNewStatus(attributeModel) {
        const isNew = attributeModel.get("isNew");
        const { menuItem } = this.attrEls[attributeModel.cid];
        if (isNew) {
          this.showAsNew(menuItem);
        } else {
          this.removeNewStatus(menuItem);
        }
      },

      /**
       * Show an attribute as new
       * @param {HTMLElement} menuItem - The menu item element
       */
      showAsNew(menuItem) {
        const CN = CLASS_NAMES;
        const BC = BOOTSTRAP_CLASS_NAMES;
        const menuEl = menuItem;
        menuEl.classList.add(CN.new);
        menuEl.querySelector(`.${CN.menuItemName}`).textContent =
          "Add Attribute";
        // Find the add icon and remove the hidden class
        menuEl.querySelector(`.${CN.add}`)?.classList.remove(BC.hidden);
      },

      /**
       * Remove the new status from an attribute
       * @param {HTMLElement} menuItem - The menu item element
       */
      removeNewStatus(menuItem) {
        menuItem.classList.remove("new");
        if (this.getMenuItemLabel(menuItem) === STRINGS.addAttribute) {
          this.updateMenuItemLabel(menuItem, STRINGS.newAttribute);
        }
        menuItem
          .querySelector(`.${CLASS_NAMES.add}`)
          .classList.add(BOOTSTRAP_CLASS_NAMES.hidden);

        // If the new status was removed, then we create a new attribute so the
        // user always has a blank attribute to fill out
        this.collection.addNewAttribute(this.parentModel);
      },

      /**
       * Handle the click event on a menu item
       * @param {Event} e - The click event
       */
      handleMenuItemClick(e) {
        // Check if the target is the remove icon, if so, remove the attribute
        if (e.target.classList.contains(CLASS_NAMES.iconRemove)) {
          this.handleRemove(e);
          return;
        }
        // Find the panel associated with the clicked menu item and show it
        const menuItem = e.currentTarget;
        const attrId = menuItem.getAttribute("data-id");
        this.hideAutofill();
        this.showAttribute(this.collection.get(attrId));
      },

      /**
       * Display the autofill view, hide the attributes.
       */
      showAutofill() {
        this.hideAllAttributes();
        this.renderAutofill();
        this.validatePreviousAttribute();
        // Hide the attribute list
        this.els.list.style.display = "none";
        // Show the autofill view
        this.els.autofill.style.display = "block";
        // Show auto-fill button as active
        this.els.autofillButton.classList.add(BOOTSTRAP_CLASS_NAMES.active);
      },

      /**
       * Hide the autofill view and show the attributes
       */
      hideAutofill() {
        if (this.autoFill) {
          this.autoFill.onClose();
          this.autoFill.remove();
          this.autoFill = null;
        }

        // Show the list again
        this.els.list.style.display = "block";
        // Hide the autofill view
        this.els.autofill.style.display = "none";
        // Remove active status from the autofill button
        this.els.autofillButton.classList.remove(BOOTSTRAP_CLASS_NAMES.active);
      },

      /**
       * Handle the remove event for an attribute
       * @param {Event} e - The click event
       */
      handleRemove(e) {
        const menuItem = e.currentTarget;
        const attrId = menuItem.getAttribute("data-id");
        this.collection.remove(attrId);
      },

      /**
       * Remove an attribute from the view
       * @param {EMLAttribute} attributeModel - The attribute model
       */
      removeAttribute(attributeModel) {
        const { listItem, menuItem } = this.attrEls[attributeModel.cid];

        // If the item is active, show the next item
        const menuItemActive = menuItem.classList.contains(
          BOOTSTRAP_CLASS_NAMES.active,
        );
        if (menuItemActive) {
          // Display the next model, the one before it, or the first model
          const index = this.collection.indexOf(attributeModel);
          const newIndex =
            index < this.collection.length - 1
              ? index + 1
              : Math.max(index - 1, 0);
          this.showAttribute(this.collection.at(newIndex));
        }
        listItem.remove();
        menuItem.remove();
        this.stopListening(attributeModel);
        delete this.attrEls[attributeModel.cid];
      },

      /**
       * Get the label of a menu item
       * @param {HTMLElement} menuItem - The menu item element
       * @returns {string} The label of the menu item
       */
      getMenuItemLabel(menuItem) {
        return menuItem.querySelector(`.${CLASS_NAMES.menuItemName}`)
          .textContent;
      },

      /**
       * Update the label of a menu item
       * @param {HTMLElement} menuItem - The menu item element
       * @param {string} text - The new label text
       */
      updateMenuItemLabel(menuItem, text) {
        const menuEl = menuItem;
        menuEl.querySelector(`.${CLASS_NAMES.menuItemName}`).textContent = text;
      },

      /**
       * Show an attribute
       * @param {EMLAttribute} attributeModel - The attribute model
       */
      showAttribute(attributeModel) {
        this.hideAllAttributes();
        const { listItem, menuItem } = this.attrEls[attributeModel.cid];
        listItem.show();
        menuItem.classList.add(BOOTSTRAP_CLASS_NAMES.active);
        listItem.postRender();
        listItem.el.scrollIntoView();

        if (attributeModel.get("isNew")) {
          attributeModel.set("isNew", false);
        }

        this.validatePreviousAttribute();
      },

      /** Validate the previous attribute */
      validatePreviousAttribute() {
        // find the active attribute listItem
        const activeAttrTab = this.el.querySelector(
          `.${BOOTSTRAP_CLASS_NAMES.active}.${CLASS_NAMES.menuItem}`,
        );
        const activeID = activeAttrTab?.getAttribute("data-id");
        // get the model associated with the active attribute
        if (activeID) {
          const activeModel = this.collection.get(activeID);
          // validate the model
          activeModel?.validate();
        }
      },

      /**
       * Show the attribute validation errors in the attribute navigation menu
       * @param {EMLAttribute} attributeModel - The attribute model
       */
      showAttributeValidation(attributeModel) {
        const attrEl = this.attrEls[attributeModel.cid];
        const menuLink = attrEl.menuItem.querySelector("a");
        if (menuLink.classList.contains("error")) return;
        attrEl.errorIcon = document.createElement("i");
        attrEl.errorIcon.classList.add(
          BOOTSTRAP_CLASS_NAMES.icon,
          CLASS_NAMES.iconError,
          CLASS_NAMES.error,
          CLASS_NAMES.iconOnLeft,
        );

        menuLink.classList.add(CLASS_NAMES.error);
        menuLink.prepend(attrEl.errorIcon);
      },

      /**
       * Hide the attribute validation errors from the attribute navigation menu
       * @param {EMLAttribute} attributeModel - The attribute model
       */
      hideAttributeValidation(attributeModel) {
        const attrEl = this.attrEls[attributeModel.cid];
        const menuLink = attrEl.menuItem.querySelector("a");
        menuLink.classList.remove("error");
        if (attrEl.errorIcon) {
          attrEl.errorIcon.remove();
          attrEl.errorIcon = null;
        }
      },

      /**
       * Hide an attribute
       * @param {EMLAttribute} attributeModel - The attribute model
       */
      hideAttribute(attributeModel) {
        if (!this.attrEls?.[attributeModel?.cid]) return;
        const { listItem, menuItem } = this.attrEls[attributeModel.cid];
        listItem.hide();
        menuItem.classList.remove(BOOTSTRAP_CLASS_NAMES.active);
      },

      /**  Hide all attribute views */
      hideAllAttributes() {
        this.collection.models.forEach(this.hideAttribute, this);
      },

      /**
       * Show the user what will be removed when this remove button is clicked
       * @param {Event} e - The click event
       */
      previewAttrRemove(e) {
        const removeBtn = e.target;
        removeBtn
          .closest(`.${CLASS_NAMES.menuItem}`)
          .classList.toggle(CLASS_NAMES.previewRemove);
      },

      /** Re-order the menu items to match the order of the collection */
      orderAttributeMenu() {
        const menuItems = this.els.menu.querySelectorAll(
          `.${CLASS_NAMES.menuItem}`,
        );
        const menuItemsArray = Array.from(menuItems);
        this.collection.each((model) => {
          const menuItem = menuItemsArray.find(
            (item) => item.getAttribute("data-id") === model.cid,
          );
          if (menuItem) {
            this.els.menu.appendChild(menuItem);
          }
        });
      },

      // TODO: Do we need this?
      onClose() {
        // Remove all event listeners
        this.stopListeningToAttributes();
        // Remove empty attribute models
        this.collection.removeEmptyAttributes();
        // Remove the autofill view
        if (this.autoFill) {
          this.autoFill.onClose();
          this.autoFill.remove();
          this.autoFill = null;
        }
      },
    },
  );

  return EMLAttributesView;
});
