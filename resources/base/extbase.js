/**
* ExtBase
* Nico Pr
* https://nicopr.fr/chromextensions
*/

const DEBUG = true; // true = verbose, false = be quiet + removes every line "if(DEBUG) trace || console.log" while compiling with closure

const _which = (typeof chrome === "undefined") ? (typeof browser === "undefined") ? null : browser : chrome;
const _name = (typeof chrome === "undefined") ? (typeof browser === "undefined") ? "" : "firefox" : "chrome";

/**
* @nocollapse
*/
class ExtensionScript { // don't touch or call
	
	/**
	* @constructor
	*/
	constructor() {
		
	}
	
	static setUp() {
		
	}
	
	static initialize() {
		trace(where() + " script initializing");
		this.setUp();
	}
	
	/**
	* @method store: store key/value pair in local storage
	* @param {string} key: 
	* @param value: 
	*/
	static store(key, value) {
		return new Promise((resolve, reject) => _which.storage.local.set({[key]: value}, () => _which.runtime.lastError ? reject(Error(_which.runtime.lastError.message)) : resolve()));
	}
	
	/**
	* @method restore: fetch key/value pair from local storage
	* @param keys: string or array of srings
	*/
	static restore(keys) {
		if(!(keys instanceof Array)) keys = [keys];
		return new Promise((resolve, reject) => _which.storage.local.get(keys, result => _which.runtime.lastError ? reject(Error(_which.runtime.lastError.message)) : resolve(result)));
	}
	
	/**
	* @method remove: delete key/value pair from local storage
	* @param keys: string or array of srings
	*/
	static remove(keys) {
		if(!(keys instanceof Array)) keys = [keys];
		return new Promise((resolve, reject) => _which.storage.local.remove(keys, result => _which.runtime.lastError ? reject(Error(_which.runtime.lastError.message)) : resolve()));
	}
	
	/**
	* @method clear: clear local storage
	*/
	static clear() {
		return new Promise((resolve, reject) => _which.storage.local.clear(() => _which.runtime.lastError ? reject(Error(_which.runtime.lastError.message)) : resolve()));
	}
	
}

/**
* @nocollapse
* @extends {ExtensionScript}
*/
class ExtensionBackgroundScript extends ExtensionScript {
			
	/**
	* @constructor
	*/
	constructor() {
		super(); // useless, for closure compiler
	}
	
	static initialize() {
		super.initialize();
		
		this.installHandler = this.onInstall.bind(this);
		_which.runtime.onInstalled.addListener(this.installHandler);
		
		this.startupHandler = this.onStartup.bind(this);
		_which.runtime.onStartup.addListener(this.startupHandler);
		
		this.closeTabHandler = this.onCloseTab.bind(this);
		_which.tabs.onRemoved.addListener(this.closeTabHandler);
		
		this.tabUpdateHandler = this.onTabUpdate.bind(this);
		_which.tabs.onUpdated.addListener(this.tabUpdateHandler);
		
		this.tabs = new Map();
		
		this.comm = new BackgroundPort(this.onCommConnect.bind(this), this.onPortDisconnect.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this));
		//this.comm = new BackgroundMessage(this.onCommConnect.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this));
		
