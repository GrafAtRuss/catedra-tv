/* Кафедра — Samsung UE49N5500, Tizen 4.0. Без ES2020: нет ?. и ??. */
/* Версия совпадает с src/lib/version.ts и config.xml. */
var APP_VERSION = "1.2.1";
var CHANNEL = "UCv_ztXSXtfmUW_fSF08kFIA";
var EMBED = "https://kinescope.io/embed/0ctuKXYjVsu6o6C5LUe6Fj";
var PAGE = "https://kinescope.io/0ctuKXYjVsu6o6C5LUe6Fj";
var SCHEDULE_URL = "https://catedra.ru/schedule";
var RSS = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL;
var DAYS = ["ВОСКРЕСЕНЬЕ", "ПОНЕДЕЛЬНИК", "ВТОРНИК", "СРЕДА", "ЧЕТВЕРГ", "ПЯТНИЦА", "СУББОТА"];
var DAY_INDEX = { ВОСКРЕСЕНЬЕ: 0, ПОНЕДЕЛЬНИК: 1, ВТОРНИК: 2, СРЕДА: 3, ЧЕТВЕРГ: 4, ПЯТНИЦА: 5, СУББОТА: 6 };
var SETTINGS_KEY = "catedra-settings-v1";

function svc(time, title, end, note) {
  return { time: time, end: end || null, title: title, note: note || "" };
}

var FALLBACK = [
  {
    title: "Обычное расписание",
    days: [
      { name: "ВОСКРЕСЕНЬЕ", items: [
        svc("08:30", "Святая Месса на польском языке"),
        svc("10:00", "Святая Месса (Сумма) на русском языке"),
        svc("11:45", "Святая Месса на русском языке с участием детей"),
        svc("13:00", "Святая Месса на польском языке"),
        svc("14:30", "Святая Месса на испанском языке (4 воскресенье месяца — на португальском языке)"),
        svc("15:30", "Божественная Литургия армянского обряда"),
        svc("17:30", "Святая Месса на русском языке"),
        svc("20:00", "Святая Месса на русском языке")
      ]},
      { name: "ПОНЕДЕЛЬНИК", items: [svc("07:45", "Святая Месса на русском языке (без проповеди)"), svc("08:20", "Поклонение Пресвятым Дарам", "10:00"), svc("19:00", "Святая Месса на русском языке")] },
      { name: "ВТОРНИК", items: [svc("07:45", "Святая Месса на русском языке (без проповеди)"), svc("08:20", "Поклонение Пресвятым Дарам", "10:00"), svc("19:00", "Святая Месса на русском языке")] },
      { name: "СРЕДА", items: [svc("07:45", "Святая Месса на русском языке (без проповеди)"), svc("08:20", "Поклонение Пресвятым Дарам", "10:00"), svc("18:00", "Святая Месса на русском языке", null, "После Св. Мессы — новенна к Матери Божией, Помощнице христиан")] },
      { name: "ЧЕТВЕРГ", items: [svc("07:45", "Святая Месса на русском языке (без проповеди)"), svc("08:20", "Поклонение Пресвятым Дарам", "18:45"), svc("19:00", "Святая Месса на русском языке")] },
      { name: "ПЯТНИЦА", items: [svc("07:45", "Святая Месса на русском языке (без проповеди)"), svc("08:20", "Поклонение Пресвятым Дарам", "10:00"), svc("13:00", "Божественная Литургия армянского обряда"), svc("18:00", "Поклонение Пресвятым Дарам и Вечерня"), svc("19:00", "Святая Месса на русском языке")] },
      { name: "СУББОТА", items: [svc("07:45", "Святая Месса на русском языке (без проповеди)"), svc("08:20", "Поклонение Пресвятым Дарам", "10:00"), svc("18:00", "Святая Месса (по воскресному чину) на русском языке")] }
    ]
  },
  { title: "Византийский обряд", days: [{ name: "ВОСКРЕСЕНЬЕ", items: [svc("09:00", "Утреня"), svc("10:00", "Божественная Литургия"), svc("12:00", "Божественная Литургия на церковнославянском языке", null, "Переносится на 9:00, когда служится Месса по Миссалу 1962 года")] }] },
  { title: "Армянский обряд", days: [{ name: "ВОСКРЕСЕНЬЕ", items: [svc("15:30", "Божественная Литургия")] }, { name: "ПЯТНИЦА", items: [svc("13:00", "Божественная Литургия")] }] },
  { title: "Испанский язык", days: [{ name: "ВОСКРЕСЕНЬЕ", items: [svc("14:30", "Святая Месса на испанском языке")] }] }
];

var state = {
  screen: "home",
  back: "home",
  sections: FALLBACK,
  notice: "Сохранённое расписание. Обновление с сайта…",
  liveSource: false,
  recordings: [],
  channelTitle: "Приход Непорочного Зачатия Пресвятой Девы Марии",
  recError: "",
  section: 0,
  day: 0,
  watch: null,
  hls: "",
  poster: "",
  onAir: null,
  forceLive: false,
  streamTitle: "Св. Месса",
  liveKind: "native",
  status: "",
  settings: { proxyOn: false, proxyMode: "prefix", proxyUrl: "", youtubeBase: "", streamOverride: "" }
};

