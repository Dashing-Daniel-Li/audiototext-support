(function () {
  var header = document.querySelector(".site-header");
  var toggle = header && header.querySelector(".menu-toggle");
  if (!toggle) return;
  function set(open) {
    header.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Menu");
  }
  toggle.addEventListener("click", function () { set(!header.classList.contains("nav-open")); });
  header.querySelectorAll(".nav-links a").forEach(function (a) { a.addEventListener("click", function () { set(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  document.addEventListener("click", function (e) { if (!header.contains(e.target)) set(false); });
})();
