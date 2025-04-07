chrome.storage.sync.get(['hiddenClasses', 'hiddenIds'], function (result) {
	const hiddenClasses = result.hiddenClasses || [];
	const hiddenIds = result.hiddenIds || [];
	applyHiddenClasses(hiddenClasses);
	applyHiddenIds(hiddenIds);

	// Set up MutationObserver to watch for DOM changes
	setupMutationObserver(hiddenClasses, hiddenIds);

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
						// Update observer with new list
						updateObserverTargets(storedClasses, null);
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
					// Update observer with new list
					updateObserverTargets(storedClasses, null);
				});
				sendResponse({ success: true, hiddenClasses: storedClasses });
			});
		} else if (request.action === 'hideId') {
			const id = request.id;
			hideElementById(id);

			// Add to stored hidden IDs if not already there
			chrome.storage.sync.get(['hiddenIds'], function (result) {
				const storedIds = result.hiddenIds || [];
				if (!storedIds.includes(id)) {
					storedIds.push(id);
					// Save updated list back to sync storage
					chrome.storage.sync.set({ hiddenIds: storedIds }, function () {
						console.log(`ID '${id}' hidden and saved to sync storage`);
						// Update observer with new list
						updateObserverTargets(null, storedIds);
					});
				}
				sendResponse({ success: true, hiddenIds: storedIds });
			});
		} else if (request.action === 'showId') {
			const id = request.id;
			showElementById(id);

			// Remove from stored hidden IDs
			chrome.storage.sync.get(['hiddenIds'], function (result) {
				let storedIds = result.hiddenIds || [];
				storedIds = storedIds.filter(i => i !== id);
				// Save updated list back to sync storage
				chrome.storage.sync.set({ hiddenIds: storedIds }, function () {
					console.log(`ID '${id}' restored and removed from sync storage`);
					// Update observer with new list
					updateObserverTargets(null, storedIds);
				});
				sendResponse({ success: true, hiddenIds: storedIds });
			});
		} else if (request.action === 'getClasses') {
			const allClasses = getAllClassesOnPage();
			sendResponse({ classes: allClasses });
		} else if (request.action === 'getIds') {
			const allIds = getAllIdsOnPage();
			sendResponse({ ids: allIds });
		} else if (request.action === 'getHiddenClasses') {
			chrome.storage.sync.get(['hiddenClasses'], function (result) {
				sendResponse({ hiddenClasses: result.hiddenClasses || [] });
			});
		} else if (request.action === 'getHiddenIds') {
			chrome.storage.sync.get(['hiddenIds'], function (result) {
				sendResponse({ hiddenIds: result.hiddenIds || [] });
			});
		} else if (request.action === 'previewClass') {
			highlightElementsByClassName(request.className);
			sendResponse({ success: true });
		} else if (request.action === 'previewId') {
			highlightElementById(request.id);
			sendResponse({ success: true });
		} else if (request.action === 'removePreview') {
			if (request.className) {
				removeHighlightFromElementsByClassName(request.className);
			}
			if (request.id) {
				removeHighlightFromElementById(request.id);
			}
			sendResponse({ success: true });
		}
		return true; // Keep the message channel open for async response
	});
});

// Global observer reference
let observer = null;
let currentHiddenClasses = [];
let currentHiddenIds = [];

