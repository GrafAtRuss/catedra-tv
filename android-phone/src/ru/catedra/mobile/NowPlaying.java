package ru.catedra.mobile;

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
    private static String lastTitle = "Св. Месса";
    private static boolean active;

    public static boolean isPlaying() {
        return active;
    }

    private NowPlaying() {}

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
        lastTitle = title;
        active = playing;
        MediaMetadata.Builder meta = new MediaMetadata.Builder();
        meta.putString(MediaMetadata.METADATA_KEY_TITLE, title);
        meta.putString(MediaMetadata.METADATA_KEY_ARTIST, "Кафедральный собор Непорочного Зачатия");
        meta.putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, title);
        meta.putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, "Кафедра");
        if (poster != null && poster.startsWith("http")) {
            meta.putString(MediaMetadata.METADATA_KEY_ART_URI, poster);
        }
        session.setMetadata(meta.build());
        PlaybackState.Builder state = new PlaybackState.Builder();
        state.setActions(
            PlaybackState.ACTION_PLAY
                | PlaybackState.ACTION_PAUSE
                | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_STOP
        );
        state.setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, 0, playing ? 1f : 0f);
        session.setPlaybackState(state.build());
        session.setActive(playing);
        if (playing) PlaybackService.start(app);
        else {
            PlaybackService.stop(app);
            NotificationManager manager = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.cancel(7);
        }
    }

    public static Notification notification(Context context) {
        Context app = context.getApplicationContext();
        ensureSession(app);
        NotificationManager manager = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null && Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel("playback", "Эфир", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Сейчас в Кафедре");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(channel);
        }
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(app, "playback")
            : new Notification.Builder(app);
        builder.setSmallIcon(R.drawable.ic_stat);
        builder.setContentTitle(lastTitle);
        builder.setContentText("Кафедра · прямой эфир");
        builder.setOngoing(true);
        builder.setVisibility(Notification.VISIBILITY_PUBLIC);
        builder.setCategory(Notification.CATEGORY_TRANSPORT);
        builder.setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()));
        return builder.build();
    }

    private static void ensureSession(Context app) {
        if (session != null) return;
        session = new MediaSession(app, "Catedra");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
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
        session.setActive(true);
    }
}
