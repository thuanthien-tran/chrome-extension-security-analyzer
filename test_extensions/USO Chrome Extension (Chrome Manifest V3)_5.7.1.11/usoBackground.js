var portContent = new Array();
var portNative = null;
var tabActive = null;
var winActive = null;
var CONTENT_NAME = "usoContentPort";
var NATIVE_NAME = "app.native.uso";
var seqNumber = -1;
var isUsoProcess = false;
var tabs; //USOC-983

function getMessageType(type)
{
	if (type == 0)
		return "USO Agent";
	else if (type == 1)
		return "USO Client";
	else if (type == 2)
		return "USO Log";
	else if (type == 3)
		return "UCM Client";	
	else if (type == 4)
		return "USO WebUI";		
	else 
		return "UNKNOWN";
}

function usoLog(str)
{
	var dt = new Date();
	var dtLog = dt.getFullYear() + "-";
	dtLog += String("00" + dt.getMonth()).slice(-2) + "-";
	dtLog += String("00" + dt.getDate()).slice(-2) + " ";
	dtLog += String("00" + dt.getHours()).slice(-2) + ":";
	dtLog += String("00" + dt.getMinutes()).slice(-2) + ":";
	dtLog += String("00" + dt.getSeconds()).slice(-2) + ".";	
	dtLog += String("000" + dt.getMilliseconds()).slice(-3) + " ";	
	console.log(dtLog + str);
}
/*
//Manifest v3
async function getCurrentTab(callback) {
  let info = { active: true, currentWindow: true };
  return await chrome.tabs.query({active: true, currentWindow: true}, function(tab) {
  callback(tab);  }
  );
 };
function _displayTab(tab) {
usoLog(tab);
 };
*/

//USOC-983
//Manifest v3
async function getCurrentTab(callback) {
  let info = { active: true, currentWindow: true };
  await chrome.tabs.query({active: true, currentWindow: true}, function(tab) {
  callback(tab);  }
  );
 

 };

 //USOC-983
 function _displayTab(tab) {
tabs = tab;
 };

function logTabEvent(eventName,tab)
{
	usoLog(eventName + " (tabIndex: " + tab.index + ", portContentLen: " + portContent.length + ", tabId: " + tab.id + ", tabWindowId: " + tab.windowId + ") " + tab.url);
}

function OnMessageContent(msg)
{
	if (msg.type >= 0 && msg.type <= 4)
		SendMessageNative(msg);
}

function OnDisconnect(port)
{
	logTabEvent("Port onDisconnect", port.sender.tab);
	clearAllInvalidPort();
}

function OnConnectContent(port)
{
	if (port.name != CONTENT_NAME)
	{
		usoLog("[INFO] Invalid port name " + port.name);
		return;
	}

	if (port.sender.tab == undefined) // chrome app tab instead of chrome ext tab
	{
		usoLog("[INFO] Invalid port (from app instead of ext) ");
		return;	
	}
	
	if (tabActive == null)
		tabActive = port.sender.tab;
		
	portContent[portContent.length] = port;	
	port.onMessage.addListener(OnMessageContent);
	port.onDisconnect.addListener(OnDisconnect);
	logTabEvent("Port onConnect", port.sender.tab);
}

function GetTab(tab)
{
	tabActive = tab;
	logTabEvent("Tab onActivated", tabActive);
}

function OnCreatedTab(tab)
{
	logTabEvent("Tab onCreated", tab);
}

async function OnActivatedTab(activeInfo)
{ // USOC-682
	chrome.windows.getAll({ populate: true }, function (windows) 
	{
		for (var i = 0, win; win = windows[i]; i++) 
		{
			for (var j = 0, tab; tab = win.tabs[j]; j++) 
			{
				if (tab.id == activeInfo.tabId) 
				{   
				     //Manifest v2
					chrome.tabs.get(activeInfo.tabId, GetTab);
					
					
					return;
				}
			}
		}
		usoLog("Invalid tabId on OnActivatedTab: " + activeInfo.tabId);
	});
}

function OnUpdatedTab(tabId, changeInfo, tabUpdate)
{
	if (tabActive == null || tabActive.id == tabUpdate.id)
		tabActive = tabUpdate;
		
	if (changeInfo.status != "complete")
		return;	
			
	for (var i = 0; i < portContent.length; i++)
	{
		if (portContent[i].sender.tab.id == tabId)
		{
			logTabEvent("Tab onUpdated", portContent[i].sender.tab);
			break;
		}
	}
}

