'use strict';

define([], () => {
  /**
  * @class ExpansionPanelsModel
  * @classdesc ExpansionPanelsModel maintains state for multiple
  * ExpansionPanelView instances so that only one is open at a time.
  * @classcategory Models/Maps
  */
  const ExpansionPanelsModel = Backbone.Model.extend(
    /** @lends ExpansionPanelsModel.prototype */{
      /**
       * @name ExpansionPanelsModel#defaults
       * @type {Object}
       * @property {ExpansionPanelView[]} panels The expansion panel views that
       * are meant to have only a single panel open at a time.
       * @property {boolean} isMulti Whether multiple panels can be open at the
       * same time when displayed in a group of panels. 
       * @extends Backbone.Model 
       */
      defaults() {
        return {
          panels: [],
          isMulti: false,
        }
      },

      /**
       * Register a panel to coordinate collapse state.
       * @property {ExpansionPanelView} panel The expansion panel view to be 
       * tracked.
       */
      register(panel) {
        this.set('panels', [...this.get('panels'), panel]);
      },

      /**
       * Collapse all panels except for the newly opened panel for certain open
       * modes.
       * @property {ExpansionPanelView} openedPanel The expansion panel view that 
       * should remain open.
       */
      collapseOthers(openedPanel) {
        const isSingleOpenMode = !this.get('isMulti');
        for (const panel of this.get('panels')) {
          if (isSingleOpenMode && panel !== openedPanel) {
            panel.collapse();
          }
        }
      }
    });

  return ExpansionPanelsModel;
});