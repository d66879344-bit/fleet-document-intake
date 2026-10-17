(function () {
  var MAX_BYTES = 20 * 1024 * 1024;
  var OK_TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  var EXT_TYPES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

  // Country-specific document sets, keyed by ISO code. Any country not listed here
  // falls back to GENERIC_DOCS below.
  var DOCS = {
    US: {
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
    ES: {
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
    GR: {
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
    GB: {
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
  // Fallback document set for any country without a specific list above.
  var GENERIC_DOCS = {
    driver: [
      { id: "license_front", label: "Driving license — front", required: true },
      { id: "license_back", label: "Driving license — back", required: true },
      { id: "professional_license", label: "Professional / taxi driver license", required: false }
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
  };
  var COUNTRY_NAMES = {};
  (window.WORLD_COUNTRIES || []).forEach(function (row) { COUNTRY_NAMES[row[0]] = row[1]; });

  var OTHER_SLOT = [{ id: "document", label: "Document", required: false }];

  var $ = function (id) { return document.getElementById(id); };
  var state = { country: null, files: {} };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
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
  function slotsFor(country, type) {
    var set = DOCS[country] || GENERIC_DOCS;
    return set[type] || [];
  }
  function hasFilesWithPrefix(prefix) {
    return Object.keys(state.files).some(function (k) { return k.indexOf(prefix + "_") === 0 && state.files[k]; });
  }

  /* ---------- country modal ---------- */
  function renderCountrySelect() {
    var rows = (window.WORLD_COUNTRIES || []).slice();
    var html = '<option value="" disabled selected>Select a country…</option>' +
      rows.map(function (r) { return '<option value="' + esc(r[0]) + '">' + esc(r[1]) + "</option>"; }).join("");
    $("countrySelect").innerHTML = html;
  }
  function openCountryModal() { $("countryModal").hidden = false; }
  function closeCountryModal() { $("countryModal").hidden = true; }
  function selectCountry(code) {
    state.country = code;
    state.files = {};
    $("countryLabel").textContent = COUNTRY_NAMES[code] || code;
    $("countryBar").hidden = false;
    $("formCard").hidden = false;
    closeCountryModal();
    renderAllSlots();
  }

  /* ---------- file slots ---------- */
  function renderSlotsInto(containerId, prefix, defs) {
    var el = $(containerId);
    if (!el) return;
    el.innerHTML = defs.map(function (d) {
      var fid = prefix + "_" + d.id;
      return '<div class="slot" id="slot-' + fid + '" data-id="' + fid + '">' +
        '<div class="slot-main"><span class="slot-label">' + esc(d.label) +
        (d.required ? '<span class="req">*</span>' : "") + '</span>' +
        '<div class="slot-file" id="slotfile-' + fid + '">No file selected</div></div>' +
        '<div class="slot-actions">' +
        '<label class="slot-btn" for="input-' + fid + '">Choose file</label>' +
        '<input type="file" id="input-' + fid + '" data-id="' + fid + '" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*">' +
        '<button type="button" class="slot-btn" data-clear="' + fid + '" hidden>Remove</button>' +
        "</div></div>";
    }).join("");
  }
  function renderAllSlots() {
    renderSlotsInto("slots-company", "company", slotsFor(state.country, "company"));
    renderSlotsInto("slots-vehicle1", "vehicle1", slotsFor(state.country, "vehicle"));
    renderSlotsInto("slots-vehicle2", "vehicle2", slotsFor(state.country, "vehicle"));
    renderSlotsInto("slots-driver1", "driver1", slotsFor(state.country, "driver"));
    renderSlotsInto("slots-driver2", "driver2", slotsFor(state.country, "driver"));
    renderSlotsInto("slots-other", "other", OTHER_SLOT);
  }
  function setSlotFile(fid, file, err) {
    var slot = $("slot-" + fid);
    if (!slot) return;
    var fileEl = $("slotfile-" + fid);
    var clearBtn = slot.querySelector("[data-clear]");
    if (err) {
      state.files[fid] = null;
      slot.classList.remove("filled"); slot.classList.add("error");
      fileEl.innerHTML = "No file selected" + '<div class="slot-err">' + esc(err) + "</div>";
      clearBtn.hidden = true;
      return;
    }
    if (!file) {
      delete state.files[fid];
      slot.classList.remove("filled", "error");
      fileEl.textContent = "No file selected";
      clearBtn.hidden = true;
      return;
    }
    state.files[fid] = file;
    slot.classList.add("filled"); slot.classList.remove("error");
    fileEl.textContent = file.name + " · " + fmtSize(file.size);
    clearBtn.hidden = false;
  }

  function setStatus(t, k) {
    var s = $("status");
    s.textContent = t || "";
    s.className = "status" + (k ? " " + k : "");
  }

  /* ---------- validation + submit ---------- */
  function validateRequiredSlots(prefix, type, errors, blockLabel) {
    slotsFor(state.country, type).forEach(function (d) {
      if (d.required && !state.files[prefix + "_" + d.id]) {
        errors.push(blockLabel + ": " + d.label);
      }
    });
  }

  async function submit(ev) {
    ev.preventDefault();
    if (!state.country) return;

    var company = $("company").value.trim();
    if (!company) { setStatus("Enter the company name.", "err"); $("company").focus(); return; }

    var v1ref = $("ref-vehicle1").value.trim().toUpperCase();
    var v2ref = $("ref-vehicle2").value.trim().toUpperCase();
    var d1ref = $("ref-driver1").value.trim();
    var d2ref = $("ref-driver2").value.trim();
    var otherDesc = $("otherDesc").value.trim();

    var errors = [];
    validateRequiredSlots("company", "company", errors, "Company");

    if (!v1ref) errors.push("Vehicle 1: plate number is required");
    validateRequiredSlots("vehicle1", "vehicle", errors, "Vehicle 1");

    var v2touched = !!v2ref || hasFilesWithPrefix("vehicle2");
    if (v2touched) {
      if (!v2ref) errors.push("Vehicle 2: plate number is required");
      validateRequiredSlots("vehicle2", "vehicle", errors, "Vehicle 2");
    }

    if (!d1ref) errors.push("Driver 1: driver name is required");
    validateRequiredSlots("driver1", "driver", errors, "Driver 1");

    var d2touched = !!d2ref || hasFilesWithPrefix("driver2");
    if (d2touched) {
      if (!d2ref) errors.push("Driver 2: driver name is required");
      validateRequiredSlots("driver2", "driver", errors, "Driver 2");
    }

    if (errors.length) {
      setStatus(errors[0] + (errors.length > 1 ? " (+" + (errors.length - 1) + " more)" : ""), "err");
      return;
    }

    var toUpload = Object.keys(state.files).filter(function (id) { return state.files[id]; });
    if (!toUpload.length) { setStatus("Add at least one file.", "err"); return; }

    $("submitBtn").disabled = true;
    setStatus("", "");
    $("progress").textContent = "Uploading " + toUpload.length + (toUpload.length === 1 ? " file…" : " files…");
    try {
      var fd = new FormData();
      fd.append("country", state.country);
      fd.append("countryName", COUNTRY_NAMES[state.country] || state.country);
      fd.append("company", company);
      fd.append("contact", $("contact").value.trim());
      fd.append("notes", $("notes").value.trim());
      fd.append("otherDescription", otherDesc);
      fd.append("vehicle1_ref", v1ref);
      fd.append("vehicle2_ref", v2ref);
      fd.append("driver1_ref", d1ref);
      fd.append("driver2_ref", d2ref);
      toUpload.forEach(function (fid) {
        var file = state.files[fid];
        fd.append("file_" + fid, file, file.name);
      });
      var res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("submit_failed");
      $("progress").textContent = "";
      setStatus("Uploaded. Thank you.", "ok");
      ["ref-vehicle1", "ref-vehicle2", "ref-driver1", "ref-driver2", "otherDesc", "notes"].forEach(function (id) {
        $(id).value = "";
      });
      state.files = {};
      renderAllSlots();
    } catch (e) {
      $("progress").textContent = "";
      setStatus("Something went wrong. Please try again.", "err");
    } finally {
      $("submitBtn").disabled = false;
    }
  }

  /* ---------- wiring ---------- */
  renderCountrySelect();
  $("countryContinue").addEventListener("click", function () {
    var code = $("countrySelect").value;
    if (!code) { $("countryModalErr").textContent = "Please select a country."; return; }
    $("countryModalErr").textContent = "";
    selectCountry(code);
  });
  $("changeCountry").addEventListener("click", openCountryModal);

  $("intakeForm").addEventListener("change", function (e) {
    var input = e.target.closest("input[type=file]"); if (!input) return;
    var fid = input.getAttribute("data-id");
    var file = input.files && input.files[0];
    if (!file) return;
    var t = typeFor(file);
    if (!t) { setSlotFile(fid, null, "Unsupported type. Use PDF, JPG, PNG, WebP or GIF."); input.value = ""; return; }
    if (file.size > MAX_BYTES) { setSlotFile(fid, null, "Larger than 20 MB."); input.value = ""; return; }
    setSlotFile(fid, file);
  });
  $("intakeForm").addEventListener("click", function (e) {
    var b = e.target.closest("[data-clear]"); if (!b) return;
    var fid = b.getAttribute("data-clear");
    var input = $("input-" + fid); if (input) input.value = "";
    setSlotFile(fid, null);
  });
  $("intakeForm").addEventListener("submit", submit);

  openCountryModal();
})();