function OnRemovedTab(tabId, removeInfo)
{
	usoLog("Tab onRemoved, tabId: " + tabId);
}

function clearInvalidPort()
{
	for (var i = 0; i < portContent.length; i++)
	{
		if (!IsPortConnected(portContent[i]))
		{
			portContent.splice(i, 1);
			return i;
		}
	}
	return -1;
}

function clearAllInvalidPort()
{
	var index = 0;
	while (index != -1 && portContent.length > 0)
		index = clearInvalidPort();
}

function IsPortConnected(port)
{
    try
    {
        port.postMessage({ping: "hi"});
        return true;
    }
    catch(e)
    {
        return false;
    }
}

function SendMessageContent(message)
{
	for (var i = 0; i < portContent.length; i++)
	{
		if (!IsPortConnected(portContent[i]))
			continue;
				
		var isSameTab = (portContent[i].sender.tab.id == tabActive.id);
		//if (message.command == "eval") //AM-1878
		//{			
			if (isUsoProcess) //USOC-676
			{
				if (isSameTab)
				{
					portContent[i].postMessage(message);
					break;
				}
			}
			else
				portContent[i].postMessage(message);
		//}
		//else if (isSameTab)
		//{
		//	portContent[i].postMessage(message);
		//	break;
		//}		
	}
}

function SendMessageNative(message) 
{
	if (message.type == 1)
		usoLog("Send response data to native with seq no: " + message.seq + ", result: " + message.res );
	else if (message.type == 4)
	{
		var msg = JSON.parse(message.invoke);
		usoLog("Send a method invocation to native, type: " + getMessageType(message.type) + ", method: " + msg.method);
		if (msg.method == "localSwitch")
		{
			//Manifest v2
			if(tabActive.id)
			chrome.tabs.update(tabActive.id,{url:msg.params.url});
			//Manifest v3
			//await chrome.tabs.update(tabActive.id,{url:msg.params.url});
			return;
		}
	}
	else if (message.type != 2)
		usoLog("Send request a function to native, type: " + getMessageType(message.type) + ", func: " + message.func);
		
    if (portNative == null)
        ConnectNative();
    portNative.postMessage(message);
}

function SrcCheckHiddenField(msg, scr)
{
/*	var el =  script ;
	while (el)
	{
		var isHidden = el.style.display.toLowerCase() == 'none';
		if (isHidden)
			break;
		el = el.parentElement;
	}
	return el;	*/
	function undefinedOrNull(x) {
	//console.log("undefinedOrNull");
		return typeof (x) == "undefined" || x == null
	}

	function findElements(scr) {
		if (!undefinedOrNull(scr.id)) {
		   // console.log("undefinedOrNull - scr.id");
			return document.getElementById(scr.id);
		}

		if (!undefinedOrNull(scr.name)) {
		// console.log("undefinedOrNull - scr.name");
			return document.getElementsByName(scr.name)[0];
		}

		if (!undefinedOrNull(scr.class)) {
		//console.log("undefinedOrNull - scr.class");
			return document.getElementsByClassName(scr.class)[0];
		}

		if (!undefinedOrNull(scr.tag)) {
		//console.log("undefinedOrNull - scr.tag");
			return document.getElementsByTagName(scr.tag)[scr.idx];
		}
		//console.log("findElements");
		return null;
	}

	let el = findElements(scr);

	while (el) {
		var isHidden = el.style.display.toLowerCase() == 'none';

		if (isHidden)
			break;

		el = el.parentElement;
	}

	return el;
};

// USOC-528
// USOC-678 remove el.style.visibility
function checkHiddenField(msg,scr)
{
	//Manifest v3
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: SrcCheckHiddenField,
			args: [msg, scr],
			},
			(result) =>
			{
				var ret = true;
				if(result != null){
					for (var i = 0; i < result.length; i++)
					{
						if (result[i].result == null)
							continue;
						
						ret = false;
						break;				
					}
					SendMessageNative({type: 1, res: ret, seq: msg.seq});
				}
			});	
	
}

