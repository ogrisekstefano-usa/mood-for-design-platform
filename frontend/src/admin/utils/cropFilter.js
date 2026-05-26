/**
 * cropFilter.js — Canvas pipeline to crop + apply CSS filters and produce a Blob.
 * Uses CSS filter string compatible with both preview (CSS) and Canvas 2D.
 */

const createImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.addEventListener('load', () => resolve(img));
  img.addEventListener('error', (e) => reject(e));
  img.setAttribute('crossOrigin', 'anonymous');
  img.src = url;
});

/**
 * Build a CSS filter string from a filters object.
 * filters: { brightness, contrast, saturate, grayscale, sepia, blur }
 * Each value is a number; defaults applied where missing.
 */
export const buildFilterString = (filters = {}) => {
  const f = {
    brightness: 100, contrast: 100, saturate: 100,
    grayscale: 0, sepia: 0, blur: 0,
    ...filters,
  };
  return [
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    `saturate(${f.saturate}%)`,
    `grayscale(${f.grayscale}%)`,
    `sepia(${f.sepia}%)`,
    f.blur > 0 ? `blur(${f.blur}px)` : null,
  ].filter(Boolean).join(' ');
};

/**
 * Render the cropped + filtered image to a Blob.
 * @param {string} imageSrc - object URL of the source image
 * @param {{x:number,y:number,width:number,height:number}} cropPx - pixel crop from react-easy-crop
 * @param {object} filters - filter values
 * @param {string} mimeType - 'image/jpeg' or 'image/png' or 'image/webp'
 * @param {number} quality - 0..1 (for JPEG/WebP)
 * @returns {Promise<Blob>}
 */
export const cropAndFilterImage = async (
  imageSrc, cropPx, filters = {},
  mimeType = 'image/jpeg', quality = 0.92,
) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cropPx.width));
  canvas.height = Math.max(1, Math.round(cropPx.height));
  const ctx = canvas.getContext('2d');
  ctx.filter = buildFilterString(filters);
  ctx.drawImage(
    image,
    cropPx.x, cropPx.y, cropPx.width, cropPx.height,
    0, 0, canvas.width, canvas.height,
  );
  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('canvas.toBlob failed')),
      mimeType, quality);
  });
};

export const ASPECT_PRESETS = [
  { key: 'free',  label: 'Libero', ratio: null },
  { key: '1:1',   label: 'Quadrato', ratio: 1 },
  { key: '4:5',   label: 'Ritratto', ratio: 4 / 5 },
  { key: '3:2',   label: 'Editoriale', ratio: 3 / 2 },
  { key: '16:9',  label: 'Cinematico', ratio: 16 / 9 },
  { key: '21:9',  label: 'Panoramico', ratio: 21 / 9 },
  { key: '9:16',  label: 'Verticale', ratio: 9 / 16 },
];

export const FILTER_DEFAULTS = {
  brightness: 100, contrast: 100, saturate: 100,
  grayscale: 0, sepia: 0, blur: 0,
};

export const FILTER_PRESETS = [
  { key: 'none', label: 'Originale', values: { ...FILTER_DEFAULTS } },
  { key: 'editorial', label: 'Editoriale', values: { brightness: 102, contrast: 108, saturate: 95, grayscale: 0, sepia: 0, blur: 0 } },
  { key: 'cinematic', label: 'Cinematico', values: { brightness: 95, contrast: 115, saturate: 88, grayscale: 0, sepia: 8, blur: 0 } },
  { key: 'mono', label: 'Bianco & Nero', values: { brightness: 100, contrast: 110, saturate: 0, grayscale: 100, sepia: 0, blur: 0 } },
  { key: 'warm', label: 'Caldo', values: { brightness: 103, contrast: 105, saturate: 115, grayscale: 0, sepia: 18, blur: 0 } },
  { key: 'cool', label: 'Freddo', values: { brightness: 100, contrast: 108, saturate: 80, grayscale: 10, sepia: 0, blur: 0 } },
  { key: 'matte', label: 'Matte', values: { brightness: 105, contrast: 88, saturate: 90, grayscale: 8, sepia: 0, blur: 0 } },
];
