// Background Service Worker for Element Selector Extension

let userScriptsAvailable = false;

// Check and configure userScripts API on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Element Selector] Extension installed/updated:', details.reason);
  
  // Configure userScripts world for code execution
  await configureUserScripts();
});

// Also configure on service worker startup
configureUserScripts();

async function configureUserScripts() {
  // Check if userScripts API is available
  if (typeof chrome.userScripts === 'undefined') {
    console.warn('[Element Selector] chrome.userScripts API is not available. Code execution will be limited.');
    console.warn('[Element Selector] This may be because:');
    console.warn('  1. Chrome version is too old (requires Chrome 120+)');
    console.warn('  2. Developer mode is not enabled in chrome://extensions/');
    console.warn('  3. The userScripts permission was not granted');
    userScriptsAvailable = false;
    return false;
  }

  try {
    // Configure the USER_SCRIPT world with relaxed CSP to allow eval
    await chrome.userScripts.configureWorld({
      csp: "script-src 'self' 'unsafe-eval'",
      messaging: true
    });
    console.log('[Element Selector] userScripts world configured successfully');
    userScriptsAvailable = true;
    return true;
  } catch (error) {
    console.error('[Element Selector] Failed to configure userScripts world:', error);
    userScriptsAvailable = false;
    return false;
  }
}

// Check if userScripts permission is available
async function checkUserScriptsPermission() {
  if (typeof chrome.userScripts === 'undefined') {
    return { available: false, reason: 'chrome.userScripts API not available. Make sure Developer mode is enabled in chrome://extensions/' };
  }
  
  try {
    // Try to get registered scripts to verify API is working
    await chrome.userScripts.getScripts();
    return { available: true };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

// Execute code in the context of a tab
async function executeUserCode(tabId, code) {
  try {
    // Execute using scripting API in MAIN world (page context)
    // This allows access to the page's DOM and JavaScript context
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (codeToRun) => {
        try {
          // Use Function constructor as an alternative to eval
          // This works in MAIN world context
          const fn = new Function('return (' + codeToRun + ')');
          const result = fn();
          return { success: true, result: result };
        } catch (error) {
          return { success: false, error: error.message, stack: error.stack };
        }
      },
      args: [code],
      world: 'MAIN'  // Execute in the main world to access page's DOM
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    
    return { success: true, result: undefined };

  } catch (error) {
    console.error('[Element Selector] executeUserCode error:', error);
    throw error;
  }
}

// Relay messages between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STATE_UPDATE') {
    // Forward state updates to popup if it's open
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup might be closed, ignore error
    });
    return true;
  }
  
  if (message.type === 'CHECK_USERSCRIPTS') {
    checkUserScriptsPermission().then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'EXECUTE_CODE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID available' });
      return true;
    }
    
    executeUserCode(tabId, message.code)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep channel open for async response
  }
  
  return true;
});

// Handle keyboard shortcut (optional)
chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'toggle-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SELECTION' });
      }
    });
  }
});
