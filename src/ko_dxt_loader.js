function KODXTLoader(data) {
    const enc = new TextDecoder("utf-8");
    let offset = 0;

    // Standard DDS magic (0x20534444 "DDS ")
    if (data.byteLength >= 4 && data.getUint32(0, true) === 0x20534444) {
        // Pure DDS file
    } else {
        // Read Knight Online specific path header if present
        if (data.byteLength < 4) throw new Error("File too small");
        const headerLen = data.getInt32(offset, true);

        if (headerLen > 1024 || headerLen < 0) {
            // No custom header, proceed
        } else {
            offset += 4;
            offset += headerLen; // Skip path string
        }
    }

    if (offset + 6 > data.byteLength && data.byteLength >= 4 && data.getUint32(0, true) !== 0x20534444) {
        throw new Error("Invalid header length or file too small");
    }

    // Read Magic "DXTNTF"
    const magicBytes = new Uint8Array(data.buffer, offset, 6);
    const magic = String.fromCharCode(...magicBytes);

    let isNTF = false;
    if (magic === 'DXTNTF') {
        isNTF = true;
        offset += 6;
    } else if (magic.substring(0, 3) === 'NTF') {
        isNTF = true;
        offset += 3;
    } else if (magic.substring(3, 6) === 'NTF') {
        isNTF = true;
        offset += 6;
    }

    let format;
    let width, height;
    let threeFormatNTF;

    if (isNTF) {
        const version = data.getUint8(offset);
        offset += 1;

        width = data.getInt32(offset, true);
        height = data.getInt32(offset + 4, true);
        format = data.getInt32(offset + 8, true);
        offset += 12;
        offset += 4; // Reserved

        // D3DFMT_A1R5G5B5 = 25
        if (format === 25) {
            const pixelCount = width * height;
            const rgbaData = new Uint8ClampedArray(pixelCount * 4);

            for (let i = 0; i < pixelCount; i++) {
                if (offset + 2 > data.byteLength) break;
                const pixel = data.getUint16(offset, true);
                offset += 2;

                const a = (pixel & 0x8000) ? 255 : 0;
                const r5 = (pixel & 0x7C00) >> 10;
                const g5 = (pixel & 0x03E0) >> 5;
                const b5 = (pixel & 0x001F);

                const r = (r5 << 3) | (r5 >> 2);
                const g = (g5 << 3) | (g5 >> 2);
                const b = (b5 << 3) | (b5 >> 2);

                const idx = i * 4;
                rgbaData[idx] = r;
                rgbaData[idx + 1] = g;
                rgbaData[idx + 2] = b;
                rgbaData[idx + 3] = a;
            }

            const texture = new THREE.DataTexture(rgbaData, width, height, THREE.RGBAFormat);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
            return texture;
        }

        if (format === 0x31545844) threeFormatNTF = THREE.RGB_S3TC_DXT1_Format;
        else if (format === 0x33545844) threeFormatNTF = THREE.RGBA_S3TC_DXT3_Format;
        else if (format === 0x35545844) threeFormatNTF = THREE.RGBA_S3TC_DXT5_Format;
    }

    // Fallback: Scan for DDS magic
    let dxtOffset = -1;
    const magicDDS = 0x20534444;

    for (let i = 0; i <= data.byteLength - 4; i++) {
        if (data.getUint32(i, true) === magicDDS) {
            dxtOffset = i;
            break;
        }
    }

    if (dxtOffset === -1 && isNTF && threeFormatNTF) {
        const blockSize = (threeFormatNTF === THREE.RGB_S3TC_DXT1_Format) ? 8 : 16;
        const size = Math.max(4, width) / 4 * Math.max(4, height) / 4 * blockSize;

        if (offset + size <= data.byteLength) {
            const byteArray = new Uint8Array(data.buffer, offset, size);
            const texture = new THREE.CompressedTexture(
                [{ data: byteArray, width: width, height: height }],
                width,
                height,
                threeFormatNTF
            );
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
            return texture;
        }
    }

    if (dxtOffset === -1) {
        throw new Error(isNTF ? `Unsupported NTF format (${format})` : "Invalid DXT/DDS file.");
    }

    const ddsHeight = data.getUint32(dxtOffset + 12, true);
    const ddsWidth = data.getUint32(dxtOffset + 16, true);
    const mipmaps = data.getUint32(dxtOffset + 28, true);
    const formatCode = data.getUint32(dxtOffset + 84, true);

    let threeFormat;
    switch (formatCode) {
        case 0x31545844: threeFormat = THREE.RGB_S3TC_DXT1_Format; break;
        case 0x33545844: threeFormat = THREE.RGBA_S3TC_DXT3_Format; break;
        case 0x35545844: threeFormat = THREE.RGBA_S3TC_DXT5_Format; break;
        default: threeFormat = THREE.RGB_S3TC_DXT1_Format;
    }

    const dataOffset = dxtOffset + 128;
    const textureData = [];
    let currentOffset = dataOffset;
    let currentWidth = ddsWidth;
    let currentHeight = ddsHeight;
    const ddsBlockSize = (threeFormat === THREE.RGB_S3TC_DXT1_Format) ? 8 : 16;

    for (let i = 0; i < Math.max(1, mipmaps); i++) {
        const size = Math.max(4, currentWidth) / 4 * Math.max(4, currentHeight) / 4 * ddsBlockSize;
        if (currentOffset + size > data.byteLength) break;

        const byteArray = new Uint8Array(data.buffer, currentOffset, size);
        textureData.push({
            data: byteArray,
            width: currentWidth,
            height: currentHeight
        });

        currentOffset += size;
        currentWidth = Math.max(currentWidth / 2, 1);
        currentHeight = Math.max(currentHeight / 2, 1);
    }

    const texture = new THREE.CompressedTexture(textureData, ddsWidth, ddsHeight, threeFormat);
    texture.minFilter = (mipmaps > 1) ? THREE.LinearMipMapLinearFilter : THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    texture.needsUpdate = true;

    return texture;
}
