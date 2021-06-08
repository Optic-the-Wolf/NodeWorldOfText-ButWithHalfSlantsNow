﻿var YourWorld = {
	Color: window.localStorage ? +localStorage.getItem("color") : 0,
	Nickname: state.userModel.username
};

var owot, owotCtx, textInput;
var linkElm, linkDiv;
function init_dom() {
	owot = document.getElementById("owot");
	owot.hidden = false;
	owot.style.cursor = defaultCursor;
	owotCtx = owot.getContext("2d");
	textInput = document.getElementById("textInput");
	textInput.value = "";
	linkElm = elm.link_element;
	linkDiv = elm.link_div;
	updateCoordDisplay();
	defineElements({
		owot: owot,
		textInput: textInput
	});
}
function getWndWidth() {
	return document.body.clientWidth;
}
function getWndHeight() {
	return document.body.clientHeight;
}
function decimal(percentage) {
	return percentage / 100;
}
function normFontSize(size) {
	return Math.floor(size / 0.1) * 0.1;
}
function deviceRatio() {
	var ratio = window.devicePixelRatio;
	if(!ratio) ratio = 1;
	return ratio;
}

var enums = {};
function makeEnum(vars) {
	var enums = {};
	for(var i = 0; i < vars.length; i++) {
		enums[vars[i]] = i;
	}
	return enums;
}

enums.edit = makeEnum(["tileY", "tileX", "charY", "charX", "time", "char", "id", "color"]);
enums.position = makeEnum(["tileX", "tileY", "charX", "charY"]);

var ws_path = createWsPath();

var nextObjId              = 1; // Next edit ID
var owotWidth              = getWndWidth();
var owotHeight             = getWndHeight();
var js_alert_active        = false; // JS alert window is open
var worldFocused           = false;
var chatResizing           = false;
var tiles                  = {}; // All loaded tiles
var images                 = {}; // { name: [data RGBA, width, height] }
var keysPressed            = {};
var verticalEnterPos       = [0, 0]; // position to go when pressing enter (tileX, charX)
var imgPatterns            = {};
var tileCanvasPool         = [];
var textColorOverride      = 0; // public-member-owner bitfield

// configuration
var positionX              = 0; // client position in pixels
var positionY              = 0;
var coordSizeX             = 4;
var coordSizeY             = 4;
var gridEnabled            = false;
var subgridEnabled         = false; // character-level grid
var linksEnabled           = true;
var linksRendered          = true;
var colorsEnabled          = true;
var backgroundEnabled      = true; // render backgrounds if any
var scrollingEnabled       = true;
var zoomRatio              = window.devicePixelRatio; // browser's zoom ratio
var ws_path                = createWsPath();
var protectPrecision       = 0; // 0 being tile and 1 being char
var checkTileFetchInterval = 300; // how often to check for unloaded tiles (ms)
var zoom                   = decimal(100); // zoom value
var unloadTilesAuto        = true; // automatically unload tiles to free up memory
var useHighlight           = true; // highlight new edits
var highlightLimit         = 10; // max chars to highlight at a time
var ansiBlockFill          = true; // fill certain ansi block characters
var colorizeLinks          = true;
var brBlockFill            = false; // render individual dots in braille characters as rectangles
var tileFetchOffsetX       = 0; // offset added to tile fetching and sending coordinates
var tileFetchOffsetY       = 0;
var ignoreCanvasContext    = true; // ignore canvas context menu when right clicking
var elementSnapApprox      = 10; // snapping margin for draggable elements
var mSpecRendering         = true; // render special properties if a certain combining character is included
var combiningCharsEnabled  = true;
var surrogateCharsEnabled  = true;
var defaultCoordLinkColor  = "#008000";
var defaultURLLinkColor    = "#0000FF";
var secureJSLink           = true; // display warning prompt when clicking on javascript links
var priorityOverwriteChar  = false; // render cells in the following order: Owner, Member, Public
var pasteDirRight          = true; // move cursor right when writing
var pasteDirDown           = true; // move cursor down after pressing enter
var defaultCursor          = "text";
var defaultDragCursor      = "move";
var fetchClientMargin      = 200;
var classicTileProcessing  = false; // directly process utf32 only
var unloadedPatternPanning = false;
var cursorRenderingEnabled = true;
var unobstructCursor       = false;
var transparentBackground  = true;

var images_to_load = {
	unloaded: "/static/unloaded.png"
};

var keyConfig = {
	reset: "ESC",
	copyColor: "ALT+C",
	copyCharacterText: "CTRL+C",
	copyCharacterMouse: "CTRL+M",
	sidewaysScroll: "SHIFT",
	tab: "TAB",
	autoSelect: "CTRL",
	autoApply: ["CTRL+S", "ALT+S"],
	autoDeselect: "SHIFT",
	erase: "BACKSPACE+*",
	cursorUp: "UP+*",
	cursorDown: "DOWN+*",
	cursorLeft: "LEFT+*",
	cursorRight: "RIGHT+*",
	copyRegion: "ALT+G"
};

var clientOnload = [];
window.addEventListener("load", function() {
	for(var i = 0; i < clientOnload.length; i++) clientOnload[i]();
});

document.addEventListener("visibilitychange", function() {
	if(!document.hidden && zoom > 0.2) {
		w.redraw();
	}
});

defineElements({ // elm[<name>]
	loading: byId("loading"),
	coord_Y: byId("coord_Y"),
	coord_X: byId("coord_X"),
	chatbar: byId("chatbar"),
	color_input_form_input: byId("color_input_form_input"),
	protect_precision: byId("protect_precision"),
	announce: byId("announce"),
	announce_text: byId("announce_text"),
	announce_close: byId("announce_close"),
	tile_choice: byId("tile_choice"),
	char_choice: byId("char_choice"),
	menu_elm: byId("menu"),
	nav_elm: byId("nav"),
	coords: byId("coords"),
	chat_window: byId("chat_window"),
	confirm_js: byId("confirm_js"),
	confirm_js_code: byId("confirm_js_code"),
	main_view: byId("main_view"),
	random_color_link: byId("random_color_link"),
	run_js_confirm_risk: byId("run_js_confirm_risk"),
	usr_online: byId("usr_online"),
	usr_online_container: byId("usr_online_container"),
	chatfield_container: byId("chatfield_container"),
	link_element: byId("link_element"),
	link_div: byId("link_div")
});

var jscolorInput;
clientOnload.push(function() {
	jscolorInput = elm.color_input_form_input.jscolor;
	jscolorInput.fromRGB(
		(YourWorld.Color >> 16) & 255, 
		(YourWorld.Color >> 8) & 255, 
		 YourWorld.Color & 255);
});

function random_color() {
	jscolorInput.fromRGB(Math.floor(Math.random() * 256),
		Math.floor(Math.random() * 256),
		Math.floor(Math.random() * 256));
}

function updateCoordDisplay() {
	var tileCoordX = -positionX / tileW;
	var tileCoordY = -positionY / tileH;
	var centerY = -Math.floor(tileCoordY / coordSizeY);
	var centerX = Math.floor(tileCoordX / coordSizeX);
	elm.coord_Y.innerText = centerY;
	elm.coord_X.innerText = centerX;
}

init_dom();

var draggable_element_mousemove = [];
var draggable_element_mouseup = [];
function draggable_element(dragger, dragged, exclusions, onDrag) {
	if(!dragged) {
		dragged = dragger;
	}
	var elmX = 0;
	var elmY = 0;
	var elmHeight = 0;
	var elmWidth = 0;
	var dragging = false;

	var clickX = 0;
	var clickY = 0;
	dragger.addEventListener("mousedown", function(e) {
		if(exclusions) {
			for(var i = 0; i < exclusions.length; i++) {
				if(closest(e.target, exclusions[i])) {
					return;
				}
			}
		}
		if(!closest(e.target, dragger)) return;
		elmX = dragged.offsetLeft;
		elmY = dragged.offsetTop;
		elmWidth = dragged.offsetWidth;
		elmHeight = dragged.offsetHeight;
		dragging = true;
		clickX = e.pageX;
		clickY = e.pageY;
	});
	// when the element is being dragged
	draggable_element_mousemove.push(function(e, arg_pageX, arg_pageY) {
		if(!dragging) return;

		if(onDrag) {
			if(onDrag() == -1) return;
		}

		dragged.style.top = "";
		dragged.style.bottom = "";
		dragged.style.left = "";
		dragged.style.right = "";

		var diffX = arg_pageX - clickX;
		var diffY = arg_pageY - clickY;

		var newY = elmY + diffY;
		var newX = elmX + diffX;

		dragged.style.top = newY + "px";
		dragged.style.left = newX + "px";
		if(newX <= elementSnapApprox) {
			dragged.style.left = "0px";
		}
		if(newX + elmWidth >= getWndWidth() - elementSnapApprox) {
			dragged.style.left = "";
			dragged.style.right = "0px";
		}
		if(newY <= elementSnapApprox) {
			dragged.style.top = "0px";
		}
		if(newY + elmHeight >= getWndHeight() - elementSnapApprox) {
			dragged.style.top = "";
			dragged.style.bottom = "0px";
		}
	});
	// when the element is released
	draggable_element_mouseup.push(function() {
		dragging = false;
	});
}

function resizeChat(width, height) {
	// default: 400 x 300
	if(width < 350) width = 350;
	if(height < 56) height = 56;
	elm.chat_window.style.width = width + "px";
	elm.chat_window.style.height = height + "px";
	elm.chatfield_container.style.height = (height - 55) + "px";
	elm.page_chatfield.style.height = (height - 55) + "px";
	elm.global_chatfield.style.height = (height - 55) + "px";
	elm.page_chatfield.style.width = (width - 8) + "px";
	elm.global_chatfield.style.width = (width - 8) + "px";
	return [width, height];
}

draggable_element(elm.chat_window, null, [
	elm.chatbar, elm.chatsend, elm.chat_close, elm.chat_page_tab, elm.chat_global_tab, elm.chatfield_container
], function() {
	if(chatResizing) {
		return -1;
	}
});
draggable_element(elm.confirm_js);

function resizable_chat() {
	var state = 0;
	var isDown = false;
	var downX = 0;
	var downY = 0;
	var elmX = 0;
	var elmY = 0;
	var chatWidth = 0;
	var chatHeight = 0;
	chat_window.addEventListener("mousemove", function(e) {
		if(isDown) return;
		var posX = e.pageX - chat_window.offsetLeft;
		var posY = e.pageY - chat_window.offsetTop;
		var top = (posY) <= 4;
		var left = (posX) <= 3;
		var right = (chat_window.offsetWidth - posX) <= 4;
		var bottom = (chat_window.offsetHeight - posY) <= 5;
		var cursor = "";
		if(left || right) cursor = "ew-resize";
		if(top || bottom) cursor = "ns-resize";
		if((top && left) || (right && bottom)) cursor = "nwse-resize";
		if((bottom && left) || (top && right)) cursor = "nesw-resize";
		chat_window.style.cursor = cursor;
		state = bottom << 3 | right << 2 | left << 1 | top;
	});
	chat_window.addEventListener("mousedown", function(e) {
		downX = e.pageX;
		downY = e.pageY;
		if(state) {
			// subtract 2 for the borders
			chatWidth = chat_window.offsetWidth - 2;
			chatHeight = chat_window.offsetHeight - 2;
			elmX = chat_window.offsetLeft;
			elmY = chat_window.offsetTop;
			isDown = true;
			chatResizing = true;
		}
	});
	document.addEventListener("mouseup", function() {
		isDown = false;
		chatResizing = false;
	});
	document.addEventListener("mousemove", function(e) {
		if(!isDown) return;
		var offX = e.pageX - downX;
		var offY = e.pageY - downY;
		switch(state) {
			case 0x1: // top
				var dimY = chatHeight - offY;
				var res = resizeChat(chatWidth, dimY);
				chat_window.style.top = (elmY + offY + (dimY - res[1])) + "px";
				break;
			case 0x2: // left
				var dimX = chatWidth - offX;
				var res = resizeChat(dimX, chatHeight);
				chat_window.style.left = (elmX + offX + (dimX - res[0])) + "px";
				break;
			case 0x3: // top left
				var dimX = chatWidth - offX;
				var dimY = chatHeight - offY;
				var res = resizeChat(dimX, dimY);
				chat_window.style.left = (elmX + offX + (dimX - res[0])) + "px";
				chat_window.style.top = (elmY + offY + (dimY - res[1])) + "px";
				break;
			case 0x4: // right
				chat_window.style.left = chat_window.offsetLeft + "px";
				chat_window.style.right = "";
				resizeChat(chatWidth + offX, chatHeight);
				break;
			case 0x5: // top right
				chat_window.style.left = chat_window.offsetLeft + "px";
				chat_window.style.right = "";
				var dimY = chatHeight - offY;
				var res = resizeChat(chatWidth + offX, dimY);
				chat_window.style.top = (elmY + offY + (dimY - res[1])) + "px";
				break;
			case 0x8: // bottom
				chat_window.style.top = chat_window.offsetTop + "px";
				chat_window.style.bottom = "";
				resizeChat(chatWidth, chatHeight + offY);
				break;
			case 0xA: // bottom left
				chat_window.style.top = chat_window.offsetTop + "px";
				chat_window.style.bottom = "";
				var dimX = chatWidth - offX;
				var res = resizeChat(dimX, chatHeight + offY);
				chat_window.style.left = (elmX + offX + (dimX - res[0])) + "px";
				break;
			case 0xC: // bottom right
				chat_window.style.left = chat_window.offsetLeft + "px";
				chat_window.style.right = "";
				chat_window.style.top = chat_window.offsetTop + "px";
				chat_window.style.bottom = "";
				resizeChat(chatWidth + offX, chatHeight + offY);
				break;
		}
	});
}
resizable_chat();

function getStoredNickname() {
	var nick = YourWorld.Nickname;
	if(window.localStorage && localStorage.getItem) {
		nick = localStorage.getItem("nickname");
	}
	if(!nick) nick = YourWorld.Nickname;
	YourWorld.Nickname = nick;
}
function storeNickname() {
	if(window.localStorage && localStorage.setItem) {
		localStorage.setItem("nickname", YourWorld.Nickname)
	}
}

getStoredNickname();

if(state.background) { // add the background image (if it already exists)
	images_to_load.background = state.background.path;
}
for(var i in images_to_load) { // add blank image object so that client knows it exists, but not loaded
	images[i] = null;
}
var img_load_keys = Object.keys(images_to_load);

var imgToArrayCanvas = document.createElement("canvas");
var backImg = imgToArrayCanvas.getContext("2d"); // temporary canvas used to pull data from images

var img_load_index = 0;
function loadImgPixelData(callback) {
	var loadImageElm = new Image();
	var img_key = img_load_keys[img_load_index];
	loadImageElm.src = images_to_load[img_key];
	var error = false;
	loadImageElm.onload = function() {
		var width = loadImageElm.width;
		var height = loadImageElm.height;
		// resize background images based on configuration
		if(img_key == "background") {
			if(w.backgroundInfo.w) {
				width = w.backgroundInfo.w;
			}
			if(w.backgroundInfo.h) {
				height = w.backgroundInfo.h;
			}
		}
		if(error) {
			width = 1;
			height = 1;
			backImg.fillStyle = "#DDDDDD";
			backImg.fillRect(0, 0, 1, 1);
		}
		imgToArrayCanvas.width = width;
		imgToArrayCanvas.height = height;
		backImg.drawImage(loadImageElm, 0, 0, width, height);
		var rawPixelData = backImg.getImageData(0, 0, width, height).data;
		images[img_key] = [rawPixelData, width, height, loadImageElm];

		img_load_index++;
		if(img_load_index >= img_load_keys.length) {
			// once all the images are loaded
			w.render();
			callback();
		} else {
			// continue loading
			loadImgPixelData(callback);
		}
	}
	loadImageElm.onerror = function() {
		error = true;
		loadImageElm.onload();
	}
}

function keydown_regionSelect(e) {
	if(!checkKeyPress(e, keyConfig.copyRegion) || regionSelectionsActive()) return;
	e.preventDefault();
	w.regionSelect.startSelection();
}
document.addEventListener("keydown", keydown_regionSelect);

function handleRegionSelection(coordA, coordB, regWidth, regHeight) {
	var tileX = coordA[0];
	var tileY = coordA[1];
	var charX = coordA[2];
	var charY = coordA[3];
	var reg = "";
	var colors = [];
	var links = [];
	var protections = [];
	for(var y = 0; y < regHeight; y++) {
		if(y != 0) {
			reg += "\n";
		}
		for(var x = 0; x < regWidth; x++) {
			var charInfo = getCharInfo(tileX, tileY, charX, charY);
			var char = charInfo.char;
			char = char.replace(/\r|\n|\x1b/g, " ");
			reg += char;
			colors.push(charInfo.color);
			var tile = Tile.get(tileX, tileY);
			var containsLink = false;
			if(tile && tile.properties && tile.properties.cell_props) {
				if(tile.properties.cell_props[charY] && tile.properties.cell_props[charY][charX]) {
					var link = tile.properties.cell_props[charY][charX];
					if(link.link) {
						link = link.link;
						containsLink = true;
						if(link.type == "url") {
							links.push("$u" + "\"" + escapeQuote(link.url) + "\"");
						} else if(link.type == "coord") {
							links.push("$c" + "[" + link.link_tileX + "," + link.link_tileY + "]");
						}
					}
				}
			}
			protections.push(charInfo.protection);
			if(!containsLink) {
				links.push(null);
			}
			charX++;
			if(charX >= tileC) {
				charX = 0;
				tileX++;
			}
		}
		tileX = coordA[0];
		charX = coordA[2];
		charY++;
		if(charY >= tileR) {
			charY = 0;
			tileY++;
		}
	}
	w._ui.selectionModal.open(reg, colors, links, protections);
	w.emit("regionSelected", {
		a: coordA,
		b: coordB
	});
}

var defaultSizes = {
	// in pixels
	cellW: 10,
	cellH: 18,
	// assigned later
	tileW: null,
	tileH: null,
	// in characters
	tileC: 16, // columns
	tileR: 8 // rows
}
if(state.worldModel.square_chars) defaultSizes.cellW = 18;
if(state.worldModel.half_chars) defaultSizes.cellH = 20;
if(state.worldModel.tileCols) defaultSizes.tileC = state.worldModel.tileCols;
if(state.worldModel.tileRows) defaultSizes.tileR = state.worldModel.tileRows;

var cellWidthPad, tileW, tileH, cellW, cellH, font, specialCharFont, tileC, tileR, tileArea;
var tileWidth, tileHeight; // exact tile dimensions for determining rendering size of tiles
var dTileW, dTileH; // locked tile sizes for background image generation

var fontTemplate = "$px 'Courier New', monospace";
var specialCharFontTemplate = "$px consolas, monospace";

function updateScaleConsts() {
	defaultSizes.tileW = defaultSizes.cellW * defaultSizes.tileC;
	defaultSizes.tileH = defaultSizes.cellH * defaultSizes.tileR;
	dTileW = defaultSizes.tileW;
	dTileH = defaultSizes.tileH;
	cellWidthPad = Math.floor((defaultSizes.cellW - 10) / 2); // X text offset if the cell is wider

	tileW = defaultSizes.tileW * zoom;
	tileH = defaultSizes.tileH * zoom;
	cellW = defaultSizes.cellW * zoom;
	cellH = defaultSizes.cellH * zoom;

	tileWidth = Math.ceil(tileW);
	tileHeight = Math.ceil(tileH);

	var fontSize = normFontSize(16 * zoom);

	font = fontTemplate.replace("$", fontSize);
	specialCharFont = specialCharFontTemplate.replace("$", fontSize);

	textRenderCanvas.width = tileWidth;
	textRenderCanvas.height = tileHeight;
	textRenderCtx.font = font;

	tileC = defaultSizes.tileC;
	tileR = defaultSizes.tileR;
	tileArea = tileC * tileR;
}

var textRenderCanvas;
var textRenderCtx;
function setupTextRenderCtx() {
	if(!textRenderCanvas) {
		textRenderCanvas = document.createElement("canvas");
	} else {
		textRenderCanvas.remove();
		textRenderCanvas = document.createElement("canvas");
	}
	if(transparentBackground) {
		textRenderCtx = textRenderCanvas.getContext("2d");
	} else {
		textRenderCtx = textRenderCanvas.getContext("2d", {
			alpha: false
		});
	}
}

setupTextRenderCtx();
updateScaleConsts();

// used to stretch background images
var backgroundImageCanvasRenderer = document.createElement("canvas");
backgroundImageCanvasRenderer.width = tileWidth;
backgroundImageCanvasRenderer.height = tileHeight;
var backgroundImageCtx = backgroundImageCanvasRenderer.getContext("2d");

// performs the zoom calculations and changes all constants
function doZoom(percentage) {
	if(percentage < 20) percentage = 20;
	if(percentage > 1000) percentage = 1000;
	percentage = decimal(percentage);
	zoom = percentage;

	updateScaleConsts();

	if(tileWidth * tileHeight > 100000000) {
		throw "Memory leak";
	}
	textRenderCanvas.width = tileWidth;
	textRenderCanvas.height = tileHeight;
	textRenderCtx.font = font;

	// change size of invisible link
	linkDiv.style.width = cellW + "px";
	linkDiv.style.height = cellH + "px";

	// rerender everything
	if(tileCanvasPool.length) {
		removeAllTilesFromPools();
		deleteAllPools();
		w.render(true);
	}
}

// called from the zoombar, adjusts client position to be in center
function changeZoom(percentage) {
	positionX /= zoom;
	positionY /= zoom;
	doZoom(percentage);
	positionX *= zoom;
	positionY *= zoom;
	positionX = Math.trunc(positionX); // remove decimals
	positionY = Math.trunc(positionY);
	w.render();
	setZoombarValue();
}

