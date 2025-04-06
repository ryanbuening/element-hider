document.addEventListener('DOMContentLoaded', function () {
	const classInput = document.getElementById('classInput');
	const hideBtn = document.getElementById('hideBtn');
	const classesDiv = document.getElementById('classes');
	let allClasses = [];
	let hiddenClasses = [];

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
	});

	// Filter classes as user types
	classInput.addEventListener('input', function () {
		const searchTerm = classInput.value.trim().toLowerCase();
		renderClassList(allClasses, searchTerm);
	});

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
							renderClassList(allClasses, classInput.value.trim().toLowerCase());
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

	// Hide button click handler
	hideBtn.addEventListener('click', function () {
		const className = classInput.value.trim();
		if (className) {
			chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, {
					action: 'hideClass',
					className: className
				}, function (response) {
					if (response && response.success) {
						// Update local hidden classes list
						hiddenClasses = response.hiddenClasses;
						// Clear input and refresh list
						classInput.value = '';
						renderClassList(allClasses, '');
					}
				});
			});
		}
	});

	// Add keyboard shortcut to hide class on Enter
	classInput.addEventListener('keypress', function (e) {
		if (e.key === 'Enter') {
			hideBtn.click();
		}
	});
});
