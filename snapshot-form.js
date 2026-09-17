/*
 * snapshot-form.js — Ask Taylor snapshot form (/snapshot)
 *
 * Replaces the original inline submit handler. Same flow as before: validate,
 * POST JSON to the runs API, redirect to the Stripe checkout URL it returns.
 * Adds the structured fields from the v1.1 form spec plus their conditionals.
 *
 * Required Webflow hooks
 *   #ask-taylor-form                     the form
 *   #at-website #at-name #at-email       text inputs
 *   #at-vertical #at-footprint           selects
 *   #at-market-raw                       location free text (never normalised)
 *   #at-consent                          CASL consent checkbox — do not alter
 *   #at-error #at-submit                 error block, submit button
 *   input[name="goal"]                   5 radios, value = backend value
 *   input[name="platforms_checked"]      6 checkboxes, value on data-value,
 *                                        data-at-exclusive on "Haven't checked yet"
 *   #at-agency-name-group #at-agency-name    revealed when goal = agency
 *   #at-industry-other                       revealed when vertical = other
 *   [data-at-label="vertical|footprint|market|platforms"]
 *                                        labels swapped on the agency path
 *   .at-hidden                           display:none, toggled by this script
 *
 * Load before </body>, or inline in the page embed.
 */
(function () {
  var API = "https://hey-taylor.kilter.cloud/api/runs";
  var CONSENT_WORDING_VERSION = "snapshot_form_v1";
  var HIDDEN = "at-hidden";

  /* Fields 2-4 always describe the business at the submitted URL. On the agency
     path that business is the client's, so only the labels change — never the keys. */
  var AGENCY_LABELS = {
    vertical: "What industry is your client in?",
    footprint: "Where does your client's business operate?",
    market: "Where is your client based?",
    platforms: "Have you looked them up in AI yet? Select any you've tried."
  };
  var STANDARD_LABELS = {
    vertical: "What industry are you in?",
    footprint: "Where does your business operate?",
    market: "Where are you based? (city, region, or country)",
    platforms: "Have you already looked yourself up in AI? Select any you've tried."
  };

  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value.trim() : ""; }
  function show(el, on) { if (el) el.classList.toggle(HIDDEN, !on); }

  function track(name, props) {
    try {
      if (window.posthog && window.posthog.capture) {
        window.posthog.capture(name, props, { send_instantly: true });
      }
    } catch (e) {}
  }

  function goal() {
    var picked = document.querySelector('input[name="goal"]:checked');
    return picked ? picked.value : "";
  }

  function platforms() {
    var boxes = document.querySelectorAll('input[name="platforms_checked"]:checked');
    return Array.prototype.map.call(boxes, function (el) {
      /* Webflow reserves the value attribute on checkboxes, so the option value
         lives on data-value. Fall back to value in case that ever changes. */
      return el.getAttribute("data-value") || el.value;
    });
  }

  function setLabels(isAgency) {
    var set = isAgency ? AGENCY_LABELS : STANDARD_LABELS;
    Object.keys(set).forEach(function (key) {
      var el = document.querySelector('[data-at-label="' + key + '"]');
      if (el) el.textContent = set[key];
    });
  }

  function syncGoal() {
    var isAgency = goal() === "agency";
    setLabels(isAgency);
    show($("at-agency-name-group"), isAgency);
    if (!isAgency) { var a = $("at-agency-name"); if (a) a.value = ""; }
  }

  function syncVertical() {
    var isOther = val("at-vertical") === "other";
    show($("at-industry-other"), isOther);
    if (!isOther) { var o = $("at-industry-other"); if (o) o.value = ""; }
  }

  /* "Haven't checked yet" contradicts every other option, so it clears them
     and any other choice clears it. */
  function syncPlatforms(changed) {
    if (!changed || !changed.checked) return;
    var boxes = document.querySelectorAll('input[name="platforms_checked"]');
    var isExclusive = changed.hasAttribute("data-at-exclusive");
    Array.prototype.forEach.call(boxes, function (el) {
      if (el === changed) return;
      if (isExclusive || el.hasAttribute("data-at-exclusive")) el.checked = false;
    });
  }

  function submitLead(e) {
    e.preventDefault();
    e.stopPropagation();

    var btn = $("at-submit");
    var err = $("at-error");
    err.style.display = "none";

    var consentEl = $("at-consent");
    var optIn = !!(consentEl && consentEl.checked);
    var picked = platforms();

    var p = {
      website: val("at-website"),
      goal: goal(),
      vertical: val("at-vertical"),
      industry_other: val("at-industry-other") || null,
      footprint: val("at-footprint"),
      market_raw: val("at-market-raw"),
      platforms_checked: picked,
      agency_name: val("at-agency-name") || null,
      partner_track: goal() === "agency",
      name: val("at-name"),
      email: val("at-email"),
      consent_marketing: optIn,
      source: "webflow-snapshot"
    };
    /* The report email is transactional and never depends on this box; the opt-in
       only adds marketing consent, recorded against the wording version shown. */
    if (optIn) p.consent_wording_version = CONSENT_WORDING_VERSION;

    if (!p.website || !p.goal || !p.vertical || !p.footprint || !p.market_raw ||
        !p.name || !p.email || !picked.length) {
      err.textContent = "Please fill in every field.";
      err.style.display = "block";
      track("snapshot_form_incomplete", {});
      return;
    }

    btn.disabled = true;
    btn.value = "Opening secure checkout";

    /* Funnel events carry the audit inputs only — never the name or email. */
    var facts = {
      website: p.website,
      goal: p.goal,
      vertical: p.vertical,
      footprint: p.footprint,
      market_raw: p.market_raw,
      platforms_checked: p.platforms_checked,
      partner_track: p.partner_track,
      marketing_opt_in: optIn
    };
    track("snapshot_form_submitted", facts);

    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p)
    }).then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      return r.json();
    }).then(function (j) {
      track("snapshot_checkout_started", facts);
      window.location.href = j.checkout_url;
    }).catch(function () {
      track("snapshot_checkout_failed", facts);
      btn.disabled = false;
      btn.value = "Ask Taylor";
      err.textContent = "Something went wrong opening checkout. Please try again.";
      err.style.display = "block";
    });
  }

  function init() {
    var form = $("ask-taylor-form");
    var btn = $("at-submit");
    if (!form || !btn) return;

    Array.prototype.forEach.call(
      document.querySelectorAll('input[name="goal"]'),
      function (el) { el.addEventListener("change", syncGoal); }
    );
    var vertical = $("at-vertical");
    if (vertical) vertical.addEventListener("change", syncVertical);
    Array.prototype.forEach.call(
      document.querySelectorAll('input[name="platforms_checked"]'),
      function (el) {
        el.addEventListener("change", function () { syncPlatforms(el); });
      }
    );

    /* Browsers restore checked state on back-navigation, so reflect it on load. */
    syncGoal();
    syncVertical();

    /* The button click drives the flow so no form submit event ever fires (Webflow
       preview blocks form submission); the submit listener still covers Enter-key
       submits on the published site. */
    btn.addEventListener("click", submitLead, true);
    form.addEventListener("submit", submitLead, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