function SrcUsoFill(scr, msg, command)
{
	function findElements(scr) {
		if (!undefinedOrNull(scr.id)) {
			return document.getElementById(scr.id);
		}

		if (!undefinedOrNull(scr.name)) {
			return document.getElementsByName(scr.name)[0];
		}

		if (!undefinedOrNull(scr.class)) {
			return document.getElementsByClassName(scr.class)[0];
		}

		if (!undefinedOrNull(scr.tag)) {
			return document.getElementsByTagName(scr.tag)[scr.idx];
		}

		return null;
	}

	function undefinedOrNull(x) {
		return typeof (x) == "undefined" || x == null
	}

	function selectElement(item) {
		if (item.text != msg.value) {
			return false;
		}

		item.selected = true;

		return true;
	}

	function runSelect(elements) {
		for (var i = 0; i < elements.length; i++) {
			let isSelected = selectElement(obj.item(i));

			if (isSelected)
				break;
		}
	}

	function runFillData(element, msg) {
		if (element.type == 'radio' || element.type == 'checkbox') {
			var isCheck = msg.value == '1' || msg.value == 'true';

			element.checked = isCheck;
		} else {
			element.value = msg.value;
			//USOC-1022 and USCO-1021
			element.dispatchEvent(new Event('input', { bubbles: true}));
			//  document.querySelectorAll('input').forEach((item) => {item.dispatchEvent(new Event('input', { bubbles: true}));}) 
		}
	}

	let elements = findElements(scr);

	if (command == "SUBMIT") {
		elements.click();
	} else if (command == "SELECT") {
		try { runSelect(elements); } catch (error) { }
	} else {
		try { runFillData(elements, msg); } catch (error) { }
	}
};

function usoFill(scr, msg)
{
//remark: ver 5.6.2.6
/*	var strMsg = msg.value; 
	strMsg = strMsg.replace(/\\/g, "\\\\");
	strMsg = strMsg.replace(/'/g,"\\'");
	msg.value = strMsg;
*/
	//Manifest v3
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: SrcUsoFill,
			args:[scr, msg, msg.value]
			},
			function(result)
			{
			});
	
}

function isMatch(scr, msg, res)
{
	try
	{
		var ret = false;
		for (var i = 0; i < res.length; i++)
		{
			if (res[i].result == null)
				continue;
			
			ret = true;
			if (msg.command == "fill")
				usoFill(scr, msg)			
			else
				break;				
		}
		
		return ret;
	}
	catch(err)
	{
	 console.log("isMatch - " + err);

	}
}

function ScrUsoMatchByIndex(msg)
{
	return document.getElementsByTagName(msg.tag)[msg.index];
};

function usoMatchByIndex(msg)
{	
	//var scr = "document.getElementsByTagName('" + msg.tag + "')[" + msg.index + "]";
	//USOC-1027
	var scr = { 'tag': msg.tag, "idx": msg.index };
	
	
	//Manifest v2
	/*chrome.tabs.executeScript(tabActive.id,{code:scr,allFrames:true},function(result)
	{
		isMatch(scr,msg,result)?checkHiddenField(msg,scr):SendMessageNative({type: 1, res: false, seq: msg.seq});
	});*/
	try
	{
	//Manifest v3
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: ScrUsoMatchByIndex,
			args:[msg]
			},
			//function(result)
			(result) =>
			{
				isMatch(scr,msg,result)?checkHiddenField(msg,scr):SendMessageNative({type: 1, res: false, seq: msg.seq});
			});
	}
	catch(err)
	{
	 console.log("usoMatchByIndex - " + err);
	}
	
}

function ScrUsoMatchByClassName(msg)
{
	return document.getElementsByClassName(msg.id)[0];
};

function usoMatchByClassName(msg)
{
	//var scr = "document.getElementsByClassName('" + msg.id + "')[0]";
	var scr = {'class': msg.id};
	
	
	//Manifest v2
	/*chrome.tabs.executeScript(tabActive.id,{code:scr,allFrames:true},function(result)
	{
		isMatch(scr,msg,result)?checkHiddenField(msg,scr):SendMessageNative({type: 1, res: false, seq: msg.seq});
	});*/
	try
	{
	//Manifest v3
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: ScrUsoMatchByClassName,
			args:[msg]
			},
			function(result)
			{
				isMatch(scr,msg,result)?checkHiddenField(msg,scr):SendMessageNative({type: 1, res: false, seq: msg.seq});
			});
	}
	catch(err)
	{
		console.log("usoMatchByClassName - " + err);
	}
}

