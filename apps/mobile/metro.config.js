const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Zustand ships ESM (.mjs) with import.meta syntax. Metro bundles web output
// as a plain <script> (not type="module"), so import.meta causes a SyntaxError.
// Force the CJS build (.js) for any zustand/* import on web.
const zustandRoot = path.dirname(
  require.resolve('zustand/package.json', { paths: [__dirname] }),
);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.startsWith('zustand')) {
    // Map zustand/foo → <zustand-root>/foo.js (CJS build)
    const suffix = moduleName.slice('zustand'.length); // '' or '/middleware' etc.
    const cjsPath = suffix ? path.join(zustandRoot, `${suffix}.js`) : path.join(zustandRoot, 'index.js');
    return { filePath: cjsPath, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
