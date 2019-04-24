const lang = (navigator.language || navigator.userLanguage).slice(0, 2);

/**
* @method merge: merge objects
* @param {...*} var_args
*/
function merge(var_args) {
	return Object.assign.apply(this, Array.prototype.slice.call(arguments));
}

function mergeArrays(a, b, p) {
	return a.filter(aa => ! b.find (bb => aa[p] === bb[p])).concat(b);
}

/**
* @method trace: console.log with file name and line number
* @param {...*} var_args
*/
function trace(var_args) {
	// return; // no trace
	let args = Array.prototype.slice.call(arguments);
	if(DEBUG) {
		let stack = new Error().stack.trim(), re = /([\w\.]+)\.js:(\d+)/gmi, fileLine = null, n = 0;
		while(n++ < 2) fileLine = re.exec(stack);
		args.push("\t" + fileLine[1] + ":" + fileLine[2]);
	}
	console.log.apply(console, args);
}

function where() {
	let which = (typeof chrome === "undefined") ? (typeof browser === "undefined") ? null : browser : chrome;
	return (which && which.extension && which.extension.getBackgroundPage ? (which.extension.getBackgroundPage() === window ? "background" : "popup") : (!which || !which.runtime || !which.runtime.onMessage ? "web" : "content")); // lol 1-liner
	/*if(chrome && chrome.extension && chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window) return "BACKGROUND";
	else if(chrome && chrome.extension && chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() !== window) return "POPUP";
	else if(!chrome || !chrome.runtime || !chrome.runtime.onMessage) return "WEB";
	else return "CONTENT";*/
}

/**
* @method die: argh
* @param {...*} var_args
*/
function die(var_args) {
	trace.apply(this, ["DIE"].concat(Array.prototype.slice.call(arguments)));
}

/**
* @method trace: console.log with file name and line number
* @param {string=} causeOfDeath
*/
function defined(value) {
	return typeof(value) !== "undefined" && value !== null;
}

function style(element, prop) {
	return window.getComputedStyle(element, null).getPropertyValue(prop);
}

class Comm {
	
	static async request(url, options) {
		return new Promise(function(resolve, reject) {
			options = merge({"method": "GET", "data": undefined, "user": undefined, "password": undefined, "progress": die, "json": true, "jsond": false, headers: {}}, options);
			let xhr = new XMLHttpRequest();
			if(options.hasOwnProperty("progress")) xhr.upload.onprogress = function(event) {
				options["progress"].apply(xhr, [(event.loaded / event.total * 100).toFixed(1)]);
			};
			xhr.onreadystatechange = function() {
				//Comm.xhr_state(xhr.status, xhr.readyState);
				if(xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) resolve({state: true, status: xhr.status, response: options["json"] ? JSON.parse(xhr.responseText) : xhr.responseText});
				else if(xhr.status !== 200 && xhr.status !== 0) if(xhr.readyState === 4) resolve({state: false, status: xhr.status, response: options["json"] ? JSON.parse(xhr.responseText) : xhr.responseText});
			};
			xhr.open(options["method"], url, true, options["user"], options["password"]);
			if(options.hasOwnProperty("headers")) for(let header in options["headers"]) xhr.setRequestHeader(header, options["headers"][header]);
			if(options["jsond"]) xhr.send(options["data"]);
			else if(typeof options["data"] !== "undefined") xhr.send(Object.keys(options["data"]).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(options["data"][key])).join("&"));
			else xhr.send();
		});
	}
	
	static xhr_state(status, readyState) {
		let s = {0: "READY", 200: "OK", 302: "FOUND", 304: "NOT MODIFIED", 400: "BAD REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT FOUND", 405: "METHOD NOT ALLOWED", 500: "INTERNAL SERVER ERROR"};
		let r = {0: "UNSENT", 1: "OPENED", 2: "HEADERS_RECEIVED", 3: "LOADING", 4: "DONE"};
		trace(s[status] || status, r[readyState] || readyState);
	}
	
	static async urlrequest(url, options) {
		return await this.request(url, merge(options, {"headers": {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}}));
	}
	
	static async jwtrequest(url, options, jwt) {
		return await this.request(url, merge(options, {"headers": {"Authorization": "Bearer " + jwt, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}}));
	}
	
	static async get(url) {
		return await this.urlrequest(url, {});
	}
	
	static async post(url, data) {
		return await this.urlrequest(url, {"method": "POST", "data": data});
	}
	
	static async json(url, data) {
		return await this.request(url, {"method": "POST", "jsond": true, "data": JSON.stringify(data), "headers": {"Content-Type": "application/json"}});
	}
	
}