function setZoombarValue() {
	// zoombar is logarithmic
	var val = zoom;
	if(val <= 1) {
		val = 2 ** (-1 / val);
	} else {
		val = 1 - (2 ** (-val));
	}
	zoombar.value = val * 100;
}

function browserZoomAdjust(retry) {
	var ratio = window.devicePixelRatio;
	if(!ratio) ratio = 1;
	if(zoomRatio == ratio && !retry) return; // ratio is still the same, do nothing
	positionX /= zoomRatio;
	positionY /= zoomRatio;
	zoomRatio = ratio;
	positionX *= zoomRatio;
	positionY *= zoomRatio;
	positionX = Math.trunc(positionX); // remove decimals
	positionY = Math.trunc(positionY);

	adjust_scaling_DOM(ratio);
	doZoom(ratio * 100);
}

function createTilePool() {
	var pCanv = document.createElement("canvas");
	var pDims = getPoolDimensions(tileWidth, tileHeight);
	var pWidth = pDims[0] * tileWidth;
	var pHeight = pDims[1] * tileHeight;
	pCanv.width = pWidth;
	pCanv.height = pHeight;
	var pCtx = pCanv.getContext("2d");
	var pMap = {};
	var pool = {
		canv: pCanv,
		ctx: pCtx,
		map: pMap,
		width: pDims[0],
		height: pDims[1],
		size: 0
	};
	tileCanvasPool.push(pool);
	return pool;
}

function allocateTile() {
	var pLocated = false;
	var pObj, pTilePos;
	for(var i = 0; i < tileCanvasPool.length; i++) {
		var pool = tileCanvasPool[i];
		var area = pool.width * pool.height;
		if(pool.size >= area) continue;
		var map = pool.map;
		for(var t = 0; t < area; t++) {
			if(map[t]) continue;
			pLocated = true;
			pObj = pool;
			pTilePos = t;
			break;
		}
		if(pLocated) break;
	}
	if(!pLocated) {
		pObj = createTilePool();
		pTilePos = 0;
	}
	var pMap = pObj.map;
	pObj.size++;
	var mapX = pTilePos % pObj.width;
	var mapY = Math.floor(pTilePos / pObj.width);
	var tileObj = {
		pool: pObj,
		x: mapX,
		y: mapY,
		idx: pTilePos,
		poolX: mapX * tileWidth,
		poolY: mapY * tileHeight
	};
	pMap[pTilePos] = tileObj;
	return tileObj;
}

function deallocateTile(obj) {
	var pool = obj.pool;
	var idx = obj.idx;
	if(pool.map[idx]) {
		delete pool.map[idx];
		pool.size--;
	}
}

function reallocateTile(obj) {
	var pX = obj.poolX;
	var pY = obj.poolY;
	var pool = obj.pool;
	deallocateTile(obj);
	var newObj = allocateTile();
	var newPool = newObj.pool;
	var newPX = newObj.poolX;
	var newPY = newObj.poolY;
	// transfer rendered text data
	if(pX != newPX || pY != newPY || pool != newPool) {
		newPool.ctx.clearRect(newPX, newPY, tileWidth, tileHeight);
		newPool.ctx.drawImage(pool.canv, pX, pY, tileWidth, tileHeight, newPX, newPY, tileWidth, tileHeight);
	}
	return newObj;
}

function deletePool(pool) {
	var canv = pool.canv;
	canv.width = 0;
	canv.height = 0;
	delete pool.canv;
	for(var t in pool.map) {
		delete pool.map[t];
	}
}

function deleteEmptyPools() {
	for(var i = 0; i < tileCanvasPool.length; i++) {
		var pool = tileCanvasPool[i];
		if(pool.size == 0) {
			deletePool(pool);
			tileCanvasPool.splice(i, 1);
			i--;
		}
	}
}

function deleteAllPools() {
	for(var i = 0; i < tileCanvasPool.length; i++) {
		var pool = tileCanvasPool[i];
		deletePool(pool);
		tileCanvasPool.splice(i, 1);
		i--;
	}
}

var tilePixelCache = {};
function loadTileFromPool(tileX, tileY, doNotCreate) {
	var pos = tileY + "," + tileX;
	if(tilePixelCache[pos]) {
		return tilePixelCache[pos];
	}
	if(doNotCreate) return null;
	var newTile = allocateTile();
	tilePixelCache[pos] = newTile;
	return newTile;
}
function shiftAllTilesInPools() {
	if(tileCanvasPool.length <= 1) return;
	for(var tile in tilePixelCache) {
		tilePixelCache[tile] = reallocateTile(tilePixelCache[tile]);
	}
	deleteEmptyPools();
}

function removeTileFromPool(tileX, tileY) {
	var pos = tileY + "," + tileX;
	if(!tilePixelCache[pos]) return;
	deallocateTile(tilePixelCache[pos]);
	delete tilePixelCache[pos];
}

function removeAllTilesFromPools() {
	for(var tile in tilePixelCache) {
		deallocateTile(tilePixelCache[tile]);
		delete tilePixelCache[tile];
	}
}

function removeAlpha(data) {
	var res = [];
	var len = data.length / 4;
	for(var i = 0; i < len; i++) {
		var indx = i * 4;
		res.push(data[indx + 0]);
		res.push(data[indx + 1]);
		res.push(data[indx + 2]);
	}
	return res;
}

var tileProtectAuto = {
	selected: {},
	selectedTile: null,
	xPos: 0,
	yPos: 0,
	charXPos: 0,
	charYPos: 0,
	lastPos: null,
	mode: 0,
	ctrlDown: false,
	shiftDown: false,
	clearSelections: function() {
		for(var i in tileProtectAuto.selected){
			tiles[i].backgroundColor = "";
			delete tileProtectAuto.selected[i];
		}
	},
	active: false
}

var linkAuto = {
	selected: {},
	ctrlDown: 0,
	shiftDown: 0,
	mode: 0,
	url: "",
	coordTileX: 0,
	coordTileY: 0,
	lastPos: null,
	active: false
}

var autoTotal = 0;
function updateAutoProg() {
	if(autoTotal > 0) {
		auto_prog.style.display = "";
	} else {
		auto_prog.style.display = "none";
	}
	auto_prog.innerText = autoTotal + " remaining";
}

// Fast tile protecting
function mousemove_tileProtectAuto() {
	if(!tileProtectAuto.active) return;
	var tile = Tile.get(currentPosition[0], currentPosition[1]);
	if(!tile) return;
	tileProtectAuto.selectedTile = tile;
	var tileX = currentPosition[0];
	var tileY = currentPosition[1];
	var charX = currentPosition[2];
	var charY = currentPosition[3];
	var lastPos = tileProtectAuto.lastPos;
	tileProtectAuto.xPos = tileX;
	tileProtectAuto.yPos = tileY;
	tileProtectAuto.charXPos = charX;
	tileProtectAuto.charYPos = charY;
	if(tileProtectAuto.ctrlDown) {
		var line = null;
		var absX = tileX * tileC + charX;
		var absY = tileY * tileR + charY;
		if(protectPrecision == 0) {
			absX = tileX;
			absY = tileY;
		}
		if(lastPos && lastPos[4] == protectPrecision) {
			var labsX = lastPos[0] * tileC + lastPos[2];
			var labsY = lastPos[1] * tileR + lastPos[3];
			if(protectPrecision == 0) {
				labsX = lastPos[0];
				labsY = lastPos[1];
			}
			line = lineGen(labsX, labsY, absX, absY, 1000);
		} else {
			line = [[absX, absY]];
		}
		tileProtectAuto.lastPos = [tileX, tileY, charX, charY, protectPrecision];
		var updTiles = {};
		for(var i = 0; i < line.length; i++) {
			var chr = line[i];
			var x = chr[0];
			var y = chr[1];
			var ctileX = Math.floor(x / tileC);
			var ctileY = Math.floor(y / tileR);
			var ccharX = x - ctileX * tileC;
			var ccharY = y - ctileY * tileR;
			if(protectPrecision == 0) {
				ctileX = x;
				ctileY = y;
			}
			var tempTile = Tile.get(ctileX, ctileY);
			var mode = tileProtectAuto.mode;
			if(protectPrecision == 0 && tempTile) {
				tileProtectAuto.selected[ctileY + "," + ctileX] =
					[protectPrecision, mode, tempTile];
			} else if(protectPrecision == 1 && tempTile) {
				tileProtectAuto.selected[ctileY + "," + ctileX + "," + ccharY + "," + ccharX] =
					[protectPrecision, mode, tempTile];
			}
			var colors = ["red", "green", "blue", "teal"];
			var color = colors[mode];
			if(protectPrecision == 0) {
				if(tempTile) tempTile.backgroundColor = color;
			} else if(protectPrecision == 1) {
				colorChar(ctileX, ctileY, ccharX, ccharY, w.protect_bg, true);
			}
			updTiles[ctileY + "," + ctileX] = 1;
		}
		for(var i in updTiles) {
			var pos = i.split(",");
			var tileX = parseInt(pos[1]);
			var tileY = parseInt(pos[0]);
			w.setTileRedraw(tileX, tileY);
		}
	}
	if(tileProtectAuto.shiftDown) {
		var pos = tileY + "," + tileX;
		if(protectPrecision == 1) {
			pos = tileY + "," + tileX + "," + charY + "," + charX;
		}
		if(tileProtectAuto.selected[pos] !== void 0) {
			var precision = tileProtectAuto.selected[pos][0];
			if(precision == 0) {
				tile.backgroundColor = "";
			} else if(precision == 1) {
				uncolorChar(tileX, tileY, charX, charY);
			}
			delete tileProtectAuto.selected[pos];
			w.setTileRender(tileX, tileY);
		}
	}
}
document.addEventListener("mousemove", mousemove_tileProtectAuto);

function keydown_tileProtectAuto(e) {
	if(!worldFocused) return;
	if(checkKeyPress(e, keyConfig.autoApply)) { // Alt/Ctrl + S to protect tiles
		var selected = tileProtectAuto.selected;
		var types = ["owner-only", "member-only", "public"];
		var keys = Object.keys(selected);
		if(keys.length == 0) return;
		if(e.ctrlKey) e.preventDefault();
		autoTotal += keys.length;
		updateAutoProg();

		var idx = 0;
		function step() {
			var i = keys[idx];
			idx++;
			var pos = i.split(",").map(Number);
			var precision = selected[i][0];
			var prot = selected[i][1];

			var tileX = pos[1];
			var tileY = pos[0];
			var charX = pos[3];
			var charY = pos[2];

			var position = {
				tileY: tileY,
				tileX: tileX
			};
			if(precision == 1) {
				position.charX = charX;
				position.charY = charY;
			}
			var type;
			if(prot == 3) {
				type = "unprotect";
			} else {
				type = types[prot];
			}
			network.protect(position, type);

			autoTotal--;
			updateAutoProg();
			if(precision == 0) {
				selected[i][2].backgroundColor = "";
				delete selected[i];
				w.setTileRender(tileX, tileY);
			} else if(precision == 1) {
				delete selected[i];
				uncolorChar(tileX, tileY, charX, charY);
				w.setTileRedraw(tileX, tileY);
			}

			if(idx >= keys.length) return;
			setTimeout(step, 4);
		}
		step();
	} else {
		var ctrlState = tileProtectAuto.ctrlDown;
		tileProtectAuto.ctrlDown = checkKeyPress(e, keyConfig.autoSelect);
		tileProtectAuto.shiftDown = checkKeyPress(e, keyConfig.autoDeselect);
		if(!ctrlState && tileProtectAuto.ctrlDown) {
			tileProtectAuto.lastPos = null;
		}
	}
}
document.body.addEventListener("keydown", keydown_tileProtectAuto)

// Fast linking
function mousemove_linkAuto() {
	if(!linkAuto.active) return;
	var tile = Tile.get(currentPosition[0], currentPosition[1]);
	if(!tile) return;
	
	var tileX = currentPosition[0];
	var tileY = currentPosition[1];
	var charX = currentPosition[2];
	var charY = currentPosition[3];
	var lastPos = linkAuto.lastPos;
	
	var color = "blue";
	if(linkAuto.mode == 1) {
		color = "green";
	}

	if(linkAuto.ctrlDown) {
		var line = null;
		var absX = tileX * tileC + charX;
		var absY = tileY * tileR + charY;
		if(lastPos) {
			var labsX = lastPos[0] * tileC + lastPos[2];
			var labsY = lastPos[1] * tileR + lastPos[3];
			line = lineGen(labsX, labsY, absX, absY, 1000);
		} else {
			line = [[absX, absY]];
		}
		linkAuto.lastPos = [tileX, tileY, charX, charY];
		var updTiles = {};
		for(var i = 0; i < line.length; i++) {
			var chr = line[i];
			var x = chr[0];
			var y = chr[1];
			var ctileX = Math.floor(x / tileC);
			var ctileY = Math.floor(y / tileR);
			var ccharX = x - ctileX * tileC;
			var ccharY = y - ctileY * tileR;

			colorChar(ctileX, ctileY, ccharX, ccharY, color);
			updTiles[ctileY + "," + ctileX] = 1;
			var ar = [ctileX, ctileY, ccharX, ccharY, linkAuto.mode];
			if(linkAuto.mode == 0) {
				ar.push([linkAuto.url])
			} else if(linkAuto.mode == 1) {
				ar.push([linkAuto.coordTileX, linkAuto.coordTileY]);
			}
			linkAuto.selected[ctileY + "," + ctileX + "," + ccharY + "," + ccharX] = ar;
		}
		for(var i in updTiles) {
			var pos = i.split(",");
			var tileX = parseInt(pos[1]);
			var tileY = parseInt(pos[0]);
			w.setTileRedraw(tileX, tileY);
		}
	}
	if(linkAuto.shiftDown) {
		var elm = linkAuto.selected[tileY + "," + tileX + "," + charY + "," + charX];
		if(elm !== void 0) {
			uncolorChar(tileX, tileY, charX, charY);
			w.setTileRedraw(tileX, tileY);
			delete linkAuto.selected[tileY + "," + tileX + "," + charY + "," + charX];
		}
	}
}
document.addEventListener("mousemove", mousemove_linkAuto);

function keydown_linkAuto(e) {
	if(!worldFocused) return;
	if(checkKeyPress(e, keyConfig.autoApply)) { // Alt/Ctrl + S to add links
		var selected = linkAuto.selected;
		var keys = Object.keys(selected);
		if(keys.length == 0) return;
		if(e.ctrlKey) e.preventDefault();
		autoTotal += keys.length;
		updateAutoProg();

		var idx = 0;
		function step() {
			var i = keys[idx];
			idx++;
			var pos = i.split(",").map(Number);
			var tileX = pos[1];
			var tileY = pos[0];
			var charX = pos[3];
			var charY = pos[2];

			var mode = selected[i][4];
			var linkData = selected[i][5];

			var data = {};
			var link_type;
			if(mode == 0) {
				data.url = w.url_input;
				link_type = "url";
				data.url = linkData[0];
			} else if(mode == 1) {
				link_type = "coord";
				data.x = linkData[0];
				data.y = linkData[1];
			}

			network.link({
				tileY: tileY,
				tileX: tileX,
				charY: charY,
				charX: charX
			}, link_type, data);

			autoTotal--;
			updateAutoProg();
			delete selected[i];
			uncolorChar(tileX, tileY, charX, charY);
			w.setTileRedraw(tileX, tileY);

			if(idx >= keys.length) return;
			setTimeout(step, 4);
		}
		step();
	} else {
		var ctrlState = linkAuto.ctrlDown;
		linkAuto.ctrlDown = checkKeyPress(e, keyConfig.autoSelect);
		linkAuto.shiftDown = checkKeyPress(e, keyConfig.autoDeselect);
		if(!ctrlState && linkAuto.ctrlDown) {
			linkAuto.lastPos = null;
		}
	}
}
document.body.addEventListener("keydown", keydown_linkAuto);

function onKeyUp(e) {
	var sel = checkKeyPress(e, keyConfig.autoSelect);
	var des = checkKeyPress(e, keyConfig.autoDeselect);
	linkAuto.ctrlDown = sel;
	linkAuto.shiftDown = des;
	tileProtectAuto.ctrlDown = sel;
	tileProtectAuto.shiftDown = des;

	if(checkKeyPress(e, keyConfig.cursorUp)) { // arrow up
		autoArrowKeyMoveStop("up");
	}
	if(checkKeyPress(e, keyConfig.cursorDown)) { // arrow down
		autoArrowKeyMoveStop("down");
	}
	if(checkKeyPress(e, keyConfig.cursorLeft)) { // arrow left
		autoArrowKeyMoveStop("left");
	}
	if(checkKeyPress(e, keyConfig.cursorRight)) { // arrow right
		autoArrowKeyMoveStop("right");
	}
}
document.body.addEventListener("keyup", onKeyUp);

// adjust canvas width, canvas display width, and variable width to
// disobey the browser zoom so that the custom zoom can be used
function adjust_scaling_DOM(ratio) {
	var window_width = getWndWidth();
	var window_height = getWndHeight();
	// change variable sizes to the screen-width of the inner browser (same, regardless of zoom)
	owotWidth = Math.round(window_width * ratio);
	owotHeight = Math.round(window_height * ratio);
	// make size of canvas the size of the inner browser screen-size
	elm.owot.width = Math.round(window_width * ratio);
	elm.owot.height = Math.round(window_height * ratio);
	// make the display size the size of the viewport
	elm.owot.style.width = window_width + "px";
	elm.owot.style.height = window_height + "px";
}

function event_resize() {
	var ratio = window.devicePixelRatio;
	if(!ratio) ratio = 1;
	w.emit("resize", ratio);

	adjust_scaling_DOM(ratio);

	browserZoomAdjust();
	w.render();
}
window.addEventListener("resize", event_resize);

browserZoomAdjust(true);

function getChar(tileX, tileY, charX, charY) {
	if(tileX == void 0 && tileY == void 0 && charX == void 0 && charY == void 0) {
		if(!cursorCoords) return -1;
		tileX = cursorCoords[0];
		tileY = cursorCoords[1];
		charX = cursorCoords[2];
		charY = cursorCoords[3];
	}
	var tile = Tile.get(tileX, tileY);
	if(!tile) return " ";
	var content = tile.content;
	return content[charY * tileC + charX];
}

function getCharColor(tileX, tileY, charX, charY) {
	if(tileX == void 0 && tileY == void 0 && charX == void 0 && charY == void 0) {
		if(!cursorCoords) return -1;
		tileX = cursorCoords[0];
		tileY = cursorCoords[1];
		charX = cursorCoords[2];
		charY = cursorCoords[3];
	}
	var tile = Tile.get(tileX, tileY);
	if(!tile) return 0;
	if(!tile.properties.color) return 0;
	return tile.properties.color[charY * tileC + charX];
}

function getCharProtection(tileX, tileY, charX, charY) {
	if(tileX == void 0 && tileY == void 0 && charX == void 0 && charY == void 0) {
		if(!cursorCoords) return -1;
		tileX = cursorCoords[0];
		tileY = cursorCoords[1];
		charX = cursorCoords[2];
		charY = cursorCoords[3];
	}
	var tile = Tile.get(tileX, tileY);
	if(!tile) return state.worldModel.writability;
	var prot = tile.properties.writability;
	if(tile.properties && tile.properties.char) {
		prot = tile.properties.char[charY * tileC + charX];
		// null indicates that it inherits writability from its parent
		if(prot == null) prot = tile.properties.writability;
	}
	if(prot == null) prot = state.worldModel.writability;
	return prot;
}

function getCharInfo(tileX, tileY, charX, charY) {
	if(tileX == void 0 && tileY == void 0 && charX == void 0 && charY == void 0) {
		if(!cursorCoords) return -1;
		tileX = cursorCoords[0];
		tileY = cursorCoords[1];
		charX = cursorCoords[2];
		charY = cursorCoords[3];
	}
	return {
		loaded: isTileLoaded(tileX, tileY),
		char: getChar(tileX, tileY, charX, charY),
		color: getCharColor(tileX, tileY, charX, charY),
		protection: getCharProtection(tileX, tileY, charX, charY)
	};
}

function getCharInfoXY(x, y) {
	var tileX = Math.floor(x / tileC);
	var tileY = Math.floor(y / tileR);
	var charX = x - tileX * tileC;
	var charY = y - tileY * tileR;
	return getCharInfo(tileX, tileY, charX, charY);
}

function getLink(tileX, tileY, charX, charY) {
	if(!Tile.get(tileX, tileY)) return null;
	var tile = Tile.get(tileX, tileY);
	if(!tile) return null;
	var props = tile.properties.cell_props;
	if(!props) return null;
	if(!props[charY]) return null;
	if(!props[charY][charX]) return null;
	if(!props[charY][charX].link) return null;
	return props[charY][charX].link;
}

function getLinkXY(x, y) {
	var tileX = Math.floor(x / tileC);
	var tileY = Math.floor(y / tileR);
	var charX = x - tileX * tileC;
	var charY = y - tileY * tileR;
	return getLink(tileX, tileY, charX, charY);
}

// copy individual chars
function event_keydown_copy_char(e) {
	if(w._state.uiModal) return;
	if(!worldFocused) return;
	if(document.activeElement.tagName == "INPUT" && document.activeElement.type == "text" && document.activeElement != elm.textInput) return;
	var textCursorCopy = checkKeyPress(e, keyConfig.copyCharacterText);
	var mouseCursorCopy = checkKeyPress(e, keyConfig.copyCharacterMouse);
	if(!textCursorCopy && !mouseCursorCopy) return;
	stopPasting();
	// ctrl + c to copy characters where the text cursor is,
	// ctrl + m to copy characters where the mouse cursor is
	var pos_ref = cursorCoords;
	if(mouseCursorCopy) { // copy where mouse cursor is
		pos_ref = currentPosition;
	}
	if(!pos_ref) return;
	var tileX = pos_ref[0];
	var tileY = pos_ref[1];
	var charX = pos_ref[2];
	var charY = pos_ref[3];
	var char = getChar(tileX, tileY, charX, charY);
	char = char.replace(/\r|\n/g, " ");
	w.clipboard.copy(char);
}
document.addEventListener("keydown", event_keydown_copy_char);

