/* KizicTech — enquiry form.
   Without this script the form still works: it posts to the form service and the
   visitor lands on enquiry-sent.html. With it, the form checks each field, sends in
   the background, and confirms on the same page. If sending fails, nothing typed is
   lost and the visitor is offered their email app as a way through. */
(function () {
  'use strict';

  var root = document.querySelector('.s-enquire');
  if (!root || !window.fetch || !window.FormData) return;

  var form = root.querySelector('.s-enquire__form');
  var sent = root.querySelector('.s-enquire__sent');
  if (!form || !sent) return;

  var button = form.querySelector('.s-enquire__send');
  var statusText = form.querySelector('.s-enquire__status-text');
  var failed = form.querySelector('.s-enquire__failed');
  var failedWhy = form.querySelector('.s-enquire__failed-why');
  var fallback = form.querySelector('.s-enquire__fallback');
  var key = form.elements.access_key;
  var sending = false;

  var MESSAGES = {
    name: { valueMissing: 'Enter your name.' },
    email: {
      valueMissing: 'Enter your email address so we can reply.',
      typeMismatch: 'Check the email address. It should look like name@example.com.'
    },
    message: { valueMissing: 'Tell us what your enquiry is about.' }
  };

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
    var text = '';
    if (typeof field.value === 'string' && field.required && !field.value.trim()) {
      text = MESSAGES[field.name].valueMissing;
    } else if (!field.validity.valid) {
      var set = MESSAGES[field.name] || {};
      text = field.validity.valueMissing ? set.valueMissing
        : field.validity.typeMismatch ? set.typeMismatch
        : field.validationMessage;
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
      if (field.getAttribute('aria-invalid') === 'true') check(field);
    });
  });

  function setSending(on) {
    sending = on;
    form.classList.toggle('is-sending', on);
    button.setAttribute('aria-disabled', on ? 'true' : 'false');
    statusText.textContent = on ? 'Sending your enquiry' : '';
  }

  function mailtoWith(data) {
    var base = form.getAttribute('data-fallback') || '';
    var body = (data.message || '') + '\n\n' + (data.name || '') +
      (data.business ? '\n' + data.business : '');
    return base + '?subject=' + encodeURIComponent('Enquiry from kizictech.com.au: ' + (data.topic || '')) +
      '&body=' + encodeURIComponent(body.trim());
  }

  function showFailure(why, data) {
    failedWhy.textContent = why;
    if (fallback) fallback.href = mailtoWith(data);
    failed.hidden = false;
  }

  function showSent(data) {
    var first = (data.name || '').trim().split(/\s+/)[0];
    root.querySelector('.s-enquire__sent-name').textContent = first ? ', ' + first : '';
    root.querySelector('.s-enquire__sent-email').textContent = data.email;
    form.hidden = true;
    sent.hidden = false;
    sent.focus();
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (sending) return;
    failed.hidden = true;

    var firstBad = null;
    fields.forEach(function (field) {
      if (!check(field) && !firstBad) firstBad = field;
    });
    if (firstBad) {
      firstBad.focus();
      return;
    }

    var data = {};
    new FormData(form).forEach(function (value, name) {
      if (name !== 'redirect' && typeof value === 'string') data[name] = value.trim();
    });
    if (form.elements.botcheck && form.elements.botcheck.checked) data.botcheck = true;
    else delete data.botcheck;

    // Not connected to an inbox yet: say so plainly instead of pretending to send.
    if (!key || !key.value || /^YOUR-/.test(key.value)) {
      showFailure('This form is not connected to our inbox yet.', data);
      return;
    }

    setSending(true);
    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (json) {
        return { ok: response.ok && json.success === true, status: response.status };
      });
    }).then(function (result) {
      setSending(false);
      if (result.ok) {
        showSent(data);
      } else if (result.status === 429) {
        showFailure('Too many enquiries were sent in a short time. Wait a minute before trying again.', data);
      } else {
        showFailure('The form service did not accept it.', data);
      }
    }).catch(function () {
      setSending(false);
      showFailure('We could not reach the form service. Check your connection.', data);
    });
  });
})();