function setupMutationObserver(hiddenClasses, hiddenIds) {
	// Store the current hidden elements lists
	currentHiddenClasses = hiddenClasses;
	currentHiddenIds = hiddenIds;

	// Create a new MutationObserver
	observer = new MutationObserver((mutations) => {
		let needsReapply = false;

		// Check if any mutations are relevant to our hidden elements
		for (const mutation of mutations) {
			// If nodes were added, they might need our hiding rules
			if (mutation.addedNodes.length > 0) {
				needsReapply = true;
				break;
			}

			// If attributes changed, check if it's a style attribute
			if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
				const element = mutation.target;

				// Check if this element should be hidden by class
				for (const className of currentHiddenClasses) {
					if (element.classList.contains(className) && element.style.display !== 'none') {
						needsReapply = true;
						break;
					}
				}

				// Check if this element should be hidden by id
				if (!needsReapply && currentHiddenIds.includes(element.id) && element.style.display !== 'none') {
					needsReapply = true;
				}

				if (needsReapply) break;
			}
		}

		// If we found relevant changes, reapply hiding
		if (needsReapply) {
			applyHiddenClasses(currentHiddenClasses);
			applyHiddenIds(currentHiddenIds);
		}
	});

	// Start observing the whole document with the configured parameters
	observer.observe(document.documentElement, {
		childList: true,      // Watch for changes in direct children
		subtree: true,        // Watch the entire subtree for changes
		attributes: true,     // Watch for changes to attributes
		attributeFilter: ['style', 'class']  // Only care about style and class changes
	});

	// Also reapply on any subsequent document loads (for SPAs, etc.)
	window.addEventListener('load', () => {
		applyHiddenClasses(currentHiddenClasses);
		applyHiddenIds(currentHiddenIds);
	});
}

function updateObserverTargets(hiddenClasses, hiddenIds) {
	// Update our stored lists of targets
	if (hiddenClasses !== null) {
		currentHiddenClasses = hiddenClasses;
	}
	if (hiddenIds !== null) {
		currentHiddenIds = hiddenIds;
	}

	// Immediately apply the current hiding rules
	applyHiddenClasses(currentHiddenClasses);
	applyHiddenIds(currentHiddenIds);
}

function applyHiddenClasses(classNames) {
	classNames.forEach(className => {
		hideElementsByClassName(className);
	});
}

function applyHiddenIds(ids) {
	ids.forEach(id => {
		hideElementById(id);
	});
}

function hideElementsByClassName(className) {
	const elements = document.getElementsByClassName(className);
	for (let i = 0; i < elements.length; i++) {
		elements[i].style.display = 'none';
		// Add a data attribute to mark this element as explicitly hidden by our extension
		elements[i].dataset.hiddenByExtension = 'true';
	}
}

function showElementsByClassName(className) {
	const elements = document.getElementsByClassName(className);
	for (let i = 0; i < elements.length; i++) {
		elements[i].style.display = '';
		// Remove our marker
		delete elements[i].dataset.hiddenByExtension;
	}
}

function hideElementById(id) {
	const element = document.getElementById(id);
	if (element) {
		element.style.display = 'none';
		// Add a data attribute to mark this element as explicitly hidden by our extension
		element.dataset.hiddenByExtension = 'true';
	}
}

function showElementById(id) {
	const element = document.getElementById(id);
	if (element) {
		element.style.display = '';
		// Remove our marker
		delete element.dataset.hiddenByExtension;
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

function getAllIdsOnPage() {
	// Get all elements on the page
	const allElements = document.querySelectorAll('[id]');
	const idSet = new Set();

	// Extract unique IDs
	for (let i = 0; i < allElements.length; i++) {
		if (allElements[i].id) {
			idSet.add(allElements[i].id);
		}
	}

	return Array.from(idSet);
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

function highlightElementById(id) {
	const element = document.getElementById(id);
	if (element) {
		// Save original styles
		if (!element.dataset.originalOutline) {
			element.dataset.originalOutline = element.style.outline;
			element.dataset.originalBackgroundColor = element.style.backgroundColor;
		}
		// Apply highlight styles
		element.style.outline = '2px solid #ff5722';
		element.style.backgroundColor = 'rgba(255, 87, 34, 0.2)';
	}
}

function removeHighlightFromElementById(id) {
	const element = document.getElementById(id);
	if (element) {
		// Restore original styles
		element.style.outline = element.dataset.originalOutline || '';
		element.style.backgroundColor = element.dataset.originalBackgroundColor || '';
	}
}
