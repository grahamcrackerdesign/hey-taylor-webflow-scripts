/* ============================================================
   Hey Taylor — Inline video play/pause
   Wires the overlay play button to a native <video>, hides the
   button while playing, and makes the video itself click-to-pause.

   No markup changes needed · works with any number of videos
   per page · never touches data-w-id, so Webflow IX2 hover
   animations on the button keep working.

   ── Webflow hooks — class-driven ─────────────────────────────
   Matches the existing video component markup as-is:

     .u-position-relative    wrapper around button + video   (required)
     .play_button-wrapper    the overlay button wrapper      (required)
     .video-component        the <video> element             (required)

   The button's inner <a href="#"> is intercepted with
   preventDefault() so the page does not jump to the top.

   ── Behaviour ────────────────────────────────────────────────
     click button  → video plays, button fades out
     click video   → toggles play / pause
     pause / ended → button fades back in

   ── Extra (attribute on the wrapper) ─────────────────────────
     [data-video-debug]   verbose per-video console logging.

   Paste inside <script defer> in
   Site Settings → Custom Code → Before </body>, or load from CDN.
   ============================================================ */

(function () {
  'use strict';

  var TAG   = '[inline-video]';
  var WRAP  = '.u-position-relative';
  var BTN   = '.play_button-wrapper';
  var VIDEO = '.video-component';
  var OFF   = 'htv-off';           // hides the button while playing
  var BOUND = 'htvBound';          // guards against double-binding

  /* --- styles --------------------------------------------------
     Injected rather than authored in Webflow so the repo stays the
     single source of truth. Uses a class (not inline styles) so an
     IX2 hover animation on the button can still win where it sets
     the same property. */
  function injectCss() {
    if (document.getElementById('ht-video-css')) return;
    var s = document.createElement('style');
    s.id = 'ht-video-css';
    s.textContent =
      BTN + '{transition:opacity 300ms ease}' +
      BTN + '.' + OFF + '{opacity:0;pointer-events:none}' +
      VIDEO + '{cursor:pointer}';
    (document.head || document.documentElement).appendChild(s);
  }

  /* --- diagnostics ---------------------------------------------
     A missing hook used to be indistinguishable from "script never
     loaded", so each failure says which element it could not find. */
  function bind(video, debug) {
    if (video[BOUND]) return;
    video[BOUND] = true;

    var wrap = video.closest(WRAP);
    if (!wrap) {
      console.warn(TAG, 'no ' + WRAP + ' ancestor — skipping', video);
      return;
    }

    var btnWrap = wrap.querySelector(BTN);
    if (!btnWrap) {
      console.warn(TAG, 'no ' + BTN + ' inside wrapper — skipping', wrap);
      return;
    }

    var trigger = btnWrap.querySelector('a') || btnWrap;

    trigger.addEventListener('click', function (e) {
      e.preventDefault();            // <a href="#"> would jump to top
      video.play();
    });

    video.addEventListener('click', function () {
      if (video.paused) video.play();
      else video.pause();
    });

    function hide() { btnWrap.classList.add(OFF); }
    function show() { btnWrap.classList.remove(OFF); }

    video.addEventListener('play',  hide);
    video.addEventListener('pause', show);
    video.addEventListener('ended', show);

    if (debug) console.log(TAG, 'bound', video.currentSrc || video.src);
  }

  function init() {
    injectCss();
    var videos = document.querySelectorAll(VIDEO);
    if (!videos.length) return;

    var debug = !!document.querySelector('[data-video-debug]');
    if (debug) console.log(TAG, videos.length + ' video(s) found');

    Array.prototype.forEach.call(videos, function (v) { bind(v, debug); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
