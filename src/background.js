chrome.runtime.onInstalled.addListener(function () {
	console.log("Element Hider installed");

	// Initialize sync storage if needed
	chrome.storage.sync.get(['hiddenClasses', 'hiddenIds'], function (result) {
		if (!result.hiddenClasses) {
			chrome.storage.sync.set({ hiddenClasses: [] });
		}
		if (!result.hiddenIds) {
			chrome.storage.sync.set({ hiddenIds: [] });
		}
	});
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	// Handle any background processing here
	return true;
});
