/**
* @nocollapse
* @extends {ExtensionWebScript}
* @final
*/
class CustomExtensionWeb extends ExtensionWebScript {
	
	static initialize() {
		
		this.extid = "glbgeogjhaebangbhdgkdcidbcflhnmf"; // chrome extension id, required for webpage <=> extension communications
		
		super.initialize();
	}
	
	static initialized() { // content script is linked to background, ready
		super.initialized();
		trace(this.name, "custom init");
		
		setTimeout(function() {
			trace("web to background");
			this.comm.toBackground("webtobackground", "test webtobackground", function(result, overload) {
				trace("web to background result :", result, "overload :", overload);
			}, "web > background > web");
		}.bind(this), 5000);
		
		setTimeout(function() {
			trace("web to content", this.comm.tabid);
			this.comm.toContent(this.comm.tabid, "webtocontent", "test webtocontent", function(result, overload) {
				trace("web to content result :", result, "overload :", overload);
			}, "web > content > web");
		}.bind(this), 6000);
	}
	
	static fromBackground(type, message, callback) {
		
		setTimeout(function(callback, type) { callback({"result": "web ack to background " + type}); }, 500, callback, type);
		
		//callback(); // ack to background, here or in async switch handler
		return true; // to enable async callback
	}
	
	static fromContent(tabid, type, message, callback) {
		
		setTimeout(function(callback, type) { callback({"result": "web ack to content " + type}); }, 500, callback, type);
		
		//callback(); // ack to content, here or in async switch handler
		return true; // to enable async callback
	}
	
	static fromPopup(type, message, callback) {
		
		setTimeout(function(callback, type) { callback({"result": "web ack to popup " + type}); }, 500, callback, type);
		setTimeout(function() {
			trace("web to popup");
			this.comm.toPopup("webtopopup", "test webtopopup", function(result, overload) {
				trace("web to popup result :", result, "overload :", overload);
			}, "web > popup > web");
		}.bind(this), 750);
		
		//callback(); // ack to popup, here or in async switch handler
		return true; // to enable async callback
	}
	
}

liftoff(CustomExtensionWeb); // do not remove