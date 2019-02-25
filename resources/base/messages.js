const SCRIPT_BACKGROUND = 0;
const SCRIPT_CONTENT = 1;
const SCRIPT_POPUP = 2;
const SCRIPT_WEB = 3;

/**
* @nocollapse
*/
class MessageBase {
	
	constructor() {
		this.acks = 0;
		this.callbacks = new Map();
	}
	
	toBackground(type, message, callback) {}
	
	toContent(tabid, type, message, callback) {}
	
	toWeb(tabid, type, message, callback) {}
	
	toPopup(type, message, callback) {}
	
	/**
	* @method toruntime: send message to browser runtime
	* @param {string} extid: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	toruntime(extid, message, callback) {
		callback = callback || die;
		which.runtime.sendMessage(extid, message, this.callbackLayer.apply(this, Array.prototype.slice.call(arguments).slice(2)));
	}
	
	/**
	* @method toruntime: send message to a tab
	* @param {number} tabid: 
	* @param {Object} message: 
	* @param {Function} callback: 
	*/
	totab(tabid, message, callback) {
		callback = callback || die;
		which.tabs.sendMessage(tabid, message, this.callbackLayer.apply(this, Array.prototype.slice.call(arguments).slice(2)));
	}
	
	/**
	* @method towindow: post message to window
	* @param {Object} message: 
	*/
	towindow(message) {
		return window.postMessage(message, window.location.toString());
	}
	
	/**
	* @method callback: allow user to pass any number of arguments to the async chrome callback triggered after sending a message
	* @param {Function} callback: 
	*/
	callbackLayer(callback) { // callback + any number of args
		let args = Array.prototype.slice.call(arguments); // keep ref for anonym nested method
		callback = callback || die; // or die
		return function(result) { // from chrome.tabs.sendMessage / chrome.runtime.sendMessage
			callback.apply(this, [result].concat(args.slice(1))); // exec callback(chromeResult, arg, ...)
		};
	}
	
	/**
	* @method ack: new ack number for async callback
	* @param {Function} callback: method called when async ack is received
	* @param {...*} var_args
	*/
	ack(callback, var_args) {
		this.callbacks.set(++this.acks, {"callback": callback || die, "args": Array.prototype.slice.call(arguments).slice(1)});
		return this.acks;
	}
	
	/**
	* @method callback: callback linked to ack number and origin script
	* @param {number} ack: ack number
	* @param {number} script: script origin
	* @param {number=} tabid: if script origin is content or web, tabid is needed
	* @param {...*} var_args
	*/
	callback(ack, script, tabid, var_args) {
		return function(result) {
			let params = {"ack": ack, "result": result};
			if(script == SCRIPT_BACKGROUND) return this.toBackground("ack", params, die);
			else if(script == SCRIPT_CONTENT) return this.toContent(tabid, "ack", params, die);
			else if(script == SCRIPT_WEB) return this.toWeb(tabid, "ack", params, die);
			else if(script == SCRIPT_POPUP) return this.toPopup("ack", params, die);
		}.bind(this);
	}
	
}

/**
* @nocollapse
* @extends {MessageBase}
*/
class BackgroundMessage extends MessageBase {
	
	constructor(onConnect, onContentMessage, onWebMessage, onPopupMessage) {
		super();
		
		if(DEBUG) trace("init background message");
		
		this.onConnect = onConnect;
		this.onContentMessage = onContentMessage;
		this.onWebMessage = onWebMessage;
		this.onPopupMessage = onPopupMessage;
		
		this.messageHandler = this.onMessage.bind(this);
		which.runtime.onMessage.addListener(this.messageHandler);
		
		this.externalMessageHandler = this.onMessageExternal.bind(this);
		which.runtime.onMessageExternal.addListener(this.externalMessageHandler);
		
	}
	
