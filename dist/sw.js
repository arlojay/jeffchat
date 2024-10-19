/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/common/bufferUtil.ts":
/*!**********************************!*\
  !*** ./src/common/bufferUtil.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nexports.bufferToBase64 = bufferToBase64;\nexports.bufferToHex = bufferToHex;\nexports.base64ToBuffer = base64ToBuffer;\nexports.hexToBuffer = hexToBuffer;\nexports.textToBuffer = textToBuffer;\nexports.bufferToText = bufferToText;\nexports.buffersEqual = buffersEqual;\nfunction bufferToBase64(data) {\n    return new Promise((res, rej) => {\n        const fileReader = new FileReader();\n        fileReader.readAsDataURL(new Blob([data]));\n        fileReader.addEventListener(\"load\", () => {\n            res(fileReader.result.split(\",\")[1]);\n        });\n        fileReader.addEventListener(\"error\", (e) => {\n            rej(e);\n        });\n    });\n}\nfunction bufferToHex(data) {\n    const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : data;\n    return Array.from(dataArray).map(v => v.toString(16).padStart(2, \"0\")).join(\"\");\n}\nasync function base64ToBuffer(base64) {\n    const url = \"data:application/octet-stream;base64,\" + base64;\n    return await fetch(url).then(v => v.arrayBuffer());\n}\nfunction hexToBuffer(data) {\n    return new Uint8Array(data.match(/.{2}/g).map(v => parseInt(v, 16))).buffer;\n}\nfunction textToBuffer(text) {\n    let array = new Uint16Array(text.length);\n    for (let i = 0; i < text.length; i++) {\n        array[i] = text.charCodeAt(i);\n    }\n    return array.buffer;\n}\nfunction bufferToText(buffer) {\n    const array = new Uint16Array(buffer);\n    let data = new Array(array.length);\n    for (let i = 0; i < array.length; i++) {\n        data[i] = String.fromCharCode(array[i]);\n    }\n    return data.join(\"\");\n}\nfunction buffersEqual(bufferA, bufferB) {\n    const viewA = new Uint8Array(bufferA);\n    const viewB = new Uint8Array(bufferB);\n    if (viewB.length != viewA.length)\n        return false;\n    for (let i = 0; i < viewA.length; i++) {\n        if (viewB[i] != viewA[i])\n            return false;\n    }\n    return true;\n}\n\n\n//# sourceURL=webpack://my-webpack-project/./src/common/bufferUtil.ts?");

/***/ }),

/***/ "./src/common/icons.ts":
/*!*****************************!*\
  !*** ./src/common/icons.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nexports.GravatarIcon = void 0;\nexports.createRobohashIcon = createRobohashIcon;\nconst bufferUtil_1 = __webpack_require__(/*! ./bufferUtil */ \"./src/common/bufferUtil.ts\");\nclass GravatarIcon {\n    hash;\n    constructor(hash) {\n        this.hash = hash ?? \"\";\n    }\n    static fromURL(url) {\n        const parts = new URL(url);\n        const hash = parts.pathname.split(\"/\").pop();\n        return new GravatarIcon(hash);\n    }\n    async setFromEmail(email) {\n        const buffer = await crypto.subtle.digest(\"SHA-256\", new Uint8Array(new Uint16Array((0, bufferUtil_1.textToBuffer)(email))));\n        this.hash = (0, bufferUtil_1.bufferToHex)(buffer);\n        return this.hash;\n    }\n    createURL(settings) {\n        settings ??= {};\n        settings.size ??= null;\n        settings.defaultType ??= \"404\";\n        settings.forceDefault ??= false;\n        settings.rating ??= \"G\";\n        const search = new URLSearchParams;\n        if (settings.size != null)\n            search.set(\"s\", settings.size + \"\");\n        search.set(\"d\", settings.defaultType);\n        if (settings.forceDefault)\n            search.set(\"f\", \"y\");\n        search.set(\"r\", settings.rating);\n        return \"https://gravatar.com/avatar/\" + this.hash + \"?\" + search;\n    }\n}\nexports.GravatarIcon = GravatarIcon;\nfunction createRobohashIcon(hash, set = 1) {\n    return \"https://robohash.org/\" + hash + \"?set=set\" + set;\n}\n\n\n//# sourceURL=webpack://my-webpack-project/./src/common/icons.ts?");

/***/ }),

/***/ "./src/service-worker/fetchCache.ts":
/*!******************************************!*\
  !*** ./src/service-worker/fetchCache.ts ***!
  \******************************************/
/***/ ((__unused_webpack_module, exports) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nexports.FetchCache = void 0;\nclass FetchCache {\n}\nexports.FetchCache = FetchCache;\n\n\n//# sourceURL=webpack://my-webpack-project/./src/service-worker/fetchCache.ts?");

/***/ }),

