import QtQuick 2.6
import Sailfish.Silica 1.0
import "Catedra.js" as C

Page {
    id: page
    allowedOrientations: Orientation.All
    property var sections: []
    property int sectionIndex: 0
    property int dayIndex: 0

    Rectangle { anchors.fill: parent; color: "#10080a" }

    SilicaListView {
        id: list
        anchors.fill: parent
        model: {
            var list = page.sections && page.sections.length ? page.sections : C.fallbackSections()
            var section = list[Math.min(page.sectionIndex, list.length - 1)]
            if (!section || !section.days || !section.days.length) return []
            var day = section.days[Math.min(page.dayIndex, section.days.length - 1)]
            return day.items || []
        }
        header: Column {
            width: list.width
            spacing: Theme.paddingSmall
            PageHeader { title: "Расписание" }
            ComboBox {
                width: parent.width
                label: "Обряды"
                currentIndex: page.sectionIndex
                menu: ContextMenu {
                    Repeater {
                        model: page.sections && page.sections.length ? page.sections : C.fallbackSections()
                        MenuItem { text: modelData.title }
                    }
                }
                onCurrentIndexChanged: { page.sectionIndex = currentIndex; page.dayIndex = 0 }
            }
            ComboBox {
                width: parent.width
                label: "День"
                currentIndex: page.dayIndex
                menu: ContextMenu {
                    Repeater {
                        model: {
                            var list = page.sections && page.sections.length ? page.sections : C.fallbackSections()
                            var section = list[Math.min(page.sectionIndex, list.length - 1)]
                            return section && section.days ? section.days : []
                        }
                        MenuItem { text: modelData.name }
                    }
                }
                onCurrentIndexChanged: page.dayIndex = currentIndex
            }
        }
        delegate: BackgroundItem {
            width: list.width
            height: Theme.itemSizeSmall + (modelData.note ? Theme.paddingMedium : 0)
            Label {
                anchors.left: parent.left
                anchors.leftMargin: Theme.horizontalPageMargin
                anchors.verticalCenter: parent.verticalCenter
                width: Theme.itemSizeMedium
                color: "#c4a46a"
                text: modelData.time
            }
            Label {
                anchors.left: parent.left
                anchors.leftMargin: Theme.horizontalPageMargin + Theme.itemSizeMedium
                anchors.right: parent.right
                anchors.rightMargin: Theme.horizontalPageMargin
                anchors.verticalCenter: parent.verticalCenter
                wrapMode: Text.WordWrap
                color: "#f3ecdf"
                text: modelData.title + (modelData.end ? "  до " + modelData.end : "")
            }
        }
    }
}
