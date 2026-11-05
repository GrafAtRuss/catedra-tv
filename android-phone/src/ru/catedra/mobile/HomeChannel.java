package ru.catedra.mobile;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.tv.TvContract;
import android.net.Uri;
import android.os.Build;
import java.io.File;
import java.io.FileOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

public final class HomeChannel {
    private static final String PREFS = "catedra";
    private static final String CHANNEL_KEY = "catedra-home";

    private HomeChannel() {}

    public static void publish(Context context, String json) {
        writeCatalog(context, json);
        if (!"ru.catedra.tv".equals(context.getPackageName())) return;
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            JSONObject root = new JSONObject(json);
            long channelId = ensureChannel(context);
            if (channelId < 0) return;
            ContentResolver resolver = context.getContentResolver();
            resolver.delete(TvContract.buildPreviewProgramsUriForChannel(channelId), null, null);
            JSONArray items = root.optJSONArray("items");
            if (items == null) return;
            int n = items.length();
            for (int i = 0; i < n; i++) {
                JSONObject item = items.getJSONObject(i);
                insertProgram(context, resolver, channelId, item, 100 - i);
            }
            String playId = root.optBoolean("playing") ? root.optString("screen", "live") : "";
            if (root.optBoolean("playing")) {
                insertWatchNext(context, resolver, root.optString("playTitle", "Св. Месса"), playId, root.optString("poster", ""));
            }
            askBrowsable(context, channelId);
        } catch (Exception ignored) {
        }
    }

    public static void ensureLive(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            long channelId = ensureChannel(context);
            if (channelId < 0) return;
            ContentValues values = baseProgram(context, channelId, "live", "live", "Прямой эфир", "Смотреть мессу", "", 100);
            context.getContentResolver().insert(TvContract.PreviewPrograms.CONTENT_URI, values);
        } catch (Exception ignored) {
        }
    }

    private static void writeCatalog(Context context, String json) {
        FileOutputStream out = null;
        try {
            out = new FileOutputStream(new File(context.getFilesDir(), "home.json"));
            out.write(json.getBytes("UTF-8"));
        } catch (Exception ignored) {
        } finally {
            if (out != null) try { out.close(); } catch (Exception ignored) {}
        }
    }

    private static long ensureChannel(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long saved = prefs.getLong("channelId", -1);
        if (saved >= 0 && channelExists(context, saved)) return saved;
        ContentValues values = new ContentValues();
        values.put(TvContract.Channels.COLUMN_TYPE, TvContract.Channels.TYPE_PREVIEW);
        values.put(TvContract.Channels.COLUMN_DISPLAY_NAME, "Кафедра");
        values.put(TvContract.Channels.COLUMN_DESCRIPTION, "Месса, расписание и записи собора Непорочного Зачатия");
        values.put(TvContract.Channels.COLUMN_INTERNAL_PROVIDER_ID, CHANNEL_KEY);
        values.put(TvContract.Channels.COLUMN_APP_LINK_INTENT_URI, openUri(context, "home", ""));
        values.put(TvContract.Channels.COLUMN_SEARCHABLE, 1);
        values.put(TvContract.Channels.COLUMN_APP_LINK_ICON_URI, "android.resource://ru.catedra.mobile/drawable/ic_launcher");
        Uri uri = context.getContentResolver().insert(TvContract.Channels.CONTENT_URI, values);
        if (uri == null) return -1;
        long id = ContentUris.parseId(uri);
        prefs.edit().putLong("channelId", id).apply();
        return id;
    }

    private static boolean channelExists(Context context, long id) {
        Cursor cursor = null;
        try {
            cursor = context.getContentResolver().query(TvContract.buildChannelUri(id), new String[]{"_id"}, null, null, null);
            return cursor != null && cursor.moveToFirst();
        } catch (Exception e) {
            return false;
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    private static void insertProgram(Context context, ContentResolver resolver, long channelId, JSONObject item, int weight) throws Exception {
        String kind = item.optString("kind", "clip");
        String id = item.optString("id", kind);
        String screen = "schedule";
        if ("live".equals(kind)) screen = "live";
        else if ("clip".equals(kind)) screen = "watch";
        ContentValues values = baseProgram(context, channelId, id, kind, item.optString("title", "Кафедра"), item.optString("text", ""), item.optString("poster", ""), weight);
        values.put(TvContract.PreviewPrograms.COLUMN_INTENT_URI, openUri(context, screen, "watch".equals(screen) ? id : ""));
        resolver.insert(TvContract.PreviewPrograms.CONTENT_URI, values);
    }

    private static ContentValues baseProgram(Context context, long channelId, String id, String kind, String title, String text, String poster, int weight) {
        ContentValues values = new ContentValues();
        values.put(TvContract.PreviewPrograms.COLUMN_CHANNEL_ID, channelId);
        values.put(TvContract.PreviewPrograms.COLUMN_INTERNAL_PROVIDER_ID, id);
        values.put(TvContract.PreviewPrograms.COLUMN_TITLE, title);
        values.put(TvContract.PreviewPrograms.COLUMN_SHORT_DESCRIPTION, text);
        values.put(TvContract.PreviewPrograms.COLUMN_WEIGHT, weight);
        values.put(TvContract.PreviewPrograms.COLUMN_SEARCHABLE, 1);
        values.put(TvContract.PreviewPrograms.COLUMN_AVAILABILITY, TvContract.PreviewPrograms.AVAILABILITY_AVAILABLE);
        int type = TvContract.PreviewPrograms.TYPE_CLIP;
        if ("live".equals(kind)) type = TvContract.PreviewPrograms.TYPE_CHANNEL;
        else if ("event".equals(kind)) type = TvContract.PreviewPrograms.TYPE_EVENT;
        values.put(TvContract.PreviewPrograms.COLUMN_TYPE, type);
        values.put(TvContract.PreviewPrograms.COLUMN_LIVE, "live".equals(kind) ? 1 : 0);
        values.put(TvContract.PreviewPrograms.COLUMN_POSTER_ART_ASPECT_RATIO, TvContract.PreviewPrograms.ASPECT_RATIO_16_9);
        values.put(TvContract.PreviewPrograms.COLUMN_THUMBNAIL_ASPECT_RATIO, TvContract.PreviewPrograms.ASPECT_RATIO_16_9);
        if (poster != null && poster.startsWith("http")) {
            values.put(TvContract.PreviewPrograms.COLUMN_POSTER_ART_URI, poster);
            values.put(TvContract.PreviewPrograms.COLUMN_THUMBNAIL_URI, poster);
        } else {
            String art = "android.resource://ru.catedra.mobile/drawable/tv_banner";
            values.put(TvContract.PreviewPrograms.COLUMN_POSTER_ART_URI, art);
            values.put(TvContract.PreviewPrograms.COLUMN_THUMBNAIL_URI, art);
        }
        values.put(TvContract.PreviewPrograms.COLUMN_INTENT_URI, openUri(context, "live".equals(kind) ? "live" : "home", ""));
        return values;
    }

    private static void insertWatchNext(Context context, ContentResolver resolver, String title, String screen, String poster) {
        try {
            resolver.delete(
                TvContract.WatchNextPrograms.CONTENT_URI,
                TvContract.WatchNextPrograms.COLUMN_INTERNAL_PROVIDER_ID + "=?",
                new String[]{"catedra-playing"}
            );
            ContentValues values = new ContentValues();
            values.put(TvContract.WatchNextPrograms.COLUMN_INTERNAL_PROVIDER_ID, "catedra-playing");
            values.put(TvContract.WatchNextPrograms.COLUMN_TYPE, TvContract.WatchNextPrograms.TYPE_CLIP);
            values.put(TvContract.WatchNextPrograms.COLUMN_WATCH_NEXT_TYPE, TvContract.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE);
            values.put(TvContract.WatchNextPrograms.COLUMN_TITLE, title);
            values.put(TvContract.WatchNextPrograms.COLUMN_SHORT_DESCRIPTION, "Кафедра");
            values.put(TvContract.WatchNextPrograms.COLUMN_LAST_ENGAGEMENT_TIME_UTC_MILLIS, System.currentTimeMillis());
            values.put(TvContract.WatchNextPrograms.COLUMN_BROWSABLE, 1);
            values.put(TvContract.WatchNextPrograms.COLUMN_INTENT_URI, openUri(context, screen == null || screen.length() == 0 ? "live" : screen, ""));
            if (poster != null && poster.startsWith("http")) {
                values.put(TvContract.WatchNextPrograms.COLUMN_POSTER_ART_URI, poster);
            }
            resolver.insert(TvContract.WatchNextPrograms.CONTENT_URI, values);
        } catch (Exception ignored) {
        }
    }

    private static void askBrowsable(Context context, long channelId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (prefs.getBoolean("browsableAsked", false)) return;
        try {
            TvContract.requestChannelBrowsable(context, channelId);
            prefs.edit().putBoolean("browsableAsked", true).apply();
        } catch (Exception ignored) {
        }
    }

    static String openUri(Context context, String screen, String id) {
        Uri.Builder data = Uri.parse("catedra://open").buildUpon().appendPath(screen == null || screen.length() == 0 ? "home" : screen);
        if (id != null && id.length() > 0) data.appendQueryParameter("id", id);
        Intent intent = new Intent(Intent.ACTION_VIEW, data.build());
        intent.setClassName(context, MainActivity.class.getName());
        intent.putExtra("screen", screen);
        if (id != null) intent.putExtra("id", id);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return intent.toUri(Intent.URI_INTENT_SCHEME);
    }
}
