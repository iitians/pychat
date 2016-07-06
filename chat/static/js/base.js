navigator.getUserMedia =  navigator.getUserMedia|| navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
var USER_REGEX = /^[a-zA-Z-_0-9]{1,16}$/;
var historyStorage;
var MAX_STORAGE_LENGTH = 3000;
var blankRegex = /^\s*$/;
var fileTypeRegex = /\.(\w+)(\?.*)?$/;
window.sound = 0;
window.loggingEnabled = true;
var growlHolder;
var ajaxLoader;
var linksRegex = /(https?:&#x2F;&#x2F;.+?(?=\s+|<br>|$))/g; /*http://anycharacter except end of text, <br> or space*/
var replaceLinkPattern = '<a href="$1" target="_blank">$1</a>';
var muteBtn;
var currentPlayingAudio;
const escapeMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"\n": '<br>',
	"/": '&#x2F;'
};
var volumeProportion = {
	0: 0,
	1: 0.15,
	2: 0.4,
	3: 1
};
var volumeIcons = {
	0: 'icon-volume-off',
	1: 'icon-volume-1',
	2: 'icon-volume-2',
	3: 'icon-volume-3'
};
var replaceHtmlRegex = new RegExp("["+Object.keys(escapeMap).join("")+"]",  "g");

var $ = function (id) {
	return document.getElementById(id);
};


window.browserVersion = (function () {
	var ua = navigator.userAgent, tem,
		M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
	if (/trident/i.test(M[1])) {
		tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
		return 'IE ' + (tem[1] || '');
	}
	if (M[1] === 'Chrome') {
		tem = ua.match(/\bOPR\/(\d+)/);
		if (tem != null) {
			return 'Opera ' + tem[1];
		}
	}
	M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
	if ((tem = ua.match(/version\/(\d+)/i)) != null) {
		M.splice(1, 1, tem[1]);
	}
	return M.join(' ');
})();


