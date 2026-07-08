/**
 * Client-side photo downscale before any byte leaves the device. Phone cameras
 * produce 12MP+ originals; uploading them full-size costs Storage space, mobile
 * bandwidth, thumbnail latency (list views load the full object), and vision-API
 * money (providers are billed on image size). 1600px on the long edge keeps
 * plenty of detail for shelf detection and item photos.
 *
 * Decode failures fall back to the original blob — a photo the browser can't
 * decode must still be uploadable rather than failing the capture flow.
 */
const DEFAULT_MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export async function downscaleImageBlob(blob: Blob, maxEdge = DEFAULT_MAX_EDGE): Promise<Blob> {
  try {
    // from-image: bake the EXIF orientation into the pixels so the resized copy
    // doesn't render sideways in browsers that ignore orientation on <img>.
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    try {
      const { width, height } = bitmap;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      if (scale >= 1) return blob;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) return blob;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const scaled = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
      // A downscale that somehow grew the file is useless — keep the original.
      return scaled && scaled.size < blob.size ? scaled : blob;
    } finally {
      bitmap.close();
    }
  } catch {
    return blob;
  }
}
