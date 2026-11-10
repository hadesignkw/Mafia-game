import UIKit
import WebKit
import AVFoundation

/// تطبيق ديوان المدلل للآيفون: يفتح الموقع بشاشة كاملة، وأي تعديل على الموقع يوصل للتطبيق على طول.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // الأصوات تطلع حتى لو التلفون على الصامت، وتختلط مع الموسيقى بدل ما توقفها
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        application.isIdleTimerDisabled = true // الشاشة ما تطفي وقت اللعب
        return true
    }
    func application(_ application: UIApplication, configurationForConnecting s: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let c = UISceneConfiguration(name: "Default", sessionRole: s.role)
        c.delegateClass = SceneDelegate.self
        return c
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: ws)
        w.backgroundColor = UIColor(red: 0.055, green: 0.043, blue: 0.035, alpha: 1)
        let vc = WebVC()
        if let u = options.urlContexts.first?.url { vc.pending = u }
        w.rootViewController = vc
        w.makeKeyAndVisible()
        window = w
    }
    func sceneDidBecomeActive(_ scene: UIScene) { UIApplication.shared.isIdleTimerDisabled = true }
}

final class WebVC: UIViewController, WKNavigationDelegate, WKUIDelegate {
    static let home = URL(string: "https://ha-games.habeeb3.workers.dev/")!
    static let host = "ha-games.habeeb3.workers.dev"
    private var web: WKWebView!
    var pending: URL?

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let c = WKWebViewConfiguration()
        c.allowsInlineMediaPlayback = true
        c.mediaTypesRequiringUserActionForPlayback = []
        c.applicationNameForUserAgent = "DiwanApp/1.0 Mobile/15E148 Safari/604.1"
        c.websiteDataStore = .default()
        // نفس تجربة تطبيق الويب: إذا الآيفون ما يدعم «الشاشة ما تطفي» أو «مشاركة» داخل التطبيق، التطبيق نفسه يسويهم
        let uc = WKUserContentController()
        uc.add(ShareBridge(self), name: "diwanShare")
        uc.addUserScript(WKUserScript(source: Self.polyfills, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        c.userContentController = uc
        web = WKWebView(frame: .zero, configuration: c)
        let bg = UIColor(red: 0.055, green: 0.043, blue: 0.035, alpha: 1)
        web.isOpaque = false
        web.backgroundColor = bg
        web.scrollView.backgroundColor = bg
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = true
        web.navigationDelegate = self
        web.uiDelegate = self
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        load(pending.flatMap { $0.host == Self.host ? $0 : nil } ?? Self.home)
    }
    private func load(_ u: URL) { web.load(URLRequest(url: u)) }

    private static let polyfills = """
    (function(){
      if(!('wakeLock' in navigator)){
        try{Object.defineProperty(navigator,'wakeLock',{value:{request:function(){return Promise.resolve({released:false,type:'screen',release:function(){this.released=true;return Promise.resolve()},addEventListener:function(){},removeEventListener:function(){}})}}})}catch(e){}
      }
      if(!navigator.share){
        var cb=null;window.__diwanShared=function(ok){var c=cb;cb=null;if(c){ok?c[0]():c[1](Object.assign(new Error('cancel'),{name:'AbortError'}))}};
        try{navigator.share=function(d){return new Promise(function(res,rej){cb=[res,rej];try{webkit.messageHandlers.diwanShare.postMessage({title:String(d&&d.title||''),text:String(d&&d.text||''),url:String(d&&d.url||'')})}catch(e){cb=null;rej(e)}})};}catch(e){}
      }
    })();
    """

    fileprivate func share(_ d: [String: Any]) {
        var items: [Any] = []
        if let t = d["text"] as? String, !t.isEmpty { items.append(t) }
        if let u = d["url"] as? String, let url = URL(string: u) { items.append(url) }
        let a = UIActivityViewController(activityItems: items, applicationActivities: nil)
        a.popoverPresentationController?.sourceView = view
        a.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        a.completionWithItemsHandler = { [weak self] _, ok, _, _ in self?.web.evaluateJavaScript("window.__diwanShared&&window.__diwanShared(\(ok))") }
        present(a, animated: true)
    }

    // الروابط اللي برا الموقع (واتساب مثلاً) تفتح بتطبيقها
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = a.request.url else { decisionHandler(.allow); return }
        let s = u.scheme?.lowercased() ?? ""
        if (s == "http" || s == "https") && (u.host == Self.host || a.targetFrame?.isMainFrame == false) { decisionHandler(.allow); return }
        if s == "about" || s == "blob" || s == "data" { decisionHandler(.allow); return }
        UIApplication.shared.open(u)
        decisionHandler(.cancel)
    }
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url { if u.host == Self.host { load(u) } else { UIApplication.shared.open(u) } }
        return nil
    }
    // الكاميرا (QR) والمايك (أون لاين): يسأل الآيفون أول مرة بس
    @available(iOS 15.0, *)
    func webView(_ w: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == Self.host ? .grant : .prompt)
    }
    // تنبيهات الموقع (alert / confirm) تطلع مثل الآيفون
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: m, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "تمام", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: m, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "لا", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "إي", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt p: String, defaultText d: String?, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: p, preferredStyle: .alert)
        a.addTextField { $0.text = d }
        a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "تمام", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
    // النت فاصل
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { offline(e) }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { offline(e) }
    private func offline(_ e: Error) {
        if (e as NSError).code == NSURLErrorCancelled { return }
        let html = """
        <html dir='rtl'><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body style='background:#0E0B09;color:#efe3c8;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center'>
        <h2>النت فاصل</h2><p style='color:#a69886'>تأكد من النت وارجع جرب</p>
        <button onclick="location.href='\(Self.home.absoluteString)'" style='font-size:18px;padding:12px 28px;border-radius:12px;border:0;background:#c9a35b;color:#1d1408;font-weight:bold'>جرب مرة ثانية</button></body></html>
        """
        web.loadHTMLString(html, baseURL: nil)
    }
    // لو الآيفون قفل صفحة الويب بالخلفية (ذاكرة)، نرجع نفتحها
    func webViewWebContentProcessDidTerminate(_ w: WKWebView) { w.reload() }
}

private final class ShareBridge: NSObject, WKScriptMessageHandler {
    weak var vc: WebVC?
    init(_ v: WebVC) { vc = v }
    func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) {
        if let d = m.body as? [String: Any] { vc?.share(d) }
    }
}
