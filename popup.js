document.addEventListener("DOMContentLoaded", () => {
    const toggleStrikethrough = document.getElementById("toggleStrikethrough");
    const toggleOpacity = document.getElementById("toggleOpacity");
    const toggleRedBackground = document.getElementById("toggleRedBackground");
    const toggleHideSponsored = document.getElementById("toggleHideSponsored");

    const pageCountEl = document.getElementById("pageCount");
    const totalCountEl = document.getElementById("totalCount");

    const donateBtn = document.getElementById("donateBtn");

    // 1) Load toggles from storage
    chrome.storage.sync.get(
        {
            sponsorStrikethroughEnabled: true,
            reduceOpacityEnabled: true,
            redBackgroundEnabled: false,
            hideSponsoredEnabled: false,
            totalAdsBlocked: 0
        },
        (data) => {
            toggleStrikethrough.checked = data.sponsorStrikethroughEnabled;
            toggleOpacity.checked = data.reduceOpacityEnabled;
            toggleRedBackground.checked = data.redBackgroundEnabled;
            toggleHideSponsored.checked = data.hideSponsoredEnabled;
            totalCountEl.textContent = data.totalAdsBlocked || 0;
        }
    );

    // 2) Get the current "on this page" badge text
    chrome.action.getBadgeText({}, (text) => {
        // If no text or not a number, default to 0
        pageCountEl.textContent = text && !isNaN(parseInt(text)) ? text : "0";
    });

    // 3) Save changes when toggles are flipped
    toggleStrikethrough.addEventListener("change", () => {
        chrome.storage.sync.set({
            sponsorStrikethroughEnabled: toggleStrikethrough.checked
        });
    });
    toggleOpacity.addEventListener("change", () => {
        chrome.storage.sync.set({
            reduceOpacityEnabled: toggleOpacity.checked
        });
    });
    toggleRedBackground.addEventListener("change", () => {
        chrome.storage.sync.set({
            redBackgroundEnabled: toggleRedBackground.checked
        });
    });
    toggleHideSponsored.addEventListener("change", () => {
        chrome.storage.sync.set({
            hideSponsoredEnabled: toggleHideSponsored.checked
        });
    });

    // 4) Donation link
    donateBtn.addEventListener("click", () => {
        // Your PayPal link
        const paypalLink = "https://www.paypal.com/donate/?business=SEJ22GD4GTHG4&no_recurring=0&item_name=Thank+you+for+supporting%21&currency_code=USD";
        chrome.tabs.create({ url: paypalLink });
    });

    // 5) Watch for changes to total ads blocked so we can update the popup “in total” text
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "sync" && changes.totalAdsBlocked) {
            totalCountEl.textContent = changes.totalAdsBlocked.newValue;
        }
    });
});
