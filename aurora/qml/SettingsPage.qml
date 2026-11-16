import QtQuick 2.6
import Sailfish.Silica 1.0
import "Store.js" as Store

Page {
    id: page
    allowedOrientations: Orientation.All
    property bool proxyOn: false
    property string proxyUrl: ""

    Component.onCompleted: {
        var s = Store.load()
        page.proxyOn = s.proxyOn
        page.proxyUrl = s.proxyUrl
    }

    function persist() {
        Store.save({ proxyOn: page.proxyOn, proxyMode: "prefix", proxyUrl: page.proxyUrl, archiveSource: "auto" })
    }

    Rectangle { anchors.fill: parent; color: "#10080a" }

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: column.height
        Column {
            id: column
            width: parent.width
            spacing: Theme.paddingMedium
            PageHeader { title: "Настройки" }
            TextSwitch {
                width: parent.width
                text: "Прокси"
                description: "Если YouTube или поток с телефона не открываются"
                checked: page.proxyOn
                onCheckedChanged: { page.proxyOn = checked; page.persist() }
            }
            TextField {
                width: parent.width
                label: "Адрес прокси"
                placeholderText: "http://192.168.1.10:8888"
                text: page.proxyUrl
                EnterKey.enabled: true
                EnterKey.onClicked: focus = false
                onTextChanged: { page.proxyUrl = text; page.persist() }
            }
            SectionHeader { text: "О программе" }
            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * x
                wrapMode: Text.WordWrap
                color: "#f3ecdf"
                text: "Автор — Ермаков Алексей Сергеевич"
            }
            Label {
                x: Theme.horizontalPageMargin
                color: "#e6d3a1"
                text: "alexey@ermakov-mail.ru"
            }
            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * x
                wrapMode: Text.WordWrap
                color: "#b5a496"
                text: "Версия 1.2.32. Записи открываются в браузере Авроры: свой плеер площадки внутрь системы не встраивается."
            }
        }
    }
}
