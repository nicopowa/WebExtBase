window.onload = function(event) { liftoff(CustomExtensionPopup); }; // do not remove

/**
* @nocollapse
* @extends {ExtensionPopupScript}
* @final
*/
class CustomExtensionPopup extends ExtensionPopupScript {
	
	constructor() { // useless, for closure compiler
		// useless, for closure compiler
		super();
	}
	
	static initialized() { // popup open and ready
		// no super call, override only
		trace(this.name, "custom init");
		
		// type here
		
		
		
	}
	
	static onTabs(tabs, activeTab) { // tabs fetched
		super.onTabs(tabs, activeTab); // do not remove
		trace("TABS");
		setTimeout(function() {
			trace("popup to background");
			this.comm.toBackground("popuptobackground", "test popuptobackground", function(result, overload) {
				trace("popup to background result :", result, "overload :", overload);
			}, "popup > background > popup");
		}.bind(this), 1000);
		
		setTimeout(function() {
			trace("popup to content", tabs[0]);
			this.comm.toContent(tabs[0], "popuptocontent", "test popuptocontent", function(result, overload) {
				trace("popup to content result :", result, "overload :", overload);
			}, "popup > content > popup");
		}.bind(this), 2000);
		
		setTimeout(function() {
			trace("popup to web", tabs[0]);
			this.comm.toWeb(tabs[0], "popuptoweb", "test popuptoweb", function(result, overload) {
				trace("popup to web result :", result, "overload :", overload);
			}, "popup > web > popup");
		}.bind(this), 3000);
		
	}
	
	static fromBackground(type, message, callback) { // message from background script
		
		setTimeout(function(callback, type) { callback({result: "popup ack to background " + type}); }, 500, callback, type);
		
		//callback(); // ack to content, here or in async handler
		return true; // to enable async callback
	}
	
	static fromContent(tabid, type, message, callback) { // message from content script
		
		setTimeout(function(callback, type) { callback({result: "popup ack to content " + type}); }, 500, callback, type);
		
		//callback(); // ack to content, here or in async handler
		return true; // to enable async callback
	}
	
	static fromWeb(tabid, type, message, callback) { // message from web script
		
		setTimeout(function(callback, type) { callback({result: "popup ack to web " + type}); }, 500, callback, type);
		
		//callback(); // ack to web, here or in async handler
		return true; // to enable async callback
	}
	
}