function pad2(n) {
  n = String(n);
  return n.length < 2 ? "0" + n : n;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

function loadSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    var p = JSON.parse(raw);
    state.settings.proxyOn = !!p.proxyOn;
    state.settings.proxyMode = p.proxyMode === "query" ? "query" : "prefix";
    state.settings.proxyUrl = p.proxyUrl || "";
    state.settings.youtubeBase = p.youtubeBase || "";
    state.settings.streamOverride = p.streamOverride || "";
  } catch (e) {}
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch (e) {}
}

function applyProxy(url) {
  var s = state.settings;
  if (!s.proxyOn) return url;
  var base = (s.proxyUrl || "").replace(/^\s+|\s+$/g, "");
  if (!base) return url;
  if (s.proxyMode === "query") {
    if (/[?&]url=$/i.test(base)) return base + encodeURIComponent(url);
    return base + (base.indexOf("?") >= 0 ? "&" : "?") + "url=" + encodeURIComponent(url);
  }
  return base.replace(/\/$/, "") + "/" + url;
}

function xhrText(url, cb) {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = 15000;
    try { xhr.setRequestHeader("X-Catedra-Fetch", "1"); } catch (e0) {}
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) cb(null, xhr.responseText || "");
      else cb(new Error("HTTP " + xhr.status));
    };
    xhr.onerror = function () { cb(new Error("network")); };
    xhr.ontimeout = function () { cb(new Error("timeout")); };
    xhr.send();
  } catch (e) { cb(e); }
}

