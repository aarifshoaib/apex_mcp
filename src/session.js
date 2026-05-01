/**
 * Import session state — tracks all components built during
 * apex_create_app → apex_finalize_app lifecycle.
 */

class ImportSession {
  constructor() {
    this.reset();
  }

  reset() {
    this.appId        = null;
    this.appName      = null;
    this.workspaceId  = null;
    this.importBegun  = false;
    this.importEnded  = false;

    this.pages        = {};   // { pageId: PageInfo }
    this.regions      = {};   // { regionId: RegionInfo }
    this.items        = {};   // { itemName: ItemInfo }
    this.lovs         = {};   // { lovName: LovInfo }
    this.authSchemes  = {};   // { schemeName: AuthSchemeInfo }
    this.navItems     = [];
    this.appItems     = [];
    this.appProcesses = [];
    this.buttons      = {};   // { 'pageId:buttonName': buttonId }
    this.dynamicActions = {};
    this.charts       = {};
    this.processes    = {};
    this.branches     = {};
    this._created     = [];   // rollback log
  }

  trackComponent(type, id) {
    this._created.push({ type, id });
  }

  popRollbackLog() {
    const log = [...this._created];
    this._created = [];
    return log;
  }

  summary() {
    return {
      appId:          this.appId,
      appName:        this.appName,
      importBegun:    this.importBegun,
      importEnded:    this.importEnded,
      pages:          Object.keys(this.pages).length,
      regions:        Object.keys(this.regions).length,
      items:          Object.keys(this.items).length,
      lovs:           Object.keys(this.lovs).length,
      authSchemes:    Object.keys(this.authSchemes).length,
      navItems:       this.navItems.length,
      appItems:       this.appItems.length,
      appProcesses:   this.appProcesses.length,
      dynamicActions: Object.keys(this.dynamicActions).length,
      charts:         Object.keys(this.charts).length,
      processes:      Object.keys(this.processes).length,
      branches:       Object.keys(this.branches).length,
      trackedComponents: this._created.length,
      pageList: Object.values(this.pages).map(p => ({
        pageId: p.pageId, name: p.pageName, type: p.pageType,
      })),
    };
  }
}

export const session = new ImportSession();