function SrcUsoMatchByName(msg)
{
  return  document.getElementsByName(msg.id)[0];
}; 
	
function usoMatchByName(msg)
{
	//var scr = "document.getElementsByName('" + msg.id + "')[0]";
	//var scr = { 'name': msg.id[0]};
	var scr = { 'name': msg.id};
	
	//Manifest v2
	/*chrome.tabs.executeScript(tabActive.id,{code:scr,allFrames:true},function(result)
	{
		isMatch(scr,msg,result)?checkHiddenField(msg,scr):usoMatchByClassName(msg);
	});*/
	try
	{
	//Manifest v3
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: SrcUsoMatchByName,
			args:[msg]
			},
			function(result) 
			{
				isMatch(scr,msg,result)?checkHiddenField(msg,scr):usoMatchByClassName(msg);
			});
	}
	catch(err)
	{
	 console.log("usoMatchByName - " + err);
	}
}
 
function SrcUsoMatchById(msg)
{
 return document.getElementById(msg.id);
}; 
 
function usoMatchById(msg)
{
	 // var scr = "document.getElementById('" + msg.id + "')";
	 var scr = {'id': msg.id };
	
	//Manifest v2
	/*chrome.tabs.executeScript(tabActive.id,{code:scr,allFrames:true},function(result)
	{
		isMatch(scr,msg,result)?checkHiddenField(msg,scr):usoMatchByName(msg);
	});*/
	
	try
	{
	//Manifest v3
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: SrcUsoMatchById,
			args:[msg]
			},
			function(result)
			{
				isMatch(scr,msg,result)?checkHiddenField(msg,scr):usoMatchByName(msg);
			});
	}
	catch(err)
	{
	 console.log("usoMatchById - " + err);
	}
	
	
}

function ScrCheckHiddenIdent(msg)
{
	var isMatch = true; 
	try
	{
		for (var i=0; i<document.all.length;i++) 
		{
			var isHidden = document.all[i].style.display.toLowerCase() == 'none';
			if (isHidden && document.all[i].innerText.indexOf('" + msg.id + "') != -1)
			{
				isMatch = false;
				break;
			}
		} 
		return isMatch;
	}
	catch(err)
	{
	 console.log("ScrCheckHiddenIdent - " + err);
	}	
};

// USOC-678 remove el.style.visibility
function checkHiddenIdent(msg)
{
	/*var scr = " var isMatch = true; \
			for (var i=0; i<document.all.length;i++) \
			{ \
				var isHidden = document.all[i].style.display.toLowerCase() == 'none';\
				if (isHidden && document.all[i].innerText.indexOf('" + msg.id + "') != -1)\
				{\
					isMatch = false;\
					break;\
				}\
			} \
			isMatch;";
			
	*/
	//Manifest v2		
	/*chrome.tabs.executeScript(tabActive.id,{code:scr,allFrames:true},function(result)
	{
		var ret = true;
		for (var i = 0; i < result.length; i++)
		{
			if (result[i] == false)
			{
				ret = false;
				break;				
			}
		}
		SendMessageNative({type: 1, res: ret, seq: msg.seq});
	});*/
	
	
	try
	{
	//Manifest v3
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: ScrCheckHiddenIdent,
			args:[msg]
			},
			(result) =>
			{
				var ret = true;
				if(result != null){
					for (var i = 0; i < result.length; i++)
					{
						if (result[i].result == false)
						{
							ret = false;
							break;				
						}
					}
					SendMessageNative({type: 1, res: ret, seq: msg.seq});
				}
			});
	}
	catch(err)
	{
	 console.log("ScrCheckHiddenIdent - " + err);
	}	
}

function ScrUsoMatchIdent(msg)
{
	return document.body.innerText;
};

