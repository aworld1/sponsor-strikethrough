(function () {

    // 1) Immediately check if we're on a recognized search page:
    const url = window.location.href.toLowerCase();
    
    const isGoogleSearch = url.includes("google.") && url.includes("/search?");
    const isBingSearch   = url.includes("bing.com/search?");
    const isYahooSearch  = url.includes("search.yahoo.com/search?");
    const isDuckSearch   = url.includes("duckduckgo.com/?");
    
    // 2) If this page is NOT one of those search result URLs, bail out:
    if (!(isGoogleSearch || isBingSearch || isYahooSearch || isDuckSearch)) {
        return;
    }

    // Ad-related keywords (expand as needed)
    const sponsoredKeywords = [
        "ad", "ads", "sponsored",
        "annonce", "annuncio", "anuncio",
        "anzeigen", "werbung",
        "sponsorizzato", "sponsorizado",
        "gesponsord",
        "広告",   // Japanese
        "реклама" // Russian
    ];

    // Toggled settings
    let isStrikethroughEnabled = true;
    let isOpacityEnabled = true;
    let isRedBackgroundEnabled = false;
    let isHideSponsoredEnabled = false;

    // Count how many sponsored *containers* we find on this page
    let foundOnPage = 0;

    // DOM selectors for potential ad containers across multiple search engines
    const adSelectors = [
        // Google
        "[data-text-ad]", ".uEierd",
        // Bing
        ".b_ad", ".b_adurl", ".ads",
        // Yahoo
        ".compAd", "[data-adblock='true']",
        // DuckDuckGo
        // (some dynamic selectors or ephemeral classes might need updating)
    ];

    /**
     * Determine if the element is exactly a "Sponsored"/"Ad" label (rather than the container).
     */
    function isSponsoredLabel(el) {
        if (!el || !el.innerText) return false;
        const text = el.innerText.trim().toLowerCase();
        return sponsoredKeywords.includes(text);
    }

    /**
     * Apply the relevant sponsor classes (or hide) to the container.
     * - If `isHideSponsoredEnabled`, we simply `.sponsor-hidden`.
     * - Otherwise, we apply whichever highlight classes are enabled.
     */
    function applySponsorClasses(container) {
        if (isHideSponsoredEnabled) {
            container.classList.add("sponsor-hidden");
            return;
        }
        // If not hiding, apply style toggles
        if (isStrikethroughEnabled) container.classList.add("sponsor-strikethrough");
        if (isOpacityEnabled) container.classList.add("reduced-opacity");
        if (isRedBackgroundEnabled) container.classList.add("red-background");
    }

    /**
     * Mark the container of a found "Sponsored" label or known ad block.
     * - We only increment `foundOnPage` once per container by checking a custom attribute.
     */
    function markContainerAsSponsored(container) {
        // If we haven't counted this container yet, increment once
        if (!container.hasAttribute("data-ss-counted")) {
            container.setAttribute("data-ss-counted", "true");
            foundOnPage++;
        }

        // If user wants an accessible label, add it
        if (!container.hasAttribute("aria-label")) {
            container.setAttribute("aria-label", "Sponsored link");
        }

        // Apply classes to container
        applySponsorClasses(container);

        // If we are not hiding, we can also apply classes to all descendants
        if (!isHideSponsoredEnabled) {
            container.querySelectorAll("*").forEach((child) => {
                // Don’t strikethrough the literal label node itself
                if (!isSponsoredLabel(child)) {
                    if (isStrikethroughEnabled) child.classList.add("sponsor-strikethrough");
                    if (isOpacityEnabled) child.classList.add("reduced-opacity");
                    if (isRedBackgroundEnabled) child.classList.add("red-background");
                }
            });
        }
    }

    /**
     * For each label text, find its container (link or itself) and mark it.
     */
    function markAsSponsoredByLabel(el) {
        const container = el.closest("a") || el.closest("div");
        if (container && container !== el) {
            markContainerAsSponsored(container);
        } else {
            // The label is its own container (no parent anchor/div).
            // So do NOT apply the styling. We might increment count once if you wish.
        }
    }

    /**
     * Clear out all sponsor classes and attributes from the page, so we can rescan.
     */
    function removeAllSponsorStyling() {
        foundOnPage = 0; // reset count
        const elements = document.querySelectorAll(`
        .sponsor-strikethrough, 
        .reduced-opacity, 
        .red-background, 
        .sponsor-hidden,
        [data-ss-counted]
      `);
        elements.forEach((el) => {
            el.classList.remove("sponsor-strikethrough", "reduced-opacity", "red-background", "sponsor-hidden");
            el.removeAttribute("data-ss-counted");
            el.removeAttribute("aria-label");
        });
    }

    /**
     * The main scanning function to find "Sponsored" labels or known ad containers.
     */
    function scanSponsored(root) {
        if (!root) return;

        // 1) Look for textual "Sponsored"/"Ad" labels
        const textEls = root.querySelectorAll("span, div, a, h3, strong, b");
        textEls.forEach((el) => {
            if (isSponsoredLabel(el)) {
                markAsSponsoredByLabel(el);
            }
        });

        // 2) Look for known ad containers
        adSelectors.forEach((selector) => {
            const matches = root.querySelectorAll(selector);
            matches.forEach((adEl) => {
                // If the container is literally a label, skip re-check
                if (!isSponsoredLabel(adEl)) {
                    markContainerAsSponsored(adEl);
                }
            });
        });
    }

    /**
     * After scanning, send the final "foundOnPage" count to background to update badge, totals, etc.
     */
    function updateBadgeAndTotals() {
        chrome.runtime.sendMessage({
            type: "updateBadge",
            pageCount: foundOnPage
        }, (response) => {
            // The background might respond with the updated total, etc.
        });
    }

    /**
     * React to newly added nodes in the DOM (for dynamic search results).
     */
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            let newNodesFound = false;

            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        scanSponsored(node);
                        newNodesFound = true;
                    }
                });
            });

            if (newNodesFound) {
                updateBadgeAndTotals();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Re-run the process after toggles change.
     */
    function reapply() {
        removeAllSponsorStyling();
        scanSponsored(document);
        updateBadgeAndTotals();
    }

    function init() {
        // Load toggles from storage
        chrome.storage.sync.get(
            {
                sponsorStrikethroughEnabled: true,
                reduceOpacityEnabled: true,
                redBackgroundEnabled: false,
                hideSponsoredEnabled: false
            },
            (data) => {
                isStrikethroughEnabled = data.sponsorStrikethroughEnabled;
                isOpacityEnabled = data.reduceOpacityEnabled;
                isRedBackgroundEnabled = data.redBackgroundEnabled;
                isHideSponsoredEnabled = data.hideSponsoredEnabled;

                // Initial scan
                scanSponsored(document);
                updateBadgeAndTotals();
            }
        );

        // Observe DOM for dynamic changes
        setupObserver();

        // Listen for storage changes
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "sync") {
                let changed = false;
                if ("sponsorStrikethroughEnabled" in changes) {
                    isStrikethroughEnabled = changes.sponsorStrikethroughEnabled.newValue;
                    changed = true;
                }
                if ("reduceOpacityEnabled" in changes) {
                    isOpacityEnabled = changes.reduceOpacityEnabled.newValue;
                    changed = true;
                }
                if ("redBackgroundEnabled" in changes) {
                    isRedBackgroundEnabled = changes.redBackgroundEnabled.newValue;
                    changed = true;
                }
                if ("hideSponsoredEnabled" in changes) {
                    isHideSponsoredEnabled = changes.hideSponsoredEnabled.newValue;
                    changed = true;
                }
                if (changed) {
                    reapply();
                }
            }
        });
    }

    init();
})();
