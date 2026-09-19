// Resolves the bare "three" specifier to the vendored build for the node tests.
export function resolve(specifier, context, nextResolve) {
  if (specifier === "three") {
    return {url: new URL("../../../../vendor/three.module.js", import.meta.url).href, shortCircuit: true};
  }
  return nextResolve(specifier, context);
}
