/**
 * Jest-only CJS stand-in for @nestjs/common/utils/load-package.util.js.
 *
 * That file is shipped as real ESM (@nestjs/common's package.json sets
 * "type": "module") and contains a literal `import.meta.url` reference in its
 * loaderFn-less fallback branch. Node's CJS parser refuses to even parse a file
 * containing that token, regardless of whether the branch runs — so once
 * transformIgnorePatterns lets ts-jest transform @nestjs's export/import syntax
 * to CommonJS, this is the one remaining line jest's CJS runtime can't load at all.
 *
 * Every real call site in this codebase (@nestjs/common's own validation.pipe.js
 * included) always passes a loaderFn, so the import.meta.url branch is never
 * actually exercised in practice — this reimplements the same four functions with
 * a plain `require()` fallback instead, which is semantically equivalent for every
 * path that's reachable here.
 */
const packageCache = new Map();

function missingDependencyMessage(name, reason) {
  return `The "${name}" package is missing. Please, make sure to install it to use ${reason}.`;
}

async function loadPackage(packageName, context, loaderFn) {
  const cached = packageCache.get(packageName);
  if (cached) return cached;
  try {
    const pkg = loaderFn ? await loaderFn() : require(packageName);
    packageCache.set(packageName, pkg);
    return pkg;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(missingDependencyMessage(packageName, context));
    process.exit(1);
  }
}

function loadPackageSync(packageName, context, loaderFn) {
  const cached = packageCache.get(packageName);
  if (cached) return cached;
  try {
    const pkg = loaderFn ? loaderFn() : require(packageName);
    packageCache.set(packageName, pkg);
    return pkg;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(missingDependencyMessage(packageName, context));
    process.exit(1);
  }
}

function loadPackageCached(packageName, context) {
  const cached = packageCache.get(packageName);
  if (!cached) {
    if (context) {
      return loadPackageSync(packageName, context);
    }
    throw new Error(
      `Package "${packageName}" has not been loaded yet. ` +
        `Ensure loadPackage("${packageName}", ...) has been awaited before calling loadPackageCached.`,
    );
  }
  return cached;
}

async function tryLoadPackage(packageName, loaderFn) {
  const cached = packageCache.get(packageName);
  if (cached) return cached;
  try {
    const pkg = loaderFn ? await loaderFn() : require(packageName);
    packageCache.set(packageName, pkg);
    return pkg;
  } catch {
    return null;
  }
}

module.exports = { loadPackage, loadPackageSync, loadPackageCached, tryLoadPackage };
