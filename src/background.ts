// Initialize state on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeBackgroundColor({ color: '#933EC5' });
    chrome.storage.local.get(['preventedDuplicatesCount', 'active'], (result) => {
        if (result.preventedDuplicatesCount === undefined) {
            chrome.storage.local.set({ preventedDuplicatesCount: 0 });
        }
        if (result.active === undefined) {
            chrome.storage.local.set({ active: true });
        }
        updateBadge();
    });
});

// Also set background color on startup just in case (service worker wake up)
chrome.action.setBadgeBackgroundColor({ color: '#933EC5' });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TurnOnOff') {
        chrome.storage.local.get(['active'], (result) => {
            const newState = !result.active;
            chrome.storage.local.set({ active: newState }, () => {
                updateBadge();
            });
        });
    } else if (request.action === 'Deduplicate') {
        chrome.tabs.query({}, (tabs) => {
            const alreadyEncounteredTabUrls = new Set<string>();
            let duplicatesToRemove: number[] = [];
            let countIncrement = 0;

            tabs.forEach((tab) => {
                if (tab.url && alreadyEncounteredTabUrls.has(tab.url)) {
                    if (tab.id) duplicatesToRemove.push(tab.id);
                    countIncrement++;
                } else if (tab.url) {
                    alreadyEncounteredTabUrls.add(tab.url);
                }
            });

            if (duplicatesToRemove.length > 0) {
                chrome.tabs.remove(duplicatesToRemove);
                chrome.storage.local.get(['preventedDuplicatesCount'], (result) => {
                    const currentCount = result.preventedDuplicatesCount || 0;
                    chrome.storage.local.set({ preventedDuplicatesCount: currentCount + countIncrement }, () => {
                        updateBadge();
                    });
                });
            }
        });
    }
});

chrome.tabs.onCreated.addListener((newTab) => {
    if (newTab.url) {
        checkActiveAndDeduplicate(newTab.id, newTab.url);
    }
});

chrome.tabs.onUpdated.addListener((updatedTabId, updateInfo, updatedTab) => {
    if (updateInfo.url) {
        checkActiveAndDeduplicate(updatedTabId, updateInfo.url);
    }
});

function checkActiveAndDeduplicate(currentTabId: number | undefined, currentTabUrl: string) {
    if (!currentTabId) return;

    chrome.storage.local.get(['active', 'exclusionRegexes'], (result) => {
        const isActive = result.active !== false;
        if (!isActive) return;

        // Check exclusions
        if (result.exclusionRegexes && Array.isArray(result.exclusionRegexes)) {
            for (const regexStr of result.exclusionRegexes) {
                try {
                    const regex = new RegExp(regexStr);
                    if (regex.test(currentTabUrl)) {
                        // Matches exclusion, allows duplicate
                        return;
                    }
                } catch (e) {
                    console.error('Invalid regex in storage:', regexStr, e);
                }
            }
        }

        verifyAndDeduplicate(currentTabId, currentTabUrl);
    });
}

function verifyAndDeduplicate(currentTabId: number, currentTabUrl: string) {
    chrome.tabs.query({}, (tabs) => {
        let duplicateTab = null;
        for (const otherTab of tabs) {
            if (otherTab.id !== currentTabId && otherTab.url === currentTabUrl) {
                duplicateTab = otherTab;
                break;
            }
        }

        if (duplicateTab && duplicateTab.id && duplicateTab.windowId) {
            chrome.tabs.update(duplicateTab.id, { active: true });
            chrome.windows.update(duplicateTab.windowId, { focused: true });
            chrome.tabs.reload(duplicateTab.id);
            chrome.tabs.remove(currentTabId);

            chrome.storage.local.get(['preventedDuplicatesCount'], (result) => {
                const currentCount = result.preventedDuplicatesCount || 0;
                chrome.storage.local.set({ preventedDuplicatesCount: currentCount + 1 }, () => {
                    updateBadge();
                });
            });
        }
    });
}

function updateBadge() {
    chrome.storage.local.get(['preventedDuplicatesCount', 'active'], (result) => {
        const count = result.preventedDuplicatesCount || 0;
        const isActive = result.active !== false;

        const text = isActive ? (count > 0 ? `${count}` : '') : 'OFF';
        chrome.action.setBadgeText({ text: text });
    });
}