function stripTags(v) {
  return String(v)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u0026nbsp;/gi, " ")
    .replace(/\u0026amp;/gi, "&")
    .replace(/\u0026quot;/gi, '"')
    .replace(/\u0026#39;/gi, "'")
    .replace(/\u0026apos;/gi, "'")
    .replace(/\u0026#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/\u00a0/g, " ")
    .replace(/^\s+|\s+$/g, "");
}

function parseLines(text) {
  var items = [];
  var lines = String(text).split("\n");
  var i;
  for (i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    if (!line) continue;
    var m = line.match(/^(\d{1,2})[:.](\d{2})\s*(?:[-–—]\s*(\d{1,2})[:.](\d{2}))?\s*[-–—]?\s*(.*)$/);
    if (!m) {
      if (items.length) items[items.length - 1].note = (items[items.length - 1].note ? items[items.length - 1].note + " " : "") + line;
      continue;
    }
    var title = (m[5] || "").replace(/^[-–—]\s*/, "").replace(/^\s+|\s+$/g, "");
    items.push({
      time: pad2(m[1]) + ":" + pad2(m[2]),
      end: m[3] ? pad2(m[3]) + ":" + pad2(m[4]) : null,
      title: title || "Богослужение",
      note: ""
    });
  }
  return items;
}

function readUntilDivClose(html, start) {
  var i = start;
  var depth = 1;
  var text = "";
  while (i < html.length && depth > 0) {
    if (html.charAt(i) === "<") {
      var close = html.indexOf(">", i);
      if (close < 0) break;
      var tag = html.substring(i + 1, close).replace(/^\s+|\s+$/g, "").toLowerCase();
      var name = tag.replace(/^\//, "").split(/[\s\/]/)[0];
      var closing = tag.charAt(0) === "/";
      var selfClose = /\/$/.test(tag) || name === "br";
      if (name === "br") text += "\n";
      if (name === "div" && !selfClose) depth += closing ? -1 : 1;
      i = close + 1;
      if (depth === 0) break;
    } else {
      text += html.charAt(i);
      i += 1;
    }
  }
  return { text: text, end: i };
}

function parseSchedule(html) {
  var rows = [];
  var re = /t521__(time|text)/g;
  var events = [];
  var found;
  while ((found = re.exec(html))) {
    var gt = html.indexOf(">", found.index);
    if (gt < 0) break;
    var read = readUntilDivClose(html, gt + 1);
    events.push({ kind: found[1], text: stripTags(read.text) });
    re.lastIndex = Math.max(read.end, found.index + 1);
  }
  var i, t;
  for (i = 0; i < events.length; i++) {
    if (events[i].kind !== "time") continue;
    var textEv = null;
    for (t = i + 1; t < events.length; t++) if (events[t].kind === "text") { textEv = events[t]; break; }
    if (!textEv) continue;
    var name = events[i].text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").toUpperCase();
    if (!DAY_INDEX.hasOwnProperty(name)) continue;
    var items = parseLines(textEv.text);
    if (items.length) rows.push({ name: name, items: items });
  }
  var sections = [];
  var current = [];
  var prev = -1;
  function titleFor(index, days) {
    if (index === 0) return "Обычное расписание";
    var blob = "";
    var d, j;
    for (d = 0; d < days.length; d++) for (j = 0; j < days[d].items.length; j++) blob += " " + days[d].items[j].title + " " + (days[d].items[j].note || "");
    blob = blob.toLowerCase();
    if (blob.indexOf("утрен") >= 0 || blob.indexOf("церковнослав") >= 0) return "Византийский обряд";
    if (blob.indexOf("испан") >= 0 || blob.indexOf("португал") >= 0) return "Испанский язык";
    if (blob.indexOf("армян") >= 0) return "Армянский обряд";
    var names = ["Обычное расписание", "Византийский обряд", "Армянский обряд", "Испанский язык"];
    return names[index] || "Дополнительно";
  }
  function flush() {
    if (!current.length) return;
    sections.push({ title: titleFor(sections.length, current), days: current });
    current = [];
  }
  for (var r = 0; r < rows.length; r++) {
    var idx = DAY_INDEX[rows[r].name];
    if (current.length && idx <= prev) flush();
    current.push(rows[r]);
    prev = idx;
  }
  flush();
  return sections;
}

function moscowClock() {
  var formatted = "";
  try {
    formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Moscow",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
  } catch (e) {
    var d = new Date(Date.now() + (180 + new Date().getTimezoneOffset()) * 60000);
    formatted = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] + " " + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  }
  var wk = formatted.slice(0, 3);
  var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var tm = formatted.match(/(\d{2}):(\d{2})/);
  var hh = tm ? parseInt(tm[1], 10) % 24 : 0;
  var mm = tm ? parseInt(tm[2], 10) : 0;
  var idx = map[wk] || 0;
  return { idx: idx, name: DAYS[idx], minutes: hh * 60 + mm, label: pad2(hh) + ":" + pad2(mm) };
}

function toMin(hhmm) {
  var p = String(hhmm).split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function agenda() {
  var clock = moscowClock();
  var main = state.sections[0];
  var today = [];
  var dayName = clock.name;
  var i;
  if (main) {
    for (i = 0; i < main.days.length; i++) {
      if (DAY_INDEX[main.days[i].name] === clock.idx) {
        today = main.days[i].items;
        dayName = main.days[i].name;
      }
    }
  }
  var current = null;
  var next = null;
  for (i = 0; i < today.length; i++) {
    var start = toMin(today[i].time);
    var end = today[i].end ? toMin(today[i].end) : start + 70;
    if (clock.minutes >= start && clock.minutes < end) current = today[i];
    if (clock.minutes < start && !next) next = today[i];
  }
  var nextDay = dayName;
  if (!next && main) {
    var step;
    for (step = 1; step <= 7; step++) {
      var idx = (clock.idx + step) % 7;
      for (i = 0; i < main.days.length; i++) {
        if (DAY_INDEX[main.days[i].name] === idx && main.days[i].items.length) {
          next = main.days[i].items[0];
          nextDay = main.days[i].name;
          step = 8;
          break;
        }
      }
    }
  }
  return { clock: clock, today: today, current: current, next: next, nextDay: nextDay };
}

function shell(body) {
  var a = agenda();
  var nav = [
    ["home", "Главная"],
    ["live", "1 Эфир"],
    ["schedule", "2 Расписание"],
    ["archive", "3 Записи"],
    ["settings", "4 Настройки"],
    ["install", "5 На ТВ"]
  ];
  var navHtml = "";
  var n;
  for (n = 0; n < nav.length; n++) {
    var on = state.screen === nav[n][0] || (state.screen === "watch" && nav[n][0] === "archive");
    navHtml += '<button class="' + (on ? "on" : "") + '" data-tv="1" data-act="go" data-arg="' + nav[n][0] + '">' + nav[n][1] + "</button>";
  }
  return (
    '<header class="hd">' +
      '<img class="mark" src="icon.png" alt="">' +
      '<button data-tv="1" data-act="go" data-arg="home" style="background:none;border:0;text-align:left"><div class="brand">Кафедра <span class="ver">' + APP_VERSION + '</span></div><div class="sub">Римско-католический кафедральный собор Непорочного Зачатия Пресвятой Девы Марии в Москве</div></button>' +
      '<div class="clock"><b>' + esc(a.clock.label) + '</b><span>МСК · ' + esc(a.clock.name) + "</span></div>" +
    "</header>" +
    '<div class="main">' + body + "</div>" +
    '<nav class="nav">' + navHtml + "</nav>"
  );
}

function homeHtml() {
  var a = agenda();
  var today = "";
  var i;
  for (i = 0; i < a.today.length; i++) {
    today += '<div class="svc"><div class="tm">' + esc(a.today[i].time) + '</div><div>' + esc(a.today[i].title) + (a.today[i].end ? '<span class="note">до ' + esc(a.today[i].end) + "</span>" : "") + "</div></div>";
  }
  if (!today) today = '<p class="muted">В обычном расписании на этот день служб нет.</p>';
  var rites = "";
  for (i = 0; i < state.sections.length; i++) {
    rites += '<button data-tv="1" data-act="section-go" data-arg="' + i + '">' + esc(state.sections[i].title) + "</button>";
  }
  var clips = "";
  var n = state.recordings.length < 4 ? state.recordings.length : 4;
  for (i = 0; i < n; i++) {
    clips += '<button class="tile" data-tv="1" data-act="watch" data-arg="' + esc(state.recordings[i].id) + '">' +
      (state.recordings[i].thumb ? '<img alt="" src="' + esc(state.recordings[i].thumb) + '">' : "") +
      "<span>" + esc(state.recordings[i].title) + "</span></button>";
  }
  if (!clips) clips = '<p class="muted">Последние эфиры канала прихода на YouTube появятся здесь.</p>';
  var poster = state.poster ? '<img alt="" src="' + esc(state.poster) + '"><div class="shade"></div>' : "";
  var now = a.current
    ? '<p class="kicker">Сейчас</p><h2>' + esc(a.current.time + "  " + a.current.title) + "</h2>" + (a.current.end ? '<p class="muted">до ' + esc(a.current.end) + "</p>" : "")
    : '<h2>Сейчас службы нет</h2>';
  var next = a.next ? '<p>Дальше ' + esc(a.next.time + "  " + a.next.title) + "</p>" : "";
  return (
    '<div class="row">' +
      '<button class="card hero" data-tv="1" data-act="go" data-arg="live">' + poster +
        '<div class="inn"><span class="pill">ПРЯМОЙ ЭФИР</span><h1>Святая Месса</h1>' +
        '<div class="lead">Трансляция с catedra.ru/online через Kinescope.</div>' +
        '<span class="go">Смотреть</span></div></button>' +
      '<section class="card side"><div class="kicker">Расписание · МСК</div>' + now + next +
        '<div class="chips">' + rites + "</div>" +
        '<p class="muted">' + esc(state.notice) + "</p></section></div>" +
    '<section class="card today"><h2>Сегодня</h2>' + today + "</section>" +
    '<section class="card today"><h2>Записи</h2><div class="grid">' + clips + "</div></section>" +
    '<button class="card today" data-tv="1" data-act="go" data-arg="settings" style="text-align:left;width:100%"><h2>Настройки</h2>' +
      '<p class="muted">Прокси: префикс http://хост:порт или параметр url. Свой Invidious или Piped и запасная ссылка на эфир, в том числе .m3u8.</p></button>'
  );
}

function scheduleHtml() {
  var sections = state.sections;
  var sIdx = state.section;
  if (sIdx >= sections.length) sIdx = 0;
  var section = sections[sIdx];
  var tabs = "";
  var i;
  for (i = 0; i < sections.length; i++) {
    tabs += '<button data-tv="1" data-act="section" data-arg="' + i + '" class="' + (i === sIdx ? "on" : "") + '">' + esc(sections[i].title) + "</button>";
  }
  var days = "";
  var dIdx = state.day;
  if (dIdx >= section.days.length) dIdx = 0;
  for (i = 0; i < section.days.length; i++) {
    var nm = section.days[i].name;
    days += '<button data-tv="1" data-act="day" data-arg="' + i + '" class="' + (i === dIdx ? "on" : "") + '">' + esc(nm.charAt(0) + nm.slice(1).toLowerCase()) + "</button>";
  }
  var items = section.days[dIdx].items;
  var list = "";
  for (i = 0; i < items.length; i++) {
    list += '<div class="svc ' + (i % 2 ? "alt" : "") + '"><div class="tm">' + esc(items[i].time) + "</div><div>" + esc(items[i].title) +
      (items[i].end ? '<span class="note">до ' + esc(items[i].end) + "</span>" : "") +
      (items[i].note ? '<span class="note">' + esc(items[i].note) + "</span>" : "") + "</div></div>";
  }
  return '<h1 style="font-size:48px">Расписание</h1><p class="muted">' + esc(state.notice) + '</p>' +
    '<div style="margin:16px 0"><button class="go" data-tv="1" data-act="go" data-arg="live">Открыть эфир</button></div>' +
    '<div class="tabs">' + tabs + "</div><div class=\"tabs\">" + days + '</div><div class="card list">' + list + "</div>";
}

function archiveHtml() {
  var html = "<h1 style=\"font-size:48px\">Записи</h1><p class=\"muted\">" + esc(state.channelTitle) + "</p>";
  if (state.recError) html += '<div class="box"><p>' + esc(state.recError) + '</p><button class="go" data-tv="1" data-act="reload-rec">Повторить</button></div>';
  if (!state.recordings.length && !state.recError) html += '<p class="muted">Загрузка…</p>';
  html += '<div class="grid">';
  var i;
  for (i = 0; i < state.recordings.length; i++) {
    var it = state.recordings[i];
    html += '<button class="tile" data-tv="1" data-act="watch" data-arg="' + esc(it.id) + '">' +
      (it.thumb ? '<img alt="" src="' + esc(it.thumb) + '">' : "") +
      "<span><b>" + esc(it.title) + '</b><span class="note">' + esc(it.when || "") + "</span></span></button>";
  }
  html += "</div>";
  return html;
}

function youtubeSrc(id) {
  var base = (state.settings.youtubeBase || "").replace(/\/$/, "").replace(/^\s+|\s+$/g, "");
  var direct = base
    ? base + "/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0"
    : "https://www.youtube.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&modestbranding=1";
  return state.settings.proxyOn ? applyProxy(direct) : direct;
}

function playerChrome(kicker, title, inner) {
  return '<div class="player"><div class="pbar"><button class="back" data-tv="1" data-act="back">Назад</button><div><div class="kicker">' +
    esc(kicker) + "</div><div>" + esc(title) + "</div></div></div>" + inner + "</div>";
}

function offlineHtml() {
  var a = agenda();
  var line = "Ближайшая служба появится в расписании.";
  if (a.current) {
    line = "По расписанию сейчас " + a.current.time + " " + a.current.title + (a.current.end ? ", до " + a.current.end : "") + ". Эфир ещё не включён.";
  } else if (a.next) {
    line = "Ближайшая служба — " + a.next.time + " " + a.next.title + (a.nextDay ? ", " + a.nextDay.toLowerCase() : "") + ".";
  }
  return '<div class="offline"><img class="bg" alt="" src="splash.jpg"><div class="veil"></div><div class="inn">' +
    '<img class="seal" alt="" src="icon.png">' +
    '<div class="kicker">ПРЯМОЙ ЭФИР</div>' +
    '<h2>Сейчас трансляции нет</h2>' +
    '<p class="when">' + esc(line) + "</p>" +
    '<p class="muted quiet">Плеер откроется здесь сам, когда начнётся трансляция.</p>' +
    '<button class="plain" data-tv="1" data-act="force-live">Открыть плеер всё равно</button></div></div>';
}

function liveHtml() {
  var kind = state.liveKind;
  var showPlayer = state.onAir === true || state.forceLive;
  var stage = '<div class="stage">';
  if (state.onAir === null && !state.forceLive) {
    stage = '<div class="offline"><img class="bg" alt="" src="splash.jpg"><div class="veil"></div><div class="inn">' +
      '<img class="seal" alt="" src="icon.png"><div class="kicker">ПРЯМОЙ ЭФИР</div><h2>Проверяем эфир</h2>' +
      '<p class="muted quiet">Если трансляции нет, здесь останется объявление.</p></div></div>';
  } else if (!showPlayer) stage = offlineHtml();
  else if (kind === "iframe") stage += '<iframe src="' + esc(currentEmbed()) + '" allowfullscreen></iframe></div>';
  else if (kind === "video") stage += '<video id="html5" src="' + esc(currentHls()) + '" autoplay controls></video></div>';
  else stage += '<div class="inn" style="padding:24px"><p class="warn">' + esc(state.status || "Открываю поток телевизионным плеером…") + "</p></div></div>";
  var modes = showPlayer
    ? '<div class="chips" style="margin-top:12px">' +
      '<button data-tv="1" data-act="live-mode" data-arg="native" class="' + (kind === "native" ? "on" : "") + '">Плеер ТВ</button>' +
      '<button data-tv="1" data-act="live-mode" data-arg="video" class="' + (kind === "video" ? "on" : "") + '">Видео</button>' +
      '<button data-tv="1" data-act="live-mode" data-arg="iframe" class="' + (kind === "iframe" ? "on" : "") + '">Сайт Kinescope</button></div>'
    : "";
  return playerChrome("Прямой эфир", state.streamTitle, stage + modes + (state.status && showPlayer && kind !== "native" ? '<p class="muted">' + esc(state.status) + "</p>" : ""));
}

function watchHtml() {
  var w = state.watch;
  if (!w) return "<p>Нет записи</p>";
  return playerChrome("Запись", w.title, '<div class="stage"><iframe src="' + esc(youtubeSrc(w.id)) + '" allowfullscreen></iframe></div>');
}

function field(label, id, value, placeholder) {
  return "<label>" + label + '</label><input id="' + id + '" data-tv="1" type="text" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '">';
}

function settingsHtml() {
  var s = state.settings;
  var sample = applyProxy(RSS);
  return '<h1 style="font-size:48px">Настройки</h1><p class="muted">Сохраняются в памяти телевизора.</p>' +
    '<section class="box"><button class="switch ' + (s.proxyOn ? "on" : "") + '" data-tv="1" data-act="toggle-proxy">' + (s.proxyOn ? "Прокси включён" : "Прокси выключен") + "</button>" +
    "<h2>Прокси</h2><p class=\"muted\">Если YouTube или поток с телевизора не открываются.</p><div style=\"clear:both\"></div>" +
    '<div class="tabs"><button data-tv="1" data-act="proxy-mode" data-arg="prefix" class="' + (s.proxyMode === "prefix" ? "on" : "") + '">Префикс хост:порт</button>' +
    '<button data-tv="1" data-act="proxy-mode" data-arg="query" class="' + (s.proxyMode === "query" ? "on" : "") + '">Параметр url</button></div>' +
    field(s.proxyMode === "prefix" ? "Адрес, например http://192.168.1.10:8888" : "База с параметром url", "proxyUrl", s.proxyUrl, "http://192.168.1.10:8888") +
    '<p class="note">' + (s.proxyOn && s.proxyUrl ? "Запрос ленты: " + esc(sample) : "Префикс склеивает адрес прокси и исходную ссылку. Параметр url дописывает ссылку в конец.") + "</p></section>" +
    '<section class="box"><h2>Записи YouTube</h2>' +
    field("Invidious или Piped. Пусто — обычный YouTube.", "ytBase", s.youtubeBase, "https://yewtu.be") +
    '<p class="note">Плеер откроет ваш-адрес/embed/ID. Так записи идут, когда встроенный YouTube на ТВ молчит.</p></section>' +
    '<section class="box"><h2>Трансляция</h2>' +
    field("Своя ссылка Kinescope или .m3u8. Пусто — официальный эфир.", "streamUrl", s.streamOverride, PAGE) +
    '<p class="note">На UE49N5500 надёжнее прямая .m3u8: её играет плеер телевизора, без нового сайта Kinescope.</p></section>' +
    '<section class="box"><img class="copy-icon" src="icon.png" alt=""><h2>О программе</h2>' +
    '<p>Автор — Ермаков Алексей Сергеевич</p>' +
    '<p class="warn">alexey@ermakov-mail.ru</p>' +
    '<p class="muted">Версия ' + APP_VERSION + '</p><div style="clear:both"></div></section>' +
    '<button class="back" data-tv="1" data-act="reset">Сбросить настройки</button>';
}

function installHtml() {
  return '<h1 style="font-size:48px">Это приложение на ТВ</h1>' +
    '<div class="step"><b class="warn">Пульт. </b>Стрелки и OK. «Назад» — на предыдущий экран, с главного экрана — выход. Цифры 1–5: эфир, расписание, записи, настройки, справка. Красная — эфир, зелёная — расписание, жёлтая — записи, синяя — настройки.</div>' +
    '<div class="step">Эфир берётся с Kinescope (' + esc(PAGE) + "). Если картинки нет, в настройках переключите «Видео» или «Сайт Kinescope», либо вставьте ссылку .m3u8.</div>" +
    '<div class="step">Расписание читается с catedra.ru/schedule. Записи — с канала прихода на YouTube. Прокси и Invidious задаются в настройках.</div>';
}

function currentHls() {
  var o = (state.settings.streamOverride || "").replace(/^\s+|\s+$/g, "");
  if (o && /\.m3u8(\?|$)/i.test(o)) return state.settings.proxyOn ? applyProxy(o) : o;
  if (state.hls) return state.settings.proxyOn ? applyProxy(state.hls) : state.hls;
  return "";
}

function currentEmbed() {
  var o = (state.settings.streamOverride || "").replace(/^\s+|\s+$/g, "");
  var page = EMBED;
  if (o && !/\.m3u8(\?|$)/i.test(o)) {
    page = o;
    if (page.indexOf("kinescope.io/") >= 0 && page.indexOf("/embed/") < 0) page = page.replace("kinescope.io/", "kinescope.io/embed/");
  }
  if (page.indexOf("autoplay=") < 0) page += (page.indexOf("?") >= 0 ? "&" : "?") + "autoplay=1";
  return state.settings.proxyOn ? applyProxy(page) : page;
}

function nativePayload() {
  var items = [];
  var a = agenda();
  var i;
  items.push({
    id: "live",
    kind: "live",
    title: state.streamTitle || "Прямой эфир",
    text: "Смотреть мессу",
    poster: state.poster || ""
  });
  var today = a.today || [];
  for (i = 0; i < today.length && i < 6; i++) {
    items.push({
      id: "svc-" + i,
      kind: "event",
      title: today[i].time + "  " + today[i].title,
      text: a.clock && a.clock.name ? a.clock.name : "Сегодня",
      poster: ""
    });
  }
  for (i = 0; i < state.recordings.length && i < 8; i++) {
    items.push({
      id: state.recordings[i].id,
      kind: "clip",
      title: state.recordings[i].title,
      text: state.recordings[i].when || "",
      poster: state.recordings[i].thumb || ""
    });
  }
  var playing = state.screen === "live" || state.screen === "watch";
  var playTitle = state.screen === "watch" && state.watch ? state.watch.title : (state.streamTitle || "Св. Месса");
  var poster = state.poster || "";
  if (state.screen === "watch" && state.watch && state.watch.thumb) poster = state.watch.thumb;
  return JSON.stringify({
    screen: state.screen,
    playing: playing,
    playTitle: playTitle,
    poster: poster,
    items: items
  });
}

function syncNative() {
  try {
    if (window.CatedraNative && window.CatedraNative.syncHome) window.CatedraNative.syncHome(nativePayload());
  } catch (e) {}
}

window.CatedraOpen = function (screen, id) {
  if (screen === "watch" && id) {
    var i;
    var found = null;
    for (i = 0; i < state.recordings.length; i++) {
      if (state.recordings[i].id === id) found = state.recordings[i];
    }
    state.watch = found || { id: id, title: "Запись", thumb: "", when: "" };
    state.back = "archive";
    state.screen = "watch";
    render();
    return;
  }
  if (screen === "live" || screen === "schedule" || screen === "archive" || screen === "settings" || screen === "home" || screen === "install") {
    go(screen);
  }
};

function render() {
  stopPlayback();
  var body = "";
  if (state.screen === "home") body = homeHtml();
  else if (state.screen === "schedule") body = scheduleHtml();
  else if (state.screen === "archive") body = archiveHtml();
  else if (state.screen === "settings") body = settingsHtml();
  else if (state.screen === "install") body = installHtml();
  else if (state.screen === "live") body = liveHtml();
  else if (state.screen === "watch") body = watchHtml();
  document.getElementById("app").innerHTML = shell(body);
  bindInputs();
  var first = document.querySelector("[data-tv]");
  if (first && first.focus) first.focus();
  if (state.screen === "live" && (state.onAir === true || state.forceLive)) startLive();
  syncNative();
}

function bindInputs() {
  var map = { proxyUrl: "proxyUrl", ytBase: "youtubeBase", streamUrl: "streamOverride" };
  var id;
  for (id in map) {
    if (!map.hasOwnProperty(id)) continue;
    var el = document.getElementById(id);
    if (!el) continue;
    (function (input, key) {
      input.oninput = function () {
        state.settings[key] = input.value;
        saveSettings();
      };
    })(el, map[id]);
  }
}

function stopPlayback() {
  try {
    if (window.webapis && webapis.avplay) {
      webapis.avplay.stop();
      webapis.avplay.close();
    }
  } catch (e) {}
  var v = document.getElementById("html5");
  if (v) { try { v.pause(); } catch (e2) {} }
}

function startLive() {
  if (state.liveKind === "iframe" || state.liveKind === "video") {
    if (state.liveKind === "video" && !currentHls()) {
      state.status = "Прямой ссылки HLS нет. Открываю сайт Kinescope.";
      state.liveKind = "iframe";
      render();
    }
    return;
  }
  var url = currentHls();
  if (!url) {
    state.liveKind = "iframe";
    state.status = "HLS ещё не получен, открыт плеер Kinescope.";
    render();
    return;
  }
  if (window.webapis && webapis.avplay) {
    try {
      var av = webapis.avplay;
      av.open(url);
      var w = window.innerWidth || 1920;
      var h = window.innerHeight || 1080;
      av.setDisplayRect(0, 150, w, h - 280);
      av.setListener({
        onbufferingstart: function () {},
        onbufferingcomplete: function () {},
        onerror: function () {
          state.liveKind = "video";
          state.status = "Плеер ТВ не принял поток. Включён режим «Видео».";
          render();
        }
      });
      av.prepareAsync(function () { try { av.play(); } catch (e1) {} }, function () {
        state.liveKind = "video";
        state.status = "Поток не подготовился в плеере ТВ. Включён режим «Видео».";
        render();
      });
      return;
    } catch (e) {}
  }
  state.liveKind = "video";
  render();
}

function go(screen) {
  if (screen !== "watch" && screen !== "live") state.back = state.screen === "watch" || state.screen === "live" ? state.back : state.screen;
  state.screen = screen;
  render();
}

function onAction(act, arg, node) {
  if (act === "go") go(arg);
  else if (act === "back") back();
  else if (act === "section-go") { state.section = parseInt(arg, 10) || 0; state.day = 0; go("schedule"); }
  else if (act === "section") { state.section = parseInt(arg, 10) || 0; state.day = 0; render(); }
  else if (act === "day") { state.day = parseInt(arg, 10) || 0; render(); }
  else if (act === "watch") {
    var i;
    for (i = 0; i < state.recordings.length; i++) {
      if (state.recordings[i].id === arg) state.watch = state.recordings[i];
    }
    state.back = state.screen === "home" ? "home" : "archive";
    state.screen = "watch";
    render();
  } else if (act === "toggle-proxy") {
    state.settings.proxyOn = !state.settings.proxyOn;
    saveSettings();
    render();
  } else if (act === "proxy-mode") {
    state.settings.proxyMode = arg === "query" ? "query" : "prefix";
    saveSettings();
    render();
  } else if (act === "reset") {
    state.settings = { proxyOn: false, proxyMode: "prefix", proxyUrl: "", youtubeBase: "", streamOverride: "" };
    saveSettings();
    render();
  } else if (act === "reload-rec") loadRecordings();
  else if (act === "force-live") { state.forceLive = true; render(); }
  else if (act === "live-mode") {
    state.liveKind = arg;
    state.status = "";
    render();
  }
}

function back() {
  if (state.screen === "home") {
    try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
    try { if (window.CatedraNative && window.CatedraNative.exitApp) window.CatedraNative.exitApp(); } catch (e2) {}
    return;
  }
  if (state.screen === "watch") state.screen = "archive";
  else if (state.screen === "live") state.screen = "home";
  else state.screen = "home";
  render();
}

function focusables() {
  var all = document.querySelectorAll("[data-tv]");
  var out = [];
  var i;
  for (i = 0; i < all.length; i++) {
    var r = all[i].getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push(all[i]);
  }
  return out;
}

function moveFocus(dir) {
  var items = focusables();
  var cur = document.activeElement;
  if (!items.length) return;
  if (!cur || !cur.getAttribute || !cur.getAttribute("data-tv")) {
    items[0].focus();
    return;
  }
  var cr = cur.getBoundingClientRect();
  var cx = cr.left + cr.width / 2;
  var cy = cr.top + cr.height / 2;
  var best = null;
  var bestScore = 1e9;
  var i;
  for (i = 0; i < items.length; i++) {
    if (items[i] === cur) continue;
    var r = items[i].getBoundingClientRect();
    var dx = r.left + r.width / 2 - cx;
    var dy = r.top + r.height / 2 - cy;
    if (dir === "left" && dx >= -4) continue;
    if (dir === "right" && dx <= 4) continue;
    if (dir === "up" && dy >= -4) continue;
    if (dir === "down" && dy <= 4) continue;
    var primary = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy);
    var secondary = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    var score = primary + secondary * 2.4;
    if (score < bestScore) { bestScore = score; best = items[i]; }
  }
  if (best) {
    best.focus();
    try { best.scrollIntoView(true); } catch (e) {}
  }
}

function onKey(e) {
  var t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) {
    if (e.keyCode === 27 || e.keyCode === 10009 || e.keyCode === 461) t.blur();
    return;
  }
  var code = e.keyCode;
  if (code === 48) { go("home"); e.preventDefault(); return; }
  if (code === 49 || code === 403) { go("live"); e.preventDefault(); return; }
  if (code === 50 || code === 404) { go("schedule"); e.preventDefault(); return; }
  if (code === 51 || code === 405) { go("archive"); e.preventDefault(); return; }
  if (code === 52 || code === 406) { go("settings"); e.preventDefault(); return; }
  if (code === 53) { go("install"); e.preventDefault(); return; }
  if (code === 10009 || code === 461 || code === 8 || code === 27) { e.preventDefault(); back(); return; }
  if (code === 37) { e.preventDefault(); moveFocus("left"); }
  else if (code === 39) { e.preventDefault(); moveFocus("right"); }
  else if (code === 38) { e.preventDefault(); moveFocus("up"); }
  else if (code === 40) { e.preventDefault(); moveFocus("down"); }
  else if (code === 415 || code === 10252 || code === 19) {
    try {
      if (window.webapis && webapis.avplay) {
        if (code === 19) webapis.avplay.pause();
        else webapis.avplay.play();
      }
    } catch (err) {}
  }
}

