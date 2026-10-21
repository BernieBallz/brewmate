// Resolve a file in public/ against the app's base URL, so it still works when the app
// is hosted under a sub-path (e.g. GitHub Pages at /brewmate/) rather than the domain root.
export const assetUrl = (path: string): string => {
  const relative = `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
  if (typeof document === 'undefined') return relative;
  return new URL(relative, document.baseURI).href;
};
