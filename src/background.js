chrome.runtime.onInstalled.addListener(function () {
	console.log("Element Hider installed");

	// Initialize sync storage if needed
	chrome.storage.sync.get(['hiddenClasses'], function (result) {
		if (!result.hiddenClasses) {
			chrome.storage.sync.set({ hiddenClasses: [] });
		}
	});
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	// Handle any background processing here
	return true;
});
