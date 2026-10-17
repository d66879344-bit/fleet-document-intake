(function () {
  var MAX_BYTES = 20 * 1024 * 1024;
  var OK_TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  var EXT_TYPES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

  var DOCS = {
    nyc: {
      label: "New York City (NYC)",
      driver: [
        { id: "license_front", label: "Driving license — front", required: true },
        { id: "license_back", label: "Driving license — back", required: true },
        { id: "tlc_license", label: "TLC license", required: true }
      ],
      vehicle: [
        { id: "registration", label: "Vehicle registration", required: true },
        { id: "insurance", label: "Insurance policy", required: true }
      ],
      company: [
        { id: "cert", label: "Registration certificate", required: true },
        { id: "bank", label: "Bank details (IBAN / bank letter)", required: false },
        { id: "owner_id", label: "Owner / manager ID", required: false }
      ]
    },
    spain: {
      label: "Spain (España)",
      driver: [
        { id: "license_front", label: "Driving license — front", required: true },
        { id: "license_back", label: "Driving license — back", required: true },
        { id: "taxi_license", label: "Taxi / VTC license", required: true }
      ],
      vehicle: [
        { id: "circulacion", label: "Permiso de circulación", required: true },
        { id: "itv", label: "ITV certificate", required: true },
        { id: "insurance", label: "Insurance policy", required: true }
      ],
      company: [
        { id: "cert", label: "Registration certificate (alta autónomo)", required: true },
        { id: "bank", label: "Bank details (IBAN)", required: false },
        { id: "owner_id", label: "Owner / manager ID", required: false }
      ]
    },
    greece: {
      label: "Greece (Ελλάδα)",
      driver: [
        { id: "license_front", label: "Driving license — front", required: true },
        { id: "license_back", label: "Driving license — back", required: true },
        { id: "taxi_license", label: "Taxi / tourist-office license", required: true }
      ],
      vehicle: [
        { id: "registration", label: "Vehicle registration", required: true },
        { id: "kteo", label: "ΚΤΕΟ (roadworthiness) certificate", required: true },
        { id: "insurance", label: "Insurance policy", required: true }
      ],
      company: [
        { id: "cert", label: "Registration certificate", required: true },
        { id: "bank", label: "Bank details (IBAN)", required: false },
        { id: "owner_id", label: "Owner / manager ID", required: false }
      ]
    },
    london: {
      label: "London (UK)",
      driver: [
        { id: "pco_driver", label: "PCO driver licence", required: true },
        { id: "driving_license", label: "Driving licence", required: true }
      ],
      vehicle: [
        { id: "pco_vehicle", label: "PCO vehicle licence", required: true },
        { id: "mot", label: "MOT certificate", required: true },
        { id: "insurance", label: "Insurance policy", required: true }
      ],
      company: [
        { id: "cert", label: "Registration certificate (Companies House)", required: true },
        { id: "bank", label: "Bank details", required: false },
        { id: "owner_id", label: "Owner / manager ID", required: false }
      ]
    }
  };
  var GROUPS = [
    { id: "driver", label: "Driver", refLabel: "Driver name" },
    { id: "vehicle", label: "Vehicle", refLabel: "Plate number" },
    { id: "company", label: "Company", refLabel: "Reference", refOptional: true },
    { id: "other", label: "Other", refLabel: "Reference", refOptional: true }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var state = { country: null, group: "driver", files: {} };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slugify(s) {
    return String(s || "").toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
  }
  function fmtSize(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function typeFor(f) {
    if (OK_TYPES[f.type]) return f.type;
    var m = /\.([a-z0-9]+)$/i.exec(f.name || "");
    return m ? (EXT_TYPES[m[1].toLowerCase()] || null) : null;
  }

  function slotsFor(country, group) {
    if (group === "other") return [{ id: "document", label: "Document", required: true }];
    var c = DOCS[country];
    return (c && c[group]) || [];
  }

  /* ---------- country modal ---------- */
  function renderCountryGrid() {
    var html = Object.keys(DOCS).map(function (k) {
      return '<button type="button" class="country-opt" data-c="' + k + '">' + esc(DOCS[k].label) + "</button>";
    }).join("");
    $("countryGrid").innerHTML = html;
  }
  function openCountryModal() { $("countryModal").hidden = false; }
  function closeCountryModal() { $("countryModal").hidden = true; }
  function selectCountry(c) {
    state.country = c;
    state.files = {};
    $("countryLabel").textContent = DOCS[c].label;
    $("countryBar").hidden = false;
    $("formCard").hidden = false;
    closeCountryModal();
    renderGroupTabs();
    renderSlots();
  }

  /* ---------- group tabs ---------- */
  function renderGroupTabs() {
    $("groupTabs").innerHTML = GROUPS.map(function (g) {
      return '<button type="button" class="tab" role="tab" data-g="' + g.id + '" aria-pressed="' +
        (g.id === state.group ? "true" : "false") + '">' + esc(g.label) + "</button>";
    }).join("");
  }
  function setGroup(g) {
    state.group = g;
    state.files = {};
    Array.prototype.forEach.call($("groupTabs").querySelectorAll(".tab"), function (t) {
      t.setAttribute("aria-pressed", t.getAttribute("data-g") === g ? "true" : "false");
    });
    var def = GROUPS.filter(function (x) { return x.id === g; })[0];
    $("refLabel").textContent = def.refLabel + (def.refOptional ? " (optional)" : "");
    $("ref").required = !def.refOptional;
    $("refField").hidden = false;
    $("otherDescField").hidden = g !== "other";
    renderSlots();
  }

  /* ---------- file slots ---------- */
  function renderSlots() {
    var defs = slotsFor(state.country, state.group);
    $("slots").innerHTML = defs.map(function (d) {
      return '<div class="slot" id="slot-' + d.id + '" data-id="' + d.id + '">' +
        '<div class="slot-main"><span class="slot-label">' + esc(d.label) +
        (d.required ? '<span class="req">*</span>' : "") + '</span>' +
        '<div class="slot-file" id="slotfile-' + d.id + '">No file selected</div></div>' +
        '<div class="slot-actions">' +
        '<label class="slot-btn" for="input-' + d.id + '">Choose file</label>' +
        '<input type="file" id="input-' + d.id + '" data-id="' + d.id + '" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*">' +
        '<button type="button" class="slot-btn" data-clear="' + d.id + '" hidden>Remove</button>' +
        "</div></div>";
    }).join("");
  }
  function setSlotFile(id, file, err) {
    var slot = $("slot-" + id);
    if (!slot) return;
    var fileEl = $("slotfile-" + id);
    var clearBtn = slot.querySelector("[data-clear]");
    if (err) {
      state.files[id] = null;
      slot.classList.remove("filled"); slot.classList.add("error");
      fileEl.innerHTML = "No file selected" + '<div class="slot-err">' + esc(err) + "</div>";
      clearBtn.hidden = true;
      return;
    }
    if (!file) {
      delete state.files[id];
      slot.classList.remove("filled", "error");
      fileEl.textContent = "No file selected";
      clearBtn.hidden = true;
      return;
    }
    state.files[id] = file;
    slot.classList.add("filled"); slot.classList.remove("error");
    fileEl.textContent = file.name + " · " + fmtSize(file.size);
    clearBtn.hidden = false;
  }

  function setStatus(t, k) {
    var s = $("status");
    s.textContent = t || "";
    s.className = "status" + (k ? " " + k : "");
  }

  async function uploadOne(id, file) {
    var ct = typeFor(file);
    var key = "uploads/" + state.country + "/" + state.group + "/" +
      slugify($("company").value) + "/" + Date.now() + "-" + id + "-" + slugify(file.name.replace(/\.[^.]+$/, "")) +
      "." + (OK_TYPES[ct] || "bin");
    var pres = await fetch("/api/presign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key, contentType: ct })
    });
    if (!pres.ok) throw new Error("presign_failed");
    var presData = await pres.json();
    var put = await fetch(presData.uploadUrl, { method: "PUT", headers: { "Content-Type": ct }, body: file });
    if (!put.ok) throw new Error("upload_failed");
    return { field: id, key: presData.key, filename: file.name, size: file.size, contentType: ct };
  }

  async function submit(ev) {
    ev.preventDefault();
    if (!state.country) return;
    var company = $("company").value.trim();
    if (!company) { setStatus("Enter the company name.", "err"); $("company").focus(); return; }
    var def = GROUPS.filter(function (x) { return x.id === state.group; })[0];
    var ref = $("ref").value.trim();
    if (!def.refOptional && !ref) { setStatus("Enter the " + def.refLabel.toLowerCase() + ".", "err"); $("ref").focus(); return; }
    if (state.group === "other" && !$("otherDesc").value.trim()) {
      setStatus("Describe what this document is.", "err"); $("otherDesc").focus(); return;
    }

    var slotDefs = slotsFor(state.country, state.group);
    var missing = slotDefs.filter(function (d) { return d.required && !state.files[d.id]; });
    if (missing.length) {
      setStatus("Please add: " + missing.map(function (d) { return d.label; }).join(", "), "err");
      return;
    }
    var toUpload = Object.keys(state.files).filter(function (id) { return state.files[id]; });
    if (!toUpload.length) { setStatus("Add at least one file.", "err"); return; }

    $("submitBtn").disabled = true;
    setStatus("", "");
    var uploaded = [], i = 0;
    try {
      for (i = 0; i < toUpload.length; i++) {
        $("progress").textContent = "Uploading " + (i + 1) + " of " + toUpload.length + "…";
        var rec = await uploadOne(toUpload[i], state.files[toUpload[i]]);
        uploaded.push(rec);
      }
      $("progress").textContent = "Saving…";
      var res = await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: state.country, group: state.group, company: company,
          contact: $("contact").value.trim(), ref: ref, notes: $("notes").value.trim(),
          otherDescription: $("otherDesc").value.trim(), files: uploaded
        })
      });
      if (!res.ok) throw new Error("submit_failed");
      $("progress").textContent = "";
      setStatus("Uploaded. Thank you.", "ok");
      $("ref").value = ""; $("notes").value = ""; $("otherDesc").value = "";
      state.files = {};
      renderSlots();
    } catch (e) {
      $("progress").textContent = "";
      setStatus("Something went wrong. Please try again.", "err");
    } finally {
      $("submitBtn").disabled = false;
    }
  }

  /* ---------- wiring ---------- */
  renderCountryGrid();
  $("countryGrid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-c]"); if (b) selectCountry(b.getAttribute("data-c"));
  });
  $("changeCountry").addEventListener("click", openCountryModal);
  $("groupTabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-g]"); if (b) setGroup(b.getAttribute("data-g"));
  });
  $("slots").addEventListener("change", function (e) {
    var input = e.target.closest("input[type=file]"); if (!input) return;
    var id = input.getAttribute("data-id");
    var file = input.files && input.files[0];
    if (!file) return;
    var t = typeFor(file);
    if (!t) { setSlotFile(id, null, "Unsupported type. Use PDF, JPG, PNG, WebP or GIF."); input.value = ""; return; }
    if (file.size > MAX_BYTES) { setSlotFile(id, null, "Larger than 20 MB."); input.value = ""; return; }
    setSlotFile(id, file);
  });
  $("slots").addEventListener("click", function (e) {
    var b = e.target.closest("[data-clear]"); if (!b) return;
    var id = b.getAttribute("data-clear");
    var input = $("input-" + id); if (input) input.value = "";
    setSlotFile(id, null);
  });
  $("intakeForm").addEventListener("submit", submit);

  openCountryModal();
})();
