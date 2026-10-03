# Third-party code

## three.js

- **Version:** 0.180.0
- **Source:** https://registry.npmjs.org/three/-/three-0.180.0.tgz (npm registry tarball)
- **License:** MIT — see `vendor/three/LICENSE`
- **Files vendored:** `vendor/three/three.module.js`, `vendor/three/three.core.js`
  (the module entry imports `./three.core.js`, both are required; unmodified)
- **Why vendored:** prototipe berjalan tanpa jaringan/CDN — server statis lokal saja.
