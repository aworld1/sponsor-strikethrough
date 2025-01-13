// background.js (service worker)

chrome.runtime.onInstalled.addListener(() => {
    // Initialize total count if not present
    chrome.storage.sync.get({ totalAdsBlocked: 0 }, (data) => {
        if (typeof data.totalAdsBlocked !== "number") {
            chrome.storage.sync.set({ totalAdsBlocked: 0 });
        }
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "updateBadge") {
        // message.count => number of sponsored items on this page
        const pageCount = message.pageCount;

        // 1) Update the badge text (the extension icon in the toolbar)
        chrome.action.setBadgeText({ text: pageCount.toString() });
        // Optional: set the badge color (e.g., red)
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });

        // 2) Update total ads blocked
        // We increment our stored total by this page count.
        // But we must be careful not to double-add if the user reloads
        // repeatedly. For a simpler approach, we just sum them up.
        chrome.storage.sync.get({ totalAdsBlocked: 0 }, (data) => {
            const newTotal = data.totalAdsBlocked + pageCount;
            chrome.storage.sync.set({ totalAdsBlocked: newTotal });
            // Let content script know the new total
            sendResponse({ newTotal });
        });

        // Return true to indicate we’ll respond asynchronously
        return true;
    }

    // Other message types...
});