function getUrlParam(name, url) {
	if (!url) url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	// TODO encode "#" ? like new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)", "i"),
	var regex = new RegExp("[?&]" + name + "(=([^&]*)|&|$)", "i"),
			results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function setUrlParam(name, value) {
	var prevValue = getUrlParam(name);
	if (prevValue == null) {
		var textToFormat = url.indexOf("?") >= 0 ? "{}&{}={}" : "{}?{}={}";
		var text = textToFormat.format(window.location.href, name, value);
	} else {
		text = window.location.href.replace(name + "=" + prevValue, name + "=" + value);
	}
	window.history.pushState('page2', 'Title', text);
}

function onDocLoad(onload) {
	return document.addEventListener("DOMContentLoaded", onload);
}


function encodeHTML(html) {
	return html.replace(replaceHtmlRegex, function (s) {
		return escapeMap[s];
	});
}


function encodeAnchorsHTML(html) {
	//&#x2F;&#x2F; = // (already encoded by encodeHTML above)
    return encodeHTML(html).replace(linksRegex, replaceLinkPattern);
}


var CssUtils = {
	visibilityClass: 'hidden',
	hasClass: function(element, className){
		return element.className != null && element.className.indexOf(className) >= 0;
	},
	addClass: function (element, className) {
		if (!CssUtils.hasClass(element, className)) {
			var oldClassName = element.className;
			element.className = "{} {}".format(oldClassName.trim(), className);
		}
	},
	deleteElement: function(target) {
		target.parentNode.removeChild(target)
	},
	setOnOf: function(element, desiredClass, removeClasses) {
		var className = element.className;
		if (className == null) {
			element.className = desiredClass;
		} else {
			var replaceReg = new RegExp("(" + removeClasses.join("|") + ")", "g");
			className = className.replace(replaceReg, '');
			element.className = className + " " + desiredClass;
		}
	},
	isHidden: function(element) {
		return CssUtils.hasClass(element, CssUtils.visibilityClass);
	},
	removeClass: function (element, className) {
		if (CssUtils.hasClass(element, className)) {
			element.className = element.className.replace(className, '');
		}
	},
	showElement: function (element) {
		CssUtils.removeClass(element, CssUtils.visibilityClass)
	},
	hideElement: function (element) {
		CssUtils.addClass(element, CssUtils.visibilityClass);
	},
	toggleVisibility: function (element) {
		return CssUtils.toggleClass(element,CssUtils.visibilityClass);
	},
	setVisibility: function(element, isVisible){
		if (isVisible) {
			CssUtils.removeClass(element, CssUtils.visibilityClass);
		} else {
			CssUtils.addClass(element, CssUtils.visibilityClass);
		}
	},
	toggleClass: function (element, className) {
		if (CssUtils.hasClass(element, className)) {
			CssUtils.removeClass(element, className);
			return false;
		} else {
			CssUtils.addClass(element, className);
			return true;
		}
	}
};


var Growl = function (message) {
	var self = this;
	self.growlHolder = growlHolder;
	self.message = message.trim();
	self.error = function () {
		self.show(4000, 'col-error')
	};
	self.success = function () {
		self.show(3000, 'col-success')
	};
	self.info = function () {
		self.show(3000, 'col-info');
	};
	self.hide = function () {
		self.growl.style.opacity = 0;
		setTimeout(self.remove, 500); // 500 = $(.growl):transition 0.5s
	};
	self.remove = function () {
		if (self.growl.parentNode === self.growlHolder) {
			self.growlHolder.removeChild(self.growl)
		}
	};
	self.show = function (baseTime, growlClass) {
		var timeout = baseTime + self.message.length * 50;
		self.growl = document.createElement('div');
		self.growl.innerHTML = self.message.indexOf("<") == 0? self.message : encodeAnchorsHTML(self.message);
		self.growl.className = 'growl ' + growlClass;
		self.growlHolder.appendChild(self.growl);
		self.growl.clientHeight; // request to paint now!
		self.growl.style.opacity += 1;
		self.growl.onclick = self.hide;
		setTimeout(self.hide, timeout);
	};

};


function growlSuccess(message) {
	new Growl(message).success();
}

function growlError(message) {
	new Growl(message).error();
}

function growlInfo(message) {
	new Growl(message).info();
}


// TODO replace with HTML5 if possible
function Draggable(container, headerText) {
	var self = this;
	self.dom = {
		container:  container
	};
	self.headerText = headerText;
	self.init = function () {
		CssUtils.addClass(self.dom.container, "modal-body");
		CssUtils.addClass(self.dom.container, "modal-draggable");
		self.dom.header = document.createElement('DIV');
		self.dom.header.className = 'windowHeader noSelection';
		self.dom.header.addEventListener ("mousedown", self.eleMouseDown, false);
		self.dom.headerText = document.createElement('span');
		self.dom.header.appendChild(self.dom.headerText);
		self.dom.headerText.style = 'display: inline-block';
		self.setHeaderText(self.headerText);
		var iconCancel = document.createElement('i');
		self.dom.header.appendChild(iconCancel);
		iconCancel.style = "float: right; color: rgb(177, 53, 51)";
		iconCancel.onclick = self.hide;
		iconCancel.className = 'icon-cancel';
		self.dom.body = self.dom.container.children[0];
		CssUtils.addClass(self.dom.body, 'window-body');
		self.dom.container.insertBefore(self.dom.header, self.dom.body);
	};
	self.hide = function () {
		CssUtils.hideElement(self.dom.container);
	};
	self.setHeaderText = function (text) {
		self.dom.headerText.innerHTML = text;
	};
	self.show = function () {
		CssUtils.showElement(self.dom.container);
	};
	self.attached = true;
	self.eleMouseDown = function (ev) {
		if (ev.target.tagName == 'I') {
			return; // if close icon was clicked
		}
		self.leftCorrection =  self.dom.container.offsetLeft - ev.pageX;
		self.topCorrection = self.dom.container.offsetTop - ev.pageY;
		// TODO 7 is kind of magical bottom margin when source is attached to video
		self.maxTop = document.body.clientHeight - self.dom.container.clientHeight - 7;
		self.maxLeft =  document.body.clientWidth - self.dom.container.clientWidth - 3;
		document.addEventListener ("mousemove", self.eleMouseMove, false);
	};
	self.eleMouseMove = function (ev) {
		var left = ev.pageX + self.leftCorrection;
		if (left < 0) {
			left = 0;
		} else if (left > self.maxLeft) {
			left = self.maxLeft;
		}
		self.dom.container.style.left = left + "px";
		var top = ev.pageY + self.topCorrection;
		if (top < 0) {
			top = 0;
		} else if (top > self.maxTop) {
			top = self.maxTop;
		}
		self.dom.container.style.top = top + "px";
		if (self.attached) {
			document.addEventListener ("mouseup", self.eleMouseUp, false);
			self.attached = false;
		}
	};
	self.eleMouseUp = function () {
		document.removeEventListener ("mousemove", self.eleMouseMove, false);
		document.removeEventListener ("mouseup", self.eleMouseUp, false);
		self.attached = true;
	};
	self.super = {
		show: self.show
	};
	self.init();
}


onDocLoad(function () {
	muteBtn = $("muteBtn");
	var sound = localStorage.getItem('sound');
	if (sound == null) {
		window.sound = 0;
	} else {
		window.sound = sound - 1;
	}
	mute();
	var theme = localStorage.getItem('theme');
	if (theme != null) {
		document.body.className = theme;
	}
	ajaxLoader = $("ajaxStatus");
	if (typeof InstallTrigger !== 'undefined') { // browser = firefox
		console.warn(getDebugMessage("Ops, there's no scrollbar for firefox"));
	}
	growlHolder = $('growlHolder');
});


function mute() {
	window.sound = (window.sound + 1) % 4;
	localStorage.sound = window.sound;
	if (muteBtn) muteBtn.className = volumeIcons[window.sound];
}


function login(event) {
	event.preventDefault();
	var callback = function (data) {
		if (data === RESPONSE_SUCCESS) {
			var nextUrl =getUrlParam('next');
			if (nextUrl == null) {
				nextUrl = '/';
			}
			window.location.href = nextUrl;
		} else {
			growlError(data);
		}
	};
	doPost('/auth', null, callback, loginForm);
}


function checkAndPlay(element) {
	if (!window.sound) {
		return;
	}
	try {
		element.pause();
		element.currentTime = 0;
		element.volume = volumeProportion[window.sound];
		element.play();
	} catch (e) {
		console.error(getDebugMessage("Skipping playing message, because {}", e.message || e));
	}
}


function readCookie(name, c, C, i) {
	c = document.cookie.split('; ');
	var cookies = {};
	for (i = c.length - 1; i >= 0; i--) {
		C = c[i].split('=');
		cookies[C[0]] = C[1];
	}
	var cookie = cookies[name];
	if (cookie != null) {
		var length = cookie.length - 1;
		// if cookie is wrapped with quotes (for ex api)
		if (cookie[0] === '"' && cookie[length] === '"') {
			cookie = cookie.substring(1, length);
		}
	}
	return cookie;
}

function ajaxShow() {
	ajaxLoader.className = 'show';
}

function ajaxHide() {
	ajaxLoader.className = '';
}

/**
 * @param params : object dict of params or DOM form
 * @param callback : function calls on response
 * @param url : string url to post
 * @param form : form in canse form is used
 * */
function doPost(url, params, callback, form) {
	var r = new XMLHttpRequest();
	r.onreadystatechange = function () {
		if (r.readyState === 4) {
			if (r.status === 200) {
				console.log(getDebugMessage("POST in: {} ::: {};", url, r.response));
			} else {
				console.error(getDebugMessage("POST in: {} ::: {}, status:", url, r.response, r.status));
			}
			if (typeof(callback) === "function") {
				callback(r.response);
			} else {
				console.warn(getDebugMessage("Skipping {} callback for POST {}", callback, url));
			}
		}
	};
	/*Firefox doesn't accept null*/
	var data = form == null ? new FormData() : new FormData(form);

	if (params) {
		for (var key in params) {
			if (params.hasOwnProperty(key)) {
				data.append(key, params[key]);
			}
		}
	}
	if (url === "") {
		url = window.location.href ; // f*cking IE
	}
	r.open("POST", url, true);
	r.setRequestHeader("X-CSRFToken", readCookie("csrftoken"));
	console.log(getDebugMessage("POST out: {} ::: {}", url, params));
	r.send(data);
}


/**
 * Loads file from server on runtime */
function doGet(fileUrl, callback) {
	console.log(getDebugMessage("GET out: {}", fileUrl));
	var regexRes = fileTypeRegex.exec(fileUrl);
	var fileType = regexRes != null && regexRes.length === 3 ? regexRes[1] : null;
	var fileRef = null;
	switch (fileType) {
		case 'js':
			fileRef = document.createElement('script');
			fileRef.setAttribute("type", "text/javascript");
			fileRef.setAttribute("src", fileUrl);
			break;
		case 'css':
			fileRef = document.createElement("link");
			fileRef.setAttribute("rel", "stylesheet");
			fileRef.setAttribute("type", "text/css");
			fileRef.setAttribute("href", fileUrl);
			break;
		case 'json':
		default:
			var xobj = new XMLHttpRequest();
			// special for IE
			if (xobj.overrideMimeType) {
				xobj.overrideMimeType("application/json");
			}
			xobj.open('GET', fileUrl, true); // Replace 'my_data' with the path to your file
			xobj.onreadystatechange = function () {
				if (xobj.readyState === 4 && xobj.status === 200) {
					console.log(getDebugMessage('GET in: {} ::: "{}"...', fileUrl, xobj.responseText.substr(0, 100)));
					if (callback) {
						callback(xobj.responseText);
					}
				}
			};
			xobj.send(null);
	}
	if (fileRef) {
		document.getElementsByTagName("head")[0].appendChild(fileRef);
		fileRef.onload = callback;
	}
}


function saveLogToStorage(result) {
	if (!window.loggingEnabled) {
		return;
	}
	if (historyStorage == null) {
		historyStorage = result;
	} else if (historyStorage.length > MAX_STORAGE_LENGTH) {
		var notConcatInfo = historyStorage +';;;'+ result;
		historyStorage = notConcatInfo.substr(notConcatInfo.length - MAX_STORAGE_LENGTH, notConcatInfo.length);
	} else {
		historyStorage = historyStorage + ';;;' + result;
	}
}


String.prototype.format = function() {
	var res = this;
	for (var i = 0; i < arguments.length; i++) {
		res = res.replace('{}', arguments[i]);
	}
	return res;
};


/** in 23 - out 23
 *  */
function sliceZero(number, count) {
	return String("00" + number).slice(count || -2);
}


/**
 *
 * Formats message for debug,
 * Usage getDebugMessage("{} is {}", 'war', 'bad');
 * @returns: "15:09:31:009: war is bad"
 *  */
function getDebugMessage() {
	var now = new Date();
	// first argument is format, others are params
	var text;
	if (arguments.length > 1) {
		var args = Array.prototype.slice.call(arguments);
		args.shift();
		text = arguments[0].format(args);
	} else {
		text = arguments[0];
	}
	var result = "{}:{}:{}.{}: {}".format(
			sliceZero(now.getHours()),
			sliceZero(now.getMinutes()),
			sliceZero(now.getSeconds()),
			sliceZero(now.getMilliseconds(), -3),
			text
	);
	saveLogToStorage(result);
	return result;
}


window.onerror = function (msg, url, linenumber) {
	var message = 'Error occurred in {}:{}\n{}'.format(url, linenumber, msg);
	growlError(message);
	return false;
};