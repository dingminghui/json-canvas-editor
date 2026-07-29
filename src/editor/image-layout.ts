interface ImageSize {
  height: number;
  width: number;
}

export interface ImageCropRect extends ImageSize {
  x: number;
  y: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getCoverImageCrop(
  image: ImageSize,
  frame: ImageSize,
  focalPointX = 0.5,
  focalPointY = 0.5,
): ImageCropRect | null {
  if (image.width <= 0 || image.height <= 0 || frame.width <= 0 || frame.height <= 0) {
    return null;
  }

  const frameAspectRatio = frame.width / frame.height;
  const imageAspectRatio = image.width / image.height;
  const width = imageAspectRatio > frameAspectRatio ? image.height * frameAspectRatio : image.width;
  const height =
    imageAspectRatio > frameAspectRatio ? image.height : image.width / frameAspectRatio;
  const centerX = clamp(focalPointX, 0, 1) * image.width;
  const centerY = clamp(focalPointY, 0, 1) * image.height;

  return {
    height,
    width,
    x: clamp(centerX - width / 2, 0, image.width - width),
    y: clamp(centerY - height / 2, 0, image.height - height),
  };
}