function usoMatchIdent(msg)
{
	//var scr = "document.body.innerText";
	
		
	//Manifest v2
	/*chrome.tabs.executeScript(tabActive.id,{code:scr,allFrames:true},function(result)
	{
		var ret = false;
		for (var i = 0; i < result.length; i++)
		{
			if (result[i] == null || result[i].indexOf(msg.id) == -1 )
				continue;
			
			ret = true;
			break;				
		}
		
		if (ret)
			checkHiddenIdent(msg);
		else
			SendMessageNative({type: 1, res: ret, seq: msg.seq});
	});*/
	
	try
	{
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: ScrUsoMatchIdent,
			args:[msg]
			},
			(result) =>
			{
				var ret = false;
				if(result != null){
					for (var i = 0; i < result.length; i++)
					{
						if (result[i].result == null || result[i].result.indexOf(msg.id) == -1 )
						continue;
				
						ret = true;
						break;				
					}
			
					if (ret)
					checkHiddenIdent(msg);
					else
						SendMessageNative({type: 1, res: ret, seq: msg.seq});
				}
			});
	}
	catch(err)
	{
	 console.log("usoMatchIdent - " + err);
	}	
}

function SrcUsoMatch()
{
 return document.readyState;
}
	
function usoMatch(msg)
{	
	try
	{
	chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: true}, 
			func: SrcUsoMatch			
			},
			function(result)
			{
				var isReady = true;
				if(result != null){
					for (var i = 0; i < result.length; i++)
					{
					   usoLog("result - " + result[i].toString());
						if (result[i].result != "complete")
						{
							isReady = false;
							usoLog("[INFO] readyState: " + result[i]);
						}
					}
					
					if (isReady)
					{
						usoLog("msg tag - " + msg.tag);
						usoLog("msg id - " + msg.id);
						if (msg.tag == "IDENT")
							usoMatchIdent(msg);
						else if (msg.id == "NULL" || msg.id == "")
							usoMatchByIndex(msg);
						else
							usoMatchById(msg);	
					}
					else
						SendMessageNative({type: 1, res: isReady, seq: msg.seq});
				}
			});
	}
	catch(err)
	{
	 console.log("usoMatch - " + err);
	}	
}

function getResult(result)
{
  let str;
  let pos = 0;
  
  str = JSON.stringify(result);
  pos = str.length;
  usoLog("pos -" + pos);
  usoLog("str -" + str);
  //pos = str.search("caption");
  pos = str.search("result");
  str = str.slice(pos-1, str.length);
  str = "{" + str;
  usoLog("after slice " + str);
  //pos = str.search("result");
  //usoLog("pos1 -" + pos);
  return str;
}

// wrap chrome.tabs.executeScript callback into async/await with Promise
async function execScript(ptabId, pScript,x, y, isNotWait) {
  var startTime = new Date().getTime();
  var ret = [];
  let str ; 
  function cback(result) {
	//manifest v2
    //Array.isArray(result)?(ret = result):ret.push(result);
	//manifest v3
	//change to result formot - refer below link
	//https://ravimashru.dev/blog/2021-04-14-executescript-chrome-extension/ 
	if(Array.isArray(result))
	{
   usoLog("Is array");	
	  /*   
	  result = getResult(result);
	  usoLog("getResult - " + result);
	  str = JSON.stringify(result);
	  usoLog("str - " +  str);*/
	  ret = result;
	}
	else
	{
	 usoLog("Is not array");
	 ret.push(result);
	}
  }
  
  function callScript(x, y, isHighlightOnly)
  {
  
	function getField(element) {
    var selector = element.tagName + ':not([aria-hidden=true])';
    var listElement = document.querySelectorAll(selector);
	console.log('YW-1');
    for (let i = 0; i < listElement.length; i++) {
      if (element != listElement[i])
        continue;
      var fieldId = listElement[i].id;
      if (!fieldId)
        fieldId = listElement[i].name;
      if (!fieldId)
        fieldId = listElement[i].className;
	  var fieldCaption = element.value;
	  if (!fieldCaption)
		fieldCaption = element.innerText; // for BUTTON
      //var usoField = {tagName: element.tagName, id: fieldId, index: i, caption: fieldCaption, url: document.URL, title: document.title};
	  var usoField = {tagName: element.tagName, id: fieldId, index: i, caption: fieldCaption,title: document.title, url: document.URL };
	  console.log(usoField);
      return usoField;
    }
    return null;
  }
  
  function getIdentifier(element) {
    //var usoIdentifier = {tagName: element.tagName, id: "", index: -1, caption: element.innerText, url: document.URL, title:document.title};
	var usoIdentifier = {tagName: element.tagName, id: "", index: -1, caption: element.innerText,title:document.title, url: document.URL };
	console.log(usoIdentifier);
    return usoIdentifier;
  }
  

    for (var item of document.querySelectorAll('*')) {
      if (item.style.outline == 'rgb(255, 0, 0) solid 5px')
        item.style.outline = '';
    }
    var element = document.elementFromPoint(x, y);
	if (!element)
		return null;
	if (isHighlightOnly) {
		element.style.outline = 'rgb(255, 0, 0) solid 5px';
		return null;
	}
	//USOC-999
    if (element.tagName == 'INPUT' || element.tagName == 'BUTTON' || element.tagName == 'A')
	{
	  //console.log('YW-5');
	  console.log(element.tagName);
      return getField(element);
	}
    else if (element.innerText)
	{	 
	 //console.log('YW-6');
	 console.log(element.tagName);
	 console.log(element.innerText);
     return getIdentifier(element);
	  
	}
	else
    {
	 console.log('exit');
	 console.log(element.tagName);
	 console.log(element.innerText);
	 //return 3;
	 return getIdentifier(element);
	  //return element.tagName;	 
    }
		
   
	
  }
  
  
  //Manifest v2
  //chrome.tabs.executeScript(tabId, {code: pScript, allFrames: true}, cback);	
  //Manifest v3 
  chrome.scripting.executeScript({
			target: {tabId: ptabId, allFrames: true}, 
			func: callScript,
			args:[x,y, isNotWait]
			},
			cback	
		);			
  
  if (isNotWait)
    return true;
    
  return new Promise(function(resolve) {
    function doCheckResult() {
      var handle = setTimeout(doCheckResult, 0);
      if (ret.length > 0) {
        clearTimeout(handle);
        resolve(ret[0]);
    }
  } // nested setTimeout has flexible interval compare with setInterval
  setTimeout(doCheckResult, 2); 
  });
}

