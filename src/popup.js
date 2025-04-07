document.addEventListener('DOMContentLoaded', function () {
	const elementInput = document.getElementById('classInput'); // Keeping same ID for compatibility
	const hideBtn = document.getElementById('hideBtn');
	const classesDiv = document.getElementById('classes');
	const tabsContainer = document.getElementById('tabs') || createTabsContainer();

	let allClasses = [];
	let allIds = [];
	let hiddenClasses = [];
	let hiddenIds = [];
	let activeTab = 'classes'; // Default to classes tab

	// Create tabs if they don't exist
	function createTabsContainer() {
		// Create tabs container
		const container = document.createElement('div');
		container.id = 'tabs';
		container.className = 'tabs-container';

		// Insert before the input
		document.body.insertBefore(container, elementInput.parentElement);
		return container;
	}

	// Set up tabs
	setupTabs();

	// Get current tab
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		const tab = tabs[0];

		// Get all classes on the page
		chrome.tabs.sendMessage(tab.id, { action: 'getClasses' }, function (response) {
			if (response && response.classes) {
				allClasses = response.classes.sort();

				// Get hidden classes
				chrome.tabs.sendMessage(tab.id, { action: 'getHiddenClasses' }, function (hiddenResponse) {
					hiddenClasses = hiddenResponse.hiddenClasses || [];
					renderClassList(allClasses, ''); // Initial render with all classes
				});
			}
		});

		// Get all IDs on the page
		chrome.tabs.sendMessage(tab.id, { action: 'getIds' }, function (response) {
			if (response && response.ids) {
				allIds = response.ids.sort();

				// Get hidden IDs
				chrome.tabs.sendMessage(tab.id, { action: 'getHiddenIds' }, function (hiddenResponse) {
					hiddenIds = hiddenResponse.hiddenIds || [];
				});
			}
		});
	});

	// Filter elements as user types
	elementInput.addEventListener('input', function () {
		const searchTerm = elementInput.value.trim().toLowerCase();
		if (activeTab === 'classes') {
			renderClassList(allClasses, searchTerm);
		} else {
			renderIdList(allIds, searchTerm);
		}
	});

	// Setup tabs functionality
	function setupTabs() {
		tabsContainer.innerHTML = `
			<div class="tab active" data-tab="classes">Classes</div>
			<div class="tab" data-tab="ids">IDs</div>
		`;

		// Add event listeners to tabs
		const tabs = tabsContainer.querySelectorAll('.tab');
		tabs.forEach(tab => {
			tab.addEventListener('click', function () {
				// Remove active class from all tabs
				tabs.forEach(t => t.classList.remove('active'));

				// Add active class to clicked tab
				this.classList.add('active');

				// Set active tab
				activeTab = this.dataset.tab;

				// Clear input field
				elementInput.value = '';

				// Update placeholder text
				if (activeTab === 'classes') {
					elementInput.placeholder = 'Enter class name';
					renderClassList(allClasses, '');
				} else {
					elementInput.placeholder = 'Enter element ID';
					renderIdList(allIds, '');
				}
			});
		});
	}

	// Function to render the filtered class list
	function renderClassList(classes, searchTerm) {
		// Clear current list
		classesDiv.innerHTML = '';

		// Filter classes by search term
		const filteredClasses = classes.filter(className =>
			className.toLowerCase().includes(searchTerm)
		);

		// Show message if no results
		if (filteredClasses.length === 0) {
			const noResults = document.createElement('div');
			noResults.textContent = searchTerm ? 'No matching classes found' : 'No classes found on this page';
			classesDiv.appendChild(noResults);
			return;
		}

		// Current tab id for sending messages
		let currentTabId;
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			currentTabId = tabs[0].id;
		});

		// Sort classes - hidden classes at the top
		const sortedClasses = [...filteredClasses].sort((a, b) => {
			const aHidden = hiddenClasses.includes(a);
			const bHidden = hiddenClasses.includes(b);

			if (aHidden && !bHidden) return -1;
			if (!aHidden && bHidden) return 1;
			return a.localeCompare(b);
		});

		// Add header for hidden classes section if there are any hidden classes
		let hiddenClassesHeader = false;
		let visibleClassesHeader = false;

		// Display sorted classes
		sortedClasses.forEach(className => {
			const isHidden = hiddenClasses.includes(className);

			// Add section headers
			if (isHidden && !hiddenClassesHeader) {
				const header = document.createElement('h5');
				header.textContent = 'Hidden Classes';
				header.style.marginTop = '5px';
				header.style.marginBottom = '5px';
				header.style.borderBottom = '1px solid #ccc';
				classesDiv.appendChild(header);
				hiddenClassesHeader = true;
			} else if (!isHidden && !visibleClassesHeader && hiddenClassesHeader) {
				const header = document.createElement('h5');
				header.textContent = 'Available Classes';
				header.style.marginTop = '15px';
				header.style.marginBottom = '5px';
				header.style.borderBottom = '1px solid #ccc';
				classesDiv.appendChild(header);
				visibleClassesHeader = true;
			}

			const classItem = document.createElement('div');
			classItem.className = 'class-item' + (isHidden ? ' hidden-class' : '');

			const nameSpan = document.createElement('span');

			// Highlight the matching part of the class name
			if (searchTerm) {
				const index = className.toLowerCase().indexOf(searchTerm.toLowerCase());
				if (index >= 0) {
					const beforeMatch = className.substring(0, index);
					const match = className.substring(index, index + searchTerm.length);
					const afterMatch = className.substring(index + searchTerm.length);

					nameSpan.innerHTML = beforeMatch + '<strong>' + match + '</strong>' + afterMatch;
				} else {
					nameSpan.textContent = className;
				}
			} else {
				nameSpan.textContent = className;
			}

			classItem.appendChild(nameSpan);

			const actionBtn = document.createElement('button');
			actionBtn.textContent = isHidden ? 'Show' : 'Hide';
			actionBtn.onclick = function () {
				chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
					const action = isHidden ? 'showClass' : 'hideClass';
					chrome.tabs.sendMessage(tabs[0].id, {
						action: action,
						className: className
					}, function (response) {
						if (response && response.success) {
							// Update local hidden classes list
							hiddenClasses = response.hiddenClasses;
							// Refresh the current view without full reload
							renderClassList(allClasses, elementInput.value.trim().toLowerCase());
						}
					});
				});
			};
			classItem.appendChild(actionBtn);

			// Add hover effects for preview
			classItem.addEventListener('mouseenter', function () {
				if (currentTabId) {
					chrome.tabs.sendMessage(currentTabId, {
						action: 'previewClass',
						className: className
					});
				}
			});

			classItem.addEventListener('mouseleave', function () {
				if (currentTabId) {
					chrome.tabs.sendMessage(currentTabId, {
						action: 'removePreview',
						className: className
					});
				}
			});

			classesDiv.appendChild(classItem);
		});
	}

	// Function to render the filtered ID list
	function renderIdList(ids, searchTerm) {
		// Clear current list
		classesDiv.innerHTML = '';

		// Filter IDs by search term
		const filteredIds = ids.filter(id =>
			id.toLowerCase().includes(searchTerm)
		);

		// Show message if no results
		if (filteredIds.length === 0) {
			const noResults = document.createElement('div');
			noResults.textContent = searchTerm ? 'No matching IDs found' : 'No IDs found on this page';
			classesDiv.appendChild(noResults);
			return;
		}

		// Current tab id for sending messages
		let currentTabId;
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			currentTabId = tabs[0].id;
		});

		// Sort IDs - hidden IDs at the top
		const sortedIds = [...filteredIds].sort((a, b) => {
			const aHidden = hiddenIds.includes(a);
			const bHidden = hiddenIds.includes(b);

			if (aHidden && !bHidden) return -1;
			if (!aHidden && bHidden) return 1;
			return a.localeCompare(b);
		});

		// Add header for hidden IDs section if there are any hidden IDs
		let hiddenIdsHeader = false;
		let visibleIdsHeader = false;

		// Display sorted IDs
		sortedIds.forEach(id => {
			const isHidden = hiddenIds.includes(id);

			// Add section headers
			if (isHidden && !hiddenIdsHeader) {
				const header = document.createElement('h5');
				header.textContent = 'Hidden IDs';
				header.style.marginTop = '5px';
				header.style.marginBottom = '5px';
				header.style.borderBottom = '1px solid #ccc';
				classesDiv.appendChild(header);
				hiddenIdsHeader = true;
			} else if (!isHidden && !visibleIdsHeader && hiddenIdsHeader) {
				const header = document.createElement('h5');
				header.textContent = 'Available IDs';
				header.style.marginTop = '15px';
				header.style.marginBottom = '5px';
				header.style.borderBottom = '1px solid #ccc';
				classesDiv.appendChild(header);
				visibleIdsHeader = true;
			}

			const idItem = document.createElement('div');
			idItem.className = 'class-item' + (isHidden ? ' hidden-class' : ''); // Reusing same CSS class

			const nameSpan = document.createElement('span');

			// Highlight the matching part of the ID
			if (searchTerm) {
				const index = id.toLowerCase().indexOf(searchTerm.toLowerCase());
				if (index >= 0) {
					const beforeMatch = id.substring(0, index);
					const match = id.substring(index, index + searchTerm.length);
					const afterMatch = id.substring(index + searchTerm.length);

					nameSpan.innerHTML = beforeMatch + '<strong>' + match + '</strong>' + afterMatch;
				} else {
					nameSpan.textContent = id;
				}
			} else {
				nameSpan.textContent = id;
			}

			idItem.appendChild(nameSpan);

			const actionBtn = document.createElement('button');
			actionBtn.textContent = isHidden ? 'Show' : 'Hide';
			actionBtn.onclick = function () {
				chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
					const action = isHidden ? 'showId' : 'hideId';
					chrome.tabs.sendMessage(tabs[0].id, {
						action: action,
						id: id
					}, function (response) {
						if (response && response.success) {
							// Update local hidden IDs list
							hiddenIds = response.hiddenIds;
							// Refresh the current view without full reload
							renderIdList(allIds, elementInput.value.trim().toLowerCase());
						}
					});
				});
			};
			idItem.appendChild(actionBtn);

			// Add hover effects for preview
			idItem.addEventListener('mouseenter', function () {
				if (currentTabId) {
					chrome.tabs.sendMessage(currentTabId, {
						action: 'previewId',
						id: id
					});
				}
			});

			idItem.addEventListener('mouseleave', function () {
				if (currentTabId) {
					chrome.tabs.sendMessage(currentTabId, {
						action: 'removePreview',
						id: id
					});
				}
			});

			classesDiv.appendChild(idItem);
		});
	}

	// Hide button click handler
	hideBtn.addEventListener('click', function () {
		const value = elementInput.value.trim();
		if (value) {
			chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
				const action = activeTab === 'classes' ? 'hideClass' : 'hideId';
				const payload = activeTab === 'classes' ? { className: value } : { id: value };

				chrome.tabs.sendMessage(tabs[0].id, {
					action: action,
					...payload
				}, function (response) {
					if (response && response.success) {
						// Update local hidden elements list
						if (activeTab === 'classes') {
							hiddenClasses = response.hiddenClasses;
							renderClassList(allClasses, '');
						} else {
							hiddenIds = response.hiddenIds;
							renderIdList(allIds, '');
						}
						// Clear input
						elementInput.value = '';
					}
				});
			});
		}
	});

	// Add keyboard shortcut to hide element on Enter
	elementInput.addEventListener('keypress', function (e) {
		if (e.key === 'Enter') {
			hideBtn.click();
		}
	});
});
