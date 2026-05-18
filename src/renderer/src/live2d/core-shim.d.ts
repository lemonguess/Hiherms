// `live2dcubismcore.min.js` is loaded via <script> in index.html and exposes
// the global `Live2DCubismCore`. We don't import its types; we just declare
// the global so TypeScript stops complaining when other code peeks at it.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Live2DCubismCore: any
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Live2DCubismCore: any
  }
}

export {}
