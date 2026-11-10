/* Contact form for the Pitch Please Studio coming soon page.

   How sending works (set on the <form> tag in index.html):
   - data-endpoint=""           -> open the visitor's own email app with the message filled in (needs no server).
   - data-endpoint="https://…"  -> send the message in the background as JSON to that address.
                                   If that fails for any reason, fall back to the email-app route so no enquiry is lost.
                                   The address must also be allowed in the Content-Security-Policy line in index.html
                                   (connect-src) when it is on another domain. */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  var note = document.getElementById('form-note');
  if (!form || !note) { return; }

  var TO = form.getAttribute('data-to') || 'namaste@pitchpleasestudio.com';
  var MAX_MAILTO = 1900;            // keep the mailto link short enough for every email app
  var busy = false;

  function value(name) {
    var el = form.elements[name];
    return el && typeof el.value === 'string' ? el.value.replace(/\r\n?/g, '\n').trim() : '';
  }

  function oneLine(text) { return text.replace(/\s+/g, ' ').trim(); }

  function showNote(parts) {
    while (note.firstChild) { note.removeChild(note.firstChild); }
    parts.forEach(function (part) {
      if (typeof part === 'string') {
        note.appendChild(document.createTextNode(part));
      } else {
        var a = document.createElement('a');
        a.href = part.href;
        a.textContent = part.text;
        note.appendChild(a);
      }
    });
    note.hidden = false;
  }

  function mailLink(data) {
    var subject = '[Website] ' + (data.looking_for || 'New enquiry') + ' — ' + data.name;
    var head = ['Name: ' + data.name, 'Email: ' + data.email, 'Company: ' + (data.company || '-'), 'Looking for: ' + (data.looking_for || '-'), '', ''].join('\n');
    var base = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=';
    var body = head + data.message;
    var link = base + encodeURIComponent(body);
    var cut = false;
    var message = data.message;
    while (link.length > MAX_MAILTO && message.length > 0) {
      cut = true;
      message = message.slice(0, Math.max(0, message.length - 40));
      link = base + encodeURIComponent(head + message + '\n\n[Message shortened to fit. Please add the rest here.]');
    }
    return { href: link, cut: cut };
  }

  function sendByEmailApp(data) {
    var link = mailLink(data);
    window.location.href = link.href;
    showNote([
      'Your email app should have opened with the message ready to send. ',
      link.cut ? 'It was long, so part of it was left out: please add the rest before sending. ' : '',
      "If it didn't open, write to us directly at ",
      { href: 'mailto:' + TO, text: TO },
      '.'
    ]);
  }

  function sendInBackground(endpoint, data) {
    busy = true;
    form.setAttribute('aria-busy', 'true');
    var button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; }

    var done = function () {
      busy = false;
      form.removeAttribute('aria-busy');
      if (button) { button.disabled = false; }
    };

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function () { controller.abort(); }, 15000) : null;

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) { throw new Error('HTTP ' + response.status); }
      form.reset();
      showNote(["Thanks, your message is on its way. We won't leave you on read."]);
    }).catch(function () {
      sendByEmailApp(data);
    }).then(function () {
      if (timer) { window.clearTimeout(timer); }
      done();
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) { return; }

    // hidden box that people never see: if it is filled in, a spam robot did it
    if (value('website') !== '') { return; }

    var data = {
      name: oneLine(value('name')),
      email: oneLine(value('email')),
      company: oneLine(value('company')),
      looking_for: oneLine(value('looking_for')),
      message: value('message')
    };

    var endpoint = (form.getAttribute('data-endpoint') || '').trim();
    if (endpoint && typeof fetch === 'function') {
      sendInBackground(endpoint, data);
    } else {
      sendByEmailApp(data);
    }
  });
})();
