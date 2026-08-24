import '@testing-library/jest-dom'

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