/***/ "./src/service-worker/gravatarCache.ts":
/*!*********************************************!*\
  !*** ./src/service-worker/gravatarCache.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nexports.GravatarCache = void 0;\nconst icons_1 = __webpack_require__(/*! ../common/icons */ \"./src/common/icons.ts\");\nconst fetchCache_1 = __webpack_require__(/*! ./fetchCache */ \"./src/service-worker/fetchCache.ts\");\nconst CACHE_LIFETIME = 4 * 60 * 60 * 1000; // 4 hours\nclass GravatarCache extends fetchCache_1.FetchCache {\n    match(request) {\n        return /^https?:\\/\\/(www\\.)?gravatar\\.com\\/avatar\\//g.test(request.url);\n    }\n    async isAvatarExpired(emailHash) {\n        const cache = await caches.open(\"gravatar-meta\");\n        const item = await cache.match(emailHash);\n        if (item == null)\n            return true;\n        const date = new Date(item.headers.get(\"date\"));\n        if (Date.now() - date.getTime() > CACHE_LIFETIME)\n            return true;\n        const data = await item.json();\n        const oldIconHash = data.hash;\n        const iconURL = new icons_1.GravatarIcon(emailHash).createURL({\n            size: 32, defaultType: \"identicon\", rating: \"X\"\n        });\n        const iconResponse = await fetch(iconURL);\n        const iconData = await iconResponse.clone().arrayBuffer();\n        const newIconHash = await crypto.subtle.digest({ name: \"SHA-256\" }, iconData);\n        const iconCache = await caches.open(\"gravatar\");\n        iconCache.put(iconURL, iconResponse);\n        if (newIconHash != oldIconHash)\n            return true;\n        return false;\n    }\n    async deleteIconCaches(iconURL) {\n        const iconCache = await caches.open(\"gravatar\");\n        const promises = new Set;\n        for (const key of await iconCache.keys()) {\n            if (new URL(key.url).pathname != new URL(iconURL).pathname)\n                continue;\n            promises.add(iconCache.delete(key));\n        }\n        await Promise.all(promises);\n    }\n    async proxyRequest(request) {\n        const url = new URL(request.url);\n        console.log(url.pathname);\n        const cache = await caches.open(\"gravatar\");\n        if (await this.isAvatarExpired(icons_1.GravatarIcon.fromURL(request.url).hash)) {\n            await this.deleteIconCaches(request.url);\n        }\n        else {\n            const item = await cache.match(request);\n            if (item != null)\n                return item;\n        }\n        const response = await fetch(request);\n        if (response.status < 200)\n            cache.put(request, response.clone());\n        return response;\n    }\n}\nexports.GravatarCache = GravatarCache;\n\n\n//# sourceURL=webpack://my-webpack-project/./src/service-worker/gravatarCache.ts?");

/***/ }),

/***/ "./src/service-worker/index.ts":
/*!*************************************!*\
  !*** ./src/service-worker/index.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nconst gravatarCache_1 = __webpack_require__(/*! ./gravatarCache */ \"./src/service-worker/gravatarCache.ts\");\nconst robohashCache_1 = __webpack_require__(/*! ./robohashCache */ \"./src/service-worker/robohashCache.ts\");\nconst fetchHandlers = [\n    new gravatarCache_1.GravatarCache,\n    new robohashCache_1.RobohashCache\n];\nself.addEventListener(\"fetch\", (event) => {\n    for (const handler of fetchHandlers) {\n        if (handler.match(event.request)) {\n            event.respondWith(handler.proxyRequest(event.request));\n            return;\n        }\n    }\n});\n\n\n//# sourceURL=webpack://my-webpack-project/./src/service-worker/index.ts?");

/***/ }),

/***/ "./src/service-worker/robohashCache.ts":
/*!*********************************************!*\
  !*** ./src/service-worker/robohashCache.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nexports.RobohashCache = void 0;\nconst fetchCache_1 = __webpack_require__(/*! ./fetchCache */ \"./src/service-worker/fetchCache.ts\");\nclass RobohashCache extends fetchCache_1.FetchCache {\n    match(request) {\n        return /^https?:\\/\\/(www\\.)?robohash\\.org\\//g.test(request.url);\n    }\n    async proxyRequest(request) {\n        const url = new URL(request.url);\n        console.log(url.pathname);\n        const cache = await caches.open(\"robohash\");\n        const item = await cache.match(request);\n        if (item != null)\n            return item;\n        const response = await fetch(request);\n        if (response.status < 200)\n            cache.put(request, response.clone());\n        return response;\n    }\n}\nexports.RobohashCache = RobohashCache;\n\n\n//# sourceURL=webpack://my-webpack-project/./src/service-worker/robohashCache.ts?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/service-worker/index.ts");
/******/ 	
/******/ })()
;