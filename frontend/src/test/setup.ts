import '@testing-library/jest-dom'

// jsdom does not implement scrollIntoView at all (by design — it doesn't do
// layout), so any component that calls it (e.g. use-form-validation.ts
// focusing + scrolling to the first invalid field) throws a raw TypeError.
// That throw happens outside the current test's try/catch (inside a
// requestAnimationFrame callback), so it surfaces as an unhandled error that
// fails the whole run's exit code even though every individual test still
// reports as passing — exactly the silent failure mode this stub exists to
// close off.
if (typeof window !== 'undefined' && typeof window.HTMLElement !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {}
}

// jsdom does not implement matchMedia; components (e.g. DashboardHero) use it
// for responsive behaviour. Provide a working stub so tests exercise real logic.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {}, // legacy Safari
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
