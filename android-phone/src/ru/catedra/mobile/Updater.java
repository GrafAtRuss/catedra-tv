package ru.catedra.mobile;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

public final class Updater {
    private static final String RELEASE = "https://api.github.com/repos/GrafAtRuss/catedra-tv/releases/latest";
    private static boolean busy;
    private static boolean waitPermission;
    private static boolean installAfter;
    private static String readyVersion = "";

    private Updater() {}

    public static void onResume(Activity activity) {
        if (!waitPermission) return;
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) return;
        waitPermission = false;
        install(activity);
    }

    public static void check(final Activity activity, final boolean automatic) {
        if (busy) return;
        busy = true;
        report(activity, "checking", "", "Проверяю GitHub…", "");
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String local = localVersion(activity);
                    JSONObject release = new JSONObject(http(RELEASE, "application/vnd.github+json", 20000));
                    String remote = release.optString("tag_name", "").replaceFirst("^v", "");
                    JSONObject asset = pick(release.optJSONArray("assets"), activity.getPackageName().endsWith(".mobile"));
                    if (remote.length() == 0 || asset == null) {
                        busy = false;
                        report(activity, "error", remote, "В релизе нет подходящего файла.", "");
                        return;
                    }
                    String url = asset.optString("browser_download_url", "");
                    if (!newer(remote, local)) {
                        busy = false;
                        readyVersion = "";
                        report(activity, "latest", remote, "Установлена последняя версия " + local + ".", "");
                        return;
                    }
                    report(activity, "downloading", remote, "Скачиваю " + remote + "…", url);
                    File file = new File(activity.getCacheDir(), "catedra-update.apk");
                    download(url, file);
                    readyVersion = remote;
                    busy = false;
                    report(activity, "ready", remote, "Версия " + remote + " скачана. Можно установить.", url);
                    boolean launch = installAfter || (automatic && !offered(activity, remote) && !isPlaying(activity));
                    installAfter = false;
                    if (launch) {
                        if (automatic) markOffered(activity, remote);
                        prompt(activity);
                    }
                } catch (Exception e) {
                    busy = false;
                    report(activity, "error", "", "Не удалось проверить обновление.", "");
                }
            }
        }).start();
    }

    public static void install(Activity activity) {
        File file = new File(activity.getCacheDir(), "catedra-update.apk");
        if (!file.exists() || readyVersion.length() == 0) {
            installAfter = true;
            if (!busy) check(activity, false);
            return;
        }
        prompt(activity);
    }

    private static void prompt(final Activity activity) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                File file = new File(activity.getCacheDir(), "catedra-update.apk");
                if (!file.exists()) return;
                if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
                    waitPermission = true;
                    report(activity, "need-permission", readyVersion, "Разрешите установку из этого приложения, затем обновление продолжится.", "");
                    Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()));
                    activity.startActivity(settings);
                    return;
                }
                Uri uri = Uri.parse("content://" + activity.getPackageName() + ".updates/catedra-update.apk");
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            }
        });
    }

    private static boolean isPlaying(Activity activity) {
        return activity instanceof MainActivity && ((MainActivity) activity).isPlayingNow();
    }

    private static void report(final Activity activity, final String state, final String version, final String message, final String url) {
        final JSONObject payload = new JSONObject();
        try {
            payload.put("state", state);
            payload.put("version", version);
            payload.put("message", message);
            payload.put("url", url);
        } catch (Exception ignored) {
        }
        if (!(activity instanceof MainActivity)) return;
        ((MainActivity) activity).reportUpdate(payload.toString());
    }

    private static JSONObject pick(JSONArray assets, boolean phone) throws Exception {
        if (assets == null) return null;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.getJSONObject(i);
            String name = asset.optString("name", "");
            boolean match = phone
                ? name.startsWith("Catedra-Phone-") && name.endsWith(".apk")
                : name.startsWith("Catedra-TV-") && name.endsWith(".apk");
            if (match) return asset;
        }
        if (phone) return null;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.getJSONObject(i);
            String name = asset.optString("name", "");
            if (name.startsWith("Catedra-") && name.indexOf("Phone") < 0 && name.endsWith(".apk")) return asset;
        }
        return null;
    }

    private static String localVersion(Activity activity) {
        try {
            PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return info.versionName == null ? "0" : info.versionName;
        } catch (Exception e) {
            return "0";
        }
    }

    static boolean newer(String remote, String local) {
        String[] a = remote.split("\\.");
        String[] b = local.split("\\.");
        int n = Math.max(a.length, b.length);
        for (int i = 0; i < n; i++) {
            int x = i < a.length ? number(a[i]) : 0;
            int y = i < b.length ? number(b[i]) : 0;
            if (x != y) return x > y;
        }
        return false;
    }

    private static int number(String part) {
        int value = 0;
        for (int i = 0; i < part.length(); i++) {
            char c = part.charAt(i);
            if (c < '0' || c > '9') break;
            value = value * 10 + (c - '0');
        }
        return value;
    }

    private static String http(String url, String accept, int timeout) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(timeout);
        connection.setReadTimeout(timeout);
        connection.setRequestProperty("User-Agent", "CatedraUpdate");
        connection.setRequestProperty("Accept", accept);
        InputStream stream = connection.getResponseCode() >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null || connection.getResponseCode() >= 400) throw new Exception("http");
        byte[] data = readAll(stream);
        return new String(data, "UTF-8");
    }

    private static void download(String url, File file) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("User-Agent", "CatedraUpdate");
        connection.setRequestProperty("Accept", "application/octet-stream");
        if (connection.getResponseCode() >= 400) throw new Exception("download");
        InputStream stream = connection.getInputStream();
        File tmp = new File(file.getParentFile(), "catedra-update.part");
        FileOutputStream out = new FileOutputStream(tmp);
        byte[] buffer = new byte[8192];
        int n;
        while ((n = stream.read(buffer)) >= 0) out.write(buffer, 0, n);
        out.close();
        stream.close();
        if (file.exists() && !file.delete()) throw new Exception("replace");
        if (!tmp.renameTo(file)) throw new Exception("rename");
    }

    private static byte[] readAll(InputStream stream) throws Exception {
        byte[] buffer = new byte[4096];
        int n;
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        while ((n = stream.read(buffer)) >= 0) out.write(buffer, 0, n);
        stream.close();
        return out.toByteArray();
    }

    private static boolean offered(Activity activity, String version) {
        return version.equals(activity.getSharedPreferences("catedra", Activity.MODE_PRIVATE).getString("offered", ""));
    }

    private static void markOffered(Activity activity, String version) {
        activity.getSharedPreferences("catedra", Activity.MODE_PRIVATE).edit().putString("offered", version).apply();
    }
}
