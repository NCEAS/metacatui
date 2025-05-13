define([
  "backbone",
  "jquery",
  "semantic",
  "models/metadata/eml211/EMLAttributeList",
  "views/metadata/EMLAttributeView",
  "views/metadata/AutofillAttributesView",
], (
  Backbone,
  $,
  Semantic,
  EMLAttributeList,
  EMLAttributeView,
  AutofillAttributesView,
) => {
  /**
   * @class EMLAttributesView
   * @classdesc An EMLAttributesView displays the info about all attributes in
   * an EML document or the references. It can be used to edit attributes and to
   * autofill from other entities or from a CSV file.
   * @classcategory Views/Metadata
   * @screenshot views/metadata/EMLAttributesView.png
   * @augments Backbone.View
   */

  const STRINGS = {
    addAttribute: "Add Attribute",
    newAttribute: "New Attribute",
    linkedAttributes: "Linked Attributes",
  };

  const CLASS_NAMES = {
    menuContainer: "attribute-menu-container",
    actionButtonsContainer: "action-buttons",
    attributeList: "attribute-list",
    menu: "attribute-menu",
    menuItem: "attribute-menu-item",
    menuItemName: "name",
    ellipsis: "ellipsis",
    new: "new",
    add: "add",
    error: "error",
    remove: "remove",
    previewRemove: "remove-preview",
    autofillButton: "autofill-button",
    autofillContainer: "autofill-attributes",
    addAttributeButton: "add-attribute-button",
    referencesPanel: "references-panel",
    editReferencesButton: "edit-references-button",
    editReferencesButtonContainer: "right-aligned-flex-container",
    buttonHelpText: "button-help-text",
  };

  // Classes from bootstrap that are used in the view
  const BOOTSTRAP_CLASS_NAMES = {
    sideNavItems: "side-nav-items",
    sideNavItem: "side-nav-item",
    pointer: "pointer",
    icon: "icon",
    hidden: "hidden",
    active: "active",
    button: "btn",
    buttonPrimary: "btn-primary",
    info: "alert-info",
    badge: "label",
    well: "well",
  };

  // Fontawesome icon names used in the view
  const ICONS = {
    edit: "pencil",
    warning: "warning-sign",
    remove: "remove",
    add: "plus",
    magic: "magic",
    error: "exclamation-sign",
    onLeft: "on-left",
    processing: "time",
    success: "ok",
    link: "link",
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
        e[`mouseover .${CN.menuItem} .${CN.remove}`] = "previewAttrRemove";
        e[`mouseout .${CN.menuItem} .${CN.remove}`] = "previewAttrRemove";
        e[`click .${CN.menuItem}`] = "handleMenuItemClick";
        e[`click .${CN.autofillButton}`] = "showAutofill";
        e[`click .${CN.editReferencesButton}`] = "switchToSourceEntity";
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
              <a href="#" class="${BC.button} ${BC.buttonPrimary} ${CN.autofillButton}"><i class="${ICONS.magic} ${ICONS.onLeft}"></i>Auto-Fill...</a>
            </div>
            <ul class="${CN.menu} ${BC.sideNavItems}"></ul>
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
              <span class="name">${attrs.attributeName}</span>
              <i class="${BC.icon} ${ICONS.remove} ${CN.remove}"></i>
            </a>
          </li>`;
        return template.content.querySelector("li");
      },

      /**
       * Creates a template for the references panel
       * @param {string} sourceTitle - The title of the source entity
       * @param {string[]} sourceAttrNames - The names of the attributes in the
       * source entity
       * @returns {HTMLElement} The references panel element
       */
      referencesTemplate(sourceTitle, sourceAttrNames) {
        const attrList = sourceAttrNames
          .map((name) => {
            const span = document.createElement("span");
            span.classList.add(BOOTSTRAP_CLASS_NAMES.badge, "label-info");
            span.textContent = name;
            return span.outerHTML;
          })
          .join(", ");
        const CN = CLASS_NAMES;
        const BC = BOOTSTRAP_CLASS_NAMES;
        const template = document.createElement("template");
        template.innerHTML = `
          <div class="${CN.referencesPanel}">
            <h3>
              <i class="${BC.icon} ${ICONS.link} ${ICONS.onLeft}"></i>${STRINGS.linkedAttributes}
            </h3>
            <div class="${BC.well} ${CN.references}">
              <p>
                This attribute list is a <b>linked copy</b> of defined in the
                <a class="label label-info">${sourceTitle}</a> entity. 
                Any updates made to the source entity will automatically be reflected here.
              </p>
              <p>The attributes in that entity are: <b>${attrList}</b>.</p>
              <p>To make changes, please edit the source entity directly.</p>
            </div>
            <div class="${CN.editReferencesButtonContainer}">
                <a class="${BC.button} ${BC.buttonPrimary} ${CN.editReferencesButton}">
                  <i class="${BC.icon} ${ICONS.edit} ${ICONS.onLeft}"></i> Edit Attributes in Source Entity
                </a>
                <div class="${CN.buttonHelpText}">You will be re-directed to '${sourceTitle}'</div>
            </div>
          </div>`;

        return template.content.querySelector("div");
      },

      /**
       * Creates a new EMLAttributesView
       * @param {object} options - A literal object with options to pass to the
       * view
       * @param {EMLAttributes} options.collection - The collection of
       * EMLAttribute models to display
       * @param {References} [options.references] - The reference element to
       * display instead of the collection. Will be ignored if collection is
       * provided.
       * @param {EMLEntity} options.parentModel - The entity model to which
       * these attributes belong
       * @param {boolean} [options.isNew] - Set to true if this is a new
       * attribute
       */
      initialize(options = {}) {
        this.model = options.model || new EMLAttributeList();
        this.parentModel = options.parentModel;
        this.parentView = options.parentView;

        // Prefix all the icons
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
          list: this.el.querySelector(`.${CN.attributeList}`),
          autofill: this.el.querySelector(`.${CN.autofillContainer}`),
          autofillButton: this.el.querySelector(`.${CN.autofillButton}`),
        };

        this.renderReferencesOrAttributes();
        this.renderAutofill();

        return this;
      },

      /**
       * Check if the attrList has references or attributes (since both are not
       * allowed), and render the appropriate UI.
       */
      renderReferencesOrAttributes() {
        if (this.model.hasReferences()) {
          this.references = this.model.get("references");
          this.renderReferences();
        } else {
          this.collection = this.model.get("emlAttributes");
          this.renderAttributes();
        }
      },

      /**
       * Renders the references button and panel
       * @returns {HTMLElement|null} The references button element or null if
       * the references' linked model can't be found
       */
      renderReferences() {
        const { list, menu } = this.els;
        const BC = BOOTSTRAP_CLASS_NAMES;

        const item = this.menuItemTemplate({
          attrId: "references",
          attributeName: `<i class="${BC.icon} ${ICONS.link} ${ICONS.onLeft}"></i>${STRINGS.linkedAttributes}`,
        });
        const removeIcon = item.querySelector(`.${ICONS.remove}`);
        removeIcon.remove();

        menu.appendChild(item);
        this.els.referencesButton = item;

        const sourceAttrs = this.references.getLinkedModel();

        if (!sourceAttrs) return null; // TODO: display error?

        const sourceEntity = sourceAttrs?.get("parentModel");
        const sourceTitle = sourceEntity?.get("entityName");
        const sourceAttrNames = sourceAttrs
          .get("emlAttributes")
          .pluck("attributeName");

        // TODO: Add tooltips w/ description of the attributes. Make clickable.

        const refEl = this.referencesTemplate(sourceTitle, sourceAttrNames);
        list.append(refEl);

        const editButton = refEl.querySelector(
          `.${CLASS_NAMES.editReferencesButton}`,
        );
        // TODO: add an unlink button.

        this.els.editReferencesButton = editButton;
        this.els.referencesButton = item;

        this.els.referencesPanel = refEl;
        this.showReferences(); // activate the button

        return refEl;
      },

      /**
       * Close the modal containing this view and open the modal for a different
       * entity in the same entities collection. Requires that the parent
       * EMLEntityView is on this view.
       */
      switchToSourceEntity() {
        const sourceEntity = this.references
          .getLinkedModel()
          ?.get("parentModel");
        if (sourceEntity) {
          this.parentView?.switchToOtherEntityView(sourceEntity);
        }
      },

      /** Show the references panel and hide everything else */
      showReferences() {
        this.hideEverything();
        const { referencesPanel, referencesButton } = this.els;
        if (!referencesPanel || !referencesButton) return;
        referencesPanel.classList.remove(BOOTSTRAP_CLASS_NAMES.hidden);
        referencesButton.classList.add(BOOTSTRAP_CLASS_NAMES.active);
        referencesPanel.scrollIntoView();
      },

      /** Hide the references panel */
      hideReferences() {
        const { referencesPanel, referencesButton } = this.els;
        if (referencesPanel)
          referencesPanel.classList.add(BOOTSTRAP_CLASS_NAMES.hidden);
        if (referencesButton)
          referencesButton.classList.remove(BOOTSTRAP_CLASS_NAMES.active);
      },

      /**
       * Create an attribute view & menu item for each attribute in the
       * collection, set up event listeners on the attributes, and set the first
       * attribute as active. Creates a new attribute for the user to fill out.
       * This function can be used to re-render the attributes.
       */
      renderAttributes() {
        if (!this.collection) return;
        // Reset elements and event listeners in case of a re-render
        this.stopListeningToAttributesCollection();
        this.attrEls = {};
        this.els.list.innerHTML = "";
        this.els.menu.innerHTML = "";
        this.collection.each((attr) => {
          attr.set("isNew", false, { silent: true });
          // Render Attribute views for each model
          this.renderAttribute(attr);
        });

        // Show the first view, the others will be hidden
        if (this.collection.length > 1) {
          this.showAttribute(this.collection.at(0));
        }

        this.listenToAttributesCollection();

        // Render the new attribute button here because it is part of the menu
        this.renderNewAttributeButton();
      },

      /**
       * Adds a list item that appears like a button that always remains at the
       * bottom of the menu. This button is used to add a new attribute.
       * @returns {HTMLElement} The button element
       * @since 0.0.0
       */
      renderNewAttributeButton() {
        if (this.els.addAttributeButton) {
          this.els.addAttributeButton.remove();
          this.els.addAttributeButton = null;
        }
        const CN = CLASS_NAMES;
        const BC = BOOTSTRAP_CLASS_NAMES;
        const button = this.menuItemTemplate({
          attrId: "add-attribute-button",
          attributeName: STRINGS.addAttribute,
          classes: `${CN.addAttributeButton} ${CN.new}`,
        });
        // Add an add icon to the button Prepend it within the <a> tag
        const iconHtml = document.createElement("i");
        iconHtml.classList.add(BC.icon, ICONS.onLeft, ICONS.add, CN.add);
        const buttonLink = button.querySelector(`.${CN.ellipsis}`);
        buttonLink.prepend(iconHtml);

        // Find the remove icon and remove it
        const removeIcon = button.querySelector(`.${CN.remove}`);
        removeIcon?.remove();
        this.els.menu.appendChild(button);

        this.els.addAttributeButton = button;
        return button;
      },

      /**
       * Adds a blank attribute to the end of the collection for the user to
       * fill out.
       */
      addNewAttribute() {
        this.listenToOnce(this.collection, "add", (model) => {
          const { menuItem } = this.attrEls[model.cid];
          this.updateMenuItemLabel(menuItem, STRINGS.newAttribute);
          this.showAttribute(model);
        });
        this.collection.addNewAttribute(this.parentModel, true);
      },

      /** Set up event listeners for the collection and its models */
      listenToAttributesCollection() {
        if (this.collection) {
          this.listenTo(this.collection, "add", this.renderAttribute);
          this.listenTo(this.collection, "remove", this.removeAttribute);
          this.listenTo(this.collection, "sort", this.orderAttributeMenu);
          this.listenTo(this.collection, "namesUpdated", this.renderAttributes);
        }
      },

      /** Stop listening to the attributes collection */
      stopListeningToAttributesCollection() {
        if (this.collection) {
          this.stopListening(this.collection);
        }
        this.stopListening(this.model.get("emlAttributes"));
      },

      /**
       * Sets up listeners for the specified attribute model to handle various
       * events. Updates the UI and triggers appropriate actions when the
       * model's state changes.
       * @param {Backbone.Model} attributeModel - The attribute model to listen
       * to.
       */
      listenToAttributeModel(attributeModel) {
        const { menuItem } = this.attrEls[attributeModel.cid];
        this.listenTo(attributeModel, "invalid", this.showAttributeValidation);
        this.listenTo(attributeModel, "valid", this.hideAttributeValidation);
        this.listenTo(
          attributeModel,
          "change:attributeName",
          (_model, value) => {
            this.updateMenuItemLabel(menuItem, value);
          },
        );
      },

      /**
       * Stops listening to events from the specified attribute model.
       * @param {Backbone.Model} attributeModel - The attribute model to stop
       * listening to.
       */
      stopListeningToAttributeModel(attributeModel) {
        this.stopListening(attributeModel);
      },

      /**
       * Initializes event listeners for all attribute models in the collection
       * and the attributes collection itself.
       */
      startAllListeners() {
        this.collection?.models.forEach((attr) => {
          this.listenToAttributeModel(attr);
        });
        this.listenToAttributesCollection();
        this.listenTo(
          this.model,
          "change:references",
          this.renderReferencesOrAttributes,
        );
      },

      /**
       * Stops all event listeners associated with the attribute models in the
       * collection and the attributes collection itself.
       */
      stopAllListeners() {
        this.collection?.models.forEach((attr) => {
          this.stopListeningToAttributeModel(attr);
        });
        this.stopListeningToAttributesCollection();
        this.stopListening(this.model, "change:references");
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

        // Always scroll to the bottom of the menu so that the add attribute
        // button is always visible
        menuItem.scrollIntoView();

        // Indicate in menu item if there's a validation error; keep name of
        // attribute in sync with the model
        this.stopListeningToAttributeModel(attributeModel);
        this.listenToAttributeModel(attributeModel);

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
          model: this.model,
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
        const removeIcon = item.querySelector(`.${ICONS.remove}`);
        $(removeIcon).popup(this.removeTooltipSettings);
        return item;
      },

      /**
       * Handle the click event on a menu item
       * @param {Event} e - The click event
       */
      handleMenuItemClick(e) {
        // Check if the target is the remove icon, if so, remove the attribute
        if (e.target.classList.contains(ICONS.remove)) {
          this.handleRemove(e);
          return;
        }
        // Find the panel associated with the clicked menu item and show it
        const menuItem = e.currentTarget;
        const attrId = menuItem.getAttribute("data-id");
        this.hideEverything();

        // The target would be the icon, link, etc. The item clicked would be
        // the parent li.
        const parentLi = e.target.closest(`.${CLASS_NAMES.menuItem}`);
        // If the target is the references menu item, show the references
        if (parentLi === this.els.referencesButton) {
          this.showReferences();
          return;
        }
        // If the clicked item is the add attribute button, add a new attribute
        if (parentLi === this.els.addAttributeButton) {
          this.addNewAttribute();
          return;
        }

        // Otherwise it's an attribute menu item, so show the attribute
        this.showAttribute(this.collection.get(attrId));
      },

      /**
       * Display the autofill view, hide the attributes.
       */
      showAutofill() {
        this.hideEverything();
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
        this.removeAutofill();
        // Show the list again
        this.els.list.style.display = "block";
        // Hide the autofill view
        this.els.autofill.style.display = "none";
        // Remove active status from the autofill button
        this.els.autofillButton.classList.remove(BOOTSTRAP_CLASS_NAMES.active);
      },

      /** Remove the autofill view */
      removeAutofill() {
        if (this.autoFill) {
          this.autoFill.onClose();
          this.autoFill.remove();
          this.autoFill = null;
        }
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
          const attrToShow = this.collection.at(newIndex);
          if (attrToShow) {
            this.showAttribute(attrToShow);
          } else {
            this.hideAllAttributes();
          }
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
        // If this attribute list is references instead of attributes, there's
        // nothing to validate
        if (!this.collection) return;
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
        const menuLink = attrEl?.menuItem.querySelector("a");
        if (menuLink?.classList.contains("error")) return;
        if (!attrEl) return;
        attrEl.errorIcon = document.createElement("i");
        attrEl.errorIcon.classList.add(
          BOOTSTRAP_CLASS_NAMES.icon,
          ICONS.error,
          CLASS_NAMES.error,
          ICONS.onLeft,
        );

        menuLink?.classList.add(CLASS_NAMES.error);
        menuLink.prepend(attrEl.errorIcon);
      },

      /**
       * Hide the attribute validation errors from the attribute navigation menu
       * @param {EMLAttribute} attributeModel - The attribute model
       */
      hideAttributeValidation(attributeModel) {
        if (!attributeModel) return;
        if (!this.attrEls?.[attributeModel.cid]) return;
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

      /** Hide all attribute views */
      hideAllAttributes() {
        this.collection?.models.forEach(this.hideAttribute, this);
      },

      /** Hide the attributes, autofill view, and references panel */
      hideEverything() {
        this.hideAllAttributes();
        this.hideAutofill();
        this.hideReferences();
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
        // Finally ensure that the add attribute button is at the end
        this.els.menu.appendChild(this.els.addAttributeButton);
      },

      /** Actions to perform when the view is removed */
      onClose() {
        // Remove empty attribute models
        this.collection?.removeEmptyAttributes();
        this.stopAllListeners();
        this.removeAutofill();
        // Destroy all popups
        const popups = this.el.querySelectorAll(`.${CLASS_NAMES.menuItem}`);
        popups.forEach((popup) => {
          $(popup).popup("destroy");
        });
      },
    },
  );

  return EMLAttributesView;
});
