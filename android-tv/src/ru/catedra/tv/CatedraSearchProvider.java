package ru.catedra.tv;

import android.app.SearchManager;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import org.json.JSONArray;
import org.json.JSONObject;

public class CatedraSearchProvider extends ContentProvider {
    private static final String[] COLUMNS = new String[] {
        "_id",
        SearchManager.SUGGEST_COLUMN_TEXT_1,
        SearchManager.SUGGEST_COLUMN_TEXT_2,
        SearchManager.SUGGEST_COLUMN_INTENT_DATA
    };

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        String query = "";
        if (uri != null && uri.getLastPathSegment() != null && !"search_suggest_query".equals(uri.getLastPathSegment())) {
            query = uri.getLastPathSegment().toLowerCase();
        }
        MatrixCursor cursor = new MatrixCursor(COLUMNS);
        add(cursor, 1, "Прямой эфир", "Кафедра", "catedra://open/live", query);
        add(cursor, 2, "Расписание", "Службы собора", "catedra://open/schedule", query);
        add(cursor, 3, "Записи", "Прошедшие мессы", "catedra://open/archive", query);
        String raw = readCatalog();
        if (raw == null) return cursor;
        try {
            JSONObject root = new JSONObject(raw);
            JSONArray items = root.optJSONArray("items");
            if (items == null) return cursor;
            int n = items.length();
            for (int i = 0; i < n; i++) {
                JSONObject item = items.getJSONObject(i);
                String title = item.optString("title", "");
                String kind = item.optString("kind", "");
                String id = item.optString("id", "");
                String data = "catedra://open/home";
                if ("live".equals(kind)) data = "catedra://open/live";
                else if ("event".equals(kind)) data = "catedra://open/schedule";
                else if ("clip".equals(kind)) data = "catedra://open/watch?id=" + Uri.encode(id);
                add(cursor, 10 + i, title, item.optString("text", "Кафедра"), data, query);
            }
        } catch (Exception ignored) {
        }
        return cursor;
    }

    private void add(MatrixCursor cursor, int id, String title, String text, String data, String query) {
        String blob = (title + " " + text).toLowerCase();
        if (query.length() > 0 && blob.indexOf(query) < 0 && !"месса".equals(query) && !"кафедра".equals(query)) {
            if (title.toLowerCase().indexOf(query) < 0) return;
        }
        cursor.addRow(new Object[] { Integer.valueOf(id), title, text, data });
    }

    private String readCatalog() {
        if (getContext() == null) return null;
        File file = new File(getContext().getFilesDir(), "home.json");
        if (!file.exists()) return null;
        FileInputStream in = null;
        try {
            in = new FileInputStream(file);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } catch (Exception e) {
            return null;
        } finally {
            if (in != null) try { in.close(); } catch (Exception ignored) {}
        }
    }

    @Override
    public String getType(Uri uri) {
        return "vnd.android.cursor.dir/vnd.catedra.search";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