// color picker
function event_keydown_copy_color(e) {
	if(!worldFocused) return;
	if(!checkKeyPress(e, keyConfig.copyColor)) return;
	stopPasting();
	// alt + c to use color of text cell (where mouse cursor is) as main color
	var pos = currentPosition;
	if(!pos) return;
	var tileX = pos[0];
	var tileY = pos[1];
	var charX = pos[2];
	var charY = pos[3];
	var color = getCharColor(tileX, tileY, charX, charY)
	w.changeColor(color);
}
document.addEventListener("keydown", event_keydown_copy_color);

// convert color value to rgb24 int
function resolveColorValue(val) {
	if(typeof val != "string" || !val) return 0;
	var orig = val;
	if(val[0] == "#") val = substr(1);
	if(isHexString(val)) {
		if(val.length == 3) {
			return parseInt(val[0] + val[0] + val[1] + val[1] + val[2] + val[2], 16);
		} else if(val.length == 6) {
			return parseInt(val, 16);
		}
	}
	var num = parseInt(val);
	if(!isNaN(num)) {
		num = Math.trunc(num);
		if(num < 0) num = 0;
		if(num > 16777215) num = 16777215;
		return num;
	}
	backImg.fillStyle = "#000000";
	backImg.fillStyle = orig;
	var fs = backImg.fillStyle;
	if(fs[0] == "#" && fs.length == 7) {
		return parseInt(fs.substr(1).slice(0, 6), 16);
	}
	return 0;
}

elm.owot.width = owotWidth;
elm.owot.height = owotHeight;

var cursorCoords = null; // [tileX, tileY, charX, charY]; Coordinates of text cursor. If mouse is deselected, the value is null.
var cursorCoordsCurrent = [0, 0, 0, 0, -1]; // [tileX, tileY, charX, charY]; cursorCoords that don't reset to null.
var currentPosition = [0, 0, 0, 0]; // [tileX, tileY, charX, charY]; Tile and char coordinates where mouse cursor is located.
var currentPositionInitted = false;
var currentMousePosition = [0, 0, 0, 0]; // [x, y, pageX, pageY]; Position of mouse cursor.

var Tile = {};
var tileCount = 0;
Tile.set = function(tileX, tileY, data) {
	var str = tileY + "," + tileX;
	if(!(str in tiles)) {
		tileCount++;
	}
	tiles[str] = data;
	return data;
}
Tile.delete = function(tileX, tileY) {
	var str = tileY + "," + tileX;
	removeTileFromPool(tileX, tileY);
	w.periodDeletedTiles++;
	if(str in tiles) {
		delete tiles[str];
		tileCount--;
	}
}
Tile.get = function(tileX, tileY) {
	var tile = tiles[tileY + "," + tileX];
	return tile;
}

var poolCleanupInterval = setInterval(function() {
	if(w.periodDeletedTiles < 50) return;
	w.periodDeletedTiles = 0;
	shiftAllTilesInPools();
}, 1000 * 10);

// deprecated
var textLayerCtx = owotCtx;

function createWsPath() {
	var search = window.location.search;
	if(!search) search = "";
	return "ws" + (window.location.protocol == "https:" ? "s" : "") + "://" + window.location.host + state.worldModel.pathname + "/ws/" + search;
}

function checkTextColorOverride() {
	var public = 4;
	var member = 2;
	var owner = 1;
	// if custom text color is set to a zone, use that color instead of main default
	if(styles.public_text != "#000" && styles.public_text != "#000000") {
		textColorOverride |= public;
	} else {
		textColorOverride &= textColorOverride ^ public;
	}
	if(styles.member_text != "#000" && styles.member_text != "#000000") {
		textColorOverride |= member;
	} else {
		textColorOverride &= textColorOverride ^ member;
	}
	if(styles.owner_text != "#000" && styles.owner_text != "#000000") {
		textColorOverride |= owner;
	} else {
		textColorOverride &= textColorOverride ^ owner;
	}
}
var styles = null;

var menuStyle;
function menu_color(color) {
	// change menu color
	if(!window.menuStyle) {
		menuStyle = document.createElement("style");
		document.head.appendChild(menuStyle);
	}
	menuStyle.innerHTML = "#menu.hover, #nav { background: " + color + "; }";
}

function ajaxRequest(settings) {
	var req = new XMLHttpRequest();

	var formData = "";
	var ampAppend = false;
	if(settings.data) {
		for(var i in settings.data) {
			if(ampAppend) formData += "&";
			ampAppend = true;
			formData += encodeURIComponent(i) + "=" + encodeURIComponent(settings.data[i]);
		}
	}
	// append form data to url if this is a GET
	if(settings.type == "GET" && formData) {
		settings.url += "?" + formData;
	}
	var async = !!settings.async;
	req.open(settings.type, settings.url, !async);
	req.onload = function() {
		if(req.status >= 200 && req.status < 400) {
			if(settings.done) {
				settings.done(req.responseText, req);
			}
		} else {
			if(settings.error) {
				settings.error(req);
			}
		}
	}
	req.onerror = function() {
		if(settings.error) {
			settings.error(req);
		}
	}
	if(settings.type == "POST") {
		if(formData) req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		req.send(formData);
	} else {
		req.send();
	}
}

function defaultStyles() {
	return {
		owner: "#ddd",
		member: "#eee",
		public: "#fff",
		cursor: "#ff0",
		guestCursor: "#ffe",
		text: "#000",
		menu: "#e5e5ff",
		public_text: "#000",
		member_text: "#000",
		owner_text: "#000"
	};
}

function manageCoordHash() {
	if(!Permissions.can_go_to_coord(state.userModel, state.worldModel)) return;
	try {
		var coord = window.location.hash.match(/#x:-?\d+,y:-?\d+$/);
		if(coord) {
			coord = window.location.hash.split(/#x:|,y:/).slice(1).map(function(a) {
				return parseInt(a, 10);
			});
			w.doGoToCoord(coord[1], coord[0]);
		}
	} catch(e) {
		console.log(e);
	}
}

// type: "style" or "props"
// callback: function(style, error)
function getWorldProps(world, type, cb) {
	if(!type) type = "style";
	var propUrl;
	if(type == "style") {
		propUrl = "/world_style/?world=";
	} else if(type == "props") {
		propUrl = "/world_props/?world=";
	} else {
		console.error("Invalid type: " + type);
		return cb(null, true);
	}
	ajaxRequest({
		type: "GET",
		url: propUrl + world,
		done: function(data) {
			try {
				data = JSON.parse(data);
			} catch(e) {
				return cb(null, true);
			}
			cb(data, false);
		},
		error: function() {
			cb(null, true);
		}
	});
}

// begin OWOT's client
function begin() {
	manageCoordHash();
	getWorldProps(state.worldModel.name, "style", function(style, error) {
		if(error) {
			console.warn("An error occurred while loading the world style");
			styles = defaultStyles();
		} else {
			styles = style;
		}
		checkTextColorOverride();
		menu_color(styles.menu);
		loadImgPixelData(function() {
			owotCtx.clearRect(0, 0, owotWidth, owotHeight);
			renderLoop();
			createSocket();
			elm.loading.style.display = "none";
		});
	});
}

function stopLinkUI() {
	if(!lastLinkHover) return;
	if(!w.isLinking) return;
	w.isLinking = false;
	linkAuto.active = false;
	elm.owot.style.cursor = defaultCursor;
	var tileX = lastLinkHover[0];
	var tileY = lastLinkHover[1];
	var charX = lastLinkHover[2];
	var charY = lastLinkHover[3];
	// remove highlight
	uncolorChar(tileX, tileY, charX, charY);
	w.setTileRedraw(tileX, tileY);
}

function removeTileProtectHighlight() {
	if(!lastTileHover) return;
	var precision = lastTileHover[0];
	var tileX = lastTileHover[1];
	var tileY = lastTileHover[2];
	var charX = lastTileHover[3];
	var charY = lastTileHover[4];

	if(Tile.get(tileX, tileY)) {
		if(precision == 0) {
			Tile.get(tileX, tileY).backgroundColor = "";
		} else if(precision == 1) {
			uncolorChar(tileX, tileY, charX, charY);
		}
	}
	w.setTileRedraw(tileX, tileY);
}

function stopTileUI() {
	if(!lastTileHover) return;
	if(!w.isProtecting) return;
	elm.protect_precision.style.display = "none";
	w.isProtecting = false;
	tileProtectAuto.active = false;
	tileProtectAuto.lastPos = null;
	elm.owot.style.cursor = defaultCursor;
	removeTileProtectHighlight();
}

function doLink() {
	if(!lastLinkHover) return;
	stopLinkUI()
	var tileX = lastLinkHover[0];
	var tileY = lastLinkHover[1];
	var charX = lastLinkHover[2];
	var charY = lastLinkHover[3];
	var data = {};
	var link_type;
	if(w.link_input_type == 0) {
		data.url = w.url_input;
		link_type = "url";
	} else if(w.link_input_type == 1) {
		data.x = w.coord_input_x;
		data.y = w.coord_input_y;
		link_type = "coord";
	}
	network.link({
		tileY: tileY,
		tileX: tileX,
		charY: charY,
		charX: charX
	}, link_type, data);
}

function doProtect() {
	if(!lastTileHover) return;
	stopTileUI();
	var tileX = lastTileHover[1];
	var tileY = lastTileHover[2];
	var types = ["public", "member-only", "owner-only"];
	var position = {
		tileY: tileY,
		tileX: tileX
	};
	var action;
	if(w.protect_type == null) {
		action = "unprotect";
	} else {
		action = types[w.protect_type];
	}
	if(protectPrecision == 1) {
		position.charX = lastTileHover[3];
		position.charY = lastTileHover[4];
	}
	network.protect(position, action);
}

var dragStartX = 0;
var dragStartY = 0;
// the offset before clicking to drag
var dragPosX = 0;
var dragPosY = 0;
var isDragging = false;
var hasDragged = false;
var draggingEnabled = true;
function event_mousedown(e, arg_pageX, arg_pageY) {
	currentMousePosition[0] = e.pageX * zoomRatio;
	currentMousePosition[1] = e.pageY * zoomRatio;
	currentMousePosition[0] = e.pageX;
	currentMousePosition[1] = e.pageY;
	var target = e.target;
	if(closest(target, getChatfield()) || target == elm.chatbar) {
		worldFocused = false;
	} else {
		worldFocused = true;
	}

	var pageX = Math.trunc(e.pageX * zoomRatio);
	var pageY = Math.trunc(e.pageY * zoomRatio);
	if(arg_pageX != void 0) pageX = arg_pageX;
	if(arg_pageY != void 0) pageY = arg_pageY;
	if(target != elm.owot && target != linkDiv) {
		return;
	}
	if(draggingEnabled) {
		dragStartX = pageX;
		dragStartY = pageY;
		dragPosX = positionX;
		dragPosY = positionY;
		isDragging = true;
	}

	e.preventDefault();
	elm.textInput.focus(); // for mobile typing
	stopPasting();
	if(w.isLinking) {
		doLink();
	}
	if(w.isProtecting) {
		doProtect();
	}
	var foundActiveSelection = false;
	for(var i = 0; i < regionSelections.length; i++) {
		var reg = regionSelections[i];
		if(reg.isSelecting) {
			reg.regionCoordA = currentPosition;
			reg.show();
			reg.setSelection(reg.regionCoordA, reg.regionCoordA);
			foundActiveSelection = true;
		}
	}
	if(foundActiveSelection) return;
	var pos = getTileCoordsFromMouseCoords(pageX, pageY);
	w.emit("mouseDown", {
		tileX: pos[0],
		tileY: pos[1],
		charX: pos[2],
		charY: pos[3],
		pageX: pageX,
		pageY: pageY
	});
	elm.owot.style.cursor = defaultDragCursor;
	w.menu.hideNow();
}
document.addEventListener("mousedown", event_mousedown);

function event_touchstart(e) {
	var pos = touch_pagePos(e);
	touchPosX = pos[0];
	touchPosY = pos[1];
	event_mousedown(e, pos[0], pos[1]);
}
document.addEventListener("touchstart", event_touchstart, { passive: false });

// change cursor position
function renderCursor(coords) {
	var newTileX = coords[0];
	var newTileY = coords[1];
	var tile = Tile.get(newTileX, newTileY);
	if(!tile) return false;
	var writability = tile.properties.writability;
	var thisTile = {
		writability: writability,
		char: tile.properties.char
	}
	var tileX = 0;
	var tileY = 0;
	if(cursorCoords) {
		tileX = cursorCoords[0];
		tileY = cursorCoords[1];
	}
	var selCharX = coords[2];
	var selCharY = coords[3];
	if(!Permissions.can_edit_tile(state.userModel, state.worldModel, thisTile, selCharX, selCharY)) {
		if(cursorCoords) {
			cursorCoords = null;
			w.setTileRender(tileX, tileY);
		}
		return false;
	}

	if(cursorCoords) {
		cursorCoords = null;
		w.setTileRender(tileX, tileY);
	}
	cursorCoords = coords.slice(0);
	cursorCoordsCurrent = coords.slice(0);
	w.setTileRender(coords[0], coords[1]);

	var pixelX = (coords[0] * tileW) + (coords[2] * cellW) + positionX + Math.trunc(owotWidth / 2);
	var pixelY = (coords[1] * tileH) + (coords[3] * cellH) + positionY + Math.trunc(owotHeight / 2);
	
	var diff = null;
	// keep record of old positions to check if they changed
	var posXCompare = positionX;
	var posYCompare = positionY;

	if(pixelX < 0) { // cursor too far left
		diff = Math.abs(pixelX);
		positionX += diff;
	}
	if(pixelX + cellW >= owotWidth) { // cursor too far right
		diff = owotWidth - pixelX;
		positionX -= cellW - diff;
	}
	if(pixelY < 0) { // cursor too far up
		diff = Math.abs(pixelY);
		positionY += diff;
	}
	if(pixelY + cellH >= owotHeight) { // cursor too far down
		diff = owotHeight - pixelY;
		positionY -= cellH - diff;
	}

	if(diff != null && (posXCompare != positionX || posYCompare != positionY)) w.render();
	if(cursorCoords) w.emit("cursorMove", {
		tileX: cursorCoords[0],
		tileY: cursorCoords[1],
		charX: cursorCoords[2],
		charY: cursorCoords[3]
	});
}

// remove cursor from view
function removeCursor() {
	if(!cursorCoords) return; // no cursor?
	var remTileX = cursorCoords[0];
	var remTileY = cursorCoords[1];
	cursorCoords = null;
	w.setTileRender(remTileX, remTileY);
}

function stopDragging() {
	isDragging = false;
	hasDragged = false;
	elm.owot.style.cursor = defaultCursor;
}

var cursorEnabled = true;
function event_mouseup(e, arg_pageX, arg_pageY) {
	var pageX = Math.trunc(e.pageX * zoomRatio);
	var pageY = Math.trunc(e.pageY * zoomRatio);
	if(arg_pageX != void 0) pageX = arg_pageX;
	if(arg_pageY != void 0) pageY = arg_pageY;
	stopDragging();

	for(var i = 0; i < draggable_element_mouseup.length; i++) {
		draggable_element_mouseup[i](e, pageX, pageY);
	}

	if(e.target != elm.owot && e.target != linkDiv) return;

	if(e.which == 3) { // right click
		if(ignoreCanvasContext) {
			ignoreCanvasContext = false;
			elm.owot.style.pointerEvents = "none";
			setTimeout(function() {
				ignoreCanvasContext = true;
				elm.owot.style.pointerEvents = "";
			}, 1);
		}
		return;
	}

	var foundActiveSelection = false;
	for(var i = 0; i < regionSelections.length; i++) {
		var reg = regionSelections[i];
		if(reg.isSelecting) {
			reg.regionCoordB = currentPosition;
			reg.handleSelection();
			reg.stopSelectionUI();
			foundActiveSelection = true;
		}
	}
	if(foundActiveSelection) return;

	// set cursor
	var pos = getTileCoordsFromMouseCoords(pageX, pageY);
	w.emit("mouseUp", {
		tileX: pos[0],
		tileY: pos[1],
		charX: pos[2],
		charY: pos[3],
		pageX: pageX,
		pageY: pageY
	});
	if(cursorEnabled && Tile.get(pos[0], pos[1]) !== void 0) {
		verticalEnterPos = [pos[0], pos[2]];
		// change position of the cursor and get results
		if(renderCursor(pos) == false) {
			// cursor should be removed if on area where user cannot write
			if(cursorCoords) {
				removeCursor();
			}
		}
	}
}
document.addEventListener("mouseup", event_mouseup);
function event_touchend(e) {
	event_mouseup(e, touchPosX, touchPosY);
}
document.addEventListener("touchend", event_touchend);
function event_mouseleave() {
	stopDragging();
}
document.addEventListener("mouseleave", event_mouseleave);
function event_mouseenter() {
	stopDragging();
}
document.addEventListener("mouseenter", event_mouseenter);

function is_link(tileX, tileY, charX, charY) {
	if(!Tile.get(tileX, tileY)) return;
	var tile = Tile.get(tileX, tileY);
	if(!tile) return;
	var props = tile.properties.cell_props;
	if(!props) return false;
	if(!props[charY]) return false;
	if(!props[charY][charX]) return false;
	if(!props[charY][charX].link) return false;
	return [props[charY][charX].link];
}

var writeBuffer = [];

function flushWrites() {
	if(w.socket.socket.readyState != WebSocket.OPEN) return;
	network.write(writeBuffer);
	writeBuffer.splice(0); // clear buffer
}

var writeInterval = setInterval(function() {
	if(!writeBuffer.length) return;
	try {
		flushWrites();
	} catch(e) {
		console.log(e);
	}
}, 1000);

function moveCursor(direction, preserveVertPos) {
	if(!cursorCoords) return;
	// [tileX, tileY, charX, charY]
	var pos = cursorCoords.slice(0);
	if(direction == "up") {
		pos[3]--;
		if(pos[3] < 0) {
			pos[3] = tileR - 1;
			pos[1]--
		}
	} else if(direction == "down") {
		pos[3]++;
		if(pos[3] > tileR - 1) {
			pos[3] = 0;
			pos[1]++;
		}
	} else if(direction == "left") {
		pos[2]--;
		if(pos[2] < 0) {
			pos[2] = tileC - 1;
			pos[0]--;
		}
	} else if(direction == "right") {
		pos[2]++;
		if(pos[2] > tileC - 1) {
			pos[2] = 0;
			pos[0]++;
		}
	}
	if(!preserveVertPos) {
		verticalEnterPos = [pos[0], pos[2]];
	}
	return renderCursor(pos);
}

// place a character
function writeCharTo(char, charColor, tileX, tileY, charX, charY) {
	if(!Tile.get(tileX, tileY)) {
		Tile.set(tileX, tileY, blankTile());
	}
	
	var cell_props = Tile.get(tileX, tileY).properties.cell_props;
	if(!cell_props) cell_props = {};
	var color = Tile.get(tileX, tileY).properties.color;
	if(!color) color = new Array(tileArea).fill(0);

	// delete link
	if(cell_props[charY]) {
		if(cell_props[charY][charX]) {
			delete cell_props[charY][charX];
		}
	}
	// change color
	if(Permissions.can_color_text(state.userModel, state.worldModel)) {
		color[charY * tileC + charX] = charColor;
		Tile.get(tileX, tileY).properties.color = color; // if the color array doesn't already exist in the tile
	}

	// update cell properties (link positions)
	Tile.get(tileX, tileY).properties.cell_props = cell_props;

	var con = Tile.get(tileX, tileY).content;
	con[charY * tileC + charX] = char;
	w.setTileRedraw(tileX, tileY);

	var editArray = [tileY, tileX, charY, charX, getDate(), char, nextObjId];
	if(tileFetchOffsetX || tileFetchOffsetY) {
		editArray[0] += tileFetchOffsetY;
		editArray[1] += tileFetchOffsetX;
	}
	if(charColor && Permissions.can_color_text(state.userModel, state.worldModel)) {
		editArray.push(charColor);
	}
	tellEdit.push([tileX, tileY, charX, charY, nextObjId]);
	writeBuffer.push(editArray);
	nextObjId++;
}

function writeCharToXY(char, charColor, x, y) {
	writeCharTo(char, charColor,
		Math.floor(x / tileC),
		Math.floor(y / tileR),
		x - Math.floor(x / tileC) * tileC,
		y - Math.floor(y / tileR) * tileR);
}

// type a character
function writeChar(char, doNotMoveCursor, temp_color, noNewline) {
	char += "";
	var charColor = temp_color || YourWorld.Color;
	if(temp_color == 0) charColor = 0;
	var cursor = cursorCoords;
	if(!cursor && (char == "\n" || char == "\r") && !noNewline) {
		cursor = cursorCoordsCurrent;
	}
	var skipChar = false;
	if(char == "") {
		skipChar = true;
	} else {
		char = w.split(char);
		char = char[0];
		if(char == void 0) return;
	}
	if(!cursor) return; // cursor is not visible
	var tileX = cursor[0];
	var tileY = cursor[1];
	var charX = cursor[2];
	var charY = cursor[3];
	var newLine = (char == "\n" || char == "\r") && !noNewline;
	// first, attempt to move the cursor
	if(!doNotMoveCursor) {
		var pos = propagatePosition({
			tileX: cursor[0],
			tileY: cursor[1],
			charX: cursor[2],
			charY: cursor[3]
		}, char, noNewline);
		renderCursor([
			pos.tileX, pos.tileY,
			pos.charX, pos.charY
		]);
		// check if cursor hasn't moved
		if(cursorCoords) {
			var compare = cursor.slice(0);
			if(cursorCoords[0] == compare[0] && cursorCoords[1] == compare[1] &&
			   cursorCoords[2] == compare[2] && cursorCoords[3] == compare[3]) {
				return null;
				// for the purpose of putting the paste feature on hold while
				// the tile is still loading
			}
		}
	}
	if(!newLine && !skipChar) {
		var data = {
			char: char,
			color: charColor,
			tileX: tileX,
			tileY: tileY,
			charX: charX,
			charY: charY
		};
		w.emit("writeBefore", data);
		writeCharTo(data.char, data.color, data.tileX, data.tileY, data.charX, data.charY);
		w.emit("write", data);
	}
}

