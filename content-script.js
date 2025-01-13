(function () {
    // Ad-related keywords
    const sponsoredKeywords = [
        "ad", "ads", "sponsored", "promo", "promoted",
        "annonce", "annuncio", "anuncio",
        "anzeigen", "werbung",
        "sponsorizzato", "sponsorizado",
        "gesponsord",
        "広告",     // Japanese
        "реклама", // Russian
        "reklama"
    ];

    // Ad container selectors
    const adSelectors = [
        "[data-text-ad]",
        ".uEierd",
        ".b_ad", ".b_adurl", ".ads",
        ".compAd", "[data-adblock='true']",
        ".sponsored", ".promotedLink", ".promoted-tweet"
    ];

    let isStrikethroughEnabled = true;
    let isOpacityEnabled = true;
    let isRedBackgroundEnabled = false;
    let isHideSponsoredEnabled = false;
    let whitelistDomains = [];
    let foundOnPage = 0;

    /**
     * We only run on known search pages (Google, Bing, Yahoo, DuckDuckGo).
     * If you prefer enumerating in the manifest, you can remove this check.
     */
    function isSearchPage() {
        const url = window.location.href.toLowerCase();
        return (
            (url.includes("google.") && url.includes("/search?")) ||
            url.includes("bing.com/search?") ||
            url.includes("search.yahoo.com/search?") ||
            url.includes("duckduckgo.com/?")
        );
    }

    /**
     * Check if an element text is one of our "ad" or "sponsored" keywords.
     */
    function isSponsoredLabel(el) {
        if (!el || !el.innerText) return false;
        const text = el.innerText.trim().toLowerCase();
        return sponsoredKeywords.includes(text);
    }

    /**
     * Determine if this element is part of a *dictionary definition* (for Google, etc.).
     * If so, we skip marking it as an ad.
     */
    function isDictionaryDefinition(el) {
        // For Google, many dictionary definitions appear within .lr_container
        // or data-attrid="DictionaryHeader" or other containers like .vkc_np. 
        // We'll do a simple check for .lr_container (Google) 
        // You can add more checks if needed for Bing (e.g., .b_dict, etc.).
        return !!(
            el.closest(".lr_container") ||
            el.closest("[data-attrid='DictionaryHeader']") ||
            el.closest(".vkc_np.kkww4d.eawCAd.PZPZlf")
        );
    }

    /**
     * Mark the entire container (except the literal "Sponsored" label) with classes.
     */
    function markContainerAsSponsored(container) {
        if (!container.hasAttribute("data-ss-counted")) {
            container.setAttribute("data-ss-counted", "true");
            foundOnPage++;
        }
        if (!container.hasAttribute("aria-label")) {
            container.setAttribute("aria-label", "Sponsored link");
        }

        // Hide or style
        if (isHideSponsoredEnabled) {
            container.classList.add("sponsor-hidden");
            return;
        }
        if (isStrikethroughEnabled) container.classList.add("sponsor-strikethrough");
        if (isOpacityEnabled) container.classList.add("reduced-opacity");
        if (isRedBackgroundEnabled) container.classList.add("red-background");

        // Apply to children, except if they're the exact "Sponsored" label
        container.querySelectorAll("*").forEach((child) => {
            if (!isSponsoredLabel(child)) {
                if (isStrikethroughEnabled) child.classList.add("sponsor-strikethrough");
                if (isOpacityEnabled) child.classList.add("reduced-opacity");
                if (isRedBackgroundEnabled) child.classList.add("red-background");
            }
        });
    }

    /**
     * If we see a "Sponsored" label, find the parent ad container and mark it.
     * But skip if we're in a dictionary definition context.
     */
    function markAsSponsoredByLabel(labelEl) {
        // If this is in a dictionary definition, skip
        if (isDictionaryDefinition(labelEl)) {
            return;
        }

        // Attempt to find a known ad container or fallback to a bigger element
        const container =
            labelEl.closest("[data-text-ad], .uEierd") ||
            labelEl.closest("div") ||
            labelEl.closest("a");

        if (container && container !== labelEl) {
            markContainerAsSponsored(container);
        } else {
            // If no container, at least count it once (but don't style the label)
            if (!labelEl.hasAttribute("data-ss-counted")) {
                labelEl.setAttribute("data-ss-counted", "true");
                foundOnPage++;
            }
        }
    }

    /**
     * Scan a DOM subtree for sponsored elements.
     */
    function scanSponsored(root) {
        if (!root) return;

        // 1) Text-based detection
        const textEls = root.querySelectorAll("span, div, a, h3, strong, b, i, p");
        textEls.forEach((el) => {
            if (isSponsoredLabel(el)) {
                markAsSponsoredByLabel(el);
            }
        });

        // 2) Container-based detection
        adSelectors.forEach((selector) => {
            const matches = root.querySelectorAll(selector);
            matches.forEach((adEl) => {
                // If it's a dictionary definition or literally a label, skip
                if (isDictionaryDefinition(adEl) || isSponsoredLabel(adEl)) {
                    return;
                }
                markContainerAsSponsored(adEl);
            });
        });
    }

    function removeAllSponsorStyling() {
        foundOnPage = 0;
        const elements = document.querySelectorAll(
            ".sponsor-strikethrough, .reduced-opacity, .red-background, .sponsor-hidden, [data-ss-counted]"
        );
        elements.forEach((el) => {
            el.classList.remove(
                "sponsor-strikethrough",
                "reduced-opacity",
                "red-background",
                "sponsor-hidden"
            );
            el.removeAttribute("data-ss-counted");
            if (el.getAttribute("aria-label") === "Sponsored link") {
                el.removeAttribute("aria-label");
            }
        });
    }

    function updateBadge() {
        // Optional: if you have a background.js that updates a badge
        chrome.runtime.sendMessage({ type: "updateBadge", pageCount: foundOnPage });
    }

    function shouldRunOnDomain() {
        const domain = window.location.hostname.toLowerCase();
        // If domain is whitelisted
        return !whitelistDomains.some((d) => domain.endsWith(d));
    }

    function reapply() {
        removeAllSponsorStyling();
        if (!shouldRunOnDomain()) return;
        if (!isSearchPage()) return;
        scanSponsored(document);
        updateBadge();
    }

    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            let changed = false;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        scanSponsored(node);
                        changed = true;
                    }
                });
            });
            if (changed) updateBadge();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        chrome.storage.sync.get(
            {
                sponsorStrikethroughEnabled: true,
                reduceOpacityEnabled: true,
                redBackgroundEnabled: false,
                hideSponsoredEnabled: false,
                whitelistDomains: []
            },
            (data) => {
                isStrikethroughEnabled = data.sponsorStrikethroughEnabled;
                isOpacityEnabled = data.reduceOpacityEnabled;
                isRedBackgroundEnabled = data.redBackgroundEnabled;
                isHideSponsoredEnabled = data.hideSponsoredEnabled;
                whitelistDomains = data.whitelistDomains || [];

                if (!shouldRunOnDomain()) return;
                if (!isSearchPage()) return;

                scanSponsored(document);
                updateBadge();
                setupObserver();
            }
        );

        // Listen for toggles/whitelist changes
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "sync") {
                let changedSomething = false;
                if (changes.sponsorStrikethroughEnabled) {
                    isStrikethroughEnabled = changes.sponsorStrikethroughEnabled.newValue;
                    changedSomething = true;
                }
                if (changes.reduceOpacityEnabled) {
                    isOpacityEnabled = changes.reduceOpacityEnabled.newValue;
                    changedSomething = true;
                }
                if (changes.redBackgroundEnabled) {
                    isRedBackgroundEnabled = changes.redBackgroundEnabled.newValue;
                    changedSomething = true;
                }
                if (changes.hideSponsoredEnabled) {
                    isHideSponsoredEnabled = changes.hideSponsoredEnabled.newValue;
                    changedSomething = true;
                }
                if (changes.whitelistDomains) {
                    whitelistDomains = changes.whitelistDomains.newValue;
                    changedSomething = true;
                }
                if (changedSomething) {
                    reapply();
                }
            }
        });
    }

    init();
})();