function registerKeys() {
  try {
    var names = ["ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "MediaPlay", "MediaPause", "MediaPlayPause", "MediaStop", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    var i;
    for (i = 0; i < names.length; i++) {
      try { tizen.tvinputdevice.registerKey(names[i]); } catch (e) {}
    }
  } catch (e2) {}
}

function formatWhen(iso) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch (e) { return String(iso).slice(0, 16); }
}

function loadRecordings() {
  state.recError = "";
  xhrText(applyProxy(RSS), function (err, xml) {
    if (err || !xml) {
      state.recError = "Не удалось загрузить записи. Проверьте сеть или укажите прокси и Invidious.";
      if (state.screen === "archive") render();
      else syncNative();
      return;
    }
    var entries = xml.split("<entry>").slice(1);
    var items = [];
    var i;
    for (i = 0; i < entries.length; i++) {
      var idm = entries[i].match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      if (!idm) continue;
      var title = (entries[i].match(/<media:title>([^<]*)<\/media:title>/) || entries[i].match(/<title>([^<]*)<\/title>/) || ["", "Запись"])[1];
      var thumb = (entries[i].match(/<media:thumbnail url="([^"]+)"/) || ["", ""])[1];
      var published = (entries[i].match(/<published>([^<]+)<\/published>/) || ["", ""])[1];
      items.push({ id: idm[1], title: stripTags(title), thumb: thumb, when: formatWhen(published) });
    }
    var ch = xml.match(/<title>([^<]+)<\/title>/);
    if (ch) state.channelTitle = stripTags(ch[1]);
    state.recordings = items;
    if (!items.length) state.recError = "Лента канала пуста.";
    if (state.screen === "archive") render();
    else syncNative();
  });
}