function spliceArray(array, A, B) {
	if(!array) return;
	if(Array.isArray(array)) {
		// list of arrays
		for(var i = 0; i < array.length; i++) {
			if(!array[i]) continue;
			array[i].splice(A, B);
		}
	} else {
		array.splice(A, B);
	}
}

function spaceTrim(str_array, left, right, gaps, secondary_array) {
	// secondary_array is an optional argument where elements are trimmed in parallel with str_array
	var marginLeft = 0;
	var marginRight = 0;
	var countL = left;
	var countR = right;
	var whitespaces = "\u0009\u000a\u000b\u000d\u0020\u0085\u00a0";
	for(var i = 0; i < str_array.length; i++) {
		var idxL = i;
		var idxR = str_array.length - 1 - i;
		if(whitespaces.indexOf(str_array[idxL]) > -1 && countL) {
			marginLeft++;
		} else {
			countL = false;
		}
		if(whitespaces.indexOf(str_array[idxR]) > -1 && countR) {
			marginRight++;
		} else {
			countR = false;
		}
		if(!countL && !countR) break;
	}
	if(marginLeft) {
		str_array.splice(0, marginLeft);
		spliceArray(secondary_array, 0, marginLeft);
	}
	if(marginRight) {
		str_array.splice(str_array.length - marginRight);
		spliceArray(secondary_array, secondary_array.length - marginRight);
	}
	if(gaps) {
		var spaceFreq = 0;
		for(var i = 0; i < str_array.length; i++) {
			var chr = str_array[i];
			if(whitespaces.indexOf(chr) > -1) {
				spaceFreq++;
			} else {
				spaceFreq = 0;
			}
			if(spaceFreq > 1) {
				str_array.splice(i, 1);
				spliceArray(secondary_array, i, 1);
				i--;
			}
		}
	}
	return str_array;
}

function coordinateAdd(tileX1, tileY1, charX1, charY1, tileX2, tileY2, charX2, charY2) {
	return [
		tileX1 + tileX2 + Math.floor((charX1 + charX2) / tileC),
		tileY1 + tileY2 + Math.floor((charY1 + charY2) / tileR),
		(charX1 + charX2) % tileC,
		(charY1 + charY2) % tileR
	];
}

function propagatePosition(coords, char, noEnter) {
	// coords: {tileX, tileY, charX, charY}
	// char: <string>
	var newline = char == "\n" || char == "\r";
	if(newline && !noEnter) {
		if(pasteDirDown) {
			coords.charY++;
			if(coords.charY >= tileR) {
				coords.charY = 0;
				coords.tileY++;
			}
		} else {
			coords.charY--;
			if(coords.charY < 0) {
				coords.charY = tileY - 1;
				coords.tileY--;
			}
		}
		coords.tileX = verticalEnterPos[0];
		coords.charX = verticalEnterPos[1];
	} else {
		if(pasteDirRight) {
			coords.charX++;
			if(coords.charX >= tileC) {
				coords.charX = 0;
				coords.tileX++;
			}
		} else {
			coords.charX--;
			if(coords.charX < 0) {
				coords.charX = tileC - 1;
				coords.tileX--;
			}
		}
	}
	return coords;
}

function textcode_parser(value, coords, defaultColor) {
	if(typeof value == "string") value = w.split(value);
	var hex = "ABCDEF";
	var pasteColor = defaultColor;
	if(!pasteColor) pasteColor = 0;
	var index = 0;
	var off = {
		tileX: 0, tileY: 0,
		charX: 0, charY: 0
	};
	if(coords) {
		off.tileX = coords.tileX;
		off.tileY = coords.tileY;
		off.charX = coords.charX;
		off.charY = coords.charY;
	}
	var pos = {
		tileX: 0, tileY: 0,
		charX: 0, charY: 0
	};
	var next = function() {
		if(index >= value.length) return -1;
		var chr = value[index];
		var doWriteChar = true;
		var newline = true;
		if(chr == "\x1b") {
			doWriteChar = false;
			var hCode = value[index + 1];
			if(hCode == "$") { // contains links
				index += 2;
				var lType = value[index];
				index++;
				if(lType == "c") { // coord
					var strPoint = index;
					var buf = "";
					var mode = 0;
					while(true) {
						if(value[strPoint] == "[" && mode == 0) {
							mode = 1;
							if(++strPoint >= value.length) break;
							continue;
						}
						if(value[strPoint] == "]" && mode == 1) {
							strPoint++;
							break;
						}
						if(mode == 1) {
							buf += value[strPoint];
							if(++strPoint >= value.length) break;
							continue;
						}
						if(++strPoint >= value.length) break;
					}
					index = strPoint;
					buf = buf.split(",");
					var coordTileX = parseFloat(buf[0].trim());
					var coordTileY = parseFloat(buf[1].trim());
					return {
						type: "link",
						linkType: "coord",
						tileX: cursorCoords[0],
						tileY: cursorCoords[1],
						charX: cursorCoords[2],
						charY: cursorCoords[3],
						coord_tileX: coordTileX,
						coord_tileY: coordTileY
					};
				} else if(lType == "u") { // urllink
					var strPoint = index;
					var buf = "";
					var quotMode = 0;
					while(true) {
						if(value[strPoint] == "\"" && quotMode == 0) {
							quotMode = 1;
							if(++strPoint >= value.length) break;
							continue;
						}
						if(value[strPoint] == "\"" && quotMode == 1) {
							strPoint++;
							break;
						}
						if(quotMode == 1) {
							if(value[strPoint] == "\\") {
								quotMode = 2;
								if(++strPoint >= value.length) break;
								continue;
							}
							buf += value[strPoint];
						}
						if(quotMode == 2) {
							buf += value[strPoint];
							quotMode = 1;
							if(++strPoint >= value.length) break;
							continue;
						}
						if(++strPoint >= value.length) break;
					}
					index = strPoint;
					return {
						type: "link",
						linkType: "url",
						tileX: cursorCoords[0],
						tileY: cursorCoords[1],
						charX: cursorCoords[2],
						charY: cursorCoords[3],
						url: buf
					};
				}
			} else if(hCode == "P") { // contains area protections
				index += 2;
				var protType = parseInt(value[index]);
				index++;
				if(isNaN(protType)) protType = 0;
				if(!(protType >= 0 && protType <= 2)) protType = 0;
				var charPos = coordinateAdd(pos.tileX, pos.tileY, pos.charX, pos.charY,
					off.tileX, off.tileY, off.charX, off.charY);
				return {
					type: "protect",
					protType: protType,
					tileX: charPos[0],
					tileY: charPos[1],
					charX: charPos[2],
					charY: charPos[3]
				};
			} else if(hCode == "\r" || hCode == "\n" || hCode == "\x1b" || hCode == "r" || hCode == "n") {
				index++;
				doWriteChar = true;
				if(hCode == "\n") { // paste newline character itself
					chr = "\n";
					newline = false;
				} else if(hCode == "\r") { // paste carriage return character itself
					chr = "\r";
					newline = false;
				} else if(hCode == "\x1b") { // paste ESC character itself
					chr = "\x1b";
				} else if(hCode == "r") { // newline
					chr = "\r";
				} else if(hCode == "n") { // newline
					chr = "\n";
				}
			} else if(hCode == "*") { // skip character
				index++;
				chr = "";
				doWriteChar = true;
			} else { // colored paste
				var cCol = "";
				if(hCode == "x") {
					cCol = "000000";
					index += 2;
				} else if(hCode == "X") {
					cCol = "-1";
					index += 2;
				} else {
					var code = hex.indexOf(hCode);
					if(code > -1) {
						cCol = value.slice(index + 2, index + 2 + code + 1).join("");
						index += code + 1;
					}
					index += 2;
				}
				pasteColor = parseInt(cCol, 16);
				return {
					type: "yield"
				};
			}
		} else {
			index++;
		}
		var charPos = coordinateAdd(pos.tileX, pos.tileY, pos.charX, pos.charY,
			off.tileX, off.tileY, off.charX, off.charY);
		propagatePosition(pos, chr, false);
		return {
			type: "char",
			char: chr,
			color: pasteColor,
			writable: doWriteChar,
			newline: newline, // allowed to make newlines
			tileX: charPos[0],
			tileY: charPos[1],
			charX: charPos[2],
			charY: charPos[3]
		};
	}
	return {
		next: next,
		nextItem: function() {
			while(true) {
				var item = next();
				if(item == -1) return -1;
				if(item.type == "yield") continue;
				return item;
			}
		}
	};
}

// write characters inputted
var write_busy = false; // busy pasting
var pasteInterval;
var linkQueue = [];
var char_input_check = setInterval(function() {
	if(write_busy) return;
	write_busy = true;
	var value = elm.textInput.value;
	if(!value) return;
	clearInterval(pasteInterval);
	value = w.split(value.replace(/\r\n/g, "\n"));
	if(value.length == 1) {
		writeChar(value[0]);
		elm.textInput.value = "";
		return;
	}
	var pastePerm = Permissions.can_paste(state.userModel, state.worldModel);
	var requestNextItem = true;
	var parser = textcode_parser(value, {
		tileX: cursorCoords[0],
		tileY: cursorCoords[1],
		charX: cursorCoords[2],
		charY: cursorCoords[3]
	}, YourWorld.Color);
	var item;
	var charCount = 0;
	var pasteFunc = function() {
		if(requestNextItem) {
			item = parser.nextItem();
		} else {
			requestNextItem = true;
		}
		if(item == -1)  {
			elm.textInput.value = "";
			write_busy = false;
			return -1;
		}
		if(item.type == "char") {
			if(item.writable) {
				var res = writeChar(item.char, false, item.color, !item.newline);
				if(res === null) {
					// pause until tile loads
					requestNextItem = false;
					return;
				}
				charCount++;
			}
		} else if(item.type == "link") {
			if(item.linkType == "url" && Permissions.can_urllink(state.userModel, state.worldModel)) {
				linkQueue.push(["url", item.tileX, item.tileY, item.charX, item.charY, item.url]);
			} else if(item.linkType == "coord" && Permissions.can_coordlink(state.userModel, state.worldModel)) {
				linkQueue.push(["coord", item.tileX, item.tileY, item.charX, item.charY, item.coord_tileX, item.coord_tileY]);
			}
		} else if(item.type == "protect") {
			var protType = item.protType;
			var canProtect = true;
			if(protType <= 1) { // public, member
				if(!Permissions.can_protect_tiles(state.userModel, state.worldModel)) canProtect = false;
			}
			if(protType == 2) { // owner
				if(!Permissions.can_admin(state.userModel, state.worldModel)) protType = 1; // member
			}
			if(canProtect) {
				network.protect({
					tileY: item.tileY,
					tileX: item.tileX,
					charY: item.charY,
					charX: item.charX
				}, ["public", "member-only", "owner-only"][protType]);
			}
		}
	};
	if(!pastePerm) {
		while(true) {
			var res = pasteFunc();
			if(res == -1 || charCount >= 4) break;
		}
		return;
	}
	pasteInterval = setInterval(function() {
		var res = pasteFunc();
		if(res == -1) clearInterval(pasteInterval);
	}, 1);
}, 10);

function stopPasting() {
	if(write_busy) elm.textInput.value = "";
	clearInterval(pasteInterval);
	write_busy = false;
}

var autoArrowKeyMoveInterval = null;
var autoArrowKeyMoveActive = false;
var autoArrowKeyMoveState = {
	up: false,
	down: false,
	left: false,
	right: false,
	x_t: 0,
	y_t: 0,
	prog_x: 0,
	prog_y: 0
};
function autoArrowKeyMoveStart(dir) {
	if(!autoArrowKeyMoveActive) {
		autoArrowKeyMoveActive = true;
		autoArrowKeyMoveInterval = setInterval(function() {
			if(cursorCoords) {
				clearInterval(autoArrowKeyMoveInterval);
				autoArrowKeyMoveActive = false;
				autoArrowKeyMoveState.y_t = 0;
				autoArrowKeyMoveState.prog_y = 0;
				autoArrowKeyMoveState.x_t = 0;
				autoArrowKeyMoveState.prog_x = 0;
				return;
			}
			var date = getDate();
			var s_up = autoArrowKeyMoveState.up;
			var s_down = autoArrowKeyMoveState.down;
			var s_left = autoArrowKeyMoveState.left;
			var s_right = autoArrowKeyMoveState.right;
			var x_t = autoArrowKeyMoveState.x_t;
			var y_t = autoArrowKeyMoveState.y_t;
			if(x_t) {
				var diff = (date - x_t) / (1000 / 240);
				if(s_right && !s_left) {
					var addDiff = diff - autoArrowKeyMoveState.prog_x;
					autoArrowKeyMoveState.prog_x = diff;
					positionX -= addDiff;
					w.render();
				}
				if(s_left && !s_right) {
					var addDiff = diff - autoArrowKeyMoveState.prog_x;
					autoArrowKeyMoveState.prog_x = diff;
					positionX += addDiff;
					w.render();
				}
			}
			if(y_t) {
				var diff = (date - y_t) / (1000 / 240);
				if(s_up && !s_down) {
					var addDiff = diff - autoArrowKeyMoveState.prog_y;
					autoArrowKeyMoveState.prog_y = diff;
					positionY += addDiff;
					w.render();
				}
				if(s_down && !s_up) {
					var addDiff = diff - autoArrowKeyMoveState.prog_y;
					autoArrowKeyMoveState.prog_y = diff;
					positionY -= addDiff;
					w.render();
				}
			}
		}, 10);
	}
	switch(dir) {
		case "up":
			autoArrowKeyMoveState.up = true;
			if(autoArrowKeyMoveState.y_t == 0) autoArrowKeyMoveState.y_t = getDate();
			break;
		case "down":
			autoArrowKeyMoveState.down = true;
			if(autoArrowKeyMoveState.y_t == 0) autoArrowKeyMoveState.y_t = getDate();
			break;
		case "left":
			autoArrowKeyMoveState.left = true;
			if(autoArrowKeyMoveState.x_t == 0) autoArrowKeyMoveState.x_t = getDate();
			break;
		case "right":
			autoArrowKeyMoveState.right = true;
			if(autoArrowKeyMoveState.x_t == 0) autoArrowKeyMoveState.x_t = getDate();
			break;
	}
}
function autoArrowKeyMoveStop(dir) {
	switch(dir) {
		case "up":
			autoArrowKeyMoveState.up = false;
			autoArrowKeyMoveState.y_t = 0;
			autoArrowKeyMoveState.prog_y = 0;
			if(autoArrowKeyMoveState.down) autoArrowKeyMoveState.y_t = getDate();
			break;
		case "down":
			autoArrowKeyMoveState.down = false;
			autoArrowKeyMoveState.y_t = 0;
			autoArrowKeyMoveState.prog_y = 0;
			if(autoArrowKeyMoveState.up) autoArrowKeyMoveState.y_t = getDate();
			break;
		case "left":
			autoArrowKeyMoveState.left = false;
			autoArrowKeyMoveState.x_t = 0;
			autoArrowKeyMoveState.prog_x = 0;
			if(autoArrowKeyMoveState.right) autoArrowKeyMoveState.x_t = getDate();
			break;
		case "right":
			autoArrowKeyMoveState.right = false;
			autoArrowKeyMoveState.x_t = 0;
			autoArrowKeyMoveState.prog_x = 0;
			if(autoArrowKeyMoveState.left) autoArrowKeyMoveState.x_t = getDate();
			break;
	}
	if(!autoArrowKeyMoveState.up && !autoArrowKeyMoveState.down && !autoArrowKeyMoveState.left && !autoArrowKeyMoveState.right) {
		clearInterval(autoArrowKeyMoveInterval);
		autoArrowKeyMoveActive = false;
	}
}

function event_keydown(e) {
	var actElm = document.activeElement;
	if(!worldFocused) return;
	if(w._state.uiModal) return;
	if(actElm == elm.chatbar) return;
	if(actElm.tagName == "INPUT" && actElm.type == "text" && actElm != elm.textInput) return;
	if(actElm != elm.textInput) elm.textInput.focus();
	stopPasting();
	if(checkKeyPress(e, keyConfig.cursorUp)) { // arrow up
		moveCursor("up");
		if(!cursorCoords) autoArrowKeyMoveStart("up");
	}
	if(checkKeyPress(e, keyConfig.cursorDown)) { // arrow down
		moveCursor("down");
		if(!cursorCoords) autoArrowKeyMoveStart("down");
	}
	if(checkKeyPress(e, keyConfig.cursorLeft)) { // arrow left
		moveCursor("left");
		if(!cursorCoords) autoArrowKeyMoveStart("left");
	}
	if(checkKeyPress(e, keyConfig.cursorRight)) { // arrow right
		moveCursor("right");
		if(!cursorCoords) autoArrowKeyMoveStart("right");
	}
	if(checkKeyPress(e, keyConfig.reset)) { // esc
		w.emit("esc");
		stopLinkUI();
		stopTileUI();
		for(var i = 0; i < regionSelections.length; i++) {
			regionSelections[i].stopSelectionUI();
		}
		removeCursor();
		tileProtectAuto.active = false;
		tileProtectAuto.lastPos = null;
		linkAuto.active = false;
	}
	if(checkKeyPress(e, "CTRL+ENTER")) {
		writeChar("\n");
	}
	if(checkKeyPress(e, keyConfig.erase)) { // erase character
		moveCursor("left", true);
		writeChar(" ", true);
	}
	if(checkKeyPress(e, keyConfig.tab)) { // tab
		for(var i = 0; i < 4; i++) writeChar(" ");
		e.preventDefault();
	}
	w.emit("keyDown", e);
}
document.addEventListener("keydown", event_keydown);

function event_keyup(e) {
	w.emit("keyUp", e);
}
document.addEventListener("keyup", event_keyup);

var colors = ["#660066", "#003366", "#ff9900", "#ff0066", "#003300", "#ff0000", "#3a3a3a", "#006666", "#3399ff", "#3333ff", "#000000"];
function assignColor(username) {
	username = username.toUpperCase();
	var colLen = colors.length;
	var usrLen = username.length;
	var avg = 0;
	for(var i = 0; i < usrLen; i++) {
		var chr = username.charCodeAt(i);
		avg += (chr * chr | (i * chr) % 628) * (i << chr) + (chr*(i + 19 + (chr % 56))*chr);
	}
	return colors[(Math.abs(avg | 0)) % colLen];
}

function getTileCoordsFromMouseCoords(x, y) {
	var tileX = 0;
	var tileY = 0;
	var charX = 0;
	var charY = 0;
	// position relative to position in client and mouse
	var mpX = x - positionX - Math.trunc(owotWidth / 2);
	var mpY = y - positionY - Math.trunc(owotHeight / 2);
	// cell position (relative to anywhere)
	charX = Math.floor(mpX / cellW);
	charY = Math.floor(mpY / cellH);
	// add tile position
	tileX = Math.floor(charX / tileC);
	tileY = Math.floor(charY / tileR);
	// in-tile cell position
	charX = charX - (Math.floor(charX / tileC) * tileC);
	charY = charY - (Math.floor(charY / tileR) * tileR);
	return [tileX, tileY, charX, charY];
}

function getTileScreenPosition(tileX, tileY) {
	var offsetX = tileX * tileW + Math.trunc(owotWidth / 2) + Math.floor(positionX);
	var offsetY = tileY * tileH + Math.trunc(owotHeight / 2) + Math.floor(positionY);
	return [offsetX, offsetY];
}

function getRange(x1, y1, x2, y2) {
	var tmp;
	if(x1 > x2) {
		tmp = x1;
		x1 = x2;
		x2 = tmp;
	}
	if(y1 > y2) {
		tmp = y1;
		y1 = y2;
		y2 = tmp;
	}

	assert(intmax([x1, y1, x2, y2]), "Invalid ranges");

	var coords = [];
	for(var y = y1; y <= y2; y++) {
		for(var x = x1; x <= x2; x++) {
			coords.push([x, y]);
			if(coords.length >= 400000) throw "Potential memory leak";
		}
	}
	return coords;
}

function getVisibleTiles(margin) {
	if(!margin) margin = 0;
	var A = getTileCoordsFromMouseCoords(0 - margin, 0 - margin);
	var B = getTileCoordsFromMouseCoords(owotWidth - 1 + margin, owotHeight - 1 + margin);
	return getRange(A[0], A[1], B[0], B[1]);
}

function getWidth(margin) {
	if(!margin) margin = 0;
	var A = getTileCoordsFromMouseCoords(0 - margin, 0);
	var B = getTileCoordsFromMouseCoords(owotWidth - 1 + margin, 0);
	return B[0] - A[0] + 1;
}

function getHeight(margin) {
	if(!margin) margin = 0;
	var A = getTileCoordsFromMouseCoords(0, 0 - margin);
	var B = getTileCoordsFromMouseCoords(0, owotHeight - 1 + margin);
	return B[1] - A[1] + 1;
}

function getArea(margin) {
	if(!margin) margin = 0;
	var A = getTileCoordsFromMouseCoords(0 - margin, 0 - margin);
	var B = getTileCoordsFromMouseCoords(owotWidth - 1 + margin, owotHeight - 1 + margin);
	return (B[0] - A[0] + 1) * (B[1] - A[1] + 1);
}

