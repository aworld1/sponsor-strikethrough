document.addEventListener("DOMContentLoaded", () => {
    const toggleStrikethrough = document.getElementById("toggleStrikethrough");
    const toggleOpacity = document.getElementById("toggleOpacity");
    const toggleRedBackground = document.getElementById("toggleRedBackground");
    const toggleHideSponsored = document.getElementById("toggleHideSponsored");

    const whitelistInput = document.getElementById("whitelistDomain");
    const addWhitelistBtn = document.getElementById("addWhitelistBtn");
    const whitelistListEl = document.getElementById("whitelistList");

    const donateBtn = document.getElementById("donateBtn");

    // 1) Load existing settings from storage
    chrome.storage.sync.get(
        {
            sponsorStrikethroughEnabled: true,
            reduceOpacityEnabled: true,
            redBackgroundEnabled: false,
            hideSponsoredEnabled: false,
            whitelistDomains: []
        },
        (data) => {
            toggleStrikethrough.checked = data.sponsorStrikethroughEnabled;
            toggleOpacity.checked = data.reduceOpacityEnabled;
            toggleRedBackground.checked = data.redBackgroundEnabled;
            toggleHideSponsored.checked = data.hideSponsoredEnabled;

            renderWhitelist(data.whitelistDomains || []);
        }
    );

    // 2) Toggle changes
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

    // 3) Whitelist management
    addWhitelistBtn.addEventListener("click", () => {
        const domain = whitelistInput.value.trim().toLowerCase();
        if (!domain) return;

        chrome.storage.sync.get({ whitelistDomains: [] }, (data) => {
            const list = data.whitelistDomains || [];
            if (!list.includes(domain)) {
                list.push(domain);
                chrome.storage.sync.set({ whitelistDomains: list }, () => {
                    whitelistInput.value = "";
                    renderWhitelist(list);
                });
            } else {
                alert("That domain is already whitelisted!");
            }
        });
    });

    function renderWhitelist(domains) {
        whitelistListEl.innerHTML = "";
        domains.forEach((domain) => {
            const li = document.createElement("li");
            const span = document.createElement("span");
            span.textContent = domain;

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "Remove";
            removeBtn.addEventListener("click", () => {
                removeDomain(domain);
            });

            li.appendChild(span);
            li.appendChild(removeBtn);
            whitelistListEl.appendChild(li);
        });
    }

    function removeDomain(domain) {
        chrome.storage.sync.get({ whitelistDomains: [] }, (data) => {
            let list = data.whitelistDomains || [];
            list = list.filter((item) => item !== domain);
            chrome.storage.sync.set({ whitelistDomains: list }, () => {
                renderWhitelist(list);
            });
        });
    }

    // 4) Donate
    donateBtn.addEventListener("click", () => {
        // Replace with your real link if desired
        const paypalLink = "https://www.paypal.com/donate/?business=SEJ22GD4GTHG4&no_recurring=0&item_name=Thank+you+for+supporting%21&currency_code=USD";
        chrome.tabs.create({ url: paypalLink });
    });
});
