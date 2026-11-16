import QtQuick 2.6
import Sailfish.Silica 1.0

ApplicationWindow {
    id: win
    allowedOrientations: Orientation.All
    initialPage: Component { HomePage { } }
    cover: Component {
        CoverBackground {
            Rectangle { anchors.fill: parent; color: "#10080a" }
            Image {
                anchors.horizontalCenter: parent.horizontalCenter
                y: parent.height * 0.16
                width: parent.width * 0.42
                height: width
                source: "icon.png"
                fillMode: Image.PreserveAspectFit
            }
            Label {
                anchors.bottom: parent.bottom
                anchors.bottomMargin: Theme.paddingLarge
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Кафедра"
                color: "#e6d3a1"
                font.pixelSize: Theme.fontSizeMedium
            }
        }
    }
}
