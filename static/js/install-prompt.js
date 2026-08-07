/* Ålgård Karate – "legg til på hjemskjerm" påminnelse
 *
 * Viser en liten banner nederst som:
 *  - på Android/Chrome: fanger opp "beforeinstallprompt" og tilbyr en
 *    "Installer"-knapp som åpner nettleserens installasjonsdialog.
 *  - på iOS Safari: viser instruksjoner, siden iOS ikke støtter
 *    beforeinstallprompt (må gjøres manuelt via Del-ikonet).
 *  - skjules helt hvis siden allerede kjører som installert PWA.
 *  - kan lukkes, og dukker da ikke opp igjen før om 14 dager
 *    (lagres i localStorage).
 */
(function () {
  const DISMISS_KEY = "algardkarate_install_dismissed_at";
  const DISMISS_COUNT_KEY = "algardkarate_install_dismiss_count";
  const SESSION_KEY = "algardkarate_install_shown_session";
  const DISMISS_DAYS = 14;
  const MAX_DISMISSALS = 2; // after this many dismissals, stop asking for good
  const SHOW_DELAY_MS = 2500; // let the page settle before showing anything

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isPermanentlyDismissed() {
    return parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || "0", 10) >= MAX_DISMISSALS;
  }

  function isDismissedRecently() {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    if (Number.isNaN(dismissedAt)) return false;
    const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  }

  function isShownThisSession() {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  }

  function markShownThisSession() {
    sessionStorage.setItem(SESSION_KEY, "1");
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function isSafari() {
    const ua = window.navigator.userAgent;
    return /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  }

  function dismiss(banner) {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    const count = parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(DISMISS_COUNT_KEY, String(count));
    banner.hidden = true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const banner = document.getElementById("install-banner");
    if (!banner) return;

    // Respect the user: never nag once they've dismissed it a couple of
    // times, never show inside the installed app, and never more than
    // once per browsing session even if not yet dismissed.
    if (isStandalone() || isPermanentlyDismissed() || isDismissedRecently() || isShownThisSession()) {
      return;
    }

    const titleEl = document.getElementById("install-banner-title");
    const textEl = document.getElementById("install-banner-text");
    const actionBtn = document.getElementById("install-banner-action");
    const closeBtn = document.getElementById("install-banner-close");

    closeBtn.addEventListener("click", function () {
      dismiss(banner);
    });

    let deferredPrompt = null;
    let readyToShow = null; // set once we know *how* to show the banner

    // Android / Chrome / Edge: native install prompt available
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredPrompt = event;
      readyToShow = function () {
        titleEl.textContent = "Legg til på hjemskjermen";
        textEl.textContent = "Trykk «Installer» for rask tilgang";
        actionBtn.hidden = false;
      };
    });

    actionBtn.addEventListener("click", async function () {
      if (!deferredPrompt) return;
      actionBtn.disabled = true;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.hidden = true;
    });

    window.addEventListener("appinstalled", function () {
      banner.hidden = true;
    });

    // iOS Safari: no beforeinstallprompt, show manual instructions instead
    if (isIOS() && isSafari()) {
      readyToShow = function () {
        titleEl.textContent = "Legg til på hjemskjermen";
        textEl.innerHTML = 'Trykk <i class="fas fa-arrow-up-from-bracket"></i> Del → «Legg til»';
      };
    }

    // Wait a bit and only show the banner once we actually have something
    // useful to say — avoids flashing an empty/irrelevant banner on
    // unsupported browsers, and avoids interrupting the page as it loads.
    setTimeout(function () {
      if (!readyToShow) return;
      readyToShow();
      banner.hidden = false;
      markShownThisSession();
    }, SHOW_DELAY_MS);
  });
})();