		this.initialized();
	}
	
	/**
	* @public
	* @method initialized: callback, script is ready
	*/
	static initialized() {
		if(DEBUG) trace(this.name, "initialized");
	}
	
	/**
	* @method onCommConnect:
	* @param {Object} infos:
	*/
	static onCommConnect(infos) {
		switch(infos["name"]) {
			
			case "content":
				this.register(infos["tab"]);
				break;
				
			case "web":
			
				break;
				
			case "popup":
				// TODO : if COMM_MESSAGE setInterval check getViews for popup close event // trace(chrome.extension.getViews({"type": "popup"}));
				this.onOpenPopup();
				break;
				
		}
	}
	
	/**
	* @method onPortDisconnect: port disconnected
	* @param infos: 
	*/
	static onPortDisconnect(infos) {
		
		switch(infos["name"]) {
			
			case "content":
				break;
				
			case "popup":
				this.onClosePopup();
				break;
				
			case "web":
				break;
				
			default:
				break;
			
		}
		
	}
	
	/**
	* @method onTabUpdate: tab is updated
	* @param {number} tabid: 
	* @param info: 
	* @param tab:
	*/
	static onTabUpdate(tabid, info, tab) {
		if(this.tabs.has(tabid)) { // handled tabs only
			this.comm.toContent(tabid, "update", info, die);
			this.onUpdateTab(tabid, info);
		}
	}
	
	static onUpdateTab(tabid, info) {
		
	}
	
	/**
	* @public
	* dispatched on install && reload ext
	*/
	static onInstall() {
		trace("installed");
	}
	
	/**
	* @public
	* dispatched on browser startup
	*/
	static onStartup() {
		trace("startup");
	}
	
	/**
	* @public
	* @method register: register new tab
	* @param {number} tabid: 
	*/
	static register(tabid) {
		if(DEBUG) trace("register tab", tabid);
		this.tabs.set(tabid, {});
	}
	
	/**
	* @public
	* @method unregister: unregister tab
	* @param {number} tabid: 
	*/
	static unregister(tabid) {
		if(DEBUG) trace("unregister tab", tabid);
		this.tabs.delete(tabid);
	}
	
	/**
	* @public
	* @method onCloseTab: handled tab closed
	* @param {number} tabid: 
	* @param info: 
	*/
	static onCloseTab(tabid, info) {
		if(this.tabs.has(tabid)) {
			if(DEBUG) trace("close tab", tabid, info);
			this.unregister(tabid);
		}
	}
	
	static async onOpenPopup() {
		this.tabs.forEach((tab, tabid) => this.comm.toContent(tabid, "open", {}, die));
		this.comm.toPopup("tabs", {"tabs": Array.from(this.tabs.keys()), "active": await this.activeTab()}, die);
	}
	
	static onClosePopup() {
		this.tabs.forEach((tab, tabid) => this.comm.toContent(tabid, "close", {}));
	}
	
	/**
	* @method fromContentMiddleWare: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromContentMiddleWare(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message, "tab", tabid);
		
		switch(type) {
			
			case "trace":
				trace.apply(null, message["params"]);
				return false;
				break;
				
		}
		
		return this.fromContent(tabid, type, message, callback)
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}
	
	/**
	* @method fromWeb: message from web page
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
	}
	
	/**
	* @method fromPopup: message from popup
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromPopup(type, message, callback) {
		//if(DEBUG) trace(type, "from popup :", message);
	}
	
	// TOOLBOX
	
	/**
	* @public
	* @method activeTab: fetch active chrome tab
	*/
	static tab(tabId) {
		return new Promise((resolve, reject) => _which.tabs.get(tabId, tab => resolve(tab)));
	}
	
	/**
	* @public
	* @method activeTab: fetch active chrome tab
	*/
	static activeTab() {
		return new Promise((resolve, reject) => _which.tabs.query({"active": true, "currentWindow": true}, tabs => resolve(tabs[0])));
	}
	
	static updateTab(tabid, updateInfos) {
		return new Promise((resolve, reject) => _which.tabs.update(tabid, updateInfos, tab => resolve(tab)));
	}
	
	static createWindow(url, x, y, width, height) {
		return new Promise((resolve, reject) => _which.windows.create({
			"url": url,
			"left": x,
			"top": y,
			"width": width,
			"height": height,
			//"focused": true,
			"incognito": false,
			"type": "popup", // "normal", "popup"
			"state": "normal", // "normal", "minimized", "maximized", "fullscreen"
			"setSelfAsOpener": false
		}, window => resolve(window)));
	}
	
	static updateWindow(windowId, updateInfo) {
		return new Promise((resolve, reject) => _which.windows.update(windowId, updateInfos, window => resolve(window)));
	}
	
	static closeWindow(windowId) {
		return new Promise((resolve, reject) => _which.windows.remove(windowId, () => resolve()));
	}
	
	static allWindows() {
		return new Promise((resolve, reject) => _which.windows.getAll({"populate": true, "windowTypes": ["popup"]}, windows => resolve(windows)));
	}
	
	static createTab(url) {
		return new Promise((resolve, reject) => _which.tabs.create({ url: url }, tab => resolve(tab)));
	}
	
	static setBadgeText(text) {
		return new Promise((resolve, reject) => _which.browserAction.setBadgeText({"text": text}, () => resolve()));
	}
	
	static setBadgeColor(color) {
		return new Promise((resolve, reject) => _which.browserAction.setBadgeBackgroundColor({"color": color}, () => resolve()));
	}
	
	/**
	* @method muteTab: mute tab
	* @param {number} tabid: tab id
	*/
	static muteTab(tabid) {
		return this.updateTab(tabid, {"muted": true});
	}
	
	/**
	* @method unmuteTab: unmute tab
	* @param {number} tabid: tab id
	*/
	static unmuteTab(tabid) {
		return this.updateTab(tabid, {"muted": false});
	}
	
	static reloadTab(tabid) {
		return new Promise((resolve, reject) => _which.tabs.reload(tabid, {"bypassCache": false}, () => resolve()));
	}
	
	/**
	* @public
	* @method exec: UNSAFE execute code in page
	* @param {number} tabid: 
	* @param code: 
	*/
	static exec(tabid, code) {
		return new Promise((resolve, reject) => _which.tabs.executeScript(tabid, {"code": code}, result => resolve(result)));
	}
	
	static close(tabid) {
		return new Promise((resolve, reject) => _which.tabs.remove(tabid, result => resolve(result)));
	}
	
	static download(options) {
		return new Promise((resolve, reject) => _which.downloads.download(options, result => resolve(result)));
	}
}