async function usoTrainer(x, y, isHighlightOnly) {
  var usoTrainerScript = `
  function getField(element) {
    var selector = element.tagName + ':not([aria-hidden=true])';
    var listElement = document.querySelectorAll(selector);
	console.log('YW-1');
    for (let i = 0; i < listElement.length; i++) {
      if (element != listElement[i])
        continue;
      var fieldId = listElement[i].id;
      if (!fieldId)
        fieldId = listElement[i].name;
      if (!fieldId)
        fieldId = listElement[i].className;
	  var fieldCaption = element.value;
	  if (!fieldCaption)
		fieldCaption = element.innerText; // for BUTTON
      var usoField = {tagName: element.tagName, id: fieldId, index: i, caption: fieldCaption, url: document.URL, title: document.title};
	  console.log(usoField);
      return usoField;
    }
    return null;
  }
  
  function getIdentifier(element) {
    var usoIdentifier = {tagName: element.tagName, id: "", index: -1, caption: element.innerText, url: document.URL, title:document.title};
	console.log(usoIdentifier);
    return usoIdentifier;
  }
  
  function elementHighlight(x, y, isHighlightOnly) {
    for (var item of document.querySelectorAll('*')) {
      if (item.style.outline == 'rgb(255, 0, 0) solid 5px')
        item.style.outline = '';
    }
    var element = document.elementFromPoint(x, y);
	if (!element)
		return null;
	if (isHighlightOnly) {
		element.style.outline = 'rgb(255, 0, 0) solid 5px';
		return null;
	}
    if (element.tagName == 'INPUT' || element.tagName == 'BUTTON')
	{
	  console.log('YW-5');
	  console.log(element.tagName);
      return getField(element);
	}
    else if (element.innerText)
	{	 
	 console.log('YW-6');
	 console.log(element.tagName);
	 console.log(element.innerText);
      return getIdentifier(element);
	}
	else
    {
	 console.log('exit');
	 console.log(element.tagName);
	 console.log(element.innerText);
	 //return 3;
	 return getIdentifier(element);
	  //return element.tagName;	 
    }	
  }  
  elementHighlight(${x},${y},${isHighlightOnly});  
 `;

   //let tabs = await getCurrentTab(_displayTab);
   //USOC-983, USOC-999: Note: this mask not related to USOC-999, related to USOC-983
   /*
   getCurrentTab(_displayTab);
  //if (!tabs || tabs[0].url.startsWith("chrome://")) {
  if (!tabs ) {
   console.log('tabs -'+ tabs);
    portNative.postMessage({type: 1, res: JSON.stringify(usoResult), seq: msg.seq});
    return;
  }*/

   
  if (isHighlightOnly)  {
    usoLog("Start Hightlight");
	 //return execScript(tabActive.id, usoTrainerScript,true);
	if(tabActive.id)
	  return execScript(tabActive.id, usoTrainerScript,x, y, true);
	//return execScript(tabs[0].id, usoTrainerScript,x, y, true);
  }
  else {    
  console.log('start');
  usoLog("Start element");
  if(tabActive.id)
   return await execScript(tabActive.id, usoTrainerScript,x, y, false);
    //return await execScript(tabs[0].id, usoTrainerScript,x, y, false);
  }
}


