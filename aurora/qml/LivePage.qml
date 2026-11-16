import QtQuick 2.6
import Sailfish.Silica 1.0
import QtMultimedia 5.6
import "Catedra.js" as C
import "Store.js" as Store

Page {
    id: page
    allowedOrientations: Orientation.All

    property string status: "Проверяем эфир"
    property bool onAir: false
    property string streamUrl: ""

    function openLive() {
        var settings = Store.load()
        C.http(C.applyProxy(C.PAGE, settings), function (status, html) {
            var playlist = C.findM3u8(html)
            if (!playlist) {
                page.onAir = false
                page.status = "Сейчас трансляции нет"
                return
            }
            C.http(C.applyProxy(playlist, settings), function (code, body) {
                var live = code >= 200 && code < 400 && body.indexOf("#EXTM3U") >= 0 && (body.indexOf("#EXT-X-STREAM-INF") >= 0 || body.indexOf("#EXTINF") >= 0)
                page.onAir = live
                page.streamUrl = live ? C.applyProxy(playlist, settings) : ""
                page.status = live ? "В эфире" : "Сейчас трансляции нет"
                if (live) player.play()
            })
        })
    }

    Component.onCompleted: openLive()
    onStatusChanged: if (!page.onAir) player.stop()

    Rectangle { anchors.fill: parent; color: "#10080a" }

    MediaPlayer {
        id: player
        autoPlay: false
        source: page.streamUrl
        onErrorChanged: if (player.error !== MediaPlayer.NoError && player.errorString) page.status = "Поток не открылся. Можно смотреть на сайте собора."
    }

    VideoOutput {
        anchors.fill: parent
        source: player
        fillMode: VideoOutput.PreserveAspectFit
        visible: page.onAir
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: Theme.itemSizeLarge * 1.6
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#cc10080a" }
            GradientStop { position: 1.0; color: "#0010080a" }
        }
        Label {
            anchors.left: parent.left
            anchors.leftMargin: Theme.horizontalPageMargin
            anchors.verticalCenter: parent.verticalCenter
            text: page.status
            color: "#e6d3a1"
        }
    }

    Column {
        anchors.centerIn: parent
        width: parent.width - 2 * Theme.horizontalPageMargin
        spacing: Theme.paddingLarge
        visible: !page.onAir
        Image {
            anchors.horizontalCenter: parent.horizontalCenter
            width: Theme.iconSizeExtraLarge
            height: width
            source: "icon.png"
        }
        Label {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            color: "#e6d3a1"
            font.pixelSize: Theme.fontSizeLarge
            text: page.status
        }
        Label {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            color: "#b5a496"
            text: "Плеер включится здесь, когда начнётся месса."
        }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: Theme.itemSizeHuge
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#0010080a" }
            GradientStop { position: 1.0; color: "#e610080a" }
        }
        Row {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.leftMargin: Theme.horizontalPageMargin
            anchors.rightMargin: Theme.horizontalPageMargin
            spacing: Theme.paddingMedium
            Button {
                text: player.playbackState === MediaPlayer.PlayingState ? "Пауза" : "Смотреть"
                enabled: page.onAir
                onClicked: player.playbackState === MediaPlayer.PlayingState ? player.pause() : player.play()
            }
            Button {
                text: "Сайт"
                onClicked: Qt.openUrlExternally(C.PAGE)
            }
        }
    }
}
