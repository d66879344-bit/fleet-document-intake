(function () {
  var $ = function (id) { return document.getElementById(id); };
  var items = [];
  var secret = "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return iso || ""; }
  }

  function fillFilters() {
    var countries = {}, groups = {};
    items.forEach(function (it) {
      countries[it.country] = it.countryName || it.country;
      groups[it.group] = 1;
    });
    $("fCountry").innerHTML = '<option value="">All countries</option>' +
      Object.keys(countries).sort(function (a, b) { return countries[a].localeCompare(countries[b]); })
        .map(function (c) { return '<option value="' + esc(c) + '">' + esc(countries[c]) + "</option>"; }).join("");
    $("fGroup").innerHTML = '<option value="">All groups</option>' +
      Object.keys(groups).sort().map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + "</option>"; }).join("");
  }

  function matches(it) {
    var fc = $("fCountry").value, fg = $("fGroup").value, q = $("fSearch").value.trim().toLowerCase();
    if (fc && it.country !== fc) return false;
    if (fg && it.group !== fg) return false;
    if (q) {
      var hay = [it.company, it.ref, it.notes, it.otherDescription].join(" ").toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function render() {
    var rows = items.filter(matches);
    if (!rows.length) {
      $("list").innerHTML = '<li class="row">No matching submissions.</li>';
      return;
    }
    $("list").innerHTML = rows.map(function (it) {
      var files = (it.files || []).map(function (f) {
        var url = "/api/admin/file?secret=" + encodeURIComponent(secret) + "&key=" + encodeURIComponent(f.key);
        return '<a class="filebtn" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(f.field) + "</a>";
      }).join("");
      return '<li class="row">' +
        '<div class="row-top"><span class="row-title">' + esc(it.company) +
        (it.ref ? " — " + esc(it.ref) : "") + '</span><span class="row-meta">' + esc(fmtDate(it.submittedAt)) + "</span></div>" +
        '<div class="row-meta">' + esc(it.countryName || it.country) + " · " + esc(it.group) +
        (it.contact ? " · " + esc(it.contact) : "") + "</div>" +
        (it.otherDescription ? '<div class="row-meta">' + esc(it.otherDescription) + "</div>" : "") +
        (it.notes ? '<div class="row-meta">' + esc(it.notes) + "</div>" : "") +
        '<div class="filebtns">' + files + "</div></li>";
    }).join("");
  }

  async function load() {
    $("panelStatus").textContent = "Loading…";
    $("panelStatus").className = "status";
    try {
      var res = await fetch("/api/admin/list?secret=" + encodeURIComponent(secret));
      if (res.status === 401) { throw new Error("unauthorized"); }
      if (!res.ok) throw new Error("load_failed");
      var data = await res.json();
      items = data.items || [];
      fillFilters();
      render();
      $("panelStatus").textContent = items.length + " submission(s)";
    } catch (e) {
      $("panelStatus").textContent = e.message === "unauthorized" ? "Wrong password." : "Could not load documents.";
      $("panelStatus").className = "status err";
      if (e.message === "unauthorized") { $("gate").hidden = false; $("panel").hidden = true; }
    }
  }

  $("unlock").addEventListener("click", function () {
    secret = $("secret").value.trim();
    if (!secret) { $("gateStatus").textContent = "Enter the password."; return; }
    try { sessionStorage.setItem("fdi_secret", secret); } catch (e) {}
    $("gateStatus").textContent = "";
    $("gate").hidden = true;
    $("panel").hidden = false;
    load();
  });
  $("fCountry").addEventListener("change", render);
  $("fGroup").addEventListener("change", render);
  $("fSearch").addEventListener("input", render);

  try {
    var saved = sessionStorage.getItem("fdi_secret");
    if (saved) {
      secret = saved;
      $("secret").value = saved;
      $("gate").hidden = true;
      $("panel").hidden = false;
      load();
    }
  } catch (e) {}
})();
