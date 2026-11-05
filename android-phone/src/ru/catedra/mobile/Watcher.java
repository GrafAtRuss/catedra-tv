package ru.catedra.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public final class Watcher {
    private Watcher() {}

    public static void kick(Context context) {
        Context app = context.getApplicationContext();
        schedule(app);
        Thread worker = new Thread(new Runnable() {
            @Override
            public void run() {
                if (NowPlaying.isPlaying()) return;
                runCheck(app);
            }
        });
        worker.setPriority(Thread.MIN_PRIORITY);
        worker.start();
    }

    public static void schedule(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Intent intent = new Intent(context, BootReceiver.class);
        intent.setAction("ru.catedra.mobile.WATCH");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pending = PendingIntent.getBroadcast(context, 41, intent, flags);
        long when = System.currentTimeMillis() + 15 * 60 * 1000L;
        if (Build.VERSION.SDK_INT >= 23) alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending);
        else alarms.set(AlarmManager.RTC_WAKEUP, when, pending);
    }

    static void runCheck(Context context) {
        try {
            checkUpdate(context);
        } catch (Exception ignored) {
        }
        try {
            checkLive(context);
        } catch (Exception ignored) {
        }
        try {
            checkArchive(context);
        } catch (Exception ignored) {
        }
    }

    private static void checkUpdate(Context context) throws Exception {
        String body = http("https://api.github.com/repos/GrafAtRuss/catedra-tv/releases/latest", "application/vnd.github+json");
        JSONObject json = new JSONObject(body);
        String remote = json.optString("tag_name", "").replaceFirst("^v", "");
        if (!Updater.newer(remote, localVersion(context))) return;
        Alerts.show(context, "update", "Кафедра " + remote, "Доступна новая версия приложения", "settings");
    }

    private static void checkLive(Context context) throws Exception {
        String page = http("https://kinescope.io/0ctuKXYjVsu6o6C5LUe6Fj", "text/html");
        String playlist = firstUrl(page, "master.m3u8");
        boolean on = false;
        if (playlist != null) {
            String body = http(playlist, "application/vnd.apple.mpegurl");
            on = body.indexOf("#EXTM3U") >= 0 && (body.indexOf("#EXT-X-STREAM-INF") >= 0 || body.indexOf("#EXTINF") >= 0);
        }
        SharedPreferences prefs = context.getSharedPreferences("catedra-alerts", Context.MODE_PRIVATE);
        boolean known = prefs.getBoolean("seen", false);
        boolean was = prefs.getBoolean("live", false);
        if (!known) {
            prefs.edit().putBoolean("seen", true).putBoolean("live", on).apply();
            return;
        }
        if (on && !was) Alerts.show(context, "live", "Началась трансляция", "Сейчас идёт месса собора Непорочного Зачатия", "live");
        else if (!on && was) Alerts.show(context, "live-off", "", "", "");
    }

    private static void checkArchive(Context context) throws Exception {
        String id = "";
        String title = "";
        String source = "";
        try {
            String xml = http("https://www.youtube.com/feeds/videos.xml?channel_id=UCv_ztXSXtfmUW_fSF08kFIA", "application/atom+xml");
            int at = xml.indexOf("<yt:videoId>");
            if (at >= 0) {
                int end = xml.indexOf("</yt:videoId>", at);
                if (end > at) id = xml.substring(at + 12, end);
            }
            int titleAt = xml.indexOf("<media:title>");
            if (titleAt >= 0) {
                int end = xml.indexOf("</media:title>", titleAt);
                if (end > titleAt) title = xml.substring(titleAt + 13, end);
            }
            if (id.length() > 0) source = "youtube";
        } catch (Exception ignored) {
        }
        if (id.length() == 0) {
            String json = http("https://rutube.ru/api/video/person/40512872/?page=1&limit=1", "application/json");
            int results = json.indexOf("\"id\":");
            if (results >= 0) {
                int quote = json.indexOf('"', results + 5);
                int end = json.indexOf('"', quote + 1);
                if (quote >= 0 && end > quote) id = json.substring(quote + 1, end);
            }
            int titleAt = json.indexOf("\"title\":");
            if (titleAt >= 0) {
                int quote = json.indexOf('"', titleAt + 8);
                int end = json.indexOf('"', quote + 1);
                if (quote >= 0 && end > quote) title = json.substring(quote + 1, end);
            }
            if (id.length() > 0) source = "rutube";
        }
        if (id.length() == 0) return;
        SharedPreferences prefs = context.getSharedPreferences("catedra-alerts", Context.MODE_PRIVATE);
        String key = "arch-" + source;
        String prev = prefs.getString(key, "");
        if (prev.length() == 0) {
            prefs.edit().putString(key, id).apply();
            return;
        }
        if (prev.equals(id)) return;
        prefs.edit().putString(key, id).apply();
        if (title.length() == 0) title = "Новая запись мессы";
        Alerts.show(context, "archive", title, source + ":" + id, "archive");
    }

    private static String localVersion(Context context) {
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return info.versionName == null ? "0" : info.versionName;
        } catch (Exception e) {
            return "0";
        }
    }

    private static String firstUrl(String page, String tail) {
        int at = page.indexOf("http");
        while (at >= 0) {
            int end = at;
            while (end < page.length()) {
                char c = page.charAt(end);
                if (c == '"' || c == '\'' || c == '\\' || c == ' ' || c == '<' || c == '>') break;
                end++;
            }
            String url = page.substring(at, end).replace("\\/", "/");
            if (url.indexOf(tail) > 0) return url;
            at = page.indexOf("http", end + 1);
        }
        return null;
    }

    private static String http(String url, String accept) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("User-Agent", "Catedra/1.2.9");
        connection.setRequestProperty("Accept", accept);
        int code = connection.getResponseCode();
        InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null || code >= 400) throw new Exception("http");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        int total = 0;
        while ((n = stream.read(buf)) >= 0 && total < 400000) {
            out.write(buf, 0, n);
            total += n;
        }
        stream.close();
        return out.toString("UTF-8");
    }
}
