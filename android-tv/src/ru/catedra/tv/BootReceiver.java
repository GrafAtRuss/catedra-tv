package ru.catedra.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context app = context.getApplicationContext();
        final PendingResult pending = goAsync();
        PowerManager power = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
        final PowerManager.WakeLock lock = power == null ? null : power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "catedra:watch");
        if (lock != null) lock.acquire(45000);
        Watcher.schedule(app);
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    HomeChannel.ensureLive(app);
                    if (!NowPlaying.isPlaying()) Watcher.runCheck(app);
                } catch (Exception ignored) {
                } finally {
                    try {
                        if (lock != null && lock.isHeld()) lock.release();
                    } catch (Exception ignored) {
                    }
                    pending.finish();
                }
            }
        }).start();
    }
}