function tileAndCharsToWindowCoords(tileX, tileY, charX, charY) {
	// first, define x and y as tile coords, not adjusted for center nor position offsets
	var x = tileX * tileW;
	var y = tileY * tileH;
	// add char offsets
	x += charX * cellW;
	y += charY * cellH;
	// add drag position offsets
	x += positionX;
	y += positionY;
	// add center offsets
	x += Math.trunc(owotWidth / 2);
	y += Math.trunc(owotHeight / 2);
	return [Math.trunc(x/zoomRatio), Math.trunc(y/zoomRatio)];
}

function alertJS(data) {
	if(js_alert_active) return;
	js_alert_active = true;
	elm.confirm_js.style.display = "";
	elm.confirm_js_code.innerText = data;
	run_js_confirm_risk.href = data;
	run_js_confirm_risk.onclick = function() {
		confirmRunJsLink(data);
		return false;
	}
	run_js_confirm.href = "javascript:confirmRunJsLink(null, true);"
	confirm_js_cancel.onclick = closeJSAlert;
	confirm_js_cancel_x.onclick = closeJSAlert;
}

function closeJSAlert() {
	if(!js_alert_active) return;
	js_alert_active = false;
	elm.confirm_js.style.display = "none";
	run_js_confirm.href = "javascript:void 0;"
	run_js_confirm.innerText = "run";
	run_js_confirm_risk.style.display = "none";
}

function confirmRunJsLink(data, confirmWarning) {
	if(confirmWarning) {
		run_js_confirm_risk.style.display = "";
		run_js_confirm.text = "run ▲";
		return; 
	}
	var preview = data;
	if(preview.length > 256) {
		preview = preview.slice(0, 256) + " [...]";
	}
	var doRun = confirm("Are you sure you want to run this javascript link?\nPress cancel to NOT run it.\n\"" + preview + "\"");
	if(!doRun) return closeJSAlert();
	var link = document.createElement("a");
	link.href = "javascript:" + encodeURIComponent(data);
	link.click();
	link.remove();
	closeJSAlert();
}

function runJsLink(data) {
	if(secureJSLink) {
		alertJS(data);
	} else {
		var link = document.createElement("a");
		link.href = "javascript:" + encodeURIComponent(data);
		link.click();
		link.remove();
	}
}

var linkParams = {
	protocol: "",
	url: "",
	coord: false
};
linkDiv.style.width = cellW + "px";
linkDiv.style.height = cellH + "px";
linkElm.style.top = "-1000px";
linkElm.style.left = "-1000px";
linkElm.ondragstart = function() {
	return false;
}
linkElm.onclick = function(e) {
	if(linkParams.coord) {
		coord_link_click(e);
		return;
	}
	var linkEvent = url_link_click(e);
	var prot = linkParams.protocol;
	var url = linkParams.url;
	if(prot == "javascript") {
		runJsLink(url);
		return false;
	} else if(prot == "com") {
		w.broadcastCommand(url);
		return false;
	} else if(prot == "comu") {
		w.broadcastCommand(url, true);
		return false;
	}
	if(linkEvent && linkEvent[0]) {
		return linkEvent[0];
	}
}
var currentSelectedLink = null;
var currentSelectedLinkCoords = null; // [tileX, tileY, charX, charY]

function coord_link_click(evt) {
	if(!currentSelectedLink) return;
	w.doGoToCoord(currentSelectedLink.link_tileY, currentSelectedLink.link_tileX);
}
function url_link_click(evt) {
	if(!currentSelectedLink) return;
	var returnValue = [undefined];
	w.emit("linkClick", {
		url: currentSelectedLink.url,
		tileX: currentSelectedLinkCoords[0],
		tileY: currentSelectedLinkCoords[1],
		charX: currentSelectedLinkCoords[2],
		charY: currentSelectedLinkCoords[3],
		elm: linkElm,
		evt: evt,
		returnValue: returnValue
	});
	return returnValue[0];
}

function updateHoveredLink(mouseX, mouseY, evt) {
	if(mouseX == void 0 && mouseY == void 0) {
		mouseX = currentMousePosition[0];
		mouseY = currentMousePosition[1];
	}
	var coords = getTileCoordsFromMouseCoords(mouseX, mouseY);
	var tileX = coords[0];
	var tileY = coords[1];
	var charX = coords[2];
	var charY = coords[3];
	if(evt) {
		if(!closest(evt.target, elm.main_view) && evt.target != linkDiv) return;
	}
	var link = is_link(tileX, tileY, charX, charY);
	if(link && linksEnabled && !regionSelectionsActive()) {
		currentSelectedLink = link[0];
		currentSelectedLinkCoords = coords;
		var pos = tileAndCharsToWindowCoords(tileX, tileY, charX, charY);
		elm.owot.style.cursor = "pointer";
		linkElm.style.left = pos[0] + "px";
		linkElm.style.top = pos[1] + "px";
		linkElm.hidden = false;
		linkElm.target = "_blank";
		linkElm.href = "";
		linkElm.rel = "";
		linkElm.title = "";
		if(link[0].type == "url") {
			linkParams.coord = false;
			var URL_Link = link[0].url;
			linkElm.href = URL_Link;
			linkElm.rel = "noopener noreferrer";
			var linkProtocol = linkElm.protocol;
			if(linkProtocol == "javascript:") {
				linkElm.target = "";
				linkParams.protocol = "javascript";
				var url = URL_Link.slice(linkProtocol.length);
				linkParams.url = url;
			} else if(linkProtocol == "com:") {
				linkElm.target = "";
				linkParams.protocol = "com";
				var url = URL_Link.slice(linkProtocol.length);
				linkParams.url = url;
				linkElm.title = "com:" + url;
			} else if(linkProtocol == "comu:") {
				linkElm.target = "";
				linkParams.protocol = "comu";
				var url = URL_Link.slice(linkProtocol.length);
				linkParams.url = url;
				linkElm.title = "comu:" + url;
			} else {
				linkParams.protocol = "";
				linkElm.rel = "noopener noreferrer";
				linkParams.url = URL_Link;
			}
			if(!linkElm.title) linkElm.title = "Link to URL " + linkElm.href;
		} else if(link[0].type == "coord") {
			linkParams.coord = true;
			linkParams.protocol = "";
			linkElm.target = "";
			linkElm.href = "javascript:void(0);";
			linkElm.target = "";
			var pos = link[0].link_tileX + "," + link[0].link_tileY;
			linkElm.title = "Link to coordinates " + pos;
		}
	} else {
		currentSelectedLink = null;
		currentSelectedLinkCoords = null;
		if(!linkElm.hidden) elm.owot.style.cursor = defaultCursor;
		linkElm.style.top = "-1000px";
		linkElm.style.left = "-1000px";
		linkElm.hidden = true;
	}
}

var touchPosX = 0;
var touchPosY = 0;
function event_mousemove(e, arg_pageX, arg_pageY) {
	currentMousePosition[0] = e.pageX * zoomRatio;
	currentMousePosition[1] = e.pageY * zoomRatio;
	currentMousePosition[0] = e.pageX;
	currentMousePosition[1] = e.pageY;
	var pageX = e.pageX * zoomRatio;
	var pageY = e.pageY * zoomRatio;
	if(arg_pageX != void 0) pageX = arg_pageX;
	if(arg_pageY != void 0) pageY = arg_pageY;
	var coords = getTileCoordsFromMouseCoords(pageX, pageY);
	currentPosition = coords;
	currentPositionInitted = true;
	var tileX = coords[0];
	var tileY = coords[1];
	var charX = coords[2];
	var charY = coords[3];
	w.emit("mouseMove", {
		tileX: tileX,
		tileY: tileY,
		charX: charX,
		charY: charY,
		pageX: pageX,
		pageY: pageY
	});
	for(var i = 0; i < draggable_element_mousemove.length; i++) {
		draggable_element_mousemove[i](e, e.pageX, e.pageY);
	}
	updateHoveredLink(pageX, pageY, e);
	if(e.target != elm.owot && e.target != linkDiv) return;

	// region selecting
	for(var i = 0; i < regionSelections.length; i++) {
		var reg = regionSelections[i];
		if(!reg.isSelecting) continue;
		if(reg.lastSelectionHover) {
			var tileX = reg.lastSelectionHover[0];
			var tileY = reg.lastSelectionHover[1];
			var charX = reg.lastSelectionHover[2];
			var charY = reg.lastSelectionHover[3];
			if(reg.tiled) {
				if(Tile.get(tileX, tileY)) {
					Tile.get(tileX, tileY).backgroundColor = "";
				}
			} else {
				uncolorChar(tileX, tileY, charX, charY);
			}
			w.setTileRedraw(tileX, tileY);
		}
		reg.lastSelectionHover = currentPosition;
		var newTileX = currentPosition[0];
		var newTileY = currentPosition[1];
		var newCharX = currentPosition[2];
		var newCharY = currentPosition[3];
		if(Tile.get(newTileX, newTileY)) {
			if(reg.tiled) {
				Tile.get(newTileX, newTileY).backgroundColor = reg.charColor;
			} else {
				colorChar(newTileX, newTileY, newCharX, newCharY, reg.charColor, true);
			}
			// re-render tile
			w.setTileRedraw(newTileX, newTileY);
		}
		reg.regionCoordB = currentPosition;
		if(reg.regionCoordA && reg.regionCoordB) reg.setSelection(reg.regionCoordA, reg.regionCoordB);
	}

	// url/coordinate linking
	if(w.isLinking) {
		if(lastLinkHover) {
			var tileX = lastLinkHover[0];
			var tileY = lastLinkHover[1];
			var charX = lastLinkHover[2];
			var charY = lastLinkHover[3];
			uncolorChar(tileX, tileY, charX, charY);
			w.setTileRedraw(tileX, tileY);
		}
		lastLinkHover = currentPosition;
		var newTileX = currentPosition[0];
		var newTileY = currentPosition[1];
		var newCharX = currentPosition[2];
		var newCharY = currentPosition[3];
		if(Tile.get(newTileX, newTileY)) {
			colorChar(newTileX, newTileY, newCharX, newCharY, "#aaf", true);
			// re-render tile
			w.setTileRedraw(newTileX, newTileY);
		}
	}

	// tile protection
	if(w.isProtecting) {
		if(lastTileHover) {
			var precision = lastTileHover[0];
			var tileX = lastTileHover[1];
			var tileY = lastTileHover[2];
			var charX = lastTileHover[3];
			var charY = lastTileHover[4];
			if(precision == 0) {
				if(Tile.get(tileX, tileY) && !tileProtectAuto.selected[tileY + "," + tileX]) {
					Tile.get(tileX, tileY).backgroundColor = "";
				}
			} else if(precision == 1) {
				uncolorChar(tileX, tileY, charX, charY);
				w.setTileRedraw(tileX, tileY);
			}
			w.setTileRedraw(tileX, tileY);
		}
		var cp = currentPosition;
		lastTileHover = [protectPrecision, cp[0], cp[1], cp[2], cp[3]];
		var newTileX = currentPosition[0];
		var newTileY = currentPosition[1];
		var newCharX = currentPosition[2];
		var newCharY = currentPosition[3];
		if(protectPrecision == 0) {
			if(Tile.get(newTileX, newTileY) && !tileProtectAuto.selected[newTileY + "," + newTileX]) {
				Tile.get(newTileX, newTileY).backgroundColor = w.protect_bg;
				w.setTileRender(newTileX, newTileY);
			}
		} else if(protectPrecision == 1) {
			if(Tile.get(newTileX, newTileY)) {
				colorChar(newTileX, newTileY, newCharX, newCharY, w.protect_bg);
				w.setTileRedraw(newTileX, newTileY);
			}
		}
	}

	// if dragging beyond window, stop
	if(pageX >= owotWidth || pageY >= owotHeight || pageX < 0 || pageY < 0) stopDragging();

	if(!isDragging || regionSelectionsActive()) return;

	positionX = dragPosX + (pageX - dragStartX);
	positionY = dragPosY + (pageY - dragStartY);
	hasDragged = true;
	w.render();
}
document.addEventListener("mousemove", event_mousemove);
function event_touchmove(e) {
	e.preventDefault();
	var pos = touch_pagePos(e);
	touchPosX = pos[0];
	touchPosY = pos[1];
	event_mousemove(e, pos[0], pos[1]);
}
document.addEventListener("touchmove", event_touchmove, { passive: false });

// get position from touch event
function touch_pagePos(e) {
	var first_touch = e.touches[0];
	return [Math.trunc(first_touch.pageX * zoomRatio), Math.trunc(first_touch.pageY * zoomRatio)];
}

function event_wheel(e) {
	if(w._state.uiModal) return;
	if(!scrollingEnabled) return; // return if disabled
	// if focused on chat, don't scroll world
	if(closest(e.target, getChatfield())) return;
	if(e.ctrlKey) return; // don't scroll if ctrl is down (zooming)
	var deltaX = Math.trunc(e.deltaX);
	var deltaY = Math.trunc(e.deltaY);
	if(e.deltaMode && deltaY) { // not zero (default)?
		deltaX = 0;
		deltaY = (deltaY / Math.abs(deltaY)) * 100;
	}
	if(checkKeyPress(e, keyConfig.sidewaysScroll)) { // if shift, scroll sideways
		deltaX = deltaY;
		deltaY = 0;
	}
	positionY -= deltaY;
	positionX -= deltaX;
	w.emit("scroll", {
		deltaX: -deltaX,
		deltaY: -deltaY
	});
	w.render();
}
document.addEventListener("wheel", event_wheel);

function checkKeyPress(e, combination) {
	// if combination arg is an array of combinations
	if(typeof combination == "object") {
		var res = false;
		for(var i = 0; i < combination.length; i++) {
			res = res || checkKeyPress(e, combination[i]);
		}
		return res;
	}
	combination = combination.split("+");
	var map = {
		ctrl: false,
		shift: false,
		alt: false,
		anyCSA: false, // does not check for ctrl/shift/alt
		key: ""
	};
	for(var i = 0; i < combination.length; i++) {
		var key = combination[i];
		switch(key) {
			case "CTRL": map.ctrl = true; break;
			case "SHIFT": map.shift = true; break;
			case "ALT": map.alt = true; break;
			case "*": map.anyCSA = true; break;

			case "ESC": map.key = "Escape"; break;
			case "TAB": map.key = "Tab"; break;
			case "SPACE": map.key = " "; break;
			case "PAGEUP": map.key = "PageUp"; break;
			case "PAGEDOWN": map.key = "PageDown"; break;
			case "UP": map.key = "ArrowUp"; break;
			case "DOWN": map.key = "ArrowDown"; break;
			case "LEFT": map.key = "ArrowLeft"; break;
			case "RIGHT": map.key = "ArrowRight"; break;
			case "CAPS": map.key = "CapsLock"; break;
			case "END": map.key = "End"; break;
			case "HOME": map.key = "Home"; break;
			case "INSERT": map.key = "Insert"; break;
			case "DELETE": map.key = "Delete"; break;
			case "PLUS": map.key = "+"; break;
			case "MINUS": map.key = "-"; break;
			case "ENTER": map.key = "Enter"; break;
			case "BACKSPACE": map.key = "Backspace"; break;
			case "COMMAND": map.key = "Meta"; break;
			default: map.key = key;
		}
	}
	if(!map.anyCSA) {
		if(map.ctrl != e.ctrlKey) return false;
		if(map.shift != e.shiftKey) return false;
		if(map.alt != e.altKey) return false;
	}
	if(e.keyCode == 37) e.key = "ArrowLeft";
	if(e.keyCode == 38) e.key = "ArrowUp";
	if(e.keyCode == 39) e.key = "ArrowRight";
	if(e.keyCode == 40) e.key = "ArrowDown";
	var eKey = e.key;
	// key must not be Ctrl/Shift/Alt because it's already stored in a boolean
	if(eKey == "Control") eKey = "";
	if(eKey == "Shift") eKey = "";
	if(eKey == "Alt") eKey = "";
	if(eKey != void 0) if(map.key.toUpperCase() != eKey.toUpperCase()) return false;
	return true;
}

// check if any specific group of keys are down
function checkKeyPatterns(combination) {
	// if combination arg is an array of combinations
	if(typeof combination == "object") {
		var res = false;
		for(var i = 0; i < combination.length; i++) {
			res = res || checkKeyPatterns(e, combination[i]);
		}
		return res;
	}
	combination = combination.split("+");
}

function cullRanges(map, width, height) {
	var completelyFilled = true;
	for(var i = 0; i < map.length; i++) {
		if(!map[i]) {
			completelyFilled = false;
			break;
		}
	}
	if(completelyFilled) return [];
	var ranges = [];
	var iterNum = 0;
	var lastStartX = 0;
	var lastStartY = 0;
	while(true) {
		var startX = lastStartX;
		var startY = lastStartY;
		var startFound = false;
		var boundX = width - 1;
		var boundY = height - 1;
		var wLen = 0;
		var hLen = 1;
		for(var i = startY * width + startX; i < width * height; i++) {
			if(!map[i]) {
				startX = i % width;
				startY = Math.floor(i / width);
				startFound = true;
				break;
			}
		}
		if(!startFound) break;
		for(var i = startX; i <= boundX; i++) {
			if(map[startY * width + i]) break;
			wLen++;
		}
		// first row is skipped
		for(var y = startY + 1; y <= boundY; y++) {
			var invRow = false;
			for(var i = startX; i <= startX + wLen - 1; i++) {
				if(map[y * width + i]) {
					invRow = true;
					break;
				}
			}
			if(invRow) {
				break;
			} else {
				hLen++;
			}
		}
		var endX = startX + wLen - 1;
		var endY = startY + hLen - 1;
		for(var y = startY; y <= endY; y++) {
			for(var x = startX; x <= endX; x++) {
				map[y * width + x] = 1;
			}
		}
		lastStartX = startX;
		lastStartY = startY;
		ranges.push([startX, startY, endX, endY]);
		iterNum++;
		if(iterNum > width * height) break;
	}
	var totalArea = 0;
	for(var i = 0; i < ranges.length; i++) {
		var range = ranges[i];
		var width = Math.abs(range[2] - range[0]) + 1;
		var height = Math.abs(range[3] - range[1]) + 1;
		if(width * height > 50 * 50) {
			if(width > 50 && height > 50) {
				range[2] -= width - 50; // reduce width
				range[3] -= height - 50; // reduce height
				width = 50;
				height = 50;
			} else if(width > 50) {
				range[2] -= width - 50;
				width = 50;
			} else if(height > 50) {
				range[3] -= height - 50;
				height = 50;
			}
		}
		totalArea += width * height;
		if(totalArea > 5000) {
			ranges = ranges.slice(0, i);
			break;
		}
	}
	if(ranges.length > 50) ranges = ranges.slice(0, 50);
	return ranges;
}

var fetchInterval;
var timesConnected = 0;
function createSocket() {
	socket = new ReconnectingWebSocket(ws_path);
	w.socket = socket;
	timesConnected++;

	socket.onmessage = function(msg) {
		var data = JSON.parse(msg.data);
		var kind = data.kind;
		if(ws_functions[kind]) {
			ws_functions[kind](data);
		}
	}

	socket.onopen = function(msg) {
		console.log("Connected socket");
		for(var tile in tiles) {
			if(tiles[tile] == null) {
				delete tiles[tile];
				tileCount--;
			}
		}
		getAndFetchTiles();
		clearInterval(fetchInterval);
		fetchInterval = setInterval(function() {
			getAndFetchTiles();
		}, checkTileFetchInterval)
		if(timesConnected == 1) {
			if(Permissions.can_chat(state.userModel, state.worldModel)) {
				network.chathistory();
			}
			timesConnected++;
		}
		if(w.receivingBroadcasts) {
			w.broadcastReceive(true);
		}
	}

	socket.onclose = function() {
		console.log("Socket has closed. Reconnecting...");
	}

	socket.onerror = function(err) {
		console.log("Socket error:", err);
	}
}

// fetches only unloaded tiles
function getAndFetchTiles() {
	var data = getVisibleTiles(fetchClientMargin);
	if(!data.length) return;
	
	var startX = data[0][0];
	var startY = data[0][1];

	// fill the map
	var map = [];
	for(var i = 0; i < data.length; i++) {
		var cell = data[i];
		var tileY = cell[1];
		var tileX = cell[0];
		var coord = tileY + "," + tileX;
		if(coord in tiles) {
			map.push(1);
		} else {
			map.push(0);
		}
	}
	var width = getWidth(fetchClientMargin);
	var height = Math.floor(map.length / width);
	var ranges = cullRanges(map, width, height);

	var toFetch = [];
	for(var i = 0; i < ranges.length; i++) {
		var range = ranges[i];
		var bounds = {
			minX: range[0] + startX + tileFetchOffsetX,
			minY: range[1] + startY + tileFetchOffsetY,
			maxX: range[2] + startX + tileFetchOffsetX,
			maxY: range[3] + startY + tileFetchOffsetY
		};
		toFetch.push(bounds);
		bounds.minX = clipIntMax(bounds.minX);
		bounds.minY = clipIntMax(bounds.minY);
		bounds.maxX = clipIntMax(bounds.maxX);
		bounds.maxY = clipIntMax(bounds.maxY);
		for(var y = bounds.minY; y <= bounds.maxY; y++) {
			for(var x = bounds.minX; x <= bounds.maxX; x++) {
				Tile.set(x, y, null);
			}
		}
	}
	if(toFetch.length > 0) {
		network.fetch(toFetch);
	}
}

// clears all tiles outside the viewport (to free up memory)
function clearTiles(all) {
	var coordinates;
	var visible = {};
	if(!all) {
		coordinates = getVisibleTiles();
		// reference to tile coordinates (EG: "5,6")
		visible = {};
		for(var i = 0; i < coordinates.length; i++) {
			visible[coordinates[i][1] + "," + coordinates[i][0]] = 1;
		}
	}
	for(var i in tiles) {
		if(!(i in visible) || all) {
			var pos = getPos(i);
			Tile.delete(pos[1], pos[0]);
		}
	}
}

