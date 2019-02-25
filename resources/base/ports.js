const SCRIPT_BACKGROUND = 0;
const SCRIPT_CONTENT = 1;
const SCRIPT_POPUP = 2;
const SCRIPT_WEB = 3;

/**
* @nocollapse
*/
class PortBase {
	
	/**
	* @constructor
	* @this {PortBase}
	*/
	constructor() {
		this.which = (typeof chrome === "undefined") ? (typeof browser === "undefined") ? null : browser : chrome;
		this.acks = 0;
		this.callbacks = new Map();
	}
	
	toBackground(type, message, callback) {}
	
	toContent(tabid, type, message, callback) {}
	
	toWeb(tabid, type, message, callback) {}
	
	toPopup(type, message, callback) {}
	
	/**
	* @method ack: new ack number for async callback
	* @param {Function} callback: method called when async ack is received
	* @param {...*} var_args: overloads
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
	* @param {...*} var_args: overloads
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
* @extends {PortBase}
*/
class BackgroundPort extends PortBase {
	
	/**
	* @param {Function} onConnect: new port connected function(infos{name, tabid})
	* @param {Function} onDisconnect: port disconnected function(infos{name, tabid})
	* @param {Function} onContentMessage: message from content port
	* @param {Function} onWebMessage: message from web port
	* @param {Function} onPopupMessage: message from popup port
	* @this {BackgroundPort}
	*/
	constructor(onConnect, onDisconnect, onContentMessage, onWebMessage, onPopupMessage) {
		super();
		
		this.onConnect = onConnect || die;
		this.onDisconnect = onDisconnect || die;
		this.onContentMessage = onContentMessage || die;
		this.onWebMessage = onWebMessage || die;
		this.onPopupMessage = onPopupMessage || die;
		
		this.contentPorts = new Map();
		this.webPorts = new Map();
		this.popupPort = null;
		
		this.portConnectHandler = this.onPortConnect.bind(this);
		this.which.runtime.onConnect.addListener(this.portConnectHandler);
		this.externalPortConnectHandler = this.onExternalPortConnect.bind(this);
		this.which.runtime.onConnectExternal.addListener(this.externalPortConnectHandler);
	}
	
	/**
	* @method onPortConnect: port is connected
	* @param port: connected port object
	* @this {BackgroundPort}
	*/
	onPortConnect(port) {
		
		if(port["sender"]["id"] != this.which.runtime.id) {
			if(DEBUG) trace("extension", port["sender"]["id"], "not allowed"); // other exts not allowed to send port messages
			port.disconnect();
			return;
		}
		
		if(DEBUG) trace(port.name, "port connected");
		
		let infos = {"name": port["name"]};

		switch(port["name"]) {
			
			case "content":
				this.contentPorts.set(port["sender"]["tab"]["id"], port);
				this.toContent(port["sender"]["tab"]["id"], "tabid", port["sender"]["tab"]["id"], die);
				infos["tab"] = port["sender"]["tab"]["id"];
				this.toContentAll("handle", port["sender"]["tab"]["id"], die); // notify other content scripts
				break;
				
			case "popup":
				this.popupPort = port;
				break;
				
			default:
				if(DEBUG) return trace("unknown port", port);
				break;
			
		}
		
		port.onMessage.addListener(this.onPortMessage.bind(this));
		port.onDisconnect.addListener(this.onPortDisconnect.bind(this));
		
		this.onConnect(infos);
	}
	
	/**
	* @method onExternalPortConnect: external port is connected
	* @param port: connected port object
	* @this {BackgroundPort}
	*/
	onExternalPortConnect(port) {
		// external port, no check sender, website authorized in manifest "externally_connectable" // TODO : CHECK DOCS SECURITY
		if(DEBUG) trace(port.name, "port connected");
		
		let infos = {"name": port["name"]};

		switch(port["name"]) {
				
			case "web":
				this.webPorts.set(port["sender"]["tab"]["id"], port);
				this.toWeb(port["sender"]["tab"]["id"], "tabid", port["sender"]["tab"]["id"], die);
				infos["tab"] = port["sender"]["tab"]["id"];
				break;
			
		}
		
		port.onMessage.addListener(this.onPortMessage.bind(this));
		port.onDisconnect.addListener(this.onPortDisconnect.bind(this));
		
		this.onConnect(infos);
	}
	
