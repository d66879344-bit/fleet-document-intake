(function () {
  var $ = function (id) { return document.getElementById(id); };
  var items = [];
  var secret = "";
  var confirmId = null;

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
    var countries = {};
    items.forEach(function (it) {
      countries[it.country] = it.countryName || it.country;
    });
    $("fCountry").innerHTML = '<option value="">All countries</option>' +
      Object.keys(countries).sort(function (a, b) { return countries[a].localeCompare(countries[b]); })
        .map(function (c) { return '<option value="' + esc(c) + '">' + esc(countries[c]) + "</option>"; }).join("");
  }

  function matches(it) {
    var fc = $("fCountry").value, q = $("fSearch").value.trim().toLowerCase();
    if (fc && it.country !== fc) return false;
    if (q) {
      var vehicleRefs = (it.vehicles || []).map(function (v) { return v.ref; });
      var driverRefs = (it.drivers || []).map(function (d) { return d.ref; });
      var hay = [it.company, it.contact, it.notes, it.otherDescription]
        .concat(vehicleRefs, driverRefs).join(" ").toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function fileLinks(files) {
    return (files || []).map(function (f) {
      var url = "/api/admin/file?secret=" + encodeURIComponent(secret) + "&key=" + encodeURIComponent(f.key);
      return '<a class="filebtn" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(f.field) + "</a>";
    }).join("");
  }

  function block(title, files) {
    var inner = (files && files.length)
      ? '<div class="filebtns">' + fileLinks(files) + "</div>"
      : '<div class="row-meta">No files uploaded.</div>';
    return '<div class="block"><div class="block-title">' + esc(title) + "</div>" + inner + "</div>";
  }

  function render() {
    var rows = items.filter(matches);
    if (!rows.length) {
      $("list").innerHTML = '<li class="row">No matching submissions.</li>';
      return;
    }
    $("list").innerHTML = rows.map(function (it) {
      var delBtn = confirmId === it.id
        ? '<button type="button" class="filebtn delbtn confirm" data-confirmdel="' + esc(it.id) + '">Confirm delete</button>' +
          '<button type="button" class="filebtn" data-canceldel="1">Cancel</button>'
        : '<button type="button" class="filebtn delbtn" data-askdel="' + esc(it.id) + '">Delete</button>';

      var blocks = block("Company documents", it.companyFiles);

      (it.vehicles || []).forEach(function (v, idx) {
        var label = "Vehicle " + (idx + 1) + (v && v.ref ? " — " + v.ref : "");
        blocks += block(label, v && v.files);
      });

      (it.drivers || []).forEach(function (d, idx) {
        var label = "Driver " + (idx + 1) + (d && d.ref ? " — " + d.ref : "");
        blocks += block(label, d && d.files);
      });

      if (it.otherDescription || (it.otherFiles && it.otherFiles.length)) {
        var otherLabel = "Other" + (it.otherDescription ? " — " + it.otherDescription : "");
        blocks += block(otherLabel, it.otherFiles);
      }

      return '<li class="row">' +
        '<div class="row-top"><span class="row-title">' + esc(it.company) + '</span><span class="row-meta">' + esc(fmtDate(it.submittedAt)) + "</span></div>" +
        '<div class="row-meta">' + esc(it.countryName || it.country) +
        (it.contact ? " · " + esc(it.contact) : "") + "</div>" +
        (it.notes ? '<div class="row-meta">' + esc(it.notes) + "</div>" : "") +
        blocks +
        '<div class="filebtns" style="margin-top:10px;">' + delBtn + "</div></li>";
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

  async function deleteItem(id) {
    confirmId = null;
    $("panelStatus").textContent = "Deleting…";
    $("panelStatus").className = "status";
    try {
      var res = await fetch("/api/admin/delete?secret=" + encodeURIComponent(secret), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id })
      });
      if (!res.ok) throw new Error("delete_failed");
      items = items.filter(function (it) { return it.id !== id; });
      fillFilters();
      render();
      $("panelStatus").textContent = "Deleted. " + items.length + " submission(s) left.";
    } catch (e) {
      $("panelStatus").textContent = "Could not delete. Try again.";
      $("panelStatus").className = "status err";
      render();
    }
  }

  $("list").addEventListener("click", function (e) {
    var ask = e.target.closest("[data-askdel]");
    var cancel = e.target.closest("[data-canceldel]");
    var confirmBtn = e.target.closest("[data-confirmdel]");
    if (ask) { confirmId = ask.getAttribute("data-askdel"); render(); }
    else if (cancel) { confirmId = null; render(); }
    else if (confirmBtn) { deleteItem(confirmBtn.getAttribute("data-confirmdel")); }
  });

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
