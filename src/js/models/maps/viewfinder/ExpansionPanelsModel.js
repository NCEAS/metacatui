'use strict';

define([], () => {
  /**
  * @class ExpansionPanelsModel
  * @classdes ExpansionPanelsModel maintains state for multiple
  * ExpansionPanelView instances so that only one is open at a time.
  * @classcategory Models/Maps
  */
  const ExpansionPanelsModel = Backbone.Model.extend({
    /**
     * @name ExpansionPanelsModel#defaults
     * @type {Object}
     * @property {ExpansionPanelView[]} panels The expansion panel views that
     * are meant to have only a single panel open at a time.
     */
    defaults() {
      return {
        panels: [],
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
     * Collapse all panels except for the newly opened panel.
     * @property {ExpansionPanelView} openedPanel The expansion panel view that 
     * should remain open.
     */
    collapseOthers(openedPanel) {
      for (const panel of this.get('panels')) {
        if (panel !== openedPanel) {
          panel.collapse();
        }
      }
    }
  });

  return ExpansionPanelsModel;
});