/* Darrell Nicholas — portfolio. No dependencies. */
(function () {
  'use strict';

  /* Current year in the footer */
  var year = document.getElementById('year');
  if (year) { year.textContent = new Date().getFullYear(); }

  /* Hairline + shadow on the nav once the page has scrolled */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* If a cover file is missing, fall back to the brand block behind it
     instead of showing a broken image. */
  Array.prototype.forEach.call(document.querySelectorAll('.cover img'), function (img) {
    var fail = function () { img.parentNode.classList.add('is-missing'); };
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0) { fail(); }
  });

  /* Gentle reveal on scroll (skipped when the OS asks for less motion) */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll('.card, .section-head, .about-copy, .signup');
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });

    /* Failsafe: nothing on this page should ever stay invisible. */
    window.setTimeout(function () {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-in'); });
    }, 2500);
  }

  /* Netlify Forms over fetch, so the signup never leaves the page.
     Without JS the form posts normally and lands on /thanks.html. */
  var form = document.querySelector('.signup');
  if (form && window.fetch) {
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type=submit]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var body = new URLSearchParams();
      data.forEach(function (value, key) { body.append(key, value); });

      button.disabled = true;
      status.className = 'form-status';
      status.textContent = 'Sending…';

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      }).then(function (res) {
        if (!res.ok) { throw new Error(res.status); }
        form.reset();
        status.className = 'form-status is-ok';
        status.textContent = "You're on the list. Thanks — I'll only email when there's something real to say.";
      }).catch(function () {
        status.className = 'form-status is-err';
        status.textContent = 'That did not go through. Please try again in a moment.';
      }).then(function () {
        button.disabled = false;
      });
    });
  }

  /* Counts the visit. Nothing is displayed anywhere on the site — the tally
     lives behind a token at /e/v/log. It fails silently on purpose: a counter
     is never worth showing somebody an error. */
  if (window.fetch) {
    try {
      fetch('/e/v', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p: location.pathname, r: document.referrer }),
        credentials: 'same-origin',
        keepalive: true
      })['catch'](function () {});
    } catch (e) { /* nothing to do, and nothing worth saying */ }
  }
})();
