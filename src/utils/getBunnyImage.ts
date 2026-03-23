const BUNNY_CDN_URL = 'https://danielupnorth-switch.b-cdn.net';

export const getBunnyImage = (
  imageName: string,
  width?: number,
  quality = 90,
  format: 'webp' | 'avif' | 'jpg' | 'png' = 'webp',
) => {
  if (!imageName) {
    throw new Error('Image name is required');
  }

  const params = new URLSearchParams({
    q: quality.toString(),
    fmt: format,
  });

  if (width) {
    params.set('w', width.toString());
  }

  return `${BUNNY_CDN_URL}/api/img/${imageName}?${params.toString()}`;
};