function getPos(ref) {
	ref = ref.split(",");
	return [parseInt(ref[0]), parseInt(ref[1])];
}

var highlightFlash = {};
var highlightCount = 0;

function highlight(positions) {
	for(var i = 0; i < positions.length; i++) {
		var tileX = positions[i][0];
		var tileY = positions[i][1];
		var charX = positions[i][2];
		var charY = positions[i][3];
		if(highlightCount > highlightLimit) return;
		if(!highlightFlash[tileY + "," + tileX]) {
			highlightFlash[tileY + "," + tileX] = {};
		}
		if(!highlightFlash[tileY + "," + tileX][charY]) {
			highlightFlash[tileY + "," + tileX][charY] = {};
		}
		if(!highlightFlash[tileY + "," + tileX][charY][charX]) {
			highlightFlash[tileY + "," + tileX][charY][charX] = [getDate(), 128];
			highlightCount++;
		}
	}
}

var flashAnimateInterval = setInterval(function() {
	if(!highlightCount) return;
	var tileGroup = {}; // tiles to re-render after highlight
	for(var tile in highlightFlash) {
		for(var charY in highlightFlash[tile]) {
			for(var charX in highlightFlash[tile][charY]) {
				var data = highlightFlash[tile][charY][charX];
				var time = data[0];
				// after 500 milliseconds
				if(getDate() - time >= 500) {
					delete highlightFlash[tile][charY][charX];
					highlightCount--;
				} else {
					// increase color brightness
					highlightFlash[tile][charY][charX][1] += 2;
					if(highlightFlash[tile][charY][charX][1] >= 255) {
						highlightFlash[tile][charY][charX][1] = 255;
					}
				}
				// mark tile to re-render
				tileGroup[tile] = 1;
			}
		}
	}
	// re-render tiles
	for(var i in tileGroup) {
		var pos = getPos(i);
		w.setTileRender(pos[1], pos[0]);
	}
}, 1000 / 60);

function blankTile() {
	var newTile = {
		content: new Array(tileArea).fill(" "),
		properties: {
			cell_props: {},
			writability: null,
			color: null
		}
	}
	newTile.properties.color = new Array(tileArea).fill(0);
	return newTile;
}

// format:
/*
	{
		"tileY,tileX": {
			charY: {
				charX: colorCode,
				etc...
			},
			etc...
		},
		etc...
	}
*/
var coloredChars = {};

function colorChar(tileX, tileY, charX, charY, color, is_link_hovers) {
	var pos = tileY + "," + tileX + "," + charY + "," + charX;
	if(linkAuto.selected[pos] && is_link_hovers) return;
	if(!coloredChars[tileY + "," + tileX]) {
		coloredChars[tileY + "," + tileX] = {};
	}
	if(!coloredChars[tileY + "," + tileX][charY]) {
		coloredChars[tileY + "," + tileX][charY] = {};
	}
	coloredChars[tileY + "," + tileX][charY][charX] = color;
}

function uncolorChar(tileX, tileY, charX, charY) {
	var pos = tileY + "," + tileX + "," + charY + "," + charX;
	if(coloredChars[tileY + "," + tileX] && !linkAuto.selected[pos] && !tileProtectAuto.selected[pos]) {
		if(coloredChars[tileY + "," + tileX][charY]) {
			if(coloredChars[tileY + "," + tileX][charY][charX]) {
				delete coloredChars[tileY + "," + tileX][charY][charX];
			}
			if(Object.keys(coloredChars[tileY + "," + tileX][charY]).length == 0) {
				delete coloredChars[tileY + "," + tileX][charY];
			}
		}
		if(Object.keys(coloredChars[tileY + "," + tileX]).length == 0) {
			delete coloredChars[tileY + "," + tileX];
		}
	}
}

function generateBackgroundPixels(tileX, tileY, image, returnCanvas, isBackground, writability) {
	var backTileWidth = tileWidth;
	var backTileHeight = tileHeight;
	if(returnCanvas) {
		backTileWidth = dTileW;
		backTileHeight = dTileH;
	}
	if(backTileWidth <= 0 || backTileHeight <= 0) {
		return false;
	}
	var imgData = owotCtx.createImageData(backTileWidth, backTileHeight);
	if(!image) { // image doesn't exist
		return false;
	}
	var invert = false;
	if(image == images.unloaded && w.nightMode == 1) {
		invert = true;
	}
	var alphaMult = isBackground ? w.backgroundInfo.alpha : -1;
	var repeatMode = isBackground ? w.backgroundInfo.rmod : 0;
	var fromData = image[0]; // pixel data (RGBA)
	var img_width = image[1];
	var img_height = image[2];
	// where the tile starts in the client (offset relative to 0,0)
	var startX = tileX * backTileWidth;
	var startY = tileY * backTileHeight;
	if(isBackground) {
		startX += w.backgroundInfo.x;
		startY += w.backgroundInfo.y;
		if(w.backgroundInfo.w) {
			img_width = w.backgroundInfo.w;
		}
		if(w.backgroundInfo.h) {
			img_height = w.backgroundInfo.h;
		}
	}
	if(repeatMode == 1) {
		startX += Math.floor(img_width / 2);
		startY += Math.floor(img_height / 2);
	}
	var brightnessOffset = 0;
	if(writability == 1) {
		brightnessOffset = -30;
	} else if(writability == 2) {
		brightnessOffset = -60;
	}
	// start drawing the pixels
	for(var y = 0; y < backTileHeight; y++) {
		for(var x = 0; x < backTileWidth; x++) {
			var posX = startX + x;
			var posY = startY + y;
			if((posX < 0 || posY < 0 || posX >= img_width || posY >= img_height) && (repeatMode == 1 || repeatMode == 2)) continue;
			posX = posX - Math.floor(posX / img_width) * img_width;
			posY = posY - Math.floor(posY / img_height) * img_height;
			var index = (posY * img_width + posX) * 4;
			var destIndex = (y * backTileWidth + x) * 4;
			var R = fromData[index + 0];
			var G = fromData[index + 1];
			var B = fromData[index + 2];
			var A = fromData[index + 3];
			if(alphaMult == -1) {
				A = 255;
			} else {
				A *= alphaMult;
			}
			if(invert) {
				R = 255 - R;
				G = 255 - G;
				B = 255 - B;
			}
			R += brightnessOffset;
			G += brightnessOffset;
			B += brightnessOffset;
			imgData.data[destIndex + 0] = R;
			imgData.data[destIndex + 1] = G;
			imgData.data[destIndex + 2] = B;
			imgData.data[destIndex + 3] = A;
		}
	}
	if(returnCanvas) { // return canvas version of background
		backgroundImageCtx.putImageData(imgData, 0, 0);
		return backgroundImageCanvasRenderer;
	}
	return imgData;
}

function isTileVisible(tileX, tileY) {
	var tilePosX = tileX * tileW + positionX + Math.trunc(owotWidth / 2);
	var tilePosY = tileY * tileH + positionY + Math.trunc(owotHeight / 2);
	// too far left/top. check if the right/bottom edge of tile is also too far left/top
	if((tilePosX < 0 || tilePosY < 0) && (tilePosX + tileW - 1 < 0 || tilePosY + tileH - 1 < 0)) {
		return false;
	}
	// too far right/bottom
	if(tilePosX >= owotWidth || tilePosY >= owotHeight) {
		return false;
	}
	return true
}

function isTileLoaded(tileX, tileY) {
	return !!Tile.get(tileX, tileY);
}

var brOrder = [1, 8, 2, 16, 4, 32, 64, 128];
var base64table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/*
	Writability format (tiles and chars):
		null: Writability of parent tile
		0: public
		1: members
		2: owners
*/
function decodeCharProt(str) {
	var res = new Array(tileArea).fill(0);
	var encoding = str.charAt(0);
	str = str.substr(1);
	if(encoding == "@") {
		for(var i = 0; i < str.length; i++) {
			var code = base64table.indexOf(str.charAt(i));
			var char1 = Math.trunc(code / (4*4) % 4);
			var char2 = Math.trunc(code / (4) % 4);
			var char3 = Math.trunc(code / (1) % 4);
			res[i*3 + 0] = char1;
			if(i*3 + 1 > tileArea - 1) break;
			res[i*3 + 1] = char2;
			if(i*3 + 2 > tileArea - 1) break;
			res[i*3 + 2] = char3;
		}
	} else if(encoding == "#") {
		var temp = str.split(",");
		for(var i = 0; i < temp.length; i++) {
			res[i] = parseInt(temp[i], 10);
		}
	} else if(encoding == "x") {
		for(var i = 0; i < str.length / 2; i++) {
			var code = parseInt(str.charAt(i * 2) + str.charAt(i * 2 + 1), 16);
			res[i] = code;
		}
	}
	// convert from base64-format to writability-format
	for(var c = 0; c < res.length; c++) {
		switch(res[c]) {
			case 0: res[c] = null; continue;
			case 1: res[c] = 0; continue;
			case 2: res[c] = 1; continue;
			case 3: res[c] = 2; continue;
		}
	}
	return res;
}
function encodeCharProt(array, encoding) {
	/*
		encodings:
			0: base64 - only 4 possible values
			1: number values
			2: hex values, values 0-255 only
	*/
	var arrayCom = array.slice(0);
	// convert array from writability-format to base64-format
	for(var c = 0; c < arrayCom.length; c++) {
		switch(arrayCom[c]) {
			case null: arrayCom[c] = 0; continue;
			case 0: arrayCom[c] = 1; continue;
			case 1: arrayCom[c] = 2; continue;
			case 2: arrayCom[c] = 3; continue;
		}
	}
	var str = "";
	if(!encoding) {
		str = "@";
		var bytes = Math.ceil(tileArea / 3);
		for(var i = 0; i < bytes; i++) {
			var idx = i * 3;
			var char1 = ((4*4)*arrayCom[idx + 0]);
			var char2 = ((4)*arrayCom[idx + 1]);
			var char3 = ((1)*arrayCom[idx + 2]);
			if(idx + 1 > tileArea - 1) char2 = 0;
			if(idx + 2 > tileArea - 1) char3 = 0;
			var code = char1 + char2 + char3;
			str += base64table.charAt(code);
		}
	} else if(encoding == 1) {
		str = "#" + arrayCom.join(",");
	} else if(encoding == 2) {
		str = "x";
		for(var i = 0; i < tileArea; i++) {
			var chr = arrayCom[i];
			str += chr.toString(16).padStart(2, 0).toUpperCase();
		}
	}
	return str;
}

function renderChar(textRender, x, y, str, content, colors, writability, props) {
	// adjust baseline
	var textYOffset = cellH - (5 * zoom);

	var fontX = x * cellW;
	var fontY = y * cellH;

	// fill background if defined
	if(coloredChars[str]) {
		if(coloredChars[str][y]) {
			if(coloredChars[str][y][x]) {
				var color = coloredChars[str][y][x];
				textRender.fillStyle = color;
				textRender.fillRect(fontX, fontY, cellW, cellH);
			}
		}
	}

	var char = content[y * tileC + x];
	var color = colors[y * tileC + x];
	// initialize link color to default text color in case there's no link to color
	var linkColor = styles.text;
	if(textColorOverride) {
		if(writability == 0 && textColorOverride & 4) linkColor = styles.public_text;
		if(writability == 1 && textColorOverride & 2) linkColor = styles.member_text;
		if(writability == 2 && textColorOverride & 1) linkColor = styles.owner_text;
	}
	

	var isLink = false;

	// check if this char is a link
	if(linksRendered) {
		if(props[y]) {
			if(props[y][x]) {
				var link = props[y][x].link;
				if(link) {
					isLink = true;
					if(link.type == "url") {
						linkColor = defaultURLLinkColor;
					} else if(link.type == "coord") {
						linkColor = defaultCoordLinkColor;
					}
				}
			}
		}
	}
	if(!char) char = " ";
	var cCode = char.charCodeAt(0);

	// if text has no color, use default text color. otherwise, colorize it
	if(color == 0 || !colorsEnabled || (isLink && !colorizeLinks)) {
		textRender.fillStyle = linkColor;
	} else {
		textRender.fillStyle = "rgb(" + (color >> 16 & 255) + "," + (color >> 8 & 255) + "," + (color & 255) + ")";
	}

	// x padding of text if the char width is > 10
	var XPadding = cellWidthPad * zoom;

	// underline link
	if(isLink) {
		textRender.fillRect(fontX, fontY + textYOffset + zoom, cellW, zoom);
	}

	// don't render whitespaces
	if(cCode == 0x0020 || cCode == 0x00A0) return;

	if(brBlockFill && cCode >= 0x2800 && cCode <= 0x28FF) { // render braille chars as rectangles
		var dimX = cellW / 2;
		var dimY = cellH / 4;
		for(var b = 0; b < 8; b++) {
			if((cCode & brOrder[b]) == 0) continue;
			textRender.fillRect(fontX + (b % 2) * dimX, fontY + ((b / 2) | 0) * dimY, dimX, dimY);
		}
	} else if(ansiBlockFill && cCode == 0x2580) { // ▀ top half block
		textRender.fillRect(fontX, fontY, cellW, Math.trunc(cellH / 2));
	} else if(ansiBlockFill && cCode == 0x2584) { // ▄ bottom half block
		textRender.fillRect(fontX, fontY + Math.trunc(cellH / 2), cellW, Math.trunc(cellH / 2));
	} else if(ansiBlockFill && cCode == 0x2588) { // █ full block
		textRender.fillRect(fontX, fontY, cellW, cellH);
	} else if(ansiBlockFill && cCode == 0x258C) { // ▌ left half block
		textRender.fillRect(fontX, fontY, Math.trunc(cellW / 2), cellH);
	} else if(ansiBlockFill && cCode == 0x2590) { // ▐ right half block
		textRender.fillRect(fontX + Math.trunc(cellW / 2), fontY, Math.trunc(cellW / 2), cellH);
	} else { // character rendering
		if(char.length > 1 ) textRender.font = specialCharFont;
		textRender.fillText(char, Math.round(fontX + XPadding), Math.round(fontY + textYOffset));
		if(char.length > 1) textRender.font = font;
	}
}

function drawGrid(renderCtx, gridColor) {
	var offsetX = 0;
	var offsetY = 0;
	if(subgridEnabled) {
		renderCtx.strokeStyle = "#B9B9B9";
		var dashSize = Math.ceil(zoom);
		if(dashSize < 1) dashSize = 1;
		renderCtx.setLineDash([dashSize]);
		renderCtx.lineWidth = dashSize;
		for(var x = 1; x < tileC; x++) {
			for(var y = 1; y < tileR; y++) {
				renderCtx.beginPath();
				renderCtx.moveTo(0, y * cellH + 0.5);
				renderCtx.lineTo(tileW, y * cellH + 0.5);
				renderCtx.stroke();
			}
			renderCtx.beginPath();
			renderCtx.moveTo(x * cellW + 0.5, 0);
			renderCtx.lineTo(x * cellW + 0.5, tileH);
			renderCtx.stroke();
		}
	}
	renderCtx.fillStyle = gridColor;
	renderCtx.fillRect(offsetX, offsetY + tileH - zoom, tileW, zoom);
	renderCtx.fillRect(offsetX + tileW - zoom, offsetY, zoom, tileH);
}

function drawObstructedCursor(renderCtx, content, curX, curY, offsetX, offsetY) {
	var idx = curY * tileC + curX;
	// if the char is a full block, force the cursor over it.
	if(content) {
		if(content[idx] == "\u2588") {
			renderCtx.fillStyle = styles.cursor;
			renderCtx.fillRect(offsetX + curX * cellW, offsetY + curY * cellH, cellW, cellH);
		}
	}
}

function renderTileBackground(renderCtx, offsetX, offsetY, tile, tileX, tileY, cursorVisibility) {
	var computed_writability = tile.properties.writability;
	if(computed_writability == null) computed_writability = state.worldModel.writability;
	
	if(!tile.backgroundColor) {
		if(computed_writability == 0) renderCtx.fillStyle = styles.public;
		if(computed_writability == 1) renderCtx.fillStyle = styles.member;
		if(computed_writability == 2) renderCtx.fillStyle = styles.owner;
	} else {
		renderCtx.fillStyle = tile.backgroundColor;
	}

	// fill tile background color
	renderCtx.fillRect(offsetX, offsetY, tileWidth, tileHeight);

	// render char protections
	if(tile.properties.char && !tile.backgroundColor) {
		for(var p = 0; p < tileArea; p++) {
			var code = tile.properties.char[p]; // writability
			var cX = p % tileC;
			var cY = Math.floor(p / tileC);
			if(code != null) {
				if(code == 0) renderCtx.fillStyle = styles.public;
				if(code == 1) renderCtx.fillStyle = styles.member;
				if(code == 2) renderCtx.fillStyle = styles.owner;
				renderCtx.fillRect(offsetX + cX * cellW, offsetY + cY * cellH, cellW, cellH);
			}
		}
	}

	// render cursor
	if(cursorVisibility) {
		var charX = cursorCoords[2];
		var charY = cursorCoords[3];
		renderCtx.fillStyle = styles.cursor;
		renderCtx.fillRect(offsetX + charX * cellW, offsetY + charY * cellH, cellW, cellH);
	}

	var highlight = highlightFlash[tileY + "," + tileX];
	if(highlight) { // highlighted edits
		for(var y = 0; y < tileR; y++) {
			for(var x = 0; x < tileC; x++) {
				if(highlight[y]) {
					if(highlight[y][x] !== void 0) {
						renderCtx.fillStyle = "rgb(255,255," + highlight[y][x][1] + ")";
						renderCtx.fillRect(offsetX + x * cellW, offsetY + y * cellH, cellW, cellH);
					}
				}
			}
		}
	}
}

function renderTile(tileX, tileY, redraw) {
	if(!isTileLoaded(tileX, tileY)) return;
	var str = tileY + "," + tileX;
	var tileScreenPos = getTileScreenPosition(tileX, tileY);
	var offsetX = Math.floor(tileScreenPos[0]);
	var offsetY = Math.floor(tileScreenPos[1]);

	var tile = tiles[str];
	if(redraw) {
		tile.redraw = true;
	}
	if(!isTileVisible(tileX, tileY)) return;

	if(tile == null) {
		tile = Tile.set(tileX, tileY, blankTile());
	}

	var writability = tile.properties.writability;
	var cursorVisibility = cursorRenderingEnabled && cursorCoords && cursorCoords[0] == tileX && cursorCoords[1] == tileY;

	var gridColor = "#000000";
	if(transparentBackground) {
		renderTileBackground(owotCtx, offsetX, offsetY, tile, tileX, tileY, cursorVisibility);
		gridColor = "#" + ("00000" + (16777215 - parseInt(owotCtx.fillStyle.substr(1), 16)).toString(16)).padStart(6, 0);
	} else {
		var backgroundUpdated = false;
		if(highlightFlash[tileY + "," + tileX]) {
			backgroundUpdated = true;
		}
		var tcp = tile.tempCursorPos;
		if(!tcp && cursorVisibility) {
			backgroundUpdated = true;
		} else if(cursorCoords && tcp && (tcp[0] != cursorCoords[0] || tcp[1] != cursorCoords[1] || tcp[2] != cursorCoords[2] || tcp[3] != cursorCoords[3])) {
			backgroundUpdated = true;
		}
		tile.tempCursorPos = cursorCoords;
		if(backgroundUpdated) {
			tile.redraw = true;
		}
	}

	// render text data from cache
	var tilePool = loadTileFromPool(tileX, tileY, true);
	if(tilePool && !tile.redraw) {
		var pCanv = tilePool.pool.canv;
		var pX = tilePool.poolX;
		var pY = tilePool.poolY;
		owotCtx.drawImage(pCanv, pX, pY, tileWidth, tileHeight, offsetX, offsetY, tileWidth, tileHeight);
		if(w.events.tilerendered) w.emit("tileRendered", {
			tileX: tileX, tileY: tileY,
			startX: offsetX, startY: offsetY,
			endX: offsetX + tileWidth - 1, endY: offsetY + tileHeight - 1
		});
		if(unobstructCursor && cursorRenderingEnabled && cursorCoords && cursorCoords[0] == tileX && cursorCoords[1] == tileY) {
			drawObstructedCursor(owotCtx, tile.content, cursorCoords[2], cursorCoords[3], offsetX, offsetY);
		}
		return;
	}
	if(tile.redraw) {
		delete tile.redraw;
	}

	tilePool = loadTileFromPool(tileX, tileY);
	var poolCtx = tilePool.pool.ctx;
	var poolCanv = tilePool.pool.canv;
	var poolX = tilePool.poolX;
	var poolY = tilePool.poolY;

	if(transparentBackground) {
		textRenderCtx.clearRect(0, 0, tileWidth, tileHeight);
	} else {
		renderTileBackground(textRenderCtx, 0, 0, tile, tileX, tileY, cursorVisibility);
	}

	if(images.background && backgroundEnabled) {
		var background_data = generateBackgroundPixels(tileX, tileY, images.background, true, true, computed_writability);
		if(background_data) {
			textRenderCtx.drawImage(background_data, 0, 0, tileWidth, tileHeight);
		}
	}

	var content = tile.content;
	var colors = tile.properties.color;
	// color data doesn't exist, use empty array as placeholder
	if(!colors) colors = new Array(tileArea).fill(0);

	var props = tile.properties.cell_props;
	if(!props) props = {};

	if(priorityOverwriteChar && tile.properties.char) {
		for(var lev = 0; lev < 3; lev++) {
			for(var c = 0; c < tileArea; c++) {
				var code = tile.properties.char[c]; // writability
				if(code == null) code = tile.properties.writability;
				if(code == null) code = state.worldModel.writability;
				if(code != lev) continue;
				var cX = c % tileC;
				var cY = Math.floor(c / tileC);
				textRenderCtx.clearRect(cX * cellW, cY * cellH, cellW, cellH);
				renderChar(textRenderCtx, cX, cY, str, content, colors, code, props);
			}
		}
	} else {
		for(var y = 0; y < tileR; y++) {
			for(var x = 0; x < tileC; x++) {
				var protValue = writability;
				if(tile.properties.char) {
					protValue = tile.properties.char[y * tileC + x];
				}
				if(protValue == null) protValue = tile.properties.writability;
				if(protValue == null) protValue = state.worldModel.writability;
				renderChar(textRenderCtx, x, y, str, content, colors, protValue, props);
			}
		}
	}

	if(gridEnabled) {
		drawGrid(textRenderCtx, gridColor);
	}

	// add image to tile pool
	poolCtx.clearRect(poolX, poolY, tileWidth, tileHeight);
	poolCtx.drawImage(textRenderCanvas, poolX, poolY);

	// add image to main canvas
	owotCtx.drawImage(textRenderCanvas, offsetX, offsetY);

	if(unobstructCursor && cursorRenderingEnabled && cursorCoords && cursorCoords[0] == tileX && cursorCoords[1] == tileY) {
		drawObstructedCursor(owotCtx, tile.content, cursorCoords[2], cursorCoords[3], offsetX, offsetY);
	}

	if(w.events.tilerendered) w.emit("tileRendered", {
		tileX: tileX, tileY: tileY,
		startX: offsetX, startY: offsetY,
		endX: offsetX + tileWidth - 1, endY: offsetY + tileHeight - 1
	});
}

