package ru.catedra.mobile;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class PlaybackService extends Service {
    private static PowerManager.WakeLock wake;
    private static AudioFocusRequest focusRequest;
    private static boolean running;

    public static void start(Context context) {
        Intent intent = new Intent(context, PlaybackService.class);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
        else context.startService(intent);
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, PlaybackService.class));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = NowPlaying.notification(this);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(7, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(7, notification);
        }
        running = true;
        hold();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audio != null && focusRequest != null && Build.VERSION.SDK_INT >= 26) audio.abandonAudioFocusRequest(focusRequest);
        if (wake != null && wake.isHeld()) wake.release();
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopForeground(true);
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    private void hold() {
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        if (power != null && (wake == null || !wake.isHeld())) {
            wake = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "catedra:live");
            wake.setReferenceCounted(false);
            wake.acquire();
        }
        AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audio == null || Build.VERSION.SDK_INT < 26) return;
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
            .build();
        focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attributes)
            .build();
        audio.requestAudioFocus(focusRequest);
    }

    public static boolean isRunning() {
        return running;
    }
}
