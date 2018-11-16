/**
* @nocollapse
* @extends {ExtensionContentScript}
* @final
*/
class CustomExtensionContent extends ExtensionContentScript {
	
	constructor() { // useless, for closure compiler
		super();
	}
	
	static initialized() { // content script is linked to background, ready
		super.initialized();
		trace(this.name, "custom init");
		
		// type here
		
		setTimeout(function() {
			trace("content to background");
			this.comm.toBackground("contenttobackground", "test contenttobackground", function(result, overload) {
				trace("content to background result :", result, "overload :", overload);
			}, "content > background > content");
		}.bind(this), 3000);
		
		setTimeout(function() {
			trace("content to web", this.comm.tabid);
			this.comm.toWeb(this.comm.tabid, "contenttoweb", "test contenttoweb", function(result, overload) {
				trace("content to web result :", result, "overload :", overload);
			}, "content > web > content");
		}.bind(this), 4000);
		
	}
	
	static fromBackground(type, message, callback) { // message from background script
		
		setTimeout(function(callback, type) { callback({"result": "content ack to background " + type}); }, 500, callback, type);
		
		//callback(); // ack to background, here or in async switch handler
		return true; // to enable async callback
	}
	
	static fromWeb(tabid, type, message, callback) { // message from popup script

		setTimeout(function(callback, type) { callback({"result": "content ack to web " + type}); }, 500, callback, type);
		
		//callback(); // ack to web, here or in async switch handler
		return true; // to enable async callback
	}
	
	static fromPopup(type, message, callback) { // message from popup script
		
		setTimeout(function(callback, type) { callback({"result": "content ack to popup " + type}); }, 500, callback, type);
		setTimeout(function() {
			trace("content to popup");
			this.comm.toPopup("contenttopopup", "test contenttopopup", function(result, overload) {
				trace("content to popup result :", result, "overload :", overload);
			}, "content > popup > content");
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
	
	static onUpdate(info) {
		
		trace(info);
		
	}
	
}

liftoff(CustomExtensionContent); // do not remove