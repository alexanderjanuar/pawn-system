/**
 * Shrink a camera photo before it is uploaded.
 *
 * Phone cameras produce 3–8 MB images; a few of those in one form overflow the
 * server's upload limit and the whole save is rejected. 1600 px on the long
 * side keeps an IMEI sticker or a KTP perfectly legible at a few hundred KB.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.82;
/** Small, already-sized images are sent untouched. */
const SKIP_BELOW_BYTES = 400 * 1024;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === 'function') {
        // Honour the EXIF rotation so portrait shots do not arrive sideways.
        return createImageBitmap(file, { imageOrientation: 'from-image' });
    }

    const url = URL.createObjectURL(file);

    try {
        const img = new Image();
        img.src = url;
        await img.decode();

        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        return file;
    }

    try {
        const image = await decode(file);
        const width =
            'naturalWidth' in image ? image.naturalWidth : image.width;
        const height =
            'naturalHeight' in image ? image.naturalHeight : image.height;
        const scale = Math.min(1, MAX_SIDE / Math.max(width, height));

        if (scale === 1 && file.size <= SKIP_BELOW_BYTES) {
            if ('close' in image) {
                image.close();
            }

            return file;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        const context = canvas.getContext('2d');

        if (!context) {
            return file;
        }

        // JPEG has no transparency; paint white so a PNG does not turn black.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        if ('close' in image) {
            image.close();
        }

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', QUALITY),
        );

        if (!blob || blob.size >= file.size) {
            return file;
        }

        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
            type: 'image/jpeg',
            lastModified: file.lastModified,
        });
    } catch {
        // An image the browser cannot decode is sent as it is; the server
        // still validates it.
        return file;
    }
}

export function compressImages(files: File[]): Promise<File[]> {
    return Promise.all(files.map(compressImage));
}
