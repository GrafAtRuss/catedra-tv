import QtQuick 2.6
import Sailfish.Silica 1.0
import "Catedra.js" as C
import "Store.js" as Store

Page {
    id: page
    allowedOrientations: Orientation.All
    property var items: []
    property string notice: "Загружаем записи"

    function load() {
        var settings = Store.load()
        C.http(C.applyProxy(C.RSS, settings), function (status, xml) {
            var list = status >= 200 && status < 300 ? C.parseYoutube(xml) : []
            if (list.length && settings.archiveSource !== "rutube") {
                page.items = list
                page.notice = ""
                return
            }
            var url = "https://rutube.ru/api/video/person/" + C.RUTUBE + "/?page=1&limit=20&format=json"
            C.http(C.applyProxy(url, settings), function (code, text) {
                var next = []
                if (code >= 200 && code < 300 && text) {
                    try {
                        var data = JSON.parse(text)
                        var rows = data.results || []
                        var i
                        for (i = 0; i < rows.length; i++) {
                            if (!rows[i].id) continue
                            next.push({
                                id: String(rows[i].id),
                                host: "rutube",
                                title: rows[i].title || "Запись",
                                url: "https://rutube.ru/video/" + rows[i].id + "/"
                            })
                        }
                    } catch (e) {}
                }
                if (!next.length && list.length) next = list
                page.items = next
                page.notice = next.length ? "" : "Записи сейчас не открылись. Проверьте сеть или прокси."
            })
        })
    }

    Component.onCompleted: load()
    Rectangle { anchors.fill: parent; color: "#10080a" }

    SilicaListView {
        id: list
        anchors.fill: parent
        model: page.items
        header: Column {
            width: list.width
            PageHeader { title: "Записи" }
            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * x
                wrapMode: Text.WordWrap
                color: "#b5a496"
                visible: page.notice.length > 0
                text: page.notice
            }
        }
        delegate: ListItem {
            width: list.width
            contentHeight: Theme.itemSizeMedium
            Label {
                anchors.fill: parent
                anchors.leftMargin: Theme.horizontalPageMargin
                anchors.rightMargin: Theme.horizontalPageMargin
                verticalAlignment: Text.AlignVCenter
                wrapMode: Text.WordWrap
                color: "#f3ecdf"
                text: modelData.title
            }
            onClicked: Qt.openUrlExternally(modelData.url)
        }
        VerticalScrollDecorator {}
    }
}
