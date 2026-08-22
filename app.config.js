module.exports = {
  expo: {
    name: 'VeloceBill Pro',
    slug: 'velocebill-pro',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'velocebill',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    platforms: ['ios', 'android', 'web'],
    android: {
      package: 'com.velocebill.pro',
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#3B5338',
      },
      permissions: [],
    },
    ios: {
      bundleIdentifier: 'com.velocebill.pro',
      buildNumber: '1',
      supportsTablet: true,
    },
    extra: {
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:4000',
      eas: {
        projectId: process.env.EAS_PROJECT_ID,
      },
    },
  },
};