	/**
	* @method onPortMessage: message from port
	* @param {Object} message: data received from port
	* @this {BackgroundPort}
	*/
	onPortMessage(message) {
		//if(DEBUG) trace("port message :", message);
		switch(message["dst"]) {
			
			case SCRIPT_BACKGROUND:
				if(message["type"] == "ack") {
					this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
					this.callbacks.delete(message["msg"]["ack"]);
				}
				else if(message["src"] == SCRIPT_CONTENT) return this.fromContent(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
				else if(message["src"] == SCRIPT_WEB) return this.fromWeb(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
				else if(message["src"] == SCRIPT_POPUP) return this.fromPopup(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
				//else trace("FAIL background port message ", message);
				break;				
				
			case SCRIPT_CONTENT:
				if(this.contentPorts.has(message["ttab"])) this.contentPorts.get(message["ttab"]).postMessage(message);
				//else trace("no tab", message["ttab"], message["msg"]);
				break;
				
			case SCRIPT_WEB:
				if(this.webPorts.has(message["ttab"])) this.webPorts.get(message["ttab"]).postMessage(message);
				//else trace("no tab", message["ttab"], message["msg"]);
				break;
				
			case SCRIPT_POPUP:
				if(this.popupPort !== null) this.popupPort.postMessage(message);
				//else trace("no popup");
				break;
				
		}
		
	}
	
	/**
	* @method onPortDisconnect: port is disconnected
	* @param port: disconnected port
	* @this {BackgroundPort}
	*/
	onPortDisconnect(port) {
		if(DEBUG) trace("port disconnected", port["name"]);
		
		let infos = {"name": port["name"]};
		
		if(port["name"] == "content") this.contentPorts.delete(port["sender"]["tab"]["id"]);
		else if(port["name"] == "web") this.webPorts.delete(port["sender"]["tab"]["id"]);
		else if(port["name"] == "popup") this.popupPort = null;
		
		this.onDisconnect(infos);
	}
	
	/**
	* @method toContent: send a message to content script
	* @param {number} tabid: which tab
	* @param {string} type: message type
	* @param {Object} message: data
	* @param {Function} callback: executed 
	* @this {BackgroundPort}
	*/
	toContent(tabid, type, message, callback) {
		if(this.contentPorts.has(tabid)) this.contentPorts.get(tabid).postMessage(
			{
				"src": SCRIPT_BACKGROUND, 
				"dst": SCRIPT_CONTENT, 
				"type": type, 
				"msg": message, 
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
			}
		);
	}
	
	/**
	* @method toContentAll: send message to all handled content scripts
	* @param {string} type: message type
	* @param {Object} message: message content
	* @param {Function} callback: 
	* @this {BackgroundPort}
	*/
	toContentAll(type, message, callback) {
		let args = Array.prototype.slice.call(arguments);
		this.contentPorts.forEach(function(port, tabid) {
			this.toContent.apply(this, [tabid].concat(args));
		}.bind(this));
	}
	
	/**
	* @method toWeb: send message to web script
	* @param {number} tabid: 
	* @param {string} type: message type
	* @param {Object} message: message content
	* @param {Function} callback: 
	* @this {BackgroundPort}
	*/
	toWeb(tabid, type, message, callback) {
		if(this.webPorts.has(tabid)) this.webPorts.get(tabid).postMessage(
			{
				"src": SCRIPT_BACKGROUND, 
				"dst": SCRIPT_WEB, 
				"type": type, 
				"msg": message, 
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(3))
			}
		);
	}
	
	/**
	* @method toPopup: send message to popup script
	* @param {string} type: message type
	* @param {Object} message: message content
	* @param {Function} callback: 
	* @this {BackgroundPort}
	*/
	toPopup(type, message, callback) {
		if(this.popupPort !== null) this.popupPort.postMessage(
			{
				"src": SCRIPT_BACKGROUND, 
				"dst": SCRIPT_POPUP, 
				"type": type, 
				"msg": message, 
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(2))
			}
		);
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: message type
	* @param {Object} message: message content
	* @param {Function} callback: 
	* @this {BackgroundPort}
	*/
	fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message);
		if(this.onContentMessage(tabid, type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {BackgroundPort}
	*/
	fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message);
		if(this.onWebMessage(tabid, type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromPopup: received message from popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {BackgroundPort}
	*/
	fromPopup(type, message, callback) {
		//if(DEBUG) trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback) === true) {}
		else callback();
	}
	
}

/**
* @nocollapse
* @extends {PortBase}
*/
class ContentPort extends PortBase {
	
	/**
	* @param {Function} onConnect: connected to background port
	* @param {Function} onBackgroundMessage: message from background port
	* @param {Function} onContentMessage: message from content port
	* @param {Function} onWebMessage: message from web port
	* @param {Function} onPopupMessage: message from popup port
	* @param {Function} onHandle: new tab handled by extension
	* @this {ContentPort}
	*/
	constructor(onConnect, onBackgroundMessage, onContentMessage, onWebMessage, onPopupMessage, onHandle) {
		super();
		
		this.onConnect = onConnect || die;
		this.onBackgroundMessage = onBackgroundMessage || die;
		this.onContentMessage = onContentMessage || die;
		this.onWebMessage = onWebMessage || die;
		this.onPopupMessage = onPopupMessage || die;
		this.onHandle = onHandle || die;
		
		this.tabid = 0;
		
		this.port = this.which.runtime.connect({name: "content"});
		this.portMessageHandler = this.onPortMessage.bind(this);
		this.port.onMessage.addListener(this.portMessageHandler);
	}
	
	/**
	* @method onPortMessage: message from port
	* @param {Object} message: 
	* @this {ContentPort}
	*/
	onPortMessage(message) {
		//if(DEBUG) trace("content port message :", message);
		if(message["type"] == "ack") {
			this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
			this.callbacks.delete(message["msg"]["ack"]);
		}
		else if(message["src"] == SCRIPT_BACKGROUND) this.fromBackground(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		else if(message["src"] == SCRIPT_CONTENT) this.fromContent(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_WEB) this.fromWeb(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_POPUP) this.fromPopup(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		//else trace("FAIL content port message ", message);
	}
	
	/**
	* @method toPort: send a message to port
	* @param {number} target: 
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	toPort(target, tabid, type, message, callback) {
		this.port.postMessage(
			{
				"src": SCRIPT_CONTENT, 
				"dst": target, 
				"type": type, 
				"msg": message, 
				"ftab": this.tabid, 
				"ttab": tabid, 
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(4))
			}
		);
	}
	
	/**
	* @method toBackground: send a message to background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	toBackground(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_BACKGROUND, this.tabid].concat(Array.prototype.slice.call(arguments)));
	}
	
	/**
	* @method toContent: send a message to content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	toContent(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_CONTENT, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}
	
	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	toWeb(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_WEB, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}
	
	/**
	* @method toPopup: send a message to popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	toPopup(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_POPUP, this.tabid].concat(Array.prototype.slice.call(arguments)));
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	fromBackground(type, message, callback) {
		//if(DEBUG) trace(type, "from background :", message);
		
		switch(type) {
			
			case "tabid":
				this.tabid = message;
				this.onConnect(this.tabid);
				return false;
				break;
				
			case "handle":
				this.onHandle(message);
				return false;
				break;
			
		}
		
		if(this.onBackgroundMessage(type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		if(this.onContentMessage(tabid, type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		if(this.onWebMessage(tabid, type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromPopup: received message from popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {ContentPort}
	*/
	fromPopup(type, message, callback) {
		//if(DEBUG) trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback) === true) {}
		else callback();
	}
	
}

/**
* @nocollapse
* @extends {PortBase}
*/
class WebPort extends PortBase {
	
	/**
	* @param {string} extid: extension unique id
	* @param {Function} onConnect: connected to background port
	* @param {Function} onBackgroundMessage: message from background port
	* @param {Function} onContentMessage: message from content port
	* @param {Function} onWebMessage: message from web port
	* @param {Function} onPopupMessage: message from popup port
	* @this {WebPort}
	*/
	constructor(extid, onConnect, onBackgroundMessage, onContentMessage, onWebMessage, onPopupMessage) {
		super();
		
		this.extid = extid;
		
		this.onConnect = onConnect || die;
		this.onBackgroundMessage = onBackgroundMessage || die;
		this.onContentMessage = onContentMessage || die;
		this.onWebMessage = onWebMessage || die;
		this.onPopupMessage = onPopupMessage || die;
		
		this.tabid = 0;
		
		this.port = this.which.runtime.connect(this.extid, {name: "web"});
		this.portMessageHandler = this.onPortMessage.bind(this);
		this.port.onMessage.addListener(this.portMessageHandler);
	}
	
	/**
	* @method onPortMessage: message from port
	* @param {Object} message: 
	* @this {WebPort}
	*/
	onPortMessage(message) {
		//if(DEBUG) trace("web port message :", message);
		if(message["type"] == "ack") {
			this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
			this.callbacks.delete(message["msg"]["ack"]);
		}
		else if(message["src"] == SCRIPT_BACKGROUND) this.fromBackground(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		else if(message["src"] == SCRIPT_CONTENT) this.fromContent(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_WEB) this.fromWeb(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_POPUP) this.fromPopup(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		//else trace("FAIL web port message ", message);
	}
	
	/**
	* @method toPort: send a message to port
	* @param {number} target: 
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	toPort(target, tabid, type, message, callback) {
		this.port.postMessage(
			{
				"src": SCRIPT_WEB, 
				"dst": target, 
				"type": type, 
				"msg": message, 
				"ftab": this.tabid, 
				"ttab": tabid, 
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(4))
			}
		);
	}
	
	/**
	* @method toBackground: send a message to background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	toBackground(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_BACKGROUND, this.tabid].concat(Array.prototype.slice.call(arguments)));
	}
	
	/**
	* @method toContent: send a message to content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	toContent(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_CONTENT, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}
	
	/**
	* @method toWeb: send a message to web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	toWeb(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_WEB, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}
	
	/**
	* @method toPopup: send a message to popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	toPopup(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_POPUP, this.tabid].concat(Array.prototype.slice.call(arguments)));
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	fromBackground(type, message, callback) {
		//if(DEBUG) trace(type, "from background :", message);
		switch(type) {
			
			case "tabid":
				this.tabid = message;
				this.onConnect(this.tabid);
				return false;
				break;
			
		}
		
		if(this.onBackgroundMessage(type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message, "tab", tabid);
		if(this.onContentMessage(tabid, type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		if(this.onWebMessage(tabid, type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromPopup: received message from popup script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {WebPort}
	*/
	fromPopup(type, message, callback) {
		//if(DEBUG) trace(type, "from popup :", message);
		if(this.onPopupMessage(type, message, callback) === true) {}
		else callback();
	}
	
}

/**
* @nocollapse
* @extends {PortBase}
*/
class PopupPort extends PortBase {
	
	/**
	* @param {Function} onConnect: connected to background port
	* @param {Function} onBackgroundMessage: message from background port
	* @param {Function} onContentMessage: message from content port
	* @param {Function} onWebMessage: message from web port
	* @this {PopupPort}
	*/
	constructor(onConnect, onBackgroundMessage, onContentMessage, onWebMessage) {
		super();
		
		this.onConnect = onConnect || die;
		this.onBackgroundMessage = onBackgroundMessage || die;
		this.onContentMessage = onContentMessage || die;
		this.onWebMessage = onWebMessage || die;
		
		this.port = this.which.runtime.connect({name: "popup"});
		this.portMessageHandler = this.onPortMessage.bind(this);
		this.port.onMessage.addListener(this.portMessageHandler);
	}
	
	/**
	* @method onPortMessage: message from port
	* @param {Object} message: 
	* @this {PopupPort}
	*/
	onPortMessage(message) {
		//if(DEBUG) trace("port message :", message);
		if(message["type"] == "ack") {
			this.callbacks.get(message["msg"]["ack"])["callback"].apply(this, [message["msg"]["result"]].concat(this.callbacks.get(message["msg"]["ack"])["args"]));
			this.callbacks.delete(message["msg"]["ack"]);
		}
		else if(message["src"] == SCRIPT_BACKGROUND) this.fromBackground(message["type"], message["msg"], this.callback(message["ack"], message["src"]));
		else if(message["src"] == SCRIPT_CONTENT) this.fromContent(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		else if(message["src"] == SCRIPT_WEB) this.fromWeb(message["ftab"], message["type"], message["msg"], this.callback(message["ack"], message["src"], message["ftab"]));
		//else trace("FAIL popup port message ", message);
	}
	
	/**
	* @method toPort: send a message to port
	* @param {number} target: 
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupPort}
	*/
	toPort(target, tabid, type, message, callback) {
		this.port.postMessage(
			{
				"src": SCRIPT_POPUP, 
				"dst": target, 
				"type": type, 
				"msg": message, 
				"ftab": 0, 
				"ttab": tabid, 
				"ack": this.ack.apply(this, Array.prototype.slice.call(arguments).slice(4))
			}
		);
	}
	
	/**
	* @method toBackground: send a message to background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupPort}
	*/
	toBackground(type, message, callback) {
		this.toPort.apply(this, [SCRIPT_BACKGROUND, 0].concat(Array.prototype.slice.call(arguments)));
	}
	
	/**
	* @method toContent: send a message to content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupPort}
	*/
	toContent(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_CONTENT, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}
	
	/**
	* @method toContent: send a message to web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupPort}
	*/
	toWeb(tabid, type, message, callback) {
		this.toPort.apply(this, [SCRIPT_WEB, tabid].concat(Array.prototype.slice.call(arguments).slice(1)));
	}
	
	/**
	* @method fromBackground: received message from background script
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupPort}
	*/
	fromBackground(type, message, callback) {
		//if(DEBUG) trace(type, "from background :", message);
		if(this.onBackgroundMessage(type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromContent: received message from content script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupPort}
	*/
	fromContent(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from content :", message, "tab", tabid);
		if(this.onContentMessage(tabid, type, message, callback) === true) {}
		else callback();
	}
	
	/**
	* @method fromWeb: received message from web script
	* @param {number} tabid: 
	* @param {string} type: 
	* @param {Object} message: 
	* @param {Function} callback: 
	* @this {PopupPort}
	*/
	fromWeb(tabid, type, message, callback) {
		//if(DEBUG) trace(type, "from web :", message, "tab", tabid);
		if(this.onWebMessage(tabid, type, message, callback) === true) {}
		else callback();
	}
	
}