function renderTiles(redraw) {
	w.emit("beforeTilesRendered");
	updateCoordDisplay();
	if(unloadedPatternPanning) {
		elm.owot.style.backgroundPosition = positionX + "px " + positionY + "px";
	}
	owotCtx.clearRect(0, 0, owotWidth, owotHeight);
	if(redraw) w.setRedraw();
	// render all visible tiles
	var pointA = getTileCoordsFromMouseCoords(0, 0);
	var pointB = getTileCoordsFromMouseCoords(owotWidth - 1, owotHeight - 1);
	for(var y = pointA[1]; y <= pointB[1]; y++) {
		for(var x = pointA[0]; x <= pointB[0]; x++) {
			renderTile(x, y, redraw);
		}
	}
	w.emit("tilesRendered");
}

function renderTilesSelective() {
	var pointA = getTileCoordsFromMouseCoords(0, 0);
	var pointB = getTileCoordsFromMouseCoords(owotWidth - 1, owotHeight - 1);
	for(var y = pointA[1]; y <= pointB[1]; y++) {
		for(var x = pointA[0]; x <= pointB[0]; x++) {
			var tile = Tile.get(x, y);
			if(!tile) continue;
			if(tile.rerender) {
				delete tile.rerender;
				renderTile(x, y);
				continue;
			}
			if(!tile.redraw) continue;
			renderTile(x, y);
		}
	}
}

function renderLoop() {
	if(w.hasUpdated) {
		renderTiles();
	} else if(w.hasSelectiveUpdated) {
		renderTilesSelective();
	}
	w.hasUpdated = false;
	w.hasSelectiveUpdated = false;
	w.emit("frame");
	requestAnimationFrame(renderLoop);
}

function protectPrecisionOption(option) {
	protectPrecision = option;
	removeTileProtectHighlight();
	var tileChoiceColor = "";
	var charChoiceColor = "";
	if(option == 0) { // tile
		tileChoiceColor = "#FF6600";
	} else if(option == 1) { // char
		charChoiceColor = "#FF6600";
	}
	elm.tile_choice.style.backgroundColor = tileChoiceColor;
	elm.char_choice.style.backgroundColor = charChoiceColor;
}
protectPrecisionOption(protectPrecision);

var menu;
function buildMenu() {
	menu = new Menu(elm.menu_elm, elm.nav_elm);
	w.menu = menu;
	var homeLink = document.createElement("a");
	var homeLinkIcon = document.createElement("img");
	var subgridEntry;
	homeLink.href = "/home";
	homeLink.target = "_blank";
	homeLink.innerHTML = "More...&nbsp";
	homeLinkIcon.src = "/static/external_link.png";
	homeLink.appendChild(homeLinkIcon);
	menu.addEntry(homeLink);
	menu.addCheckboxOption(" Show coordinates", function() {
		return elm.coords.style.display = "";
	}, function() {
		return elm.coords.style.display = "none";
	});
	if(Permissions.can_color_text(state.userModel, state.worldModel)) {
		menu.addOption("Change color", w.color);
	}
	if (Permissions.can_go_to_coord(state.userModel, state.worldModel)) {
		menu.addOption("Go to coordinates", w.goToCoord);
	}
	if (Permissions.can_coordlink(state.userModel, state.worldModel)) {
		menu.addOption("Create link to coordinates", w.coordLink);
	}
	if (Permissions.can_urllink(state.userModel, state.worldModel)) {
		menu.addOption("Create link to URL", w.urlLink);
	}
	if (Permissions.can_admin(state.userModel, state.worldModel)) {
		menu.addOption("Make an area owner-only", function() {
			return w.doProtect("owner-only");
		});
	}
	if (Permissions.can_protect_tiles(state.userModel, state.worldModel)) {
		menu.addOption("Make an area member-only", function() {
			return w.doProtect("member-only");
		});
		menu.addOption("Make an area public", function() {
			return w.doProtect("public");
		});
		menu.addOption("Default area protection", w.doUnprotect);
	}
	menu.addCheckboxOption("Toggle grid", function() {
		gridEnabled = true;
		w.render(true);
		menu.showEntry(subgridEntry);
	}, function() {
		gridEnabled = false;
		w.render(true);
		menu.hideEntry(subgridEntry);
	});
	subgridEntry = menu.addCheckboxOption("Subgrid", function() {
		subgridEnabled = true;
		w.render(true);
	}, function() {
		subgridEnabled = false;
		w.render(true);
	});
	menu.hideEntry(subgridEntry);
	menu.addCheckboxOption("Links enabled", function() {
		linksEnabled = true;
	}, function() {
		linksEnabled = false;
	}, true);
	menu.addCheckboxOption("Colors enabled", function() {
		w.enableColors();
	}, function() {
		w.disableColors();
	}, true);
	if("background" in images) {
		menu.addCheckboxOption("Background", function() {
			backgroundEnabled = true;
			w.render(true);
		}, function() {
			backgroundEnabled = false;
			w.render(true);
		}, true);
	}
	var zoomBar = document.createElement("input");
	zoomBar.onchange = function() {
		var val = this.value;
		val /= 100;
		if(val < 0 || val > 1) val = 0.5;
		if(val <= 0.5) {
			val = -1 / Math.log2(val);
		} else {
			val = -Math.log2(1 - val);
		}
		changeZoom(val * 100);
	}
	zoomBar.ondblclick = function() {
		changeZoom(100);
	}
	zoomBar.title = "Zoom";
	zoomBar.type = "range";
	zoomBar.value = 50;
	zoomBar.min = 1;
	zoomBar.max = 100;
	zoomBar.id = "zoombar";
	menu.addEntry(zoomBar);
}

function orderRangeABCoords(coordA, coordB) {
	var tmp;
	if(coordA[0] > coordB[0]) {
		// swap X coords
		tmp = coordA[0];
		coordA[0] = coordB[0];
		coordB[0] = tmp;
		tmp = coordA[2];
		coordA[2] = coordB[2];
		coordB[2] = tmp;
	} else if(coordA[0] == coordB[0] && coordA[2] > coordB[2]) {
		// swap X char coords
		tmp = coordA[2];
		coordA[2] = coordB[2];
		coordB[2] = tmp;
	}
	if(coordA[1] > coordB[1]) {
		// swap Y coords
		tmp = coordA[1];
		coordA[1] = coordB[1];
		coordB[1] = tmp;
		tmp = coordA[3];
		coordA[3] = coordB[3];
		coordB[3] = tmp;
	} else if(coordA[1] == coordB[1] && coordA[3] > coordB[3]) {
		// swap Y char coords
		tmp = coordA[3];
		coordA[3] = coordB[3];
		coordB[3] = tmp;
	}
}

var regionSelections = [];
function regionSelectionsActive() {
	for(var i = 0; i < regionSelections.length; i++) {
		if(regionSelections[i].isSelecting) return true;
	}
	return false;
}
function RegionSelection() {
	this.selection = null;
	this.regionSelected = false;
	this.regionCoordA = null;
	this.regionCoordB = null;
	this.isSelecting = false;
	this.charColor = "#9999e6";
	this.color = "rgba(0, 0, 255, 0.1)";
	this.tiled = false;
	this.lastSelectionHover = null; // [tileX, tileY, charX, charY]
	this.init = function() {
		var div = document.createElement("div");
		div.className = "region_selection";
		div.style.display = "none";
		div.style.backgroundColor = this.color;
		document.body.appendChild(div);
		this.selection = div;
	}
	this.setSelection = function(start, end) {
		var coordA = start.slice(0);
		var coordB = end.slice(0);
		orderRangeABCoords(coordA, coordB);
		var tileX1 = coordA[0];
		var tileY1 = coordA[1];
		var charX1 = coordA[2];
		var charY1 = coordA[3];
		var tileX2 = coordB[0];
		var tileY2 = coordB[1];
		var charX2 = coordB[2];
		var charY2 = coordB[3];
		if(this.tiled) {
			charX1 = 0;
			charY1 = 0;
			charX2 = tileC - 1;
			charY2 = tileR - 1;
		}
		var pxCoordA = tileAndCharsToWindowCoords(tileX1, tileY1, charX1, charY1);
		var pxCoordB = tileAndCharsToWindowCoords(tileX2, tileY2, charX2, charY2);
		var regWidth = pxCoordB[0] - pxCoordA[0] + Math.trunc(cellW / zoomRatio) - 2;
		var regHeight = pxCoordB[1] - pxCoordA[1] + Math.trunc(cellH / zoomRatio) - 2;
		var sel = this.selection;
		sel.style.width = regWidth + "px";
		sel.style.height = regHeight + "px";
		sel.style.top = pxCoordA[1] + "px";
		sel.style.left = pxCoordA[0] + "px";
	}
	this.show = function() {
		this.selection.style.display = "";
	}
	this.hide = function() {
		this.selection.style.display = "none";
	}
	this.deselect = function() {
		this.regionSelected = false;
		this.regionCoordA = null;
		this.regionCoordB = null;
		this.hide();
	}
	this.stopSelectionUI = function() {
		if(!this.lastSelectionHover) return;
		if(!this.isSelecting) return;
		this.isSelecting = false;
		elm.owot.style.cursor = defaultCursor;
		var tileX = this.lastSelectionHover[0];
		var tileY = this.lastSelectionHover[1];
		var charX = this.lastSelectionHover[2];
		var charY = this.lastSelectionHover[3];
		// remove highlight
		if(this.tiled) {
			if(Tile.get(tileX, tileY)) {
				Tile.get(tileX, tileY).backgroundColor = "";
			}
		} else {
			uncolorChar(tileX, tileY, charX, charY);
		}
		w.setTileRedraw(tileX, tileY);
		this.deselect();
	}
	var onselectionEvents = [];
	this.onselection = function(func) {
		onselectionEvents.push(func);
	}
	this.handleSelection = function() {
		for(var i = 0; i < onselectionEvents.length; i++) {
			var func = onselectionEvents[i];
			this.regionSelected = true;
			this.setSelection(this.regionCoordA, this.regionCoordB);
			var coordA = this.regionCoordA.slice(0);
			var coordB = this.regionCoordB.slice(0);
			orderRangeABCoords(coordA, coordB);
			var regWidth = (coordB[0] - coordA[0]) * tileC + coordB[2] - coordA[2] + 1;
			var regHeight = (coordB[1] - coordA[1]) * tileR + coordB[3] - coordA[3] + 1;
			func(coordA, coordB, regWidth, regHeight);
		}
	}
	this.startSelection = function() {
		this.isSelecting = true;
		elm.owot.style.cursor = "cell";
	}
	regionSelections.push(this);
	this.destroy = function() {
		for(var i = 0; i < regionSelections.length; i++) {
			if(regionSelections[i] == this) {
				regionSelections.splice(i, 1);
				i--;
			}
		}
	}
	return this;
}

w.on("tilesRendered", function() {
	for(var i = 0; i < regionSelections.length; i++) {
		var reg = regionSelections[i];
		if(reg.regionCoordA && reg.regionCoordB) reg.setSelection(reg.regionCoordA, reg.regionCoordB);
	}
});

var networkHTTP = {
	fetch: function(x1, y1, x2, y2, opts, callback) {
		if(typeof opts == "function") {
			callback = opts;
		} else if(!opts) {
			opts = {};
		}
		var temp;
		if(x1 > x2) {
			temp = x1;
			x1 = x2;
			x2 = temp;
		}
		if(y1 > y2) {
			temp = y1;
			y1 = y2;
			y2 = temp;
		}
		var data = {
			fetch: 1,
			min_tileX: x1,
			min_tileY: y1,
			max_tileX: x2,
			max_tileY: y2
		};
		if(opts.utf16) data.utf16 = true;
		if(opts.array) data.array = true;
		if(opts.content_only) data.content_only = true;
		if(opts.concat) data.concat = true;
		ajaxRequest({
			type: "GET",
			url: window.location.pathname,
			data: data,
			done: function(data) {
				if(callback) callback(JSON.parse(data));
			},
			error: function() {
				if(callback) callback(null);
			}
		});
	},
	write: function(edits, opts, callback) {
		if(typeof opts == "function") {
			callback = opts;
		} else if(!opts) {
			opts = {};
		}
		var data = {
			edits: JSON.stringify(edits)
		};
		if(opts.public_only) data.public_only = true;
		if(opts.preserve_links) data.preserve_links = true;
		ajaxRequest({
			type: "POST",
			url: window.location.pathname,
			data: data,
			done: function(data) {
				if(callback) callback(JSON.parse(data));
			},
			error: function() {
				if(callback) callback(null);
			}
		});
	},
	urllink: function(tileX, tileY, charX, charY, url, callback) {
		ajaxRequest({
			type: "POST",
			url: "/ajax/urllink/",
			data: {
				world: state.worldModel.name,
				tileX: tileX,
				tileY: tileY,
				charX: charX,
				charY: charY,
				url: url
			},
			done: function(data) {
				if(callback) callback(data);
			},
			error: function() {
				if(callback) callback(null);
			}
		});
	},
	coordlink: function(tileX, tileY, charX, charY, link_tileX, link_tileY, callback) {
		ajaxRequest({
			type: "POST",
			url: "/ajax/coordlink/",
			data: {
				world: state.worldModel.name,
				tileX: tileX,
				tileY: tileY,
				charX: charX,
				charY: charY,
				link_tileX: link_tileX,
				link_tileY: link_tileY
			},
			done: function(data) {
				if(callback) callback(data);
			},
			error: function() {
				if(callback) callback(null);
			}
		});
	},
	protect: function(tileX, tileY, type, callback) {
		// type: unprotect, public, member-only, owner-only
		var data = {
			world: state.worldModel.name,
			tileX: tileX,
			tileY: tileY
		};
		var url = "/ajax/protect/";
		if(type == "unprotect") {
			url = "/ajax/unprotect/";
		} else {
			data.type = type;
		}
		ajaxRequest({
			type: "POST",
			url: url,
			data: data,
			done: function(data) {
				if(callback) callback(data);
			},
			error: function() {
				if(callback) callback(null);
			}
		});
	},
	protectchar: function(tileX, tileY, charX, charY, type, callback) {
		// type: unprotect, public, member-only, owner-only
		var data = {
			world: state.worldModel.name,
			tileX: tileX,
			tileY: tileY,
			charX: charX,
			charY: charY
		};
		var url = "/ajax/protect/char/";
		if(type == "unprotect") {
			url = "/ajax/unprotect/char/";
		} else {
			data.type = type;
		}
		ajaxRequest({
			type: "POST",
			url: url,
			data: data,
			done: function(data) {
				if(callback) callback(data);
			},
			error: function() {
				if(callback) callback(null);
			}
		});
	}
};

var network = {
	latestID: 0,
	http: networkHTTP,
	protect: function(position, type, callback) {
		// position: {tileX, tileY, [charX, charY]}
		// type: <unprotect, public, member-only, owner-only>
		var isPrecise = "charX" in position && "charY" in position;
		var data = {
			tileX: position.tileX,
			tileY: position.tileY,
			type: type == "unprotect" ? void 0 : type
		};
		if(isPrecise) {
			data.charX = position.charX;
			data.charY = position.charY;
			if(!("tileX" in position || "tileY" in position)) {
				data.tileX = Math.floor(data.charX / tileC);
				data.tileY = Math.floor(data.charY / tileR);
				data.charX = data.charX - Math.floor(data.charX / tileC) * tileC;
				data.charY = data.charY - Math.floor(data.charY / tileR) * tileR;
			}
			data.precise = true;
		}
		w.socket.send(JSON.stringify({
			kind: "protect",
			data: data,
			action: type == "unprotect" ? type : "protect"
		}));
	},
	link: function(position, type, args, callback) {
		// position: {tileX, tileY, charX, charY}
		// type: <url, coord>
		// args: {url} or {x, y}
		var data = {
			tileY: position.tileY,
			tileX: position.tileX,
			charY: position.charY,
			charX: position.charX
		};
		if(!("tileX" in position || "tileY" in position)) {
			data.tileX = Math.floor(data.charX / tileC);
			data.tileY = Math.floor(data.charY / tileR);
			data.charX = data.charX - Math.floor(data.charX / tileC) * tileC;
			data.charY = data.charY - Math.floor(data.charY / tileR) * tileR;
		}
		if(type == "url") {
			data.url = args.url;
		} else if(type == "coord") {
			data.link_tileX = args.x;
			data.link_tileY = args.y;
		}
		w.socket.send(JSON.stringify({
			kind: "link",
			data: data,
			type: type
		}));
	},
	cmd: function(data, include_username) {
		w.socket.send(JSON.stringify({
			kind: "cmd",
			data: data, // maximum length of 2048
			include_username: include_username
		}));
	},
	cmd_opt: function() {
		w.socket.send(JSON.stringify({
			kind: "cmd_opt"
		}));
	},
	write: function(edits, opts, callback) {
		if(!opts) opts = {};
		var writeReq = {
			kind: "write",
			edits: edits,
			public_only: opts.public_only,
			preserve_links: opts.preserve_links
		};
		if(callback) {
			writeReq.request = network.latestID++;
		}
		w.socket.send(JSON.stringify(writeReq));
	},
	chathistory: function() {
		w.socket.send(JSON.stringify({
			kind: "chathistory"
		}));
	},
	fetch: function(fetches, opts) {
		if(!opts) opts = {};
		if(typeof fetches == "object" && !Array.isArray(fetches)) fetches = [fetches];
		var fetchReq = {
			fetchRectangles: fetches,
			kind: "fetch",
			utf16: opts.utf16,
			array: opts.array,
			content_only: opts.content_only,
			concat: opts.concat
		};
		w.socket.send(JSON.stringify(fetchReq));
	},
	chat: function(message, location, nickname, color) {
		w.socket.send(JSON.stringify({
			kind: "chat",
			nickname: nickname,
			message: message,
			location: location,
			color: color
		}));
	},
	ping: function(returnTime) {
		var str = "2::";
		if(returnTime) str += "@";
		w.socket.send(str);
	},
	clear_tile: function(x, y) {
		w.socket.send(JSON.stringify({
			kind: "clear_tile",
			tileX: x,
			tileY: y
		}));
	}
};

// [tileX, tileY, charX, charY]
var lastLinkHover = null;
// [type, tileX, tileY, (charX, charY)]
var lastTileHover = null;