	/**
	* @method onMessage: received message
	* @param {Object} message: 
	* @param sender: 
	* @param {Function} callback: 
	* @this {BackgroundMessage}
	*/
	onMessage(message, sender, callback) {
		//if(DEBUG) trace(message);
		if(which.runtime.id != sender["id"]) return; // other exts not allowed to send messages !!
		switch(message["dst"]) {
			
			case SCRIPT_BACKGROUND:
				if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
				else if(message["src"] == SCRIPT_CONTENT) return this.fromContent(sender["tab"]["id"], message["type"], message["msg"], callback);
				else if(message["src"] == SCRIPT_POPUP) return this.fromPopup(message["type"], message["msg"], callback);
				break;
				
		}
		return false; // RETURN TRUE TO ENABLE ASYNC CALLBACK
	}
	
	onMessageExternal(message, sender, callback) {
		//if(DEBUG) trace("external message", message);
		
		switch(message["dst"]) {
			
			case SCRIPT_BACKGROUND:
				if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
				else if(message["src"] == SCRIPT_WEB) return this.fromWeb(sender["tab"]["id"], message["type"], message["msg"], callback);
				break;
				
			case SCRIPT_CONTENT:
				this.totab.apply(this, [sender["tab"]["id"], {"src": message["src"], "dst": message["dst"], "type": message["type"], "msg": message["msg"], "ftab": sender["tab"]["id"], "ttab": message["ttab"]}, callback]);
				return true; // relay, must return true ??
				break;
				
			case SCRIPT_POPUP:
				this.toruntime.apply(this, ["", {"src": message["src"], "dst": message["dst"], "type": message["type"], "msg": message["msg"], "ftab": sender["tab"]["id"]}, callback]);
				return true; // relay, must return true ??
				break;
				
		}
		
		return true; // RETURN TRUE TO ENABLE ASYNC CALLBACK	
	}
	
	/**
	* @method toContent: send message to content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {BackgroundMessage}
	*/
	toContent(tabid, type, message, callback) {
		this.totab.apply(this, 
			[
				tabid, 
				{
					"src": SCRIPT_BACKGROUND, 
					"dst": SCRIPT_CONTENT, 
					"type": type, 
					"msg": message
				}, callback
			].concat(Array.prototype.slice.call(arguments).slice(4))
		);
	}
	
	/**
	* @method toWeb: send message to web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {BackgroundMessage}
	*/
	toWeb(tabid, type, message, callback) {
		this.totab.apply(this, 
			[
				tabid, 
				{
					"src": SCRIPT_BACKGROUND, 
					"dst": SCRIPT_WEB, 
					"type": type, 
					"msg": message, 
					"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
				}, 
				die
			]
		);
	}
	
