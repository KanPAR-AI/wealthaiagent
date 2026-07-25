// Local Expo config plugin: disable release lint gating.
//
// Release builds (assembleRelease) fail on `lintVitalRelease` in transitive
// React Native modules (react-native-svg / screens / keyboard-controller).
// We don't want a shareable APK gated on third-party library lint. This was
// previously a manual edit to android/app/build.gradle, which `expo prebuild`
// (now required by @react-native-firebase) regenerates and would drop — so it
// lives here as a plugin and is re-applied on every prebuild.

const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidLintFix(config) {
  return withAppBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (src.includes('checkReleaseBuilds false')) return cfg; // already applied
    // Insert a lint {} block as the first thing inside the top-level android {}.
    cfg.modResults.contents = src.replace(
      /android\s*\{/,
      'android {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }'
    );
    return cfg;
  });
};
