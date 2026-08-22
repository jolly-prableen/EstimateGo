module.exports = {
  expo: {
    name: 'EstimateGo',
    slug: 'velocebill-pro',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'estimatego',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    platforms: ['ios', 'android', 'web'],
    icon: './assets/favicon.png',
    web: {
      favicon: './assets/favicon.png',
    },
    android: {
      package: 'com.estimatego.app',
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#3B5338',
      },
      permissions: [],
    },
    ios: {
      bundleIdentifier: 'com.estimatego.app',
      buildNumber: '1',
      supportsTablet: true,
    },
    extra: {
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:4000',
      eas: {
        projectId: 'ffd6b3a2-28be-44c1-b03f-8db6a27d8216',
      },
    },
  },
};
