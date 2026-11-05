package ru.catedra.mobile;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static MainActivity current;
    private WebView web;
    private FrameLayout full;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private boolean pageReady;
    private boolean playingNow;
    private String pendingScreen = "home";
    private String pendingId = "";

    public boolean isPlayingNow() {
        return playingNow;
    }

    public void reportUpdate(final String json) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript("if(window.CatedraUpdate)CatedraUpdate(" + json + ")", null);
            }
        });
    }

    public static void open(String screen, String id) {
        MainActivity activity = current;
        if (activity == null) return;
        activity.pendingScreen = screen == null ? "home" : screen;
        activity.pendingId = id == null ? "" : id;
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                activity.applyPending();
            }
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = this;
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16, 8, 10));
        web = new WebView(this);
        full = new FrameLayout(this);
        full.setVisibility(View.GONE);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(full, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        try {
            WebSettings.class.getMethod("setAllowUniversalAccessFromFileURLs", boolean.class).invoke(settings, Boolean.TRUE);
        } catch (Exception ignored) {
        }
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        settings.setUserAgentString(settings.getUserAgentString() + " CatedraPhone/1.2.0");
        web.addJavascriptInterface(new Bridge(), "CatedraNative");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();
        readIntent(getIntent());
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
        applyPending();
    }

    @Override
    protected void onResume() {
        super.onResume();
        current = this;
        Updater.onResume(this);
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            hideCustom();
            return;
        }
        if (web != null) web.evaluateJavascript("back()", null);
        else super.onBackPressed();
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (!playingNow || Build.VERSION.SDK_INT < 26) return;
        if (Build.VERSION.SDK_INT >= 24 && isInPictureInPictureMode()) return;
        try {
            enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9)).build());
        } catch (Exception ignored) {
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            onBackPressed();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void readIntent(Intent intent) {
        if (intent == null) return;
        if (intent.hasExtra("screen")) pendingScreen = intent.getStringExtra("screen");
        if (intent.hasExtra("id")) pendingId = intent.getStringExtra("id");
        Uri data = intent.getData();
        if (data == null) return;
        String host = data.getHost() == null ? "" : data.getHost();
        String path = data.getPath() == null ? "" : data.getPath();
        String last = data.getLastPathSegment() == null ? "" : data.getLastPathSegment();
        if (path.contains("schedule") || "schedule".equals(last)) pendingScreen = "schedule";
        else if (path.contains("online") || "live".equals(last) || "live".equals(host)) pendingScreen = "live";
        else if ("watch".equals(last) || path.contains("watch")) {
            pendingScreen = "watch";
            String id = data.getQueryParameter("id");
            if (id != null) pendingId = id;
        } else if ("archive".equals(last)) pendingScreen = "archive";
        else if ("settings".equals(last)) pendingScreen = "settings";
        else if ("home".equals(last)) pendingScreen = "home";
    }

    private void applyPending() {
        if (!pageReady || web == null) return;
        final String screen = pendingScreen == null ? "home" : pendingScreen;
        final String id = pendingId == null ? "" : pendingId;
        web.evaluateJavascript("if(window.CatedraOpen)CatedraOpen(" + js(screen) + "," + js(id) + ")", null);
    }

    private static String js(String value) {
        if (value == null) value = "";
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private void hideCustom() {
        if (customCallback != null) customCallback.onCustomViewHidden();
        if (customView != null) full.removeView(customView);
        customView = null;
        customCallback = null;
        full.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
    }

    private final class Chrome extends WebChromeClient {
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) {
                callback.onCustomViewHidden();
                return;
            }
            customView = view;
            customCallback = callback;
            full.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            full.setVisibility(View.VISIBLE);
            web.setVisibility(View.GONE);
        }

        @Override
        public void onHideCustomView() {
            hideCustom();
        }
    }

    private final class Client extends WebViewClient {
        @Override
        public void onPageFinished(WebView view, String url) {
            pageReady = true;
            view.evaluateJavascript("document.documentElement.className='phone'", null);
            applyPending();
            view.postDelayed(new Runnable() {
                @Override
                public void run() {
                    Updater.check(MainActivity.this, true);
                }
            }, 4000);
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (request == null || request.getUrl() == null) return null;
            Map<String, String> headers = request.getRequestHeaders();
            if (headers == null || !"1".equals(headers.get("X-Catedra-Fetch"))) {
                if (headers == null || !"1".equals(headers.get("x-catedra-fetch"))) return null;
            }
            return fetch(request.getUrl().toString());
        }
    }

    private WebResourceResponse fetch(String url) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(15000);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) Catedra/1.2.0");
            connection.setRequestProperty("Accept", "text/html,application/xml,application/xhtml+xml,*/*");
            int code = connection.getResponseCode();
            InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) return null;
            Map<String, String> responseHeaders = new HashMap<String, String>();
            responseHeaders.put("Access-Control-Allow-Origin", "*");
            String reason = connection.getResponseMessage();
            if (reason == null || reason.length() == 0) reason = code >= 400 ? "error" : "OK";
            return new WebResourceResponse("text/plain", "utf-8", code, reason, responseHeaders, stream);
        } catch (Exception e) {
            return null;
        }
    }

    public class Bridge {
        @JavascriptInterface
        public void syncHome(String json) {
            HomeChannel.publish(getApplicationContext(), json == null ? "{}" : json);
            try {
                JSONObject root = new JSONObject(json);
                final boolean playing = root.optBoolean("playing");
                final String title = root.optString("playTitle", "Св. Месса");
                final String poster = root.optString("poster", "");
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        playingNow = playing;
                        NowPlaying.update(MainActivity.this, playing, title, poster);
                    }
                });
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            });
        }

        @JavascriptInterface
        public void checkUpdate() {
            Updater.check(MainActivity.this, false);
        }

        @JavascriptInterface
        public void installUpdate() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Updater.install(MainActivity.this);
                }
            });
        }
    }
}
