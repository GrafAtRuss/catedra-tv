import QtQuick 2.6
import Sailfish.Silica 1.0
import "Catedra.js" as C
import "Store.js" as Store

Page {
    id: page
    allowedOrientations: Orientation.All

    property var sections: []
    property string clock: C.moscowLabel()
    property string day: C.moscowDay()
    property string notice: ""

    Timer {
        interval: 30000
        running: true
        repeat: true
        onTriggered: { page.clock = C.moscowLabel(); page.day = C.moscowDay() }
    }

    Component.onCompleted: {
        C.http(C.applyProxy(C.SCHEDULE_URL, Store.load()), function (status, html) {
            var parsed = status >= 200 && status < 300 ? C.parseSchedule(html) : []
            page.sections = parsed.length ? parsed : C.fallbackSections()
            if (!parsed.length) page.notice = "Нет связи с catedra.ru — показано сохранённое расписание."
        })
    }

    Rectangle { anchors.fill: parent; color: "#10080a" }

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: column.height + Theme.paddingLarge
        Column {
            id: column
            width: parent.width
            spacing: Theme.paddingLarge
            PageHeader { title: "Кафедра" }
            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * x
                wrapMode: Text.WordWrap
                color: "#b5a496"
                text: "Римско-католический кафедральный собор Непорочного Зачатия Пресвятой Девы Марии в Москве"
            }
            Label {
                x: Theme.horizontalPageMargin
                color: "#e6d3a1"
                font.pixelSize: Theme.fontSizeExtraLarge
                text: page.clock + "  " + page.day
            }
            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * x
                wrapMode: Text.WordWrap
                color: "#f3ecdf"
                text: {
                    var next = C.nextService(page.sections)
                    return next ? ("Ближайшая служба — " + next.time + " " + next.title) : "Смотрите расписание собора"
                }
            }
            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * x
                wrapMode: Text.WordWrap
                color: "#b5a496"
                visible: page.notice.length > 0
                text: page.notice
            }
            Button {
                text: "Прямой эфир"
                preferredWidth: Theme.buttonWidthLarge
                anchors.horizontalCenter: parent.horizontalCenter
                onClicked: pageStack.push(Qt.resolvedUrl("LivePage.qml"))
            }
            Button {
                text: "Расписание"
                preferredWidth: Theme.buttonWidthLarge
                anchors.horizontalCenter: parent.horizontalCenter
                onClicked: pageStack.push(Qt.resolvedUrl("SchedulePage.qml"), { sections: page.sections })
            }
            Button {
                text: "Записи"
                preferredWidth: Theme.buttonWidthLarge
                anchors.horizontalCenter: parent.horizontalCenter
                onClicked: pageStack.push(Qt.resolvedUrl("ArchivePage.qml"))
            }
            Button {
                text: "Настройки"
                preferredWidth: Theme.buttonWidthLarge
                anchors.horizontalCenter: parent.horizontalCenter
                onClicked: pageStack.push(Qt.resolvedUrl("SettingsPage.qml"))
            }
        }
    }
}