function loadSchedule() {
  xhrText(applyProxy(SCHEDULE_URL), function (err, html) {
    if (err || !html) {
      state.notice = "Нет связи с catedra.ru — показано сохранённое расписание.";
      if (state.screen === "home" || state.screen === "schedule") render();
      else syncNative();
      return;
    }
    var sections = parseSchedule(html);
    if (!sections.length || !sections[0].days || sections[0].days.length < 7) {
      state.notice = "Сайт отдал неполное расписание — показано сохранённое.";
    } else {
      state.sections = sections;
      state.notice = "Расписание с сайта прихода";
      state.liveSource = true;
    }
    if (state.screen === "home" || state.screen === "schedule") render();
    else syncNative();
  });
}

function playlistLooksLive(text) {
  return text.indexOf("#EXTM3U") >= 0 && (text.indexOf("#EXT-X-STREAM-INF") >= 0 || text.indexOf("#EXTINF") >= 0);
}

function probePlaylist(url, cb) {
  if (!url) { cb(false); return; }
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = 8000;
    try { xhr.setRequestHeader("X-Catedra-Fetch", "1"); } catch (e0) {}
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      cb(xhr.status >= 200 && xhr.status < 300 && playlistLooksLive(xhr.responseText || ""));
    };
    xhr.onerror = function () { cb(false); };
    xhr.ontimeout = function () { cb(false); };
    xhr.send();
  } catch (e) { cb(false); }
}

