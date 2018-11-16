/**
* @nocollapse
* @extends {ExtensionBackgroundScript}
* @final
*/
class CustomExtensionBackground extends ExtensionBackgroundScript {
	
	constructor() { // useless, for closure compiler
		super();
	}
	
	static initialized() { // extension is ready
		// no super call, override only
		trace(this.name, " init");
		
		// type here
		
	}
	
	static onInstall() {
		super.onInstall();
		
		// type here
		
	}
	
	static onStartup() {
		super.onStartup();
		
		// type here
		
	}
	
	static register(tabid) { // new tab matches extension handler
		super.register(tabid); // do not remove
		
		// type here
		
		setTimeout(function() {
			trace("background to content");
			this.comm.toContent(tabid, "backgroundtocontent", "test backgroundtocontent", function(result, overload) {
				trace("background to content result :", result, "overload :", overload);
			}, "background > content > background");
		}.bind(this), 1000);
		
		setTimeout(function() {
			trace("background to web");
			this.comm.toWeb(tabid, "backgroundtoweb", "test backgroundtoweb", function(result, overload) {
				trace("background to web result :", result, "overload :", overload);
			}, "background > web > background");
		}.bind(this), 2000);
		
		
		
	}
	
	static unregister(tabId) { // tab was closed, unregister
		super.unregister(tabId); // do not remove
		
		// type here
		
	}
	
	static fromContent(tabid, type, message, callback) { // message from content script

		setTimeout(function(callback, type) { callback({"result": "background ack to content " + type}); }, 500, callback, type);
		
		//callback(); // ack to content, here or in async switch handler
		return true; // to enable async callback
	}
	
	static fromWeb(tabid, type, message, callback) { // message from popup script
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		setTimeout(function(callback, type) { callback({"result": "background ack to web " + type}); }, 500, callback, type);
		
		//callback(); // ack to web, here or in async switch handler
		return true; // to enable async callback
	}
	
	static fromPopup(type, message, callback) { // message from popup script
		//trace("from popup", type, message)
		setTimeout(function(callback, type) { callback({"result": "background ack to popup " + type}); }, 500, callback, type);
		setTimeout(function() {
			trace("background to popup");
			this.comm.toPopup("backgroundtopopup", "test backgroundtopopup", function(result, overload) {
				trace("background to popup result :", result, "overload :", overload);
			}, "background > popup > background");
		}.bind(this), 750);
		
		//callback(); // ack to popup, here or in async switch handler
		return true; // to enable async callback
	}
	
	static onOpenPopup() { // called when popup is opened
		super.onOpenPopup(); // do not remove
		
		trace("custom popup open");
		// type here
		
	}
	
	static onClosePopup() { // called when popup is closed
		super.onClosePopup(); // do not remove
		
		trace("custom popup close");
		// type here
		
	}
	
	static onUpdateTab(tabid, info) { // called when handled tab is updated

		trace("custom update tab", tabid, info);
		// type here
		
	}
	
}

liftoff(CustomExtensionBackground); // do not remove