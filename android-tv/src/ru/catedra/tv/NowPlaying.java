package ru.catedra.tv;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;

public final class NowPlaying {
    private static MediaSession session;
    private static boolean active;
    private static boolean liveOffer;

    public static boolean isPlaying() {
        return active;
    }

    private NowPlaying() {}

    public static void offerContinue(Context context, boolean on) {
        liveOffer = on;
        if (active) return;
        update(context, false, "Св. Месса", "");
    }

    public static void update(Context context, boolean playing, String title, String poster) {
        Context app = context.getApplicationContext();
        if (session == null) {
            session = new MediaSession(app, "Catedra");
            session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
            session.setCallback(new MediaSession.Callback() {
                @Override
                public void onPlay() {
                    MainActivity.open("live", "");
                }

                @Override
                public void onPlayFromSearch(String query, android.os.Bundle extras) {
                    MainActivity.open("live", "");
                }

                @Override
                public void onPause() {
                    MainActivity.open("home", "");
                }

                @Override
                public void onStop() {
                    MainActivity.open("home", "");
                }
            });
        }
        if (title == null || title.length() == 0) title = "Св. Месса";
        active = playing;
        MediaMetadata.Builder meta = new MediaMetadata.Builder();
        meta.putString(MediaMetadata.METADATA_KEY_TITLE, title);
        meta.putString(MediaMetadata.METADATA_KEY_ARTIST, "Кафедральный собор Непорочного Зачатия");
        meta.putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, title);
        meta.putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, playing ? "Кафедра" : "Продолжить просмотр");
        if (poster != null && poster.startsWith("http")) {
            meta.putString(MediaMetadata.METADATA_KEY_ART_URI, poster);
        }
        session.setMetadata(meta.build());
        PlaybackState.Builder state = new PlaybackState.Builder();
        state.setActions(
            PlaybackState.ACTION_PLAY
                | PlaybackState.ACTION_PLAY_FROM_SEARCH
                | PlaybackState.ACTION_PAUSE
                | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_STOP
        );
        if (playing) {
            state.setState(PlaybackState.STATE_PLAYING, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f);
            session.setPlaybackState(state.build());
            session.setActive(true);
        } else if (liveOffer) {
            state.setState(PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 0f);
            session.setPlaybackState(state.build());
            session.setActive(true);
        } else {
            state.setState(PlaybackState.STATE_STOPPED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 0f);
            session.setPlaybackState(state.build());
            session.setActive(false);
        }
        NotificationManager manager = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel("playback", "Эфир", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Сейчас в Кафедре");
            manager.createNotificationChannel(channel);
        }
        if (!playing) {
            manager.cancel(7);
            return;
        }
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(app, "playback")
            : new Notification.Builder(app);
        builder.setSmallIcon(R.drawable.ic_stat);
        builder.setContentTitle(title);
        builder.setContentText(playing ? "Кафедра · прямой эфир" : "Продолжить просмотр");
        builder.setOngoing(true);
        builder.setVisibility(Notification.VISIBILITY_PUBLIC);
        builder.setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()));
        try {
            manager.notify(7, builder.build());
        } catch (Exception ignored) {
        }
    }
}