	/**
	* @method toPopup: send message to popup
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {BackgroundMessage}
	*/
	toPopup(type, message, callback) {
		this.toruntime.apply(this, 
			[
				"", 
				{
					"src": SCRIPT_BACKGROUND, 
					"dst": SCRIPT_POPUP, 
					"type": type, 
					"msg": message
				}, callback
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {BackgroundMessage}
	*/
	fromContent(tabid, type, message, callback) {
		//trace(type, "from content :", message);
		
		switch(type) {
			
			case "ehlo":
				callback(tabid);
				this.onConnect({"name": "content", "tab": tabid});
				return false;
				break;
			
		}
		
		if(this.onContentMessage(tabid, type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {BackgroundMessage}
	*/
	fromWeb(tabid, type, message, callback) {
		//trace(type, "from web :", message);
		
		switch(type) {
			
			case "ehlo":
				callback(tabid);
				this.onConnect({"name": "web", "tab": tabid});
				return;
				break;
			
		}
		
		if(this.onWebMessage(tabid, type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromPopup: received message from popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {BackgroundMessage}
	*/
	fromPopup(type, message, callback) {
		//trace(type, "from popup :", message);
		
		switch(type) {
			
			case "ehlo":
				callback();
				this.onConnect({"name": "popup"});
				return;
				break;
			
		}
		
		if(this.onPopupMessage(type, message, callback)) return true;
		else callback();
	}
	
}

/**
* @nocollapse
* @extends {MessageBase}
*/
class ContentMessage extends MessageBase {
	
	constructor(onConnect, onBackgroundMessage, onContentMessage, onWebMessage, onPopupMessage, onHandle) {
		super();
		
		if(DEBUG) trace("init content message");
		
		this.tabid = 0;
		
		this.onConnect = onConnect;
		this.onBackgroundMessage = onBackgroundMessage;
		this.onWebMessage = onWebMessage;
		this.onContentMessage = onContentMessage;
		this.onPopupMessage = onPopupMessage;
		this.onHandle = onHandle;
		
		this.messageHandler = this.onMessage.bind(this);
		which.runtime.onMessage.addListener(this.messageHandler);
		
		this.toBackground("ehlo", {}, this.helo.bind(this));
	}
	
	/**
	* @method helo: background script connected
	* @param {number} tabid: 
	* @this {ContentMessage}
	*/
	helo(tabid) {
		this.tabid = tabid;
		this.onConnect(tabid);
	}
	
	/**
	* @method onMessage: received message
	* @param {Object} message: 
	* @param sender: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	onMessage(message, sender, callback) {
		if(which.runtime.id != sender.id) return; // other exts not allowed to send messages !!
		
		switch(message["dst"]) {
			
			case SCRIPT_CONTENT:
				if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
				else if(message["src"] == SCRIPT_BACKGROUND) return this.fromBackground(message["type"], message["msg"], callback);
				else if(message["src"] == SCRIPT_CONTENT) return this.fromContent(message["ftab"], message["type"], message["msg"], callback);
				else if(message["src"] == SCRIPT_WEB) return this.fromWeb(message["ftab"], message["type"], message["msg"], callback);
				else if(message["src"] == SCRIPT_POPUP) return this.fromPopup(message["type"], message["msg"], callback);
				break;
			
			case SCRIPT_WEB:
				return this.towindow({"src": message["src"], "dst": SCRIPT_WEB, "type": message["type"], "msg": message["msg"], "ack": message["ack"]});
				break;
		}
		
		return false; // unhandled, no async callback
	}
	
	/**
	* @method toBackground: send a message to background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	toBackground(type, message, callback) {
		this.toruntime.apply(this, 
			[
				"", 
				{
					"src": SCRIPT_CONTENT, 
					"dst": SCRIPT_BACKGROUND, 
					"type": type, 
					"msg": message
				}, callback
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}
	
	/**
	* @method toPopup: send a message to popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	toPopup(type, message, callback) {
		this.toruntime.apply(this, 
			[
				"", 
				{
					"src": SCRIPT_CONTENT, 
					"dst": SCRIPT_POPUP, 
					"type": type, 
					"msg": message,
					"ftab": this.tabid
				}, 
				callback
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}
	
	/**
	* @method toContent: send a message to content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	toContent(tabid, type, message, callback) {
		this.toruntime.apply(this, 
			[
				"", 
				{
					"src": SCRIPT_CONTENT, 
					"dst": SCRIPT_CONTENT, 
					"type": type, 
					"msg": message,
					"ftab": this.tabid,
					"ttab": tabid
				}, 
				callback
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}
	
	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	toWeb(tabid, type, message, callback) {
		// if tabid != this.tabid, pipe to corresponding content tab id and then to window
		this.towindow.apply(this, 
			[
				{
					"src": SCRIPT_CONTENT, 
					"dst": SCRIPT_WEB, 
					"type": type, 
					"msg": message, 
					"ftab": this.tabid, 
					"ttab": tabid, 
					"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
				}
			]
		);
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	fromBackground(type, message, callback) {
		//trace(type, "from background :", message);
		if(this.onBackgroundMessage(type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	fromContent(tabid, type, message, callback) {
		//trace(type, "from content :", message);
		if(this.onContentMessage(tabid, type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	fromWeb(tabid, type, message, callback) {
		//trace(type, "from web :", message);
		if(this.onWebMessage(tabid, type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromPopup: received message from popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentMessage}
	*/
	fromPopup(type, message, callback) {
		//trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback)) return true;
		else callback();
	}
	
}

/**
* @nocollapse
* @extends {MessageBase}
*/
class WebMessage extends MessageBase {
	
	/**
	* @constructor
	* @param {String} extid: Chrome extension identifier
	* @param {Function} onConnect: 
	* @param {Function} onBackgroundMessage: 
	* @param {Function} onContentMessage: 
	* @param {Function} onWebMessage: 
	* @param {Function} onPopupMessage: 
	*/
	constructor(extid, onConnect, onBackgroundMessage, onContentMessage, onWebMessage, onPopupMessage) {
		super();
		
		if(DEBUG) trace("init web message");
		
		this.extid = extid;
		this.tabid = 0;
		
		this.onConnect = onConnect;
		this.onBackgroundMessage = onBackgroundMessage;
		this.onContentMessage = onContentMessage;
		this.onWebMessage = onWebMessage;
		this.onPopupMessage = onPopupMessage;
		
		window.addEventListener("message", this.onWindowPostMessage.bind(this), false);
		
		this.toBackground("ehlo", {}, this.ehlo.bind(this));
	}
	
	ehlo(tabid) {
		this.tabid = tabid;
		this.onConnect(tabid);
	}
	
	onWindowPostMessage(event) {
		if(event["data"]["type"] == "ack") return this.callbacks.get(event["data"]["msg"]["ack"])["callback"].apply(this, [event["data"]["msg"]["result"]].concat(this.callbacks.get(event["data"]["msg"]["ack"])["args"]));
		else if(event["data"]["src"] == SCRIPT_BACKGROUND) this.fromBackground(event["data"]["type"], event["data"]["msg"], this.callback(event["data"]["ack"], event["data"]["src"]));
		else if(event["data"]["src"] == SCRIPT_CONTENT) this.fromContent(event["data"]["ftab"], event["data"]["type"], event["data"]["msg"], this.callback(event["data"]["ack"], event["data"]["src"], event["data"]["ftab"]));
		else if(event["data"]["src"] == SCRIPT_WEB) this.fromWeb(event["data"]["ftab"], event["data"]["type"], event["data"]["msg"], this.callback(event["data"]["ack"], event["data"]["src"], event["data"]["ftab"]));
		else if(event["data"]["src"] == SCRIPT_POPUP) this.fromPopup(event["data"]["type"], event["data"]["msg"], this.callback(event["data"]["ack"], event["data"]["src"]));
	}
	
	/**
	* @method toBackground: send a message to background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebMessage}
	*/
	toBackground(type, message, callback) {
		this.toruntime.apply(this, 
			[
				this.extid, 
				{
					"src": SCRIPT_WEB, 
					"dst": SCRIPT_BACKGROUND, 
					"type": type, 
					"msg": message, 
					"ftab": this.tabid
				}, 
				callback
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}
	
	/**
	* @method toContent: send a message to content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebMessage}
	*/
	toContent(tabid, type, message, callback) {
		this.toruntime.apply(this, 
			[
				this.extid, 
				{
					"src": SCRIPT_WEB, 
					"dst": SCRIPT_CONTENT, 
					"type": type, 
					"msg": message, 
					"ftab": this.tabid,
					"ttab": tabid
				}, 
				callback
			].concat(Array.prototype.slice.call(arguments).slice(4))
		);
	}
	
	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebMessage}
	*/
	toWeb(tabid, type, message, callback) {
		this.toruntime.apply(this, 
			[
				this.extid, 
				{
					"src": SCRIPT_WEB, 
					"dst": SCRIPT_WEB, 
					"type": type, 
					"msg": message, 
					"ftab": this.tabid,
					"ttab": tabid
				}, 
				callback
			].concat(Array.prototype.slice.call(arguments).slice(4))
		);
	}
	
	/**
	* @method toPopup: send message to popup
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebMessage}
	*/
	toPopup(type, message, callback) {
		this.toruntime.apply(this, 
			[
				this.extid, 
				{
					"src": SCRIPT_WEB, 
					"dst": SCRIPT_POPUP, 
					"type": type, 
					"msg": message, 
					"ftab": this.tabid
				}, 
				callback
			].concat(Array.prototype.slice.call(arguments).slice(3))
		);
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebMessage}
	*/
	fromBackground(type, message, callback) {
		//trace(type, "from background :", message);
		if(this.onBackgroundMessage(type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebMessage}
	*/
	fromContent(tabid, type, message, callback) {
		//trace(type, "from content :", message);
		if(this.onContentMessage(tabid, type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebMessage}
	*/
	fromWeb(tabid, type, message, callback) {
		//trace(type, "from web :", message);
		if(this.onWebMessage(tabid, type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromPopup: received message from popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebMessage}
	*/
	fromPopup(type, message, callback) {
		//trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback)) return true;
		else callback();
	}
	
}

/**
* @nocollapse
* @extends {MessageBase}
*/
class PopupMessage extends MessageBase {
	
	constructor(onConnect, onBackgroundMessage, onContentMessage, onWebMessage) {
		super();
		
		if(DEBUG) trace("init popup message");
		
		this.onConnect = onConnect;
		this.onBackgroundMessage = onBackgroundMessage;
		this.onContentMessage = onContentMessage;
		this.onWebMessage = onWebMessage;
		
		this.messageHandler = this.onMessage.bind(this);
		which.runtime.onMessage.addListener(this.messageHandler);
		
		this.toBackground("ehlo", {}, this.ehlo.bind(this));
	}
	
	ehlo() {
		this.onConnect();
	}
	
	/**
	* @method onMessage: received message
	* @param {Object} message: 
	* @param sender: 
	* @param {Function} callback: 
	* @this {PopupMessage}
	*/
	onMessage(message, sender, callback) {
		//trace(message);
		if(which.runtime.id != sender.id) return;
		if(message["type"] == "ack") return this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
		if(message["dst"] == SCRIPT_POPUP && message["src"] == SCRIPT_BACKGROUND) return this.fromBackground(message["type"], message["msg"], callback);
		else if(message["dst"] == SCRIPT_POPUP && message["src"] == SCRIPT_CONTENT) return this.fromContent(sender["tab"]["id"], message["type"], message["msg"], callback);
		else if(message["dst"] == SCRIPT_POPUP && message["src"] == SCRIPT_WEB) return this.fromWeb(message["ftab"], message["type"], message["msg"], callback);
		return false; // RETURN TRUE TO ENABLE ASYNC CALLBACK
	}
	
	/**
	* @method toBackground: send a message to background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupMessage}
	*/
	toBackground(type, message, callback) {
		let args = Array.prototype.slice.call(arguments);
		this.toruntime.apply(this, 
			[
				"", 
				{
					"src": SCRIPT_POPUP, 
					"dst": SCRIPT_BACKGROUND, 
					"type": type, 
					"msg": message
				}, 
				callback
			].concat(args.slice(3))
		);
	}
	
	/**
	* @method toContent: send a message to content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupMessage}
	*/
	toContent(tabid, type, message, callback) {
		this.totab.apply(this, 
			[
				tabid, 
				{
					"src": SCRIPT_POPUP, 
					"dst": SCRIPT_CONTENT, 
					"type": type, 
					"msg": message
				}, 
				callback
			].concat(Array.prototype.slice.call(arguments).slice(4))
		);
	}
	
	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupMessage}
	*/
	toWeb(tabid, type, message, callback) {
		this.totab.apply(this, 
			[
				tabid, 
				{
					"src": SCRIPT_POPUP, 
					"dst": SCRIPT_WEB, 
					"type": type, 
					"msg": message, 
					"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
				}, 
				die
			]
		);
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupMessage}
	*/
	fromBackground(type, message, callback) {
		//trace(type, "from background :", message);
		if(this.onBackgroundMessage(type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupMessage}
	*/
	fromContent(tabid, type, message, callback) {
		//trace(type, "from content :", message);
		if(this.onContentMessage(tabid, type, message, callback)) return true;
		else callback();
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupMessage}
	*/
	fromWeb(tabid, type, message, callback) {
		//trace(type, "from web :", message);
		if(this.onWebMessage(tabid, type, message, callback)) return true;
		else callback();
	}
	
}