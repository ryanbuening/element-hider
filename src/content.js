chrome.storage.sync.get(['hiddenClasses'], function (result) {
	const hiddenClasses = result.hiddenClasses || [];
	applyHiddenClasses(hiddenClasses);

	// Listen for messages from popup or service worker
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request.action === 'hideClass') {
			const className = request.className;
			hideElementsByClassName(className);

			// Add to stored hidden classes if not already there
			chrome.storage.sync.get(['hiddenClasses'], function (result) {
				const storedClasses = result.hiddenClasses || [];
				if (!storedClasses.includes(className)) {
					storedClasses.push(className);
					// Save updated list back to sync storage
					chrome.storage.sync.set({ hiddenClasses: storedClasses }, function () {
						console.log(`Class '${className}' hidden and saved to sync storage`);
					});
				}
				sendResponse({ success: true, hiddenClasses: storedClasses });
			});
		} else if (request.action === 'showClass') {
			const className = request.className;
			showElementsByClassName(className);

			// Remove from stored hidden classes
			chrome.storage.sync.get(['hiddenClasses'], function (result) {
				let storedClasses = result.hiddenClasses || [];
				storedClasses = storedClasses.filter(c => c !== className);
				// Save updated list back to sync storage
				chrome.storage.sync.set({ hiddenClasses: storedClasses }, function () {
					console.log(`Class '${className}' restored and removed from sync storage`);
				});
				sendResponse({ success: true, hiddenClasses: storedClasses });
			});
		} else if (request.action === 'getClasses') {
			const allClasses = getAllClassesOnPage();
			sendResponse({ classes: allClasses });
		} else if (request.action === 'getHiddenClasses') {
			chrome.storage.sync.get(['hiddenClasses'], function (result) {
				sendResponse({ hiddenClasses: result.hiddenClasses || [] });
			});
		} else if (request.action === 'previewClass') {
			highlightElementsByClassName(request.className);
			sendResponse({ success: true });
		} else if (request.action === 'removePreview') {
			removeHighlightFromElementsByClassName(request.className);
			sendResponse({ success: true });
		}
		return true; // Keep the message channel open for async response
	});
});

function applyHiddenClasses(classNames) {
	classNames.forEach(className => {
		hideElementsByClassName(className);
	});
}

function hideElementsByClassName(className) {
	const elements = document.getElementsByClassName(className);
	for (let i = 0; i < elements.length; i++) {
		elements[i].style.display = 'none';
	}
}

function showElementsByClassName(className) {
	const elements = document.getElementsByClassName(className);
	for (let i = 0; i < elements.length; i++) {
		elements[i].style.display = '';
	}
}

function getAllClassesOnPage() {
	// Get all elements on the page
	const allElements = document.querySelectorAll('*');
	const classSet = new Set();

	// Extract unique class names
	for (let i = 0; i < allElements.length; i++) {
		const classes = allElements[i].classList;
		for (let j = 0; j < classes.length; j++) {
			classSet.add(classes[j]);
		}
	}

	return Array.from(classSet);
}

function highlightElementsByClassName(className) {
	const elements = document.getElementsByClassName(className);
	for (let i = 0; i < elements.length; i++) {
		// Save original styles
		if (!elements[i].dataset.originalOutline) {
			elements[i].dataset.originalOutline = elements[i].style.outline;
			elements[i].dataset.originalBackgroundColor = elements[i].style.backgroundColor;
		}
		// Apply highlight styles
		elements[i].style.outline = '2px solid #ff5722';
		elements[i].style.backgroundColor = 'rgba(255, 87, 34, 0.2)';
	}
}

function removeHighlightFromElementsByClassName(className) {
	const elements = document.getElementsByClassName(className);
	for (let i = 0; i < elements.length; i++) {
		// Restore original styles
		elements[i].style.outline = elements[i].dataset.originalOutline || '';
		elements[i].style.backgroundColor = elements[i].dataset.originalBackgroundColor || '';
	}
}
