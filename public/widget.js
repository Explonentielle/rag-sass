/**
 * Corpus.ai embeddable chat widget loader.
 *
 * Usage (paste once on the host page, anywhere before </body>):
 *   <script src="https://YOUR-CORPUS-DOMAIN/widget.js" data-chatbot-id="YOUR_CHATBOT_ID"></script>
 *
 * Creates a floating bubble in the bottom-right corner that opens into a
 * chat panel. The iframe it creates points at /embed/[chatbotId]?widget=1,
 * which renders its own bubble+toggle chrome (components/EmbedBubbleWidget.tsx)
 * and reports open/closed state back here via postMessage — an iframe can't
 * draw itself over the rest of the host page, so resizing the iframe element
 * itself (from here, the parent page) is what actually shows/hides the panel.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var chatbotId = script.getAttribute('data-chatbot-id');
  if (!chatbotId) {
    console.error('[corpus-widget] data-chatbot-id manquant sur le <script>.');
    return;
  }

  var origin = new URL(script.src, window.location.href).origin;

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/embed/' + encodeURIComponent(chatbotId) + '?widget=1';
  iframe.title = 'Assistant Corpus.ai';
  iframe.setAttribute('scrolling', 'no');
  iframe.style.position = 'fixed';
  iframe.style.border = '0';
  iframe.style.zIndex = '2147483000';
  iframe.style.colorScheme = 'normal';
  iframe.style.transition = 'width 0.15s ease, height 0.15s ease';

  function applySize(open) {
    var mobile = window.innerWidth < 480;
    if (open && mobile) {
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.bottom = '';
      iframe.style.right = '';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.borderRadius = '0';
    } else {
      iframe.style.top = '';
      iframe.style.left = '';
      iframe.style.bottom = '20px';
      iframe.style.right = '20px';
      iframe.style.width = open ? '380px' : '72px';
      iframe.style.height = open ? '580px' : '72px';
      iframe.style.borderRadius = open ? '12px' : '50%';
    }
  }

  applySize(false);

  window.addEventListener('message', function (event) {
    if (event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (!data || data.source !== 'corpus-widget') return;
    applySize(!!data.open);
  });

  window.addEventListener('resize', function () {
    // Re-evaluate the mobile breakpoint while the panel is open (a resize
    // wouldn't otherwise be caught since it's not triggered by a message).
    if (iframe.style.width === '380px' || iframe.style.width === '100%') {
      applySize(true);
    }
  });

  if (document.body) {
    document.body.appendChild(iframe);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(iframe);
    });
  }
})();
