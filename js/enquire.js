/* KizicTech — enquiry form.
   Without this script the form still works: it posts to the form service and the
   visitor lands on enquiry-sent.html. With it, the form checks each field, sends in
   the background, and confirms on the same page. If sending fails or takes too long,
   nothing typed is lost and the visitor is offered their email app as a way through. */
(function () {
  'use strict';

  /* On phones the header nav is one sideways-scrolling row and "Enquire" is its last
     item: bring the current page's marker into view. */
  var nav = document.querySelector('.site-nav');
  function showCurrent() {
    if (nav && nav.querySelector('a[aria-current="page"]')) nav.scrollLeft = nav.scrollWidth;
  }
  showCurrent();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(showCurrent);

  var root = document.querySelector('.s-enquire');
  if (!root || !window.fetch || !window.FormData) return;

  var form = root.querySelector('.s-enquire__form');
  var sent = root.querySelector('.s-enquire__sent');
  var panel = root.querySelector('.s-enquire__panel');
  if (!form || !sent || !panel) return;

  var button = form.querySelector('.s-enquire__send');
  var statusText = form.querySelector('.s-enquire__status-text');
  var failed = form.querySelector('.s-enquire__failed');
  var failedWhy = form.querySelector('.s-enquire__failed-why');
  var fallback = form.querySelector('.s-enquire__fallback');
  var key = form.elements.access_key;
  var sending = false;

  var TIMEOUT_MS = 20000;
  var MAILTO_LIMIT = 1900;   // some mail apps ignore or cut links much longer than this
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/;   // needs a dot in the domain, which browsers do not insist on

  var MESSAGES = {
    name: { valueMissing: 'Enter your name.' },
    email: {
      valueMissing: 'Enter your email address so we can reply.',
      typeMismatch: 'Check the email address. It needs an @ and a full domain, such as .com or .com.au.'
    },
    message: { valueMissing: 'Tell us what your enquiry is about.' }
  };

  function chars(text) {
    return Array.from ? Array.from(text) : text.split('');   // whole characters, so an emoji is never cut in half
  }

  form.noValidate = true; // this script shows its own messages beside each field

  /* Links such as enquire.html?topic=Support choose the subject in advance. */
  try {
    var wanted = new URLSearchParams(window.location.search).get('topic');
    var topic = form.elements.topic;
    if (wanted && topic) {
      for (var i = 0; i < topic.options.length; i++) {
        if (topic.options[i].value.toLowerCase() === wanted.toLowerCase()) topic.selectedIndex = i;
      }
    }
  } catch (e) { /* older browsers: the default subject stays */ }

  function errorFor(field) {
    return document.getElementById(field.id + '-error');
  }

  function check(field) {
    var box = errorFor(field);
    if (!box) return true;
    var set = MESSAGES[field.name] || {};
    var text = '';
    if (field.required && !field.value.trim()) {
      text = set.valueMissing;
    } else if (!field.validity.valid) {
      text = field.validity.valueMissing ? set.valueMissing
        : (field.validity.typeMismatch || field.validity.patternMismatch) ? set.typeMismatch
        : field.validationMessage;
    } else if (field.type === 'email' && !EMAIL.test(field.value.trim())) {
      text = set.typeMismatch;
    }
    if (text) {
      box.textContent = text;
      box.hidden = false;
      field.setAttribute('aria-invalid', 'true');
    } else {
      box.textContent = '';
      box.hidden = true;
      field.removeAttribute('aria-invalid');
    }
    return !text;
  }

  var fields = [form.elements.name, form.elements.email, form.elements.message];
  fields.forEach(function (field) {
    field.addEventListener('blur', function () {
      // only correct a field the visitor has already been told about, or has filled in
      if (field.getAttribute('aria-invalid') === 'true' || field.value.trim()) check(field);
    });
    field.addEventListener('input', function () {
      if (field.getAttribute('aria-invalid') === 'true' && check(field) && !sending &&
          !form.querySelector('[aria-invalid="true"]')) {
        statusText.textContent = '';
      }
    });
  });

  function setSending(on) {
    sending = on;
    form.classList.toggle('is-sending', on);
    button.setAttribute('aria-disabled', on ? 'true' : 'false');
    statusText.textContent = on ? 'Sending your enquiry' : '';
  }

  /* A link that opens the visitor's email app with their enquiry already written.
     Long enquiries are shortened to fit, and the draft says so. */
  function mailtoWith(data) {
    var base = form.getAttribute('data-fallback') || '';
    var head = base + '?subject=' + encodeURIComponent('Enquiry from kizictech.com.au: ' + (data.topic || '')) + '&body=';
    var sign = '\n\n' + (data.name || '') + (data.business ? '\n' + data.business : '');
    var text = chars(data.message || '');
    var note = '';
    function enc() {
      return encodeURIComponent((text.join('') + note + sign).trim().replace(/\r\n?|\n/g, '\r\n'));
    }
    var body = enc();
    while (text.length && head.length + body.length > MAILTO_LIMIT) {
      text.length = Math.floor(text.length * 0.9);
      note = '\n\n[Shortened to fit. Please paste the rest of your enquiry from the form.]';
      body = enc();
    }
    return head + body;
  }

  function showFailure(why, data) {
    failedWhy.textContent = why;
    if (fallback) fallback.href = mailtoWith(data);
    failed.hidden = false;
    if (failed.scrollIntoView) failed.scrollIntoView({ block: 'nearest' });
  }

  function showSent(data) {
    var first = (data.name || '').trim().split(/\s+/)[0];
    root.querySelector('.s-enquire__sent-name').textContent = first ? ', ' + first : '';
    root.querySelector('.s-enquire__sent-email').textContent = data.email;
    form.hidden = true;
    sent.hidden = false;
    // the page has just become shorter: bring the confirmation back under the header
    try { sent.focus({ preventScroll: true }); } catch (e) { sent.focus(); }
    if (panel.scrollIntoView) panel.scrollIntoView({ block: 'start' });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (sending) return;
    failed.hidden = true;
    statusText.textContent = '';

    var firstBad = null;
    fields.forEach(function (field) {
      if (!check(field) && !firstBad) firstBad = field;
    });
    if (firstBad) {
      // say it aloud too: focus may already be on the field, which announces nothing
      var bad = form.querySelectorAll('[aria-invalid="true"]').length;
      statusText.textContent = (bad === 1 ? '1 field needs fixing: ' : bad + ' fields need fixing. First: ') +
        errorFor(firstBad).textContent;
      firstBad.focus();
      return;
    }

    var data = {};
    new FormData(form).forEach(function (value, name) {
      if (name !== 'redirect' && typeof value === 'string') data[name] = value.trim();
    });
    if (form.elements.botcheck && form.elements.botcheck.checked) data.botcheck = true;
    else delete data.botcheck;
    // a subject per enquiry, so each one starts its own conversation in the inbox
    data.subject = 'Enquiry: ' + (data.topic || 'General') + ' (' + chars(data.name).slice(0, 60).join('') + ')';

    // Not connected to an inbox yet: say so plainly instead of pretending to send.
    if (!key || !key.value || /^YOUR-/.test(key.value)) {
      showFailure('This form is not connected to our inbox yet.', data);
      return;
    }

    setSending(true);
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (json) {
        return { ok: response.ok && json.success === true, status: response.status };
      });
    }).then(function (result) {
      clearTimeout(timer);
      setSending(false);
      if (result.ok) {
        showSent(data);
      } else if (result.status === 429) {
        showFailure('Too many enquiries were sent in a short time. Wait a minute before trying again.', data);
      } else {
        showFailure('The form service did not accept it.', data);
      }
    }).catch(function (error) {
      clearTimeout(timer);
      setSending(false);
      showFailure(error && error.name === 'AbortError'
        ? 'The form service took too long to answer.'
        : 'We could not reach the form service. Check your connection.', data);
    });
  });
})();
