import type { BannerConfig } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateBannerFiles(config: BannerConfig) {
  const fontWeightMap: Record<string, string> = {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  };

  const justifyContentMap: Record<string, string> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  };

  const uniqueId = "systedo-info-banner";
  const storageKey = `${uniqueId}-closed`;
  const isTopPosition = config.position === "top";
  const isFloating = config.position === "bottom-left" || config.position === "bottom-right";

  // Position-specific styles
  let positionStyles = "";
  if (isTopPosition) {
    positionStyles = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  min-height: ${config.styles.height}px;`;
  } else if (config.position === "bottom-left") {
    positionStyles = `
  position: fixed;
  bottom: 20px;
  left: 20px;
  max-width: 320px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);`;
  } else if (config.position === "bottom-right") {
    positionStyles = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  max-width: 320px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);`;
  }

  const responsiveStyles = !config.targeting.showOnMobile
    ? `\n@media (max-width: 768px) { #${uniqueId} { display: none !important; } }`
    : !config.targeting.showOnDesktop
      ? `\n@media (min-width: 769px) { #${uniqueId} { display: none !important; } }`
      : "";

  // Generate CSS
  const css = `/* Info Banner - Generated: ${new Date().toISOString().split("T")[0]} */
@keyframes ${uniqueId}-fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
#${uniqueId} {
  all: initial;
  display: flex;
  align-items: center;
  justify-content: ${justifyContentMap[config.styles.textAlignment]};
  gap: 12px;${positionStyles}
  padding: ${config.styles.padding}px;
  background-color: ${config.styles.backgroundColor};
  color: ${config.styles.textColor};
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: ${config.styles.fontSize}px;
  font-weight: ${fontWeightMap[config.styles.fontWeight]};
  text-align: ${config.styles.textAlignment};
  box-sizing: border-box;
  z-index: 2147483647;
  animation: ${uniqueId}-fadeIn 0.3s ease-out;
}
#${uniqueId} * {
  box-sizing: border-box;
  font-family: inherit;
  color: inherit;
}
#${uniqueId} a:hover {
  opacity: 0.9;
}
#${uniqueId} .close-btn {
  position: absolute;
  ${isFloating ? "right: 8px; top: 8px;" : "right: 12px; top: 50%; transform: translateY(-50%);"}
  padding: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: ${config.styles.textColor};
  opacity: 0.8;
}
#${uniqueId} .close-btn:hover {
  opacity: 1;
}${responsiveStyles}`;

  // Build HTML content for JS
  let innerContent = "";
  if (config.icon) {
    innerContent += `<span style="flex-shrink:0">${escapeHtml(config.icon)}</span>`;
  }
  if (isFloating) {
    innerContent += `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">`;
  } else {
    innerContent += `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:${justifyContentMap[config.styles.textAlignment]}">`;
  }
  innerContent += `<span>${escapeHtml(config.text)}</span>`;
  if (config.couponCode) {
    innerContent += `<code style="padding:2px 8px;border-radius:4px;font-family:monospace;font-size:0.875em;background:${config.styles.textColor}20;border:1px dashed ${config.styles.textColor}50">${escapeHtml(config.couponCode)}</code>`;
  }
  if (config.button) {
    innerContent += `<a href="${escapeHtml(config.button.url)}" style="padding:6px 16px;border-radius:4px;font-size:0.875em;font-weight:500;text-decoration:none;background:${config.button.backgroundColor};color:${config.button.textColor};display:inline-block">${escapeHtml(config.button.text)}</a>`;
  }
  innerContent += `</div>`;
  if (config.closable) {
    innerContent += `<button class="close-btn" aria-label="Zavrit"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  }

  // Generate visibility conditions
  const visibilityConditions: string[] = [];
  if (!config.targeting.showOnDesktop) {
    visibilityConditions.push("window.innerWidth > 768");
  }
  if (!config.targeting.showOnMobile) {
    visibilityConditions.push("window.innerWidth <= 768");
  }
  if (!config.visibility.alwaysVisible) {
    if (config.visibility.startDate) {
      visibilityConditions.push(`new Date() < new Date("${config.visibility.startDate}")`);
    }
    if (config.visibility.endDate) {
      visibilityConditions.push(`new Date() > new Date("${config.visibility.endDate}")`);
    }
  }

  const hideCondition = visibilityConditions.length > 0
    ? `if (${visibilityConditions.join(" || ")}) { banner.style.display = "none"; return; }`
    : "";

  const closableScript = config.closable
    ? `
  var closeBtn = banner.querySelector(".close-btn");
  if (closeBtn) {
    if (localStorage.getItem("${storageKey}")) {
      banner.style.display = "none";
      return;
    }
    closeBtn.addEventListener("click", function() {
      banner.style.display = "none";
      ${isTopPosition ? `
      // Remove mobile fix CSS or reset desktop spacer
      var mobileFixStyle = document.getElementById("${uniqueId}-mobile-fix");
      if (mobileFixStyle) {
        mobileFixStyle.remove();
      }
      var spacerEl = document.getElementById("${uniqueId}-spacer");
      if (spacerEl) spacerEl.style.height = "0";` : ""}
      localStorage.setItem("${storageKey}", "1");
    });
  }`
    : "";

  const insertScript = isTopPosition
    ? `
  // Detect mobile devices
  var isMobile = window.innerWidth <= 768;

  // Insert banner at the beginning of body
  if (document.body.firstChild) {
    document.body.insertBefore(banner, document.body.firstChild);
  } else {
    document.body.appendChild(banner);
  }

  if (isMobile) {
    // Mobile: banner stays fixed at top, adjust header position
    setTimeout(function() {
      var bannerHeight = banner.offsetHeight;

      // Find and adjust Shoptet header
      var header = document.getElementById("header") || document.querySelector("header");
      if (header) {
        var headerStyle = window.getComputedStyle(header);
        if (headerStyle.position === "fixed" || headerStyle.position === "sticky") {
          var currentTop = parseInt(headerStyle.top) || 0;
          header.style.setProperty("top", (currentTop + bannerHeight) + "px", "important");
        }
      }

      // Also adjust top-navigation-bar if exists
      var topNav = document.querySelector(".top-navigation-bar");
      if (topNav) {
        var topNavStyle = window.getComputedStyle(topNav);
        if (topNavStyle.position === "fixed" || topNavStyle.position === "sticky") {
          var navTop = parseInt(topNavStyle.top) || 0;
          topNav.style.setProperty("top", (navTop + bannerHeight) + "px", "important");
        }
      }

      // Push content wrapper down
      var wrapper = document.querySelector(".overall-wrapper");
      if (wrapper) {
        wrapper.style.setProperty("margin-top", bannerHeight + "px", "important");
      }
    }, 50);
  } else {
    // Desktop: use fixed positioning with spacer element
    var spacer = document.createElement("div");
    spacer.id = "${uniqueId}-spacer";
    spacer.style.cssText = "height:0;transition:height 0.1s";
    document.body.insertBefore(spacer, banner.nextSibling);

    // Set spacer height after banner renders
    setTimeout(function() {
      spacer.style.height = banner.offsetHeight + "px";
    }, 10);
  }`
    : "";

  // Generate JS
  const js = `/* Info Banner - Generated: ${new Date().toISOString().split("T")[0]} */
(function() {
  // Create banner element
  var banner = document.createElement("div");
  banner.id = "${uniqueId}";
  banner.setAttribute("role", "banner");
  banner.innerHTML = '${innerContent.replace(/'/g, "\\'")}';

  // Check visibility conditions
  ${hideCondition}
  ${closableScript}
  ${insertScript}

  // Insert into page
  ${isTopPosition ? "" : "document.body.appendChild(banner);"}
})();`;

  // Generate HTML (for reference)
  const html = `<div id="${uniqueId}" role="banner">${innerContent}</div>`;

  // Generate inline snippet (original format)
  const positionLabel = isTopPosition ? "Top Banner" : (config.position === "bottom-left" ? "Floating Box Left" : "Floating Box Right");
  const inlineSnippet = `<!-- ${positionLabel} - Generated: ${new Date().toISOString().split("T")[0]} -->
<style>
${css}
</style>
<script>
${js}
</script>`;

  return { css, js, html, inlineSnippet };
}
