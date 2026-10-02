// Keep these limits aligned with the compact media queries in both stylesheets.
export function isCompactView(width = innerWidth, height = innerHeight) {
  return height <= 360 || (width <= 520 && height <= 400) || (width <= 360 && height <= 520);
}
