(function () {
  if (window.__appcatalogReady) {
    return;
  }
  window.__appcatalogReady = true;

  var popup = null;
  var frame = null;
  var titleEl = null;
  var lastFocus = null;
  var currentUrl = "";

  function closeLabel() {
    var root = document.querySelector("[data-appcatalog-close]");
    return (root && root.getAttribute("data-appcatalog-close")) || "×";
  }

  function ensure() {
    if (popup) {
      return;
    }
    popup = document.createElement("div");
    popup.className = "appcatalog-popup";
    popup.hidden = true;
    popup.innerHTML =
      '<div class="appcatalog-popup__window" role="dialog" aria-modal="true">' +
        '<div class="appcatalog-popup__bar">' +
          '<p class="appcatalog-popup__title"></p>' +
          '<button type="button" class="appcatalog-popup__close"></button>' +
        "</div>" +
        '<iframe class="appcatalog-popup__frame" title=""></iframe>' +
      "</div>";
    document.body.appendChild(popup);
    frame = popup.querySelector("iframe");
    titleEl = popup.querySelector(".appcatalog-popup__title");
    popup.querySelector(".appcatalog-popup__close").addEventListener("click", close);
    popup.addEventListener("click", function (event) {
      if (event.target === popup) {
        close();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && popup && !popup.hidden) {
        close();
      }
    });
  }

  function resolve(base, href) {
    try {
      return new URL(href, base).href;
    } catch (error) {
      return href;
    }
  }

  function loadDoc(url) {
    currentUrl = url;
    frame.removeAttribute("srcdoc");
    frame.src = "about:blank";
    fetch(url, { credentials: "omit" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("catalog document");
        }
        return response.text();
      })
      .then(function (html) {
        var base = url.replace(/[^/]+$/, "");
        var bridge =
          "<base href=\"" + base.replace(/"/g, "%22") + "\">" +
          "<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';if(!h||h.charAt(0)==='#')return;if(/^(https?:|mailto:|tel:)/i.test(h)){if(/^https?:/i.test(h)){a.target='_blank';a.rel='noopener noreferrer';}return;}e.preventDefault();parent.postMessage({type:'appcatalog-doc',href:h},'*');});<\/script>";
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head[^>]*>/i, function (tag) {
            return tag + bridge;
          });
        } else {
          html = bridge + html;
        }
        frame.srcdoc = html;
      })
      .catch(function () {
        frame.removeAttribute("srcdoc");
        frame.src = url;
      });
  }

  function open(url, title) {
    ensure();
    var button = popup.querySelector(".appcatalog-popup__close");
    var label = closeLabel();
    button.textContent = label;
    button.setAttribute("aria-label", label);
    lastFocus = document.activeElement;
    titleEl.textContent = title || "";
    popup.querySelector(".appcatalog-popup__window").setAttribute("aria-label", title || "");
    frame.title = title || "";
    popup.hidden = false;
    document.body.classList.add("appcatalog-popup-open");
    button.focus();
    loadDoc(url);
  }

  function close() {
    if (!popup || popup.hidden) {
      return;
    }
    popup.hidden = true;
    frame.removeAttribute("srcdoc");
    frame.src = "about:blank";
    document.body.classList.remove("appcatalog-popup-open");
    if (lastFocus && lastFocus.focus) {
      lastFocus.focus();
    }
  }

  window.addEventListener("message", function (event) {
    if (!frame || !popup || popup.hidden || event.source !== frame.contentWindow) {
      return;
    }
    var data = event.data || {};
    if (data.type !== "appcatalog-doc" || typeof data.href !== "string") {
      return;
    }
    var next = resolve(currentUrl, data.href);
    if (!/^https:\/\//i.test(next)) {
      return;
    }
    loadDoc(next);
  });

  function draw(el) {
    var url = el.getAttribute("data-qr");
    if (!url || typeof qrcode !== "function") {
      return;
    }
    try {
      var qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (error) {
      el.classList.add("is-failed");
    }
  }

  function run() {
    var nodes = document.querySelectorAll(".appcatalog-app__qr[data-qr]");
    for (var i = 0; i < nodes.length; i++) {
      draw(nodes[i]);
    }
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("[data-appcatalog-policy]") : null;
    if (!link) {
      return;
    }
    event.preventDefault();
    open(link.href, link.getAttribute("data-title") || link.textContent);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
