(function () {
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
    var nodes = document.querySelectorAll(".catedra-app__qr[data-qr]");
    for (var i = 0; i < nodes.length; i++) {
      draw(nodes[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
