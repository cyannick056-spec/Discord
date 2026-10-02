// Sharing decoded images also makes the first lighting/shadow pass complete.
const images = new Map<string, HTMLImageElement>();
export function sceneImage(url: string) {
  let image = images.get(url);
  if (!image) { image = new Image(); image.src = url; images.set(url, image); }
  return image;
}