/**
* @nocollapse
* @extends {ExtensionScript}
*/
class ExtensionContentScript extends ExtensionScript {
			
	/**
	* @constructor
	*/
	constructor() {
		super(); // useless, for closure compiler
	}
	
	static initialize() {
		super.initialize();
		
		if(!defined(this.injectWeb)) this.injectWeb = true;
		
		this.tabid = 0;
		
		
		this.comm = new ContentPort(this.commConnected.bind(this), this.fromBackgroundMiddleware.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this), this.onHandle.bind(this));
		//this.comm = new ContentMessage(this.commConnected.bind(this), this.fromBackgroundMiddleware.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this), this.onHandle.bind(this));
	}
	
	/**
	* @method commConnected: communications ready
	* @param {number} tabid:
	*/
	static commConnected(tabid) {
		this.tabid = tabid;
		if(name != "firefox" && this.injectWeb) {
			trace("inject web script");
			this.inject([
				"base/extbase.js", 
				//"base/messages.js", 
				"base/ports.js", 
				"base/utils.js", 
				"web.js"
			], this.webInjected.bind(this));
		}
		else {
			trace("no web inject");
			this.initialized();
		}
	}
	
	static webInjected() {
		this.initialized();
	}
	
	static initialized() {
		if(DEBUG) trace(this.name, ":", this.tabid, "initialized");
	}
	
	/**
	@method load: load a js file
	@param {string|Array} src: url or array
	@param {Function} callback: method called once scripts are loaded
	@return void
	*/
	static inject(src, callback) { // + progress ? :P
		if(!(src instanceof Array)) src = [src];
		let list = src.slice();
		let args = Array.prototype.slice.call(arguments);
		doLoad.bind(this)(src[0]);
		
		function doLoad(script) {
			//trace("load script : " + script);
			let scr = document.createElement("script");
			scr.setAttribute("type", "text/javascript");
			scr.setAttribute("async", "true");
			document.head.appendChild(/** @type {!Element} */(scr));
			scr.onload = scr.onreadystatechange = (/** @param {!Event|null} _ @param {*=} isAbort @return {?}*/function(_, isAbort) {
				if(isAbort || !scr.readyState || /loaded|complete/.test(scr.readyState)) {
					scr.onload = scr.onreadystatechange = null;
					scr = undefined;
					if(isAbort) trace("script load fail :", src[0]);
					else trace("script loaded :", src[0]); // remove script tag ?
					src.shift();
					if(src.length == 0) callback.apply(this, [list].concat(args.slice(2)));
					else doLoad.bind(this)(src[0]);
				}
			}).bind(this);
			let url = _which.extension.getURL("resources/" + script);
			scr.setAttribute("src", url);
		}
	}
	
	/**
	* @method fromBackgroundMiddleware: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromBackgroundMiddleware(type, message, callback) {
		//if(DEBUG) trace(type, "from background :", message);
		
		switch(type) {
				
			case "update":
				this.onUpdate(message);
				return false;
				break;
				
			case "open":
				this.onOpenPopup();
				return false;
				break;
			
			case "close":
				this.onClosePopup();
				return false;
				break;
				
		}
		
		return this.fromBackground(type, message, callback);
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromBackground(type, message, callback) {
		if(DEBUG) trace(type, "from background :", message);
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromContent(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromWeb(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from web :", message, "tab", tabid);
	}
	
	/**
	* @method fromPopup: received message from popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromPopup(type, message, callback) {
		if(DEBUG) trace(type, "from popup :", message);
	}
	
	static onOpenPopup() {
		
	}
	
	static onClosePopup() {
		
	}
	
	static onUpdate(info) {
		
	}
	
	static onHandle(tabid) {
		if(DEBUG) trace("new content", tabid);
	}
	
}

/**
* @nocollapse
*/
class ExtensionWebScript extends ExtensionScript {
	
