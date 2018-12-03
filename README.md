# WebExtBase

Nico Pr

https://nicopr.fr/chromextensions

install :

	- load unpacked extension in Chrome Developper Mode
	- copy extension ID from extensions page
	- paste extension ID in {ExtensionDir}/resources/web.js : line 10

#### Communications between background / content / web / popup scripts :
	
There are two ways to communicate :

- ports : messages are sent through Port objects
- runtime : messages are sent using API methods :
	- chrome.runtime.sendMessage
	- chrome.tabs.sendMessage
	- window.postMessage

This project aims to unify runtime and port messaging, and make extensions development fast and easy
			
			
# How it works	

Port messaging is pretty simple : all messages piped through background script

Runtime messaging is ugly, and may be UNSTABLE :

- Background :
  - can send to content via chrome.tabs
  - cannot send to web (window.postMessage)
      >send through content (chrome.tabs > window.postMessage)
  - can send to popup via chrome.runtime
- Content :
  - can send to background via chrome.runtime
  - can send to web via window.postMessage
      >same tab only, send to other web script through background > content > window.postMessage
  - can send to popup via chrome.runtime
- Web :
  - can send to background via chrome.runtime
  - cannot send to content (chrome.tabs)
      >send through background (chrome.runtime > chrome.tabs)
  - can send to popup via chrome.runtime
- Popup :
  - can send to background via chrome.runtime
  - can send to content via chrome.tabs
  - cannot send to web (window.postMessage)
      >send through content (chrome.tabs > window.postMessage)

#### Communication :

ports : BackgroundPort, ContentPort, WebPort, PopupPort

message : BackgroundMessage, ContentMessage, WebMessage, PopupMessage

TODO

	
#### Extension parts :

	ExtensionBackgroundScript : background script, access chrome apis, relay messages

	ExtensionContentScript : extension script, injected in every page matching manifest url rules

	ExtensionWebScript : web script, injected in website execution context

	ExtensionPopupScript : popup script, extension settings UI (top right icon)

Communications are included in scripts, define COMM_TYPE in resources/base/extbase.js to choose ports or messages

Methods to send messages :

	toBackground(type, message, callback, ...args); // send message to background script
	toContent(tabid, type, message, callback, ...args); // send message to content script
	toWeb(tabid, type, message, callback, ...args); // send message to web script
	toPopup(type, message, callback, ...args); // send message to popup script

Override these methods to receive messages :

	fromBackground(type, message, callback)
	fromContent(tabid, type, message, callback)
	fromWeb(tabid, type, message, callback)
	fromPopup(type, message, callback)

overload arguments "...args" are passed back to callback method with the message result
	
## Example

In background script :

```this.toContent({tabId}, "myType", {my: "message"}, myCallback.bind(this), "overload0", 1, {over: "load2"});```

Triggers "fromBackground" method defined in extension content script

```
fromBackground(type, message, callback) {
	console.log(type, "message from bg :", message); // "myType" message from bg : {my: "message"}
	// some code
	if(message.my == "message") doMoreThings();

	callback({some: "results"}); // fires callback method passed to "toContent" method in background script

	// OR IN LATER ASYNC CALL
	setTimeout(callback, 1000, {some: "results"}̀);
	return true; // or callback will be fired by super class
}
```

Triggers background script callback passed to toContent() call

```
myCallback(result, overload0, overload1, overload2) {
	console.log(result); // {some: "results"}
	console.log(overload0, overload1, overload2); // "overload0", 1, {over: "load2"}
}
```
	


**receive methods MUST return true if async callback is needed !**
>fromBackground fromContent fromWeb fromPopup

**if return false the callback will be fired synchronously with null result**

if callback is not needed, pass the message without callback arg
