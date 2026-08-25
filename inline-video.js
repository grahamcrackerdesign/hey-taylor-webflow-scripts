/* ============================================================
   Hey Taylor — Inline video play/pause
   Keeps the overlay button visible at all times and swaps its
   Phosphor icon to reflect playback state. Clicking either the
   button or the video toggles play / pause.

   No markup changes needed · works with any number of videos
   per page · never touches data-w-id, so Webflow IX2 hover
   animations on the button keep working.

   ── Webflow hooks — class-driven ─────────────────────────────
   Matches the existing video component markup as-is:

     .u-position-relative    wrapper around button + video   (required)
     .play_button-wrapper    the overlay button wrapper      (required)
     .icon                   the Phosphor <span> inside it   (required)
     .video-component        the <video> element             (required)

   The button's inner <a href="#"> is intercepted with
   preventDefault() so the page does not jump to the top.

   ── Icon ─────────────────────────────────────────────────────
   Only the ph-play / ph-pause token is swapped. Every other class
   on the span — ph-fill, size variants, colour — is left alone,
   so the icon keeps whatever styling it was given in the Designer.

   ── Autoplay ─────────────────────────────────────────────────
   The <video> needs autoplay + muted + playsinline, and a preload
   other than "none". Browsers refuse to autoplay unmuted video, so
   if autoplay is blocked the icon simply stays on play and the
   first click starts it — no special-casing required.

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
  var ICON  = '.icon';
  var VIDEO = '.video-component';
  var PLAY  = 'ph-play';
  var PAUSE = 'ph-pause';
  var BOUND = 'htvBound';          // guards against double-binding

  /* --- styles --------------------------------------------------
     Only a cursor hint; the button stays visible in every state, so
     nothing here can fight an IX2 animation on it. */
  function injectCss() {
    if (document.getElementById('ht-video-css')) return;
    var s = document.createElement('style');
    s.id = 'ht-video-css';
    s.textContent = VIDEO + '{cursor:pointer}';
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

    var icon = btnWrap.querySelector(ICON);
    if (!icon) console.warn(TAG, 'no ' + ICON + ' inside button — icon will not swap', btnWrap);

    function paint() {
      if (!icon) return;
      var playing = !video.paused && !video.ended;
      icon.classList.toggle(PLAY, !playing);
      icon.classList.toggle(PAUSE, playing);
    }

    function toggle() {
      if (video.paused) video.play();
      else video.pause();
    }

    (btnWrap.querySelector('a') || btnWrap).addEventListener('click', function (e) {
      e.preventDefault();            // <a href="#"> would jump to top
      toggle();
    });

    video.addEventListener('click', toggle);

    video.addEventListener('play',  paint);
    video.addEventListener('pause', paint);
    video.addEventListener('ended', paint);

    paint();                         // autoplay may not have started yet

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
