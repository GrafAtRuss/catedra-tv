.pragma library

var PAGE = "https://kinescope.io/0ctuKXYjVsu6o6C5LUe6Fj"
var SCHEDULE_URL = "https://catedra.ru/schedule"
var RSS = "https://www.youtube.com/feeds/videos.xml?channel_id=UCv_ztXSXtfmUW_fSF08kFIA"
var RUTUBE = "40512872"
var DAYS = ["ВОСКРЕСЕНЬЕ", "ПОНЕДЕЛЬНИК", "ВТОРНИК", "СРЕДА", "ЧЕТВЕРГ", "ПЯТНИЦА", "СУББОТА"]
var DAY_INDEX = { "ВОСКРЕСЕНЬЕ": 0, "ПОНЕДЕЛЬНИК": 1, "ВТОРНИК": 2, "СРЕДА": 3, "ЧЕТВЕРГ": 4, "ПЯТНИЦА": 5, "СУББОТА": 6 }

function pad2(n) {
    n = String(parseInt(n, 10))
    return n.length < 2 ? "0" + n : n
}

function stripTags(s) {
    return String(s || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&/gi, "&")
        .replace(/"/gi, "\"")
        .replace(/&#39;|'/gi, "'")
        .replace(/\u00a0/g, " ")
        .replace(/^\s+|\s+$/g, "")
}

function http(url, done) {
    var xhr = new XMLHttpRequest()
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE)
            done(xhr.status, xhr.responseText || "")
    }
    xhr.open("GET", url)
    xhr.send()
}

function applyProxy(url, settings) {
    if (!settings || !settings.proxyOn || !settings.proxyUrl) return url
    var base = String(settings.proxyUrl).replace(/\/$/, "")
    if (settings.proxyMode === "query") return base + encodeURIComponent(url)
    return base + "/" + url.replace(/^https?:\/\//, "")
}

function moscowDate() {
    return new Date(Date.now() + (180 + new Date().getTimezoneOffset()) * 60000)
}

function moscowLabel() {
    var d = moscowDate()
    return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes())
}

function moscowDay() {
    return DAYS[moscowDate().getUTCDay()]
}

function parseLines(text) {
    var items = []
    var lines = String(text).split("\n")
    var i
    for (i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "")
        if (!line) continue
        var m = line.match(/^(\d{1,2})[:.](\d{2})\s*(?:[-–—]\s*(\d{1,2})[:.](\d{2}))?\s*[-–—]?\s*(.*)$/)
        if (!m) {
            if (items.length) items[items.length - 1].note = (items[items.length - 1].note ? items[items.length - 1].note + " " : "") + line
            continue
        }
        items.push({
            time: pad2(m[1]) + ":" + pad2(m[2]),
            end: m[3] ? pad2(m[3]) + ":" + pad2(m[4]) : "",
            title: (m[5] || "").replace(/^[-–—]\s*/, "").replace(/^\s+|\s+$/g, "") || "Богослужение",
            note: ""
        })
    }
    return items
}

