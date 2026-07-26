declare module 'pptx2html' {
  const renderPptx: (pptx: ArrayBuffer, resultElement: Element | string, thumbElement?: Element | string) => Promise<{ time: number; slideSize: { width: number; height: number } }>
  export default renderPptx
}