	/**
	* @constructor
	*/
	constructor() {
		super(); // useless, for closure compiler
	}
	
	static initialize() {
		super.initialize();
		
		this.comm = new WebPort(this.extid, this.commConnected.bind(this), this.fromBackground.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this));
		//this.comm = new WebMessage(this.extid, this.commConnected.bind(this), this.fromBackground.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this), this.fromPopup.bind(this));
	}
	
	/**
	* @method commConnected: communications ready
	* @param {number} tabid:
	*/
	static commConnected(tabid) {
		this.tabid = tabid;
		this.initialized();
	}
	
	static initialized() {
		if(DEBUG) trace(this.name, "initialized");
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromBackground(type, message, callback) {
		if(DEBUG) trace(type, "from background :", message);
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromContent(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromWeb(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}
	
	/**
	* @method fromPopup: received message from popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromPopup(type, message, callback) {
		if(DEBUG) trace(type, "from popup :", message);
	}

}

/**
* @nocollapse
* @extends {ExtensionScript}
*/
class ExtensionPopupScript extends ExtensionScript {
	
	/**
	* @constructor
	*/
	constructor() {
		super(); // useless, for closure compiler
	}
	
	static initialize() {
		super.initialize();
		
		this.comm = new PopupPort(this.commConnected.bind(this), this.fromBackgroundMiddleware.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this));
		//this.comm = new PopupMessage(this.commConnected.bind(this), this.fromBackgroundMiddleware.bind(this), this.fromContent.bind(this), this.fromWeb.bind(this));
	}
	
	/**
	* @method commConnected: communications ready
	*/
	static commConnected() { // TODO all tabs infos
		this.initialized();
	}
	
	static initialized() {
		if(DEBUG) trace(this.name, "initialized");
	}
	
	static onTabs(tabs, activeTab) {
		//if(DEBUG) trace(activeTab, tabs);
		this.tabs = tabs;
		this.activeTab = activeTab;
	}
	
	/**
	* @method fromBackgroundMiddleware: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromBackgroundMiddleware(type, message, callback) {
		//if(DEBUG) trace(type, "from background :", message);
		
		switch(type) {
			
			case "tabs":
				this.onTabs(message["tabs"], message["active"]);
				return false;
				break;
				
		}
		
		return this.fromBackground(type, message, callback);
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromBackground(type, message, callback) {
		if(DEBUG) trace(type, "from background :", message);
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromContent(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from content :", message, "tab", tabid);
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	static fromWeb(tabid, type, message, callback) {
		if(DEBUG) trace(type, "from web :", message, "tab", tabid);
	}
	
	// TODO : fromPopup ? // other popup ?
}


/**
* https://youtu.be/OnoNITE-CLc?t=1m22s
**/
function liftoff(classRef) {
	where() == "background" && classRef.prototype instanceof ExtensionBackgroundScript ? classRef.initialize() : (where() == "content" && classRef.prototype instanceof ExtensionContentScript ? classRef.initialize() : (where() == "popup" && classRef.prototype instanceof ExtensionPopupScript ? classRef.initialize() : (where() == "web" && classRef.prototype instanceof ExtensionWebScript ? classRef.initialize() : die())));
}