var usoVersion = "";
var usoSession = "";
var port = null;
var dataScript = "";
//USOC-1028
var isContentPolicyEnabledFlag = null;

//usoc-978
function isContentPolicyEnabled(check){
	//USOC-1028	
	//USOC-1083
	if(!check)
	{
		if (isContentPolicyEnabledFlag !== null){
			console.log('Skip content policy enabled check');
			return isContentPolicyEnabledFlag;
		}
		var req = new XMLHttpRequest();
		req.open('GET', document.location, false);	
		req.send(null);
		console.log('document.location: ' + document.location);
		//USOC-1028
		let contentSecurityPolicy = req.getResponseHeader('content-security-policy') != null;
		console.log('contentSecurityPolicy : ' + contentSecurityPolicy );
		let contentSecurityPolicyReportOnly = req.getResponseHeader('content-security-policy-report-only') != null;
		console.log('concontentSecurityPolicyReportOnlytentSecurityPolicy : ' + contentSecurityPolicyReportOnly );
		isContentPolicyEnabledFlag = contentSecurityPolicy || contentSecurityPolicyReportOnly;
		console.log('isContentPolicyEnabledFlag: ' + isContentPolicyEnabledFlag);
	}
	else {
		isContentPolicyEnabledFlag = false
	}

	return isContentPolicyEnabledFlag;
}
//usoc-978
function isAgent() {
	return document.baseURI.indexOf('hytera.com') != -1 
				   ||document.baseURI.indexOf('start.uso') != -1 
				   || document.baseURI.indexOf('webui') != -1
				   || document.baseURI.indexOf('ucmanager') != -1
				   || document.baseURI.indexOf('ucmweb') != -1; // AM-6384
}

//usoc-978
function evalScript(code){
	try{    
		setTimeout(code,1);
	}
	catch(err){
		console.log('Error evaluating expression: - ' + err);
	return null;
	}
}
  
// don't use key 'result' and value 'true' (native connection will be terminated)    
function OnMessageBackground(msg)
{
	if (msg.ping == "hi")
	{	    
		port.postMessage({ping: "hello " + document.baseURI});
	}
	else if (msg.type == 1 && msg.command == "eval" && !isAgent()) //USOC-978	
	{
		//USOC-1083
		var checkCSP = true;
		dataScript= msg.script.split("usoextconfig=");
		if(dataScript[1]) {
	   		var usoextconfig = JSON.parse(dataScript[1].slice(0, -1));
			 if(!usoextconfig.DisableCSPChecking) 
				checkCSP = false;
		}
		else {
			checkCSP = true;
		}
		
		if (!isContentPolicyEnabled(checkCSP)){
			try
			{	if(dataScript[1] == null)
				{
					isContentPolicyEnabledFlag = null;
				}			
			
				evalScript(dataScript[0]);
			}
			catch(err)
			{ // for USO Agent	
				console.log(err);
			}
		}else{
			console.log('Content security policy is enabled. Cannot execute script: ', msg.script);
		}
        //window.postMessage(msg, "*"); // AM-5857 //usoc-978
	}
	else if (msg.type >= 0 && msg.type <= 4)
	{
	
		if (msg.func == "GetUsoVersion")
		{
			usoVersion = msg.return;
			document.cookie = "usoVersion=" + usoVersion;
		}		
		else if (msg.func == "GetSessionId")
		{
			usoSession = msg.return;
			if (msg.type == 0)
				document.cookie = "usoSession=" + usoSession;
			else if (msg.type == 3)
				document.cookie = "ucmSession=" + usoSession;
		}
		else if (msg.func == "getClientVersion")
			document.cookie = "ucmClientVersion=" + msg.return;
		else if (msg.func == "isUserActivityAvailable")
			document.cookie = "ucmClientUserActivityAvailable=" + msg.return;
		else
		{
			//console.log("Content: WebUI message -> %s", JSON.stringify(msg))
			window.postMessage(msg, "*");
		}
	}
}

function OnMessagePage(event)
{	
	if (event.source != window || !event.data.params)
		return;

	//console.log("Content: OnMessagePage -> %s", JSON.stringify(event.data))
	if (event.data.func == "GetUsoVersion")
	{
		if (usoVersion == "")
			port.postMessage({type:0, func: "GetUsoVersion", params: []});
	}
	else if (event.data.func == "GetSessionId")
	{
		if (usoSession == "")
			port.postMessage({type:event.data.type, func: "GetSessionId", params: []});
	}else if (event.data.func == "DoLogout")  { 
        if (usoVersion == "") //USOC 982
            port.postMessage({type:0, func: "DoLogout", params: []});		  	
    }
   	else
	{
		if(event.data!= null) {
		port.postMessage(event.data);	
		console.log("event.data", JSON.stringify(event.data));	
		}
	}		
}

function GetChromeVersion()
{
	return Number(navigator.appVersion.split("Chrome/")[1].split(".")[0]);
}

function connectContentPort()
{
	port = chrome.runtime.connect({name: "usoContentPort"});
	port.onMessage.addListener(OnMessageBackground);
}

function agentEvent()
{
	if (document.baseURI.indexOf('hytera.com') != -1
		||document.baseURI.indexOf('start.uso') != -1
		|| document.baseURI.indexOf('webui') != -1)
	{
		port.postMessage({type:0, func: "GetUsoVersion", params: []});
		port.postMessage({type:0, func: "GetSessionId", params: []});
		window.addEventListener("message", OnMessagePage, false);
	}
	else if (document.baseURI.indexOf('ucmanager') != -1 
	      || document.baseURI.indexOf('ucmweb') != -1) // AM-6384
	{
		console.log("UCM detected.");
		port.postMessage({type:3, func: "GetSessionId", params: []});
		window.addEventListener("message", OnMessagePage, false);		
	}
}

function contentMain()
{
	console.log("Chrome version is " + GetChromeVersion());
	document.cookie = "usoNativeHost=yes";
	
	if (GetChromeVersion() >= 34) // Native Messaging
	{
		//USOC-978
		//AM-11237: Use function instead of using variable
		if (isAgent())
		{	
			//AM-11237: add cookie to simplely detect usoClientExt installed
			let version = GetChromeVersion() + '_' +  new Date().getTime();
			document.cookie = 'usoClientExt=' + version +';path=/';
			//AM-11311
			var ChromeExtVer = chrome.runtime.getManifest().version + "_" + new Date().getTime();
			document.cookie = "ChromeExtM3="+ChromeExtVer+";path=/";


			connectContentPort();
			agentEvent();
		}
		else
			setTimeout(connectContentPort, 1000);
	}
	else // NPAPI
	{
		if (document.getElementById('embWebLauncher') == null )
		{
			if (navigator.mimeTypes["application/uso-weblauncher"])
			{
				document.body.insertAdjacentHTML('beforeEnd','<embed id="embWebLauncher" type="application/uso-weblauncher" height=0 width=0">');
				embWebLauncher.usoStart(); // ensure installed properly
			}
			else
				console.log("USO Web Launcher plugins is not installed yet!");
		}
	}
}

// call entry point
contentMain();