function loadStream() {
  var override = (state.settings.streamOverride || "").replace(/^\s+|\s+$/g, "");
  if (override && /\.m3u8(\?|$)/i.test(override)) {
    state.hls = override;
    probePlaylist(applyProxy(override), function (on) {
      state.onAir = on;
      if (on) state.forceLive = false;
      if (state.screen === "live" || state.screen === "home") render();
      else syncNative();
    });
    return;
  }
  if (override) {
    state.onAir = true;
    if (state.screen === "live") render();
    return;
  }
  xhrText(applyProxy(PAGE), function (err, html) {
    if (err || !html) {
      if (state.onAir === null) state.onAir = false;
      if (state.screen === "live") render();
      return;
    }
    var m = html.match(/https?:\\?\/\\?\/live\.kinescopecdn\.net[^"'\\]+master\.m3u8/);
    if (m) state.hls = m[0].replace(/\\\//g, "/");
    var title = html.match(/<title>([^<]+)<\/title>/);
    if (title) state.streamTitle = stripTags(title[1]);
    var poster = html.match(/property="og:image" content="([^"]+)"/);
    if (poster) state.poster = poster[1];
    probePlaylist(state.hls, function (on) {
      state.onAir = on;
      if (on) state.forceLive = false;
      if (state.screen === "live" || state.screen === "home") render();
      else syncNative();
    });
  });
}

function hideSplash() {
  var s = document.getElementById("splash");
  if (!s) return;
  s.style.opacity = "0";
  setTimeout(function () {
    if (s.parentNode) s.parentNode.removeChild(s);
  }, 700);
}

function init() {
  loadSettings();
  registerKeys();
  document.addEventListener("keydown", onKey);
  document.getElementById("app").addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== document.getElementById("app")) {
      if (t.getAttribute && t.getAttribute("data-act")) {
        onAction(t.getAttribute("data-act"), t.getAttribute("data-arg") || "", t);
        return;
      }
      t = t.parentNode;
    }
  });
  render();
  loadSchedule();
  loadRecordings();
  loadStream();
  setTimeout(hideSplash, 1600);
  setInterval(function () {
    if (state.screen === "home") render();
    loadStream();
  }, 60000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
