import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

const isNative = Capacitor.isNativePlatform();

// Google AdMob official Test IDs for Android (Replace with actual IDs for production)
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

/**
 * Initializes AdMob SDK. Safe to call on web/native.
 */
export async function initAdMob() {
  if (!isNative) {
    console.log('[AdMob] Not running on native platform. Skipping initialization.');
    return;
  }
  try {
    await AdMob.initialize({
      requestTrackingAuthorization: true,
    });
    console.log('[AdMob] Initialized successfully.');
  } catch (err) {
    console.error('[AdMob] Initialization failed:', err);
  }
}

/**
 * Shows a banner ad at the bottom of the screen.
 * @param {string} adUnitId AdMob banner ad unit ID
 */
export async function showBanner(adUnitId = TEST_BANNER_ID) {
  if (!isNative) {
    console.log('[AdMob] Not running on native platform. Skipping banner.');
    return;
  }
  try {
    const options = {
      adId: adUnitId,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true, // Force test ads. Set to false when using real ad IDs in production
    };
    await AdMob.showBanner(options);
    console.log('[AdMob] Banner ad shown.');
  } catch (err) {
    console.error('[AdMob] Failed to show banner ad:', err);
  }
}

/**
 * Hides/removes the active banner ad.
 */
export async function hideBanner() {
  if (!isNative) return;
  try {
    await AdMob.removeBanner();
    console.log('[AdMob] Banner ad removed.');
  } catch (err) {
    console.error('[AdMob] Failed to remove banner ad:', err);
  }
}

/**
 * Prepares and shows an interstitial ad.
 * @param {string} adUnitId AdMob interstitial ad unit ID
 */
export async function showInterstitial(adUnitId = TEST_INTERSTITIAL_ID) {
  if (!isNative) {
    console.log('[AdMob] Not running on native platform. Skipping interstitial.');
    return;
  }
  try {
    await AdMob.prepareInterstitial({
      adId: adUnitId,
      isTesting: true, // Force test ads. Set to false when using real ad IDs in production
    });
    await AdMob.showInterstitial();
    console.log('[AdMob] Interstitial ad shown.');
  } catch (err) {
    console.error('[AdMob] Failed to show interstitial ad:', err);
  }
}