function usoGetFieldsFunction()
{
	//usoLog("usoGetFieldsFunction");

		var fields = [];
	function getField(tagName) {
	
		var selector = tagName + ':not([aria-hidden=true])';
		//if (tagName.toUpperCase() == 'INPUT')
		//	selector += ':not([type=hidden])';
		
		var listElement = document.querySelectorAll(selector);			
		for (let i = 0; i < listElement.length; i++) {
			var clientRect = listElement[i].getBoundingClientRect();
			if (clientRect.left <= 0 || clientRect.top <= 0)
			{
				//usoLog("YW-T1");
				continue;
			}
			var fieldId = listElement[i].id;
			if (!fieldId)
			{
				//usoLog("YW-T2");
				fieldId = listElement[i].name;
			}
			if (!fieldId)
			{
				//usoLog("YW-T3");
				fieldId = listElement[i].className;
			}
			var usoField = {tagName: listElement[i].tagName, id: fieldId, index: i};
			fields.push(usoField);
			//usoLog("YW-T4" + usoField);
		}			
	}
	getField('INPUT');
	getField('BUTTON');
	return fields;
}		

/*
async function getCurrentTab() {
        let queryOptions = { active: true, lastFocusedWindow: true };
        let [tab] = await chrome.tabs.query(queryOptions);

        return tab;
    }
*/
 
