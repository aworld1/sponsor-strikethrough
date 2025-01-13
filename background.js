chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "updateBadge") {
        const pageCount = message.pageCount || 0;
        // e.g. show the count on the extension icon
        chrome.action.setBadgeText({ text: pageCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    }
});