Object.assign(w, {
	tiles: tiles,
	periodDeletedTiles: 0,
	hasUpdated: true,
	hasSelectiveUpdated: false,
	userCount: -1,
	clientId: -1,
	net: network,
	isLinking: false,
	isProtecting: false,
	url_input: "",
	coord_input_x: 0,
	coord_input_y: 0,
	link_input_type: 0, // 0 = link, 1 = coord,
	protect_type: null, // null = unprotect, 0 = public, 1 = member, 2 = owner
	protect_bg: "",
	nightMode: 0, // 0 = normal, 1 = night, 2 = night with normal background patterns
	input: elm.textInput,
	menu: null,
	_state: state,
	_ui: {
		announce: elm.announce,
		announce_text: elm.announce_text,
		announce_close: elm.announce_close,
		coordinateInputModal: new CoordinateInputModal(),
		scrolling: null,
		urlInputModal: new URLInputModal(),
		colorInputModal: new ColorInputModal(),
		selectionModal: new SelectionModal()
	},
	styles: styles,
	backgroundInfo: {
		x: 0,
		y: 0,
		w: 0,
		h: 0,
		rmod: 0,
		alpha: 1
	},
	doAnnounce: function(text) {
		if(text) {
			w._ui.announce_text.innerHTML = text;
			w._ui.announce.style.display = "";
		} else {
			w._ui.announce.style.display = "none";
		}
	},
	regionSelect: new RegionSelection(),
	color: function() {
		w._ui.colorInputModal.open(function(color) {
			var this_color = 0;
			if(color) {
				this_color = parseInt(color, 16);
			}
			if(!this_color) {
				this_color = 0;
			}
			w.changeColor(this_color);
			localStorage.setItem("color", this_color);
		});
	},
	goToCoord: function() {
		w._ui.coordinateInputModal.open("Go to coordinates:", w.doGoToCoord.bind(w));
	},
	doGoToCoord: function(y, x) {
		var maxX = Number.MAX_SAFE_INTEGER / 160 / 4;
		var maxY = Number.MAX_SAFE_INTEGER / 144 / 4;
		if(x > maxX || x < -maxX || y > maxY || y < -maxY) {
			return;
		}
		positionX = Math.floor(-x * tileW * coordSizeX);
		positionY = Math.floor(y * tileH * coordSizeY);
		w.render();
	},
	getCenterCoords: function() {
		return [-positionY / tileH, -positionX / tileW];
	},
	doUrlLink: function(url) {
		linkAuto.active = true;
		linkAuto.mode = 0;
		linkAuto.url = url;

		if(w.isLinking || w.isProtecting) return;
		w.url_input = url;
		elm.owot.style.cursor = "pointer";
		w.isLinking = true;
		w.link_input_type = 0;
	},
	urlLink: function() {
		w._ui.urlInputModal.open(w.doUrlLink.bind(w));
	},
	doCoordLink: function(y, x) {
		linkAuto.active = true;
		linkAuto.mode = 1;
		linkAuto.coordTileY = y;
		linkAuto.coordTileX = x;

		if(w.isLinking || w.isProtecting) return;
		w.coord_input_x = x;
		w.coord_input_y = y;
		elm.owot.style.cursor = "pointer";
		w.isLinking = true;
		w.link_input_type = 1;
	},
	coordLink: function() {
		w._ui.coordinateInputModal.open("Enter the coordinates to create a link to. You can then click on a letter to create the link.", w.doCoordLink.bind(w));
	},
	doProtect: function(protectType, unprotect) {
		// show the protection precision menu
		elm.protect_precision.style.display = "";
		tileProtectAuto.active = true;
		if(unprotect) { // default area protection
			tileProtectAuto.mode = 3;
		} else {
			if(protectType == "owner-only") tileProtectAuto.mode = 0;
			if(protectType == "member-only") tileProtectAuto.mode = 1;
			if(protectType == "public") tileProtectAuto.mode = 2;
		}

		if(w.isLinking || w.isProtecting) return;
		elm.owot.style.cursor = "pointer";
		w.protect_bg = {
			"owner-only": "#ddd",
			"member-only": "#eee",
			"public": "#fff"
		}[protectType];
		w.isProtecting = true;
		if(unprotect) {
			w.protect_type = null;
		} else if(protectType == "owner-only") {
			w.protect_type = 2;
		} else if(protectType == "member-only") {
			w.protect_type = 1;
		} else if(protectType == "public") {
			w.protect_type = 0;
		}
	},
	doUnprotect: function() {
		w.doProtect("public", true);
	},
	typeChar: writeChar,
	getChar: getChar,
	socketChannel: null,
	moveCursor: moveCursor,
	fetchUpdates: getAndFetchTiles,
	acceptOwnEdits: false,
	receivingBroadcasts: false,
	getTileVisibility: function() {
		var minVisY = (-positionY - Math.trunc(owotHeight / 2)) / tileH;
		var minVisX = (-positionX - Math.trunc(owotWidth / 2)) / tileW;
		var numDown = owotHeight / tileH;
		var numAcross = owotWidth / tileW;
		var maxVisY = minVisY + numDown;
		var maxVisX = minVisX + numAcross;
		var centerY = minVisY + numDown / 2;
		var centerX = minVisX + numAcross / 2;
		return {
			minVisY: minVisY,
			minVisX: minVisX,
			numDown: numDown,
			numAcross: numAcross,
			maxVisY: maxVisY,
			maxVisX: maxVisX,
			centerY: centerY,
			centerX: centerX
		};
	},
	chat: {
		send: api_chat_send
	},
	broadcastReceive: function(force) {
		if(w.receivingBroadcasts && !force) return;
		w.receivingBroadcasts = true;
		network.cmd_opt();
	},
	broadcastCommand: function(data, includeUsername) {
		network.cmd(data, includeUsername);
	},
	jquery: function(callback) {
		if(window.jQuery) return;
		var jqueryURL = "/static/lib/jquery-1.7.min.js";
		w.loadScript(jqueryURL, callback);
	},
	redraw: function() {
		renderTiles(true);
	},
	setRedraw: function() {
		for(var t in tiles) {
			if(!tiles[t]) continue;
			tiles[t].redraw = true;
		}
	},
	setTileRedraw: function(tileX, tileY) {
		var tile = Tile.get(tileX, tileY);
		if(!tile) return;
		w.hasSelectiveUpdated = true;
		tile.redraw = true;
	},
	setTileRender: function(tileX, tileY) {
		// render tile again on main canvas on next render loop
		var tile = Tile.get(tileX, tileY);
		if(!tile) return;
		w.hasSelectiveUpdated = true;
		tile.rerender = true;
	},
	setTransparency: function(transparent) {
		if(transparent) {
			transparentBackground = true;
			setupTextRenderCtx();
		} else {
			transparentBackground = false;
			setupTextRenderCtx();
		}
		updateScaleConsts();
		w.redraw();
	},
	render: function(redraw) {
		if(redraw) w.setRedraw();
		w.hasUpdated = true;
	},
	changeFont: function(fontData) {
		// change the global font
		fontTemplate = fontData;
		font = fontTemplate.replace("$", normFontSize(16 * zoom));
		textRenderCtx.font = font;
		w.redraw();
	},
	fixFonts: function() {
		var fnt_main = new FontFace("suppl_cour", "url('/static/font/cour.ttf')");
		var fnt_cal = new FontFace("suppl_cal", "url('/static/font/calibri.ttf')");
		var fnt_sym = new FontFace("suppl_sym", "url('/static/font/seguisym.ttf')");
		Promise.all([fnt_main.load(), fnt_cal.load(), fnt_sym.load()]).then(function() {
			document.fonts.add(fnt_main);
			document.fonts.add(fnt_cal);
			document.fonts.add(fnt_sym);
			w.changeFont("$px suppl_cour, suppl_cal, suppl_sym");
		});
	},
	loadFont: function(name, path, cb) {
		var fnt = new FontFace(name, "url(\"" + encodeURI(path) + "\")");
		fnt.load().then(function() {
			document.fonts.add(fnt);
			if(cb) cb(fnt);
		});
	},
	changeSpecialCharFont: function(fontData) {
		specialCharFontTemplate = fontData;
		specialCharFont = specialCharFontTemplate.replace("$", normFontSize(16 * zoom));
		w.redraw();
	},
	enableCombining: function(nr) {
		combiningCharsEnabled = true;
		if(!nr) w.redraw();
	},
	disableCombining: function(nr) {
		combiningCharsEnabled = false;
		if(!nr) w.redraw();
	},
	enableSurrogates: function(nr) {
		surrogateCharsEnabled = true;
		if(!nr) w.redraw();
	},
	disableSurrogates: function(nr) {
		surrogateCharsEnabled = false;
		if(!nr) w.redraw();
	},
	enableColors: function(nr) {
		colorsEnabled = true;
		if(!nr) w.redraw();
	},
	disableColors: function(nr) {
		colorsEnabled = false;
		if(!nr) w.redraw();
	},
	basic: function() {
		w.disableSurrogates(1);
		w.disableCombining(1);
		w.disableColors(1);
		w.redraw();
	},
	restore: function() {
		w.enableSurrogates(1);
		w.enableCombining(1);
		w.enableColors(1);
		w.redraw();
	},
	night: function(ignoreUnloadedPattern) {
		styles.member = "#111";
		styles.owner = "#222";
		styles.public = "#000";
		styles.text = "#FFF";
		w.nightMode = 1;
		if(ignoreUnloadedPattern) {
			w.nightMode = 2;
		} else if(!elm.owot.classList.contains("nightmode")) {
			elm.owot.classList.add("nightmode");
		}
		w.redraw();
	},
	day: function(reloadStyle) {
		w.nightMode = 0;
		if(elm.owot.classList.contains("nightmode")) {
			elm.owot.classList.remove("nightmode");
		}
		if(reloadStyle) {
			getWorldProps(state.worldModel.name, "style", function(style, error) {
				if(!error) {
					styles.member = style.member;
					styles.owner = style.owner;
					styles.public = style.public;
					styles.text = style.text;
				}
				menu_color(styles.menu);
				w.redraw();
			});
		} else {
			var def = defaultStyles();
			styles.member = def.member;
			styles.owner = def.owner;
			styles.public = def.public;
			styles.text = def.text;
			w.redraw();
		}
	},
	rotate: function(speed) {
		if(!speed) speed = 2;
		var rotation = 0;
		var rot = setInterval(function() {
			elm.main_view.style.transform = "perspective(900px) rotateY(" + rotation + "deg)";
			rotation += speed;
			if(rotation >= 360) {
				elm.main_view.style.transform = "";
				clearInterval(rot);
			}
		}, 10);
	},
	hideChat: function() {
		chat_open.style.display = "none";
		elm.chat_window.style.display = "none";
	},
	showChat: function() {
		chat_open.style.display = "";
		if(chatOpen) elm.chat_window.style.display = "";
	},
	disableDragging: function() {
		draggingEnabled = false;
		stopDragging();
	},
	enableDragging: function() {
		draggingEnabled = true;
	},
	disableCursor: function() {
		cursorEnabled = false;
		removeCursor();
	},
	enableCursor: function() {
		cursorEnabled = true;
	},
	disableScrolling: function() {
		scrollingEnabled = false;
	},
	enableScrolling: function() {
		scrollingEnabled = true;
	},
	setMouseCursor: function(cursor) {
		defaultCursor = cursor;
	},
	resetMouseCursor: function() {
		defaultCursor = "text";
	},
	setDragCursor: function(cursor) {
		defaultDragCursor = cursor;
	},
	resetDragCursor: function() {
		defaultDragCursor = "move";
	},
	changeSocket: function(addr) {
		ws_path = addr;
		socket.close()
		createSocket();
		clearTiles(true);
		clearInterval(fetchInterval);
	},
	changeColor: function(color) {
		if(!color) color = 0;
		YourWorld.Color = color;
		localStorage.setItem("color", color);
		// update color textbox in "change color" menu
		elm.color_input_form_input.value = ("00000" + color.toString(16)).slice(-6);
	},
	fetchUpdates: function(margin) {
		if(!margin) margin = 0;
		var top_left = getTileCoordsFromMouseCoords(0 - margin, 0 - margin, true);
		var bottom_right = getTileCoordsFromMouseCoords(owotWidth - 1 + margin, owotHeight - 1 + margin, true);
		network.fetch({
			minX: top_left[0],
			minY: top_left[1],
			maxX: bottom_right[0],
			maxY: bottom_right[1]
		});
	},
	splitTile: function(str) {
		if(!classicTileProcessing) {
			return w.split(str);
		} else {
			return w.split(str, false, false, true);
		}
	}
});

if (state.announce) {
	w._ui.announce_text.innerHTML = w._state.announce;
	w._ui.announce.style.display = "";
}

w._ui.announce_close.onclick = function() {
	w._ui.announce.style.display = "none";
}

elm.random_color_link.onclick = random_color;

elm.owot.oncontextmenu = function() {
	if(ignoreCanvasContext) {
		ignoreCanvasContext = false;
		elm.owot.style.pointerEvents = "none";
		setTimeout(function() {
			ignoreCanvasContext = true;
			elm.owot.style.pointerEvents = "";
		}, 1);
	}
}

window.onhashchange = function(e) {
	manageCoordHash();
}

window.onbeforeunload = function() {
	if(writeBuffer.length) flushWrites();
}

document.onselectstart = function(e) {
	var target = e.target;
	if(closest(target, getChatfield()) || target == elm.chatbar || closest(target, elm.confirm_js_code) || closest(target, elm.announce_text)) {
		return true;
	}
	return w._state.uiModal;
}

w._state.goToCoord = {};
w._state.uiModal = false; // is the UI open? (coord, url, go to coord)

buildMenu();
w.regionSelect.onselection(handleRegionSelection);
w.regionSelect.init();

if(state.userModel.is_superuser) {
	w.loadScript("/static/yw/javascript/world_tools.js");
}

if(state.background) {
	w.backgroundInfo.x = ("x" in state.background) ? state.background.x : 0;
	w.backgroundInfo.y = ("y" in state.background) ? state.background.y : 0;
	w.backgroundInfo.w = ("w" in state.background) ? state.background.w : 0;
	w.backgroundInfo.h = ("h" in state.background) ? state.background.h : 0;
	w.backgroundInfo.rmod = ("rmod" in state.background) ? state.background.rmod : 0;
	w.backgroundInfo.alpha = ("alpha" in state.background) ? state.background.alpha : 1;
}

var simplemodal_onopen = function() {
	return w._state.uiModal = true;
}
var simplemodal_onclose = function() {
	return w._state.uiModal = false;
}

var tellEdit = [];
// tileX, tileY, charX, charY, editID
function searchTellEdit(tileX, tileY, charX, charY) {
	for(var i = 0; i < tellEdit.length; i++) {
		if (tellEdit[i][0] == tileX &&
			tellEdit[i][1] == tileY &&
			tellEdit[i][2] == charX &&
			tellEdit[i][3] == charY) {
			return true;
		}
	}
	return false;
}

function tile_offset_object(data, tileOffX, tileOffY) {
	var refs = {};
	var tilef;
	for(var tilef in data) {
		refs[tilef] = data[tilef];
		delete data[tilef];
	}
	for(var tkp in refs) {
		var new_key = getPos(tkp);
		new_key = (new_key[0] - tileOffY) + "," + (new_key[1] - tileOffX);
		data[new_key] = refs[tkp];
	}
}

var ws_functions = {
	fetch: function(data) {
		if(tileFetchOffsetX || tileFetchOffsetY) {
			tile_offset_object(data.tiles, tileFetchOffsetX, tileFetchOffsetY);
		}
		w.emit("fetch", data);
		for(var tileKey in data.tiles) {
			var tile = data.tiles[tileKey];
			var pos = getPos(tileKey);
			if(tile) {
				tile.content = w.splitTile(tile.content);
				Tile.set(pos[1], pos[0], tile);
			} else {
				Tile.set(pos[1], pos[0], blankTile());
			}
			if(tiles[tileKey].properties.char) {
				tiles[tileKey].properties.char = decodeCharProt(tiles[tileKey].properties.char);
			}
			w.setTileRedraw(pos[1], pos[0]);
		}
		w.emit("afterFetch", data);
		// too many tiles, remove tiles outside of the viewport
		var tileLim = Math.floor(getArea(fetchClientMargin) * 1.5 / zoom + 1000);
		if(tileCount > tileLim && unloadTilesAuto) {
			clearTiles();
		}
	},
	colors: function(data) {
		// update all world colors
		w.emit("colors", data);
		styles.public = data.colors.background;
		styles.cursor = data.colors.cursor;
		styles.member = data.colors.member_area;
		styles.menu = data.colors.menu;
		styles.owner = data.colors.owner_area;
		styles.text = data.colors.text;
		styles.public_text = data.colors.public_text;
		styles.member_text = data.colors.member_text;
		styles.owner_text = data.colors.owner_text;
		checkTextColorOverride();
		w.render(true); // render all tiles with new colors
		menu_color(styles.menu);
	},
	tileUpdate: function(data) {
		w.emit("tileUpdate", data);
		var highlights = [];
		// settings are configured to offset server-fetched tiles
		if(tileFetchOffsetX || tileFetchOffsetY) {
			tile_offset_object(data.tiles, tileFetchOffsetX, tileFetchOffsetY);
		}
		for(tileKey in data.tiles) {
			var pos = getPos(tileKey);
			var tileX = pos[1];
			var tileY = pos[0];
			// if tile isn't loaded, load it blank
			if(!tiles[tileKey]) {
				Tile.set(tileX, tileY, blankTile());
			}
			if(!data.tiles[tileKey]) {
				data.tiles[tileKey] = blankTile();
			}
			if(!data.tiles[tileKey].properties.color) {
				data.tiles[tileKey].properties.color = new Array(tileArea).fill(0);
			}
			if(data.tiles[tileKey].properties.char) {
				data.tiles[tileKey].properties.char = decodeCharProt(data.tiles[tileKey].properties.char);
			}
			if(!tiles[tileKey].properties.color) {
				tiles[tileKey].properties.color = new Array(tileArea).fill(0);
			}
			var newContent;
			var newColors;
			// get content and colors from new tile data
			if(data.tiles[tileKey]) {
				newContent = w.splitTile(data.tiles[tileKey].content);
				if(data.tiles[tileKey].properties.color) {
					newColors = data.tiles[tileKey].properties.color;
				} else {
					newColors = new Array(tileArea).fill(0);
				}
			} else {
				newContent = new Array(tileArea).fill(" ");
			}
			var oldContent = tiles[tileKey].content;
			var oldColors = tiles[tileKey].properties.color.slice(0);
			var charX = 0;
			var charY = 0;
			// compare data
			for(var g = 0; g < tileArea; g++) {
				var oChar = oldContent[g];
				var nChar = newContent[g];
				var oCol = oldColors[g];
				var nCol = newColors[g];
				if(oChar != nChar || oCol != nCol) {
					// make sure it won't overwrite the clients changes before they get sent.
					// if edits are from client, don't overwrite, but leave the highlight flashes
					if(!searchTellEdit(tileX, tileY, charX, charY) && (data.channel != w.socketChannel || w.acceptOwnEdits)) {
						oldContent[g] = nChar;
						oldColors[g] = nCol;
					}
					// briefly highlight these edits (10 at a time)
					if(useHighlight) highlights.push([tileX, tileY, charX, charY]);
				}
				charX++;
				if(charX >= tileC) {
					charX = 0;
					charY++;
				}
			}
			tiles[tileKey].properties = data.tiles[tileKey].properties; // update tile
			tiles[tileKey].content = oldContent; // update only necessary character updates
			tiles[tileKey].properties.color = oldColors; // update only necessary color updates
			w.setTileRedraw(tileX, tileY);
		}
		if(highlights.length > 0 && useHighlight) highlight(highlights);
		var tileLim = Math.floor(getArea(fetchClientMargin) * 1.5 / zoom + 1000);
		if(tileCount > tileLim && unloadTilesAuto) {
			clearTiles();
		}
		w.emit("afterTileUpdate", data);
	},
	write: function(data) {
		w.emit("writeResponse", data);
		// after user has written text, the client should expect list of all edit ids that passed
		for(var i = 0; i < data.accepted.length; i++) {
			for(var x = 0; x < tellEdit.length; x++) {
				if(tellEdit[x][4] == data.accepted[i]) {
					var tileX = tellEdit[x][0];
					var tileY = tellEdit[x][1];
					var charX = tellEdit[x][2];
					var charY = tellEdit[x][3];
					// check if there are links in queue
					for(var r = 0; r < linkQueue.length; r++) {
						var queueItem = linkQueue[r];
						if(queueItem[1] == tileX && queueItem[2] == tileY && queueItem[3] == charX && queueItem[4] == charY) {
							var linkType = queueItem[0];
							if(linkType == "url") {
								network.link({
									tileY: tileY,
									tileX: tileX,
									charY: charY,
									charX: charX
								}, "url", { url: queueItem[5] });
							} else if(linkType == "coord") {
								network.link({
									tileY: tileY,
									tileX: tileX,
									charY: charY,
									charX: charX
								}, "coord", { x: queueItem[5], y: queueItem[6] });
							}
							linkQueue.splice(r, 1);
							break;
						}
					}
					tellEdit.splice(x, 1);
					// because the element has been removed, the length of the array is shorter
					x--;
				}
			}
		}
	},
	channel: function(data) {
		w.socketChannel = data.sender;
		w.clientId = data.id;
		w.userCount = data.initial_user_count;
		updateUserCount();
	},
	announcement: function(data) {
		w.emit("announcement", data);
		w.doAnnounce(data.text);
	},
	ping: function(data) {
		w.emit("ping", data);
		if(data.time) {
			var clientReceived = getDate();
			// serverPingTime is from chat.js
			var pingMs = clientReceived - serverPingTime;
			addChat(null, 0, "user", "[ Client ]", "Ping: " + pingMs + " MS", "Client", false, false, false, null, clientReceived);
			return;
		}
	},
	tile_clear: function(data) {
		var pos = data.tileY + "," + data.tileX;
		if(tiles[pos]) {
			var writability = tiles[pos].properties.writability;
			Tile.set(data.tileX, data.tileY, blankTile());
			tiles[pos].properties.writability = writability;
			w.setTileRender(data.tileX, data.tileY);
		}
	},
	chat: function(data) {
		var type = chatType(data.registered, data.nickname, data.realUsername);
		w.emit("chat", {
			location: data.location,
			id: data.id,
			type: type,
			nickname: data.nickname,
			message: data.message,
			realUsername: data.realUsername,
			op: data.op,
			admin: data.admin,
			staff: data.staff,
			color: data.color,
			dataObj: data,
			hide: false
		});
	},
	user_count: function(data) {
		var count = data.count;
		w.emit("userCount", count);
		w.userCount = count;
		updateUserCount();
	},
	chathistory: function(data) {
		if(data.error) {
			return;
		}
		var global_prev = data.global_chat_prev;
		var page_prev = data.page_chat_prev;
		for(var g = 0; g < global_prev.length; g++) {
			var chat = global_prev[g];
			var type = chatType(chat.registered, chat.nickname, chat.realUsername);
			addChat(chat.location, chat.id, type, chat.nickname,
				chat.message, chat.realUsername, chat.op, chat.admin, chat.staff, chat.color, chat.date, chat);
		}
		for(var p = 0; p < page_prev.length; p++) {
			var chat = page_prev[p];
			var type = chatType(chat.registered, chat.nickname, chat.realUsername);
			addChat(chat.location, chat.id, type, chat.nickname,
				chat.message, chat.realUsername, chat.op, chat.admin, chat.staff, chat.color, chat.date, chat);
		}
	},
	cmd: function(data) {
		w.emit("cmd", data);
	},
	error: function(data) {
		var code = data.code;
		var message = data.message;
		switch(code) {
			case "CONN_LIMIT": // too many connections
			case "INVALID_ADDR": // invalid websocket path
			case "NO_EXIST": // world does not exist
			case "NO_PERM": // no permission to access world
				console.log("Received error from the server with code [" + code + "]: " + message);
				break;
			case "PARAM": // invalid parameters in message
				break;
		}
	}
};

begin();