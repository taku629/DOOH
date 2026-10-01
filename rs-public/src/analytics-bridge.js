const CONFIG_PATH = new URL("../config/firebase-config.json", import.meta.url).href;

let analyticsPromise;

async function loadConfig() {
  try {
    const response = await fetch(CONFIG_PATH, { cache: "no-cache" });
    if (!response.ok) {
      return null;
    }

    const config = await response.json();
    return config.apiKey && config.measurementId ? config : null;
  } catch {
    return null;
  }
}

async function getAnalyticsClient() {
  if (analyticsPromise) {
    return analyticsPromise;
  }

  analyticsPromise = (async () => {
    const config = await loadConfig();
    if (!config) {
      return null;
    }

    try {
      const [appSdk, analyticsSdk] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js"),
      ]);

      if (!(await analyticsSdk.isSupported())) {
        return null;
      }

      const app = appSdk.getApps().length > 0
        ? appSdk.getApp()
        : appSdk.initializeApp(config);
      return {
        analytics: analyticsSdk.getAnalytics(app),
        logEvent: analyticsSdk.logEvent,
      };
    } catch (error) {
      console.info("[analytics] unavailable:", error);
      return null;
    }
  })();

  return analyticsPromise;
}

export async function logAnalyticsEvent(eventName, parameters = {}) {
  const client = await getAnalyticsClient();
  if (!client) {
    return false;
  }

  client.logEvent(client.analytics, eventName, parameters);
  return true;
}
