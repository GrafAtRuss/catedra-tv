package ru.catedra.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public final class Alerts {
    private Alerts() {}

    public static void show(Context context, String kind, String title, String text, String screen) {
        Context app = context.getApplicationContext();
        SharedPreferences prefs = app.getSharedPreferences("catedra-alerts", Context.MODE_PRIVATE);
        if ("live".equals(kind)) {
            if (prefs.getBoolean("live", false)) return;
            prefs.edit().putBoolean("live", true).putBoolean("seen", true).apply();
        } else if ("live-off".equals(kind)) {
            prefs.edit().putBoolean("live", false).putBoolean("seen", true).apply();
            return;
        } else if ("archive".equals(kind)) {
            String mark = text == null ? "" : text;
            if (mark.length() == 0 || mark.equals(prefs.getString("arch", ""))) return;
            prefs.edit().putString("arch", mark).apply();
        } else if ("update".equals(kind)) {
            String mark = title == null ? "" : title;
            if (mark.length() == 0 || mark.equals(prefs.getString("ver", ""))) return;
            prefs.edit().putString("ver", mark).apply();
        }
        NotificationManager manager = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        String channel = "live".equals(kind) ? "live" : ("archive".equals(kind) ? "archive" : "updates");
        String channelName = "live".equals(kind) ? "Трансляции" : ("archive".equals(kind) ? "Новые записи" : "Обновления");
        int importance = "live".equals(kind) ? NotificationManager.IMPORTANCE_HIGH : NotificationManager.IMPORTANCE_DEFAULT;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel made = new NotificationChannel(channel, channelName, importance);
            manager.createNotificationChannel(made);
        }
        Intent open = new Intent(app, MainActivity.class);
        open.putExtra("screen", screen == null || screen.length() == 0 ? "home" : screen);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        int id = "live".equals(kind) ? 12 : ("archive".equals(kind) ? 13 : 11);
        PendingIntent pending = PendingIntent.getActivity(app, id, open, flags);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(app, channel)
            : new Notification.Builder(app);
        builder.setSmallIcon(R.drawable.ic_stat);
        builder.setContentTitle(title);
        builder.setContentText("archive".equals(kind) ? "Новая запись в архиве" : text);
        builder.setAutoCancel(true);
        builder.setContentIntent(pending);
        builder.setVisibility(Notification.VISIBILITY_PUBLIC);
        if ("live".equals(kind)) builder.setCategory(Notification.CATEGORY_EVENT);
        try {
            manager.notify(id, builder.build());
        } catch (Exception ignored) {
        }
    }
}
