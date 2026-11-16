.pragma library
.import QtQuick.LocalStorage 2.0 as Sql

function load() {
    var base = { proxyOn: false, proxyMode: "prefix", proxyUrl: "", archiveSource: "auto" }
    try {
        var db = Sql.LocalStorage.openDatabaseSync("Catedra", "1.0", "Catedra", 16000)
        db.transaction(function (tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)")
            var rows = tx.executeSql("SELECT v FROM kv WHERE k = 'settings'")
            if (rows.rows.length) {
                var saved = JSON.parse(rows.rows.item(0).v)
                if (saved.proxyOn !== undefined) base.proxyOn = !!saved.proxyOn
                if (saved.proxyMode) base.proxyMode = saved.proxyMode
                if (saved.proxyUrl !== undefined) base.proxyUrl = saved.proxyUrl
                if (saved.archiveSource) base.archiveSource = saved.archiveSource
            }
        })
    } catch (e) {}
    return base
}

function save(settings) {
    try {
        var db = Sql.LocalStorage.openDatabaseSync("Catedra", "1.0", "Catedra", 16000)
        db.transaction(function (tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)")
            tx.executeSql("INSERT OR REPLACE INTO kv(k, v) VALUES('settings', ?)", [JSON.stringify(settings)])
        })
    } catch (e) {}
}
