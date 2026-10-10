(function () {
  "use strict";

  var STORAGE_KEY = "hillcrest-water-watch-v1";
  var ZONE = "Africa/Johannesburg";

  var tabs = document.querySelectorAll(".tab");
  var panels = {
    status: document.getElementById("panel-status"),
    log: document.getElementById("panel-log"),
    official: document.getElementById("panel-official")
  };
  var form = document.getElementById("log-form");
  var areaSelect = document.getElementById("area");
  var otherWrap = document.getElementById("other-wrap");
  var formError = document.getElementById("form-error");
  var savedNote = document.getElementById("saved-note");
  var summary = document.getElementById("summary");
  var filters = document.getElementById("filters");
  var statusFilters = document.getElementById("status-filters");
  var list = document.getElementById("report-list");
  var copyNote = document.getElementById("copy-note");
  var areaBreakdown = document.getElementById("area-breakdown");
  var officialDraftNote = document.getElementById("official-draft-note");
  var filterArea = "all";
  var filterStatus = "active";
  var SCHEMA_VERSION = 1;

  var SAMPLE_REPORTS = [
    {
      id: "sample-demo-1",
      area: "Hillcrest",
      areaOther: "",
      place: "Demo: near Inanda Road turnoff",
      kind: "No water",
      started: hoursAgo(18),
      note: "Sample only — invented for a judge demo. Not a live city report.",
      municipalRef: "DEMO-REF-1042",
      createdAt: hoursAgo(17),
      resolvedAt: null,
      isSample: true
    },
    {
      id: "sample-demo-2",
      area: "Kloof",
      areaOther: "",
      place: "Demo: opposite sample park bench",
      kind: "Low pressure",
      started: hoursAgo(8),
      note: "Sample only — weak flow since morning in this invented scenario.",
      municipalRef: "",
      createdAt: hoursAgo(7),
      resolvedAt: null,
      isSample: true
    },
    {
      id: "sample-demo-3",
      area: "Waterfall",
      areaOther: "",
      place: "Demo: near fictional reservoir fence",
      kind: "Leak in the street",
      started: hoursAgo(30),
      note: "Sample only — pretend street leak for UI walkthrough.",
      municipalRef: "DEMO-REF-2210",
      createdAt: hoursAgo(29),
      resolvedAt: hoursAgo(4),
      isSample: true
    },
    {
      id: "sample-demo-4",
      area: "Gillits",
      areaOther: "",
      place: "Demo: sample cul-de-sac",
      kind: "Discoloured water",
      started: hoursAgo(5),
      note: "Sample only — brown tint in the invented log, not a real outage.",
      municipalRef: "",
      createdAt: hoursAgo(4.5),
      resolvedAt: null,
      isSample: true
    }
  ];

  function hoursAgo(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return [];
      return data.map(normalizeReport);
    } catch (err) {
      return [];
    }
  }

  function normalizeReport(item) {
    return {
      id: item.id,
      area: item.area || "",
      areaOther: item.areaOther || "",
      place: item.place || "",
      kind: item.kind || "",
      started: item.started || item.createdAt || new Date().toISOString(),
      note: item.note || "",
      municipalRef: item.municipalRef || "",
      createdAt: item.createdAt || new Date().toISOString(),
      resolvedAt: item.resolvedAt || null,
      isSample: Boolean(item.isSample)
    };
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function isResolved(item) {
    return Boolean(item.resolvedAt);
  }

  function formatWhen(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "time not set";
    return date.toLocaleString("en-ZA", {
      timeZone: ZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }) + " SAST";
  }

  function plural(count, word) {
    return count + " " + word + (count === 1 ? "" : "s");
  }

  function formatSpan(ms) {
    if (ms < 60000) return "under a minute";
    var totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 60) return plural(totalMinutes, "minute");
    var totalHours = Math.floor(ms / 3600000);
    if (totalHours < 24) return plural(totalHours, "hour");
    var days = Math.floor(totalHours / 24);
    var hours = totalHours % 24;
    if (!hours) return plural(days, "day");
    return plural(days, "day") + " " + plural(hours, "hour");
  }

  function durationPhrase(item) {
    var start = new Date(item.started).getTime();
    var end = isResolved(item) ? new Date(item.resolvedAt).getTime() : Date.now();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "";
    var span = formatSpan(end - start);
    return isResolved(item) ? "Lasted " + span : "Active for " + span;
  }

  function showPanel(name) {
    Object.keys(panels).forEach(function (key) {
      panels[key].hidden = key !== name;
    });
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-panel") === name;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () {
      showPanel(tab.getAttribute("data-panel"));
    });
    // Arrow keys, Home and End move between tabs, as screen-reader users expect.
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      showPanel(tabs[next].getAttribute("data-panel"));
      tabs[next].focus();
    });
  });

  areaSelect.addEventListener("change", function () {
    var other = areaSelect.value === "other";
    otherWrap.hidden = !other;
    document.getElementById("areaOther").required = other;
  });

  function setStartedDefault() {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    document.getElementById("started").value = local.toISOString().slice(0, 16);
  }
  setStartedDefault();

  function areaName(report) {
    return report.area === "other" ? report.areaOther : report.area;
  }

  function updateItem(id, updater) {
    var items = load();
    var next = items.map(function (row) {
      return row.id === id ? updater(row) : row;
    });
    save(next);
    render();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    formError.hidden = true;
    savedNote.textContent = "";
    var data = new FormData(form);
    var area = String(data.get("area") || "");
    var areaOther = String(data.get("areaOther") || "").trim();
    var kind = String(data.get("kind") || "");
    var started = String(data.get("started") || "");
    if (!area || !kind || !started || (area === "other" && !areaOther)) {
      formError.textContent = "Choose an area, what you are seeing, and when it started.";
      formError.hidden = false;
      return;
    }
    var report = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      area: area,
      areaOther: areaOther,
      place: String(data.get("place") || "").trim(),
      kind: kind,
      started: new Date(started).toISOString(),
      note: String(data.get("note") || "").trim(),
      municipalRef: String(data.get("municipalRef") || "").trim(),
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      isSample: false
    };
    var items = load();
    items.unshift(report);
    save(items);
    form.reset();
    otherWrap.hidden = true;
    setStartedDefault();
    savedNote.textContent = "Saved on this device only. It has not been sent to the municipality. Use Report officially if you still need to log it with eThekwini.";
    filterArea = "all";
    filterStatus = "active";
    render();
    showPanel("status");
  });

  document.getElementById("clear-logs").addEventListener("click", function () {
    if (!load().length) return;
    if (window.confirm("Clear every water log stored in this browser?")) {
      save([]);
      filterArea = "all";
      filterStatus = "active";
      copyNote.textContent = "";
      render();
    }
  });

  document.getElementById("clear-samples").addEventListener("click", function () {
    var items = load();
    var samples = items.filter(function (item) { return item.isSample; });
    if (!samples.length) {
      copyNote.textContent = "No sample demo logs on this device.";
      return;
    }
    if (window.confirm("Clear only the sample demo logs? Your own logs stay.")) {
      save(items.filter(function (item) { return !item.isSample; }));
      copyNote.textContent = "Sample demo logs cleared. This page did not contact the municipality.";
      render();
    }
  });

  document.getElementById("load-samples").addEventListener("click", function () {
    var items = load();
    var withoutOldSamples = items.filter(function (item) { return !item.isSample; });
    var stamped = SAMPLE_REPORTS.map(function (sample) {
      return normalizeReport(Object.assign({}, sample, {
        started: hoursAgo(sample.id === "sample-demo-1" ? 18 : sample.id === "sample-demo-2" ? 8 : sample.id === "sample-demo-3" ? 30 : 5),
        createdAt: hoursAgo(sample.id === "sample-demo-1" ? 17 : sample.id === "sample-demo-2" ? 7 : sample.id === "sample-demo-3" ? 29 : 4.5),
        resolvedAt: sample.id === "sample-demo-3" ? hoursAgo(4) : null
      }));
    });
    save(stamped.concat(withoutOldSamples));
    filterArea = "all";
    filterStatus = "all";
    copyNote.textContent = "Loaded sample demo logs for judging. They are invented Outer West scenarios, not live municipal data.";
    render();
    showPanel("status");
  });

  statusFilters.addEventListener("click", function (event) {
    var button = event.target.closest("[data-status]");
    if (!button) return;
    filterStatus = button.getAttribute("data-status");
    render();
  });

  document.getElementById("copy-summary").addEventListener("click", function () {
    var text = summaryText(load());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        copyNote.textContent = "Summary copied. Paste it yourself if you want to share it. This page did not send it.";
      }).catch(function () {
        copyNote.textContent = text;
      });
    } else {
      copyNote.textContent = text;
    }
  });

  function copyPlainText(text, statusEl, okMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        statusEl.textContent = okMessage;
      }).catch(function () {
        statusEl.textContent = text;
      });
    } else {
      statusEl.textContent = text;
    }
  }

  document.getElementById("export-logs").addEventListener("click", function () {
    var items = load();
    var payload = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      app: "hillcrest-water-watch",
      note: "Household logs from this browser only. Not municipal data. Not sent anywhere by this page.",
      reports: items
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "hillcrest-water-watch-logs.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    copyNote.textContent = items.length
      ? "Exported " + items.length + " log" + (items.length === 1 ? "" : "s") + " as hillcrest-water-watch-logs.json. Nothing was uploaded."
      : "Exported an empty log file. Nothing was uploaded.";
  });

  document.getElementById("import-logs").addEventListener("click", function () {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onerror = function () {
      copyNote.textContent = "Could not read that file. Nothing was changed on this device.";
    };
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result || ""));
      } catch (err) {
        copyNote.textContent = "That file is not valid JSON. Nothing was imported.";
        return;
      }
      var incoming = [];
      if (Array.isArray(parsed)) {
        incoming = parsed;
      } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.reports)) {
        incoming = parsed.reports;
      } else {
        copyNote.textContent = "JSON must be an array of reports, or an object with a reports array. Nothing was imported.";
        return;
      }
      var normalized = [];
      for (var i = 0; i < incoming.length; i++) {
        var row = incoming[i];
        if (!row || typeof row !== "object" || !row.id) {
          copyNote.textContent = "One or more reports are missing an id. Nothing was imported.";
          return;
        }
        if (!row.kind || !(row.area || row.areaOther)) {
          copyNote.textContent = "One or more reports are missing area or kind. Nothing was imported.";
          return;
        }
        normalized.push(normalizeReport(row));
      }
      var byId = {};
      load().forEach(function (item) { byId[item.id] = item; });
      var added = 0;
      var updated = 0;
      normalized.forEach(function (item) {
        if (byId[item.id]) updated += 1;
        else added += 1;
        byId[item.id] = item;
      });
      var merged = Object.keys(byId).map(function (id) { return byId[id]; });
      merged.sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      save(merged);
      filterArea = "all";
      filterStatus = "all";
      copyNote.textContent = "Imported " + normalized.length + " report" + (normalized.length === 1 ? "" : "s")
        + " (" + added + " new, " + updated + " updated). Merged by id; imported wins on the same id. Still only on this device — nothing was sent.";
      render();
      showPanel("status");
    };
    reader.readAsText(file);
  });

  document.getElementById("copy-official-draft").addEventListener("click", function () {
    var text = officialDraftText(load());
    copyPlainText(
      text,
      officialDraftNote,
      "Draft copied. Paste it into a call note, SMS, or WhatsApp yourself. This page did not open WhatsApp or send anything."
    );
  });

  function summaryText(items) {
    if (!items.length) {
      return "Hillcrest Water Watch: no household reports saved on this device. This is not an official eThekwini report. Fault line: 080 13 13 013.";
    }
    var lines = items.map(function (item) {
      var where = areaName(item) + (item.place ? " (" + item.place + ")" : "");
      var state = isResolved(item) ? "resolved " + formatWhen(item.resolvedAt) : "active";
      var ref = item.municipalRef ? " — ref " + item.municipalRef : "";
      var sample = item.isSample ? " [SAMPLE DEMO]" : "";
      var duration = durationPhrase(item);
      return where + " — " + item.kind + " — started " + formatWhen(item.started) + " — " + state + (duration ? " — " + duration : "") + ref + sample;
    });
    return [
      "Hillcrest Water Watch (this browser only, not the municipality):",
      lines.join("\n"),
      "Official fault line: 080 13 13 013. WhatsApp: 073 148 3477."
    ].join("\n");
  }

  function officialDraftText(items) {
    var active = items.filter(function (item) { return !isResolved(item); });
    if (!active.length) {
      return [
        "Hillcrest Water Watch household note (not an official municipal report):",
        "No active outage logs on this device right now.",
        "I still need to call or WhatsApp eThekwini myself if there is a fault.",
        "Water Services: 080 13 13 013. WhatsApp: 073 148 3477."
      ].join("\n");
    }
    var real = active.filter(function (item) { return !item.isSample; });
    var useSamples = !real.length;
    var chosen = useSamples ? active : real;
    var lines = chosen.map(function (item) {
      var where = areaName(item) + (item.place ? " (" + item.place + ")" : "");
      var ref = item.municipalRef ? "; municipal ref " + item.municipalRef : "";
      var sample = item.isSample ? " [SAMPLE DEMO — invented for judging]" : "";
      return "- " + where + ": " + item.kind + "; started " + formatWhen(item.started) + ref + sample;
    });
    var header = useSamples
      ? "Hillcrest Water Watch household note — active SAMPLE DEMO logs only (invented for judging, not live city data):"
      : "Hillcrest Water Watch household note — active logs from this device (not a live municipal feed):";
    return [
      header,
      lines.join("\n"),
      "This is a household note only. The person still needs to call or WhatsApp eThekwini themselves.",
      "Water Services: 080 13 13 013. WhatsApp: 073 148 3477."
    ].join("\n");
  }

  function renderAreaBreakdown(activeItems) {
    areaBreakdown.innerHTML = "";
    if (!activeItems.length) {
      areaBreakdown.hidden = true;
      return;
    }
    var byArea = {};
    activeItems.forEach(function (item) {
      var name = areaName(item) || "Unknown area";
      if (!byArea[name]) byArea[name] = { count: 0, kinds: {} };
      byArea[name].count += 1;
      byArea[name].kinds[item.kind || "Unspecified"] = (byArea[name].kinds[item.kind || "Unspecified"] || 0) + 1;
    });
    var names = Object.keys(byArea).sort();
    var heading = document.createElement("h3");
    heading.textContent = "Active by area";
    var intro = document.createElement("p");
    intro.textContent = "From logs on this device only — not a live municipal map.";
    var ul = document.createElement("ul");
    names.forEach(function (name) {
      var row = byArea[name];
      var li = document.createElement("li");
      var areaEl = document.createElement("span");
      areaEl.className = "area-name";
      areaEl.textContent = name;
      var countEl = document.createElement("span");
      countEl.className = "area-count";
      countEl.textContent = plural(row.count, "active report");
      var kindParts = Object.keys(row.kinds).sort().map(function (kind) {
        return row.kinds[kind] + "× " + kind;
      });
      var kindsEl = document.createElement("span");
      kindsEl.className = "area-kinds";
      kindsEl.textContent = kindParts.join(", ");
      li.appendChild(areaEl);
      li.appendChild(countEl);
      li.appendChild(kindsEl);
      ul.appendChild(li);
    });
    areaBreakdown.appendChild(heading);
    areaBreakdown.appendChild(intro);
    areaBreakdown.appendChild(ul);
    areaBreakdown.hidden = false;
  }

  function renderStatusChips() {
    statusFilters.querySelectorAll("[data-status]").forEach(function (button) {
      var on = button.getAttribute("data-status") === filterStatus;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function render() {
    var items = load();
    var activeItems = items.filter(function (item) { return !isResolved(item); });
    var activeNoWater = activeItems.filter(function (item) { return item.kind === "No water"; }).length;
    var areas = {};
    items.forEach(function (item) { areas[areaName(item)] = true; });
    var areaCount = Object.keys(areas).length;
    var headline = "Nothing logged";
    var tone = "ok";
    if (!items.length) {
      headline = "No reports";
      tone = "ok";
    } else if (activeNoWater) {
      headline = activeNoWater + (activeNoWater === 1 ? " active no-water" : " active no-water");
      tone = "alert";
    } else if (activeItems.length) {
      headline = activeItems.length + (activeItems.length === 1 ? " active report" : " active reports");
      tone = "warn";
    } else {
      headline = "All resolved";
      tone = "ok";
    }
    summary.innerHTML = "";
    [
      { tone: tone, label: "Active on this device", value: headline },
      { tone: "", label: "Active / total", value: activeItems.length + " / " + items.length },
      { tone: "", label: "Areas mentioned", value: String(areaCount) },
      { tone: "", label: "Newest", value: items.length ? formatWhen(items[0].createdAt) : "—" }
    ].forEach(function (stat) {
      var node = document.createElement("div");
      node.className = "stat " + stat.tone;
      var strong = document.createElement("strong");
      strong.textContent = stat.value;
      var span = document.createElement("span");
      span.textContent = stat.label;
      node.appendChild(strong);
      node.appendChild(span);
      summary.appendChild(node);
    });

    renderAreaBreakdown(activeItems);

    renderStatusChips();

    var names = Object.keys(areas).sort();
    filters.hidden = names.length < 2;
    filters.innerHTML = "";
    if (names.length >= 2) {
      ["all"].concat(names).forEach(function (name) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "chip" + (filterArea === name ? " is-active" : "");
        button.textContent = name === "all" ? "All areas" : name;
        button.setAttribute("aria-pressed", filterArea === name ? "true" : "false");
        button.addEventListener("click", function () {
          filterArea = name;
          render();
        });
        filters.appendChild(button);
      });
    }

    list.innerHTML = "";
    var visible = items.filter(function (item) {
      var areaOk = filterArea === "all" || areaName(item) === filterArea;
      var statusOk = filterStatus === "all"
        || (filterStatus === "active" && !isResolved(item))
        || (filterStatus === "resolved" && isResolved(item));
      return areaOk && statusOk;
    });
    if (!visible.length) {
      var empty = document.createElement("li");
      empty.className = "empty";
      if (!items.length) {
        empty.textContent = "No household has logged an outage in this browser yet. Open Log an outage to add one, or load sample demo logs for a judge walkthrough. This list is not a feed from the city.";
      } else if (filterStatus === "active") {
        empty.textContent = "No active logs match this filter. Try Resolved or All, or load sample demo logs.";
      } else if (filterStatus === "resolved") {
        empty.textContent = "No resolved logs match this filter.";
      } else {
        empty.textContent = "No logs for that area on this device.";
      }
      list.appendChild(empty);
      return;
    }
    visible.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "card" + (isResolved(item) ? " is-resolved" : "") + (item.isSample ? " is-sample" : "");
      li.setAttribute("data-kind", String(item.kind || "").toLowerCase().replace(/[^a-z]+/g, "-"));

      var header = document.createElement("header");
      var titleRow = document.createElement("div");
      titleRow.className = "title-row";
      var h = document.createElement("h3");
      h.className = "kind";
      h.textContent = item.kind;
      titleRow.appendChild(h);

      var stateBadge = document.createElement("span");
      stateBadge.className = "badge " + (isResolved(item) ? "badge-resolved" : "badge-active");
      stateBadge.textContent = isResolved(item) ? "Resolved" : "Active";
      titleRow.appendChild(stateBadge);

      if (item.isSample) {
        var sampleBadge = document.createElement("span");
        sampleBadge.className = "badge badge-sample";
        sampleBadge.textContent = "Sample";
        titleRow.appendChild(sampleBadge);
      }

      var actions = document.createElement("div");
      actions.className = "card-actions";

      var resolveBtn = document.createElement("button");
      resolveBtn.type = "button";
      resolveBtn.className = "btn ghost small";
      resolveBtn.textContent = isResolved(item) ? "Mark active" : "Mark resolved";
      resolveBtn.addEventListener("click", function () {
        updateItem(item.id, function (row) {
          row.resolvedAt = isResolved(row) ? null : new Date().toISOString();
          return row;
        });
      });

      var refBtn = document.createElement("button");
      refBtn.type = "button";
      refBtn.className = "btn ghost small";
      refBtn.textContent = item.municipalRef ? "Edit ref" : "Add ref";
      refBtn.addEventListener("click", function () {
        var next = window.prompt(
          "Municipal reference number (optional). Leave blank to clear. This stays on this device only.",
          item.municipalRef || ""
        );
        if (next === null) return;
        updateItem(item.id, function (row) {
          row.municipalRef = String(next).trim().slice(0, 40);
          return row;
        });
      });

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn ghost small";
      remove.textContent = "Remove";
      remove.addEventListener("click", function () {
        save(load().filter(function (row) { return row.id !== item.id; }));
        render();
      });

      actions.appendChild(resolveBtn);
      actions.appendChild(refBtn);
      actions.appendChild(remove);
      header.appendChild(titleRow);
      header.appendChild(actions);

      var where = document.createElement("p");
      where.className = "meta";
      where.textContent = areaName(item) + (item.place ? " · " + item.place : "");

      var when = document.createElement("p");
      when.className = "meta";
      var whenText = "Started " + formatWhen(item.started) + ". Saved " + formatWhen(item.createdAt) + ".";
      if (isResolved(item)) {
        whenText += " Resolved " + formatWhen(item.resolvedAt) + ".";
      }
      when.textContent = whenText;

      li.appendChild(header);
      li.appendChild(where);
      var phrase = durationPhrase(item);
      if (phrase) {
        var duration = document.createElement("p");
        duration.className = "duration";
        duration.textContent = phrase;
        li.appendChild(duration);
      }
      li.appendChild(when);

      if (item.municipalRef) {
        var ref = document.createElement("p");
        ref.className = "ref-line";
        ref.innerHTML = "";
        var label = document.createElement("strong");
        label.textContent = "Municipal ref: ";
        ref.appendChild(label);
        ref.appendChild(document.createTextNode(item.municipalRef));
        li.appendChild(ref);
      }

      if (item.note) {
        var note = document.createElement("p");
        note.className = "card-note";
        note.textContent = item.note;
        li.appendChild(note);
      }

      list.appendChild(li);
    });
  }

  render();

  // Recording mode: opening index.html#demo refreshes the labelled sample logs
  // (your own logs stay), shows Neighbourhood status, and scrolls to the top,
  // so a demo recording starts from the same screen every time without any
  // confirm dialogs on camera.
  if (/^#demo\b/.test(location.hash)) {
    document.getElementById("load-samples").click();
    filterStatus = "active";
    render();
    copyNote.textContent = "";
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    window.scrollTo(0, 0);
  }
})();