async function OnMessageNative(msg) 
{	
	if (msg.type != 1)
	{		
		isUsoProcess = false;
		if (msg.type == 4)
			usoLog("Recv data from native, type: " + getMessageType(msg.type) + ", method: " + JSON.parse(msg.ret).method);
		else
			usoLog("Recv data from native, type: " + getMessageType(msg.type) + ", func: " + msg.func);
		SendMessageContent(msg);
		return;
	}
	
	var logStr = "";
	if (msg.seq != undefined)
	{
		logStr = "Recv request data from native with ";
		if (seqNumber == msg.seq )
		{
			logStr += "INVALID seq no: " + msg.seq + " (expected " + (seqNumber+1) + "), command: " + msg.command;
			if (msg.command != "url")
				logStr += ", tag: " + msg.tag + ", id: " + msg.id + ", index: " + msg.index;
			
			usoLog(logStr);
			return;
		}
		
		seqNumber = msg.seq;
		logStr += "seq no: " + msg.seq + ", command: " + msg.command;
		if (msg.command != "url")
			logStr += ", tag: " + msg.tag + ", id: " + msg.id + ", index: " + msg.index;
	}
	else
	{
		logStr = "Recv request data from native, command: " + msg.command;
		if (msg.command == "eval"){
			logStr += ", script: " + msg.script;	
		}
		else if (msg.command != "url")
			logStr += ", tag: " + msg.tag + ", id: " + msg.id + ", index: " + msg.index;
	}
	
	usoLog(logStr);
	
	if (msg.command == "url")
	{
	 
		isUsoProcess = true;
		//Manifest v2 format
		//chrome.tabs.query({active:true,windowId:winActive},function(tab)
		//Manifest v3
		let URLinfo = {active:true,windowId:winActive};
		(async () => {
		 var tab = await chrome.tabs.query(URLinfo)
		{
			if (tab.length == 1) // ensure valid tab, length 0 means the tab is closing
				tabActive = tab[0];			
				
			SendMessageNative({type: 1, res: tabActive.url, seq: msg.seq});
		}})();		
	}
	else if (msg.command == "eval")
	{
		isUsoProcess = false;
		console.log("msg :" + msg)
		SendMessageContent(msg);
	}
	else if (msg.command == "train")
	{
	  usoLog("Train");
		isUsoProcess = true;
		

	/*
	USO will inspect all visible user input elements.
	Element attribute priority is id, name, className along with index for each to construct USO Field ID.
	*/
	/*var usoGetFields = `
		(()=> { 
			var fields = [];
			function getField(tagName) {
				var selector = tagName + ':not([aria-hidden=true])';
				//if (tagName.toUpperCase() == 'INPUT')
				//	selector += ':not([type=hidden])';
				var listElement = document.querySelectorAll(selector);			
				for (let i = 0; i < listElement.length; i++) {
					var clientRect = listElement[i].getBoundingClientRect();
					if (clientRect.left <= 0 || clientRect.top <= 0)
						continue;
					var fieldId = listElement[i].id;
					if (!fieldId)
						fieldId = listElement[i].name;
					if (!fieldId)
						fieldId = listElement[i].className;
					var usoField = {tagName: listElement[i].tagName, id: fieldId, index: i};
					fields.push(usoField);
				}			
			}
			getField('INPUT');
			getField('BUTTON');
			return fields;
		})();
	`;*/
	

		
	// https://developer.chrome.com/docs/extensions/reference/tabs/#method-executeScript
	//Manifest v2
	/*chrome.tabs.executeScript({code: usoGetFields, allFrames: false}, function(response){
		var fields = [];
		fields.push(tabActive.url);
		fields.push(tabActive.title);
		for (let frm of response)
			for (let uso of frm)
				fields.push(uso);
		var usoResult = {result: fields};
		SendMessageNative({type: 1, res: JSON.stringify(usoResult), seq: msg.seq});
	});*/

		chrome.scripting.executeScript({
			target: {tabId: tabActive.id, allFrames: false}, 
			func: usoGetFieldsFunction,
			},
			(response) =>{
			var fields = [];
		    fields.push(tabActive.url);
			fields.push(tabActive.title);			
		    for (let frm of response)
			   for (let uso of frm.result)
					fields.push(uso);
			var usoResult = {result: fields};
			SendMessageNative({type: 1, res: JSON.stringify(usoResult), seq: msg.seq});
		});	
	}
	else if (msg.position != undefined)
	{
		usoLog(msg.position);
		var arrPos = msg.position.split(',');
		var x = parseInt(arrPos[0]);
		var y = parseInt(arrPos[1]);
		let str;
		if (msg.command == "element") {
			(async function () { 
				var usoObject = await usoTrainer(x,y,false);
				//var usoResult = {result: usoObject};
				var usoResult = {result: usoObject.result};
				usoLog(JSON.stringify(usoObject.result));
				SendMessageNative({type: 1, res: JSON.stringify(usoResult), seq: msg.seq});
				//str = getResult(usoObject);		
				//SendMessageNative({type: 1, res: str, seq: msg.seq});		
			})();
		}
		else if (msg.command == "highlight")
			usoTrainer(x,y,true);
	}
	else
	{
		isUsoProcess = true;	
		usoMatch(msg);
	}
 }
 
function OnDisconnectedNative() 
{
    usoLog("INFO] Disconnected to native messaging host: " + chrome.runtime.lastError.message);
    portNative = null;
}

function ConnectNative()
{
    usoLog("[INFO] Connecting to native messaging host " + NATIVE_NAME)
    try
    {
        portNative = chrome.runtime.connectNative(NATIVE_NAME);
        portNative.onMessage.addListener(OnMessageNative);
        portNative.onDisconnect.addListener(OnDisconnectedNative);
		SendMessageNative({type: 2, text: "USO Chrome Extension version " + chrome.runtime.getManifest().version + " on " + navigator.userAgent});
		chrome.tabs.onCreated.addListener(OnCreatedTab);
		chrome.tabs.onActivated.addListener(OnActivatedTab);
		chrome.tabs.onUpdated.addListener(OnUpdatedTab); 
		chrome.tabs.onRemoved.addListener(OnRemovedTab);
		chrome.windows.onFocusChanged.addListener(function(windowId)
		{
			if (windowId != chrome.windows.WINDOW_ID_NONE)
				winActive = windowId;
		});
	
    }
    catch(e)
    {
        usoLog("INFO] Exception: " + e.message);
    }
}
//Entry point
chrome.runtime.onConnect.addListener(OnConnectContent);
ConnectNative();