function readUntilDivClose(html, start) {
    var i = start
    var depth = 1
    var text = ""
    while (i < html.length && depth > 0) {
        if (html.charAt(i) === "<") {
            var close = html.indexOf(">", i)
            if (close < 0) break
            var tag = html.substring(i + 1, close).replace(/^\s+|\s+$/g, "").toLowerCase()
            var name = tag.replace(/^\//, "").split(/[\s\/]/)[0]
            var closing = tag.charAt(0) === "/"
            var selfClose = /\/$/.test(tag) || name === "br"
            if (name === "br") text += "\n"
            if (name === "div" && !selfClose) depth += closing ? -1 : 1
            i = close + 1
            if (depth === 0) break
        } else {
            text += html.charAt(i)
            i += 1
        }
    }
    return { text: text, end: i }
}

function parseSchedule(html) {
    var rows = []
    var re = /t521__(time|text)/g
    var events = []
    var found
    while ((found = re.exec(html))) {
        var gt = html.indexOf(">", found.index)
        if (gt < 0) break
        var read = readUntilDivClose(html, gt + 1)
        events.push({ kind: found[1], text: stripTags(read.text) })
        re.lastIndex = Math.max(read.end, found.index + 1)
    }
    var i
    for (i = 0; i < events.length; i++) {
        if (events[i].kind !== "time") continue
        var textEv = null
        var t
        for (t = i + 1; t < events.length; t++) if (events[t].kind === "text") { textEv = events[t]; break }
        if (!textEv) continue
        var name = events[i].text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").toUpperCase()
        if (!DAY_INDEX.hasOwnProperty(name)) continue
        var items = parseLines(textEv.text)
        if (items.length) rows.push({ name: name, items: items })
    }
    var sections = []
    var current = []
    var prev = -1
    function titleFor(index, days) {
        if (index === 0) return "Обычное расписание"
        var blob = ""
        var d, j
        for (d = 0; d < days.length; d++) for (j = 0; j < days[d].items.length; j++) blob += " " + days[d].items[j].title
        blob = blob.toLowerCase()
        if (blob.indexOf("утрен") >= 0 || blob.indexOf("церковнослав") >= 0) return "Византийский обряд"
        if (blob.indexOf("испан") >= 0 || blob.indexOf("португал") >= 0) return "Испанский язык"
        if (blob.indexOf("армян") >= 0) return "Армянский обряд"
        return "Дополнительно"
    }
    function flush() {
        if (!current.length) return
        sections.push({ title: titleFor(sections.length, current), days: current })
        current = []
    }
    var r
    for (r = 0; r < rows.length; r++) {
        var idx = DAY_INDEX[rows[r].name]
        if (current.length && idx <= prev) flush()
        current.push(rows[r])
        prev = idx
    }
    flush()
    return sections
}

function fallbackSections() {
    function s(time, title, end) { return { time: time, end: end || "", title: title, note: "" } }
    return [{
        title: "Обычное расписание",
        days: [
            { name: "ВОСКРЕСЕНЬЕ", items: [s("08:30", "Святая Месса на польском языке"), s("10:00", "Святая Месса (Сумма) на русском языке"), s("11:45", "Святая Месса на русском языке с участием детей"), s("13:00", "Святая Месса на польском языке"), s("17:30", "Святая Месса на русском языке"), s("20:00", "Святая Месса на русском языке")] },
            { name: "ПОНЕДЕЛЬНИК", items: [s("07:45", "Святая Месса на русском языке"), s("19:00", "Святая Месса на русском языке")] },
            { name: "ВТОРНИК", items: [s("07:45", "Святая Месса на русском языке"), s("19:00", "Святая Месса на русском языке")] },
            { name: "СРЕДА", items: [s("07:45", "Святая Месса на русском языке"), s("19:00", "Святая Месса на русском языке")] },
            { name: "ЧЕТВЕРГ", items: [s("07:45", "Святая Месса на русском языке"), s("19:00", "Святая Месса на русском языке")] },
            { name: "ПЯТНИЦА", items: [s("07:45", "Святая Месса на русском языке"), s("19:00", "Святая Месса на русском языке")] },
            { name: "СУББОТА", items: [s("07:45", "Святая Месса на русском языке"), s("18:00", "Святая Месса на русском языке")] }
        ]
    }]
}

function todayItems(sections) {
    var day = moscowDay()
    var out = []
    var i, d
    var list = sections && sections.length ? sections : fallbackSections()
    for (i = 0; i < list.length; i++) {
        var days = list[i].days || []
        for (d = 0; d < days.length; d++) if (days[d].name === day) out = out.concat(days[d].items)
    }
    return out
}

function nextService(sections) {
    var items = todayItems(sections)
    var now = moscowLabel()
    var i
    for (i = 0; i < items.length; i++) if (items[i].time >= now) return items[i]
    return items.length ? items[0] : null
}

function parseYoutube(xml) {
    var items = []
    if (!xml) return items
    var entries = xml.split("<entry>").slice(1)
    var i
    for (i = 0; i < entries.length; i++) {
        var idm = entries[i].match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
        if (!idm) continue
        var title = (entries[i].match(/<media:title>([^<]*)<\/media:title>/) || entries[i].match(/<title>([^<]*)<\/title>/) || ["", "Запись"])[1]
        var thumb = (entries[i].match(/<media:thumbnail url="([^"]+)"/) || ["", ""])[1]
        items.push({ id: idm[1], host: "youtube", title: stripTags(title), thumb: thumb, url: "https://www.youtube.com/watch?v=" + idm[1] })
    }
    return items
}

function findM3u8(html) {
    var m = String(html || "").match(/https?:[^"'\\\s]+master\.m3u8/)
    if (!m) return ""
    return m[0].replace(/\\u0026/g, "&").replace(/\\+/g, "")
}
