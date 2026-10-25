package kw.hadesign.diwan;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** تطبيق ديوان المدلل: يفتح الموقع بشاشة كاملة، وأي تعديل على الموقع يوصل للتطبيق على طول. */
public class MainActivity extends Activity {
    static final String HOME = "https://ha-games.habeeb3.workers.dev/";
    static final String HOST = "ha-games.habeeb3.workers.dev";
    WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // الشاشة ما تطفي وقت اللعب
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0E0B09"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " DiwanApp/1.0");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                // الروابط اللي برا الموقع (واتساب مثلاً) تفتح بتطبيقها
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (!r.isForMainFrame()) return;
                v.loadDataWithBaseURL(null,
                    "<html dir='rtl'><body style='background:#0E0B09;color:#efe3c8;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center'>"
                    + "<h2>النت فاصل</h2><p style='color:#a69886'>تأكد من النت وارجع جرب</p>"
                    + "<button onclick=\"location.href='" + HOME + "'\" style='font-size:18px;padding:12px 28px;border-radius:12px;border:0;background:#c9a35b;color:#1d1408;font-weight:bold'>جرب مرة ثانية</button></body></html>",
                    "text/html", "utf-8", null);
            }
        });
        setContentView(web);
        Uri data = getIntent() != null ? getIntent().getData() : null;
        if (state != null) web.restoreState(state);
        else web.loadUrl(data != null && HOST.equals(data.getHost()) ? data.toString() : HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onPause() { web.onPause(); super.onPause(); }
}
