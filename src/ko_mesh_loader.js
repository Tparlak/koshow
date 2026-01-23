function readN3PMesh(data) {
  let offset = 0;
  const enc = new TextDecoder('utf-8');

  // Mesh Name
  const meshNameLength = data.getInt32(offset, true);
  const meshName = enc.decode(data.buffer.slice(offset + 4, offset + meshNameLength + 4));
  offset += meshNameLength + 4;

  // Header Info
  const collapseCount = data.getInt32(offset, true);
  const indexChangeCount = data.getInt32(offset + 4, true);
  const verticeCount = data.getInt32(offset + 8, true);
  const faceCount = data.getInt32(offset + 12, true);
  const verticeMinCount = data.getInt32(offset + 16, true);
  const faceMinCount = data.getInt32(offset + 20, true);
  offset += 24;

  // Safety Limit
  if (verticeCount > 0x8000 || faceCount > 0x8000) throw new Error('Model complexity too high');

  // Vertices
  const vertices = [];
  for (let i = 0; i < verticeCount; i++) {
    vertices.push({
      x: data.getFloat32(offset, true),
      y: data.getFloat32(offset + 4, true),
      z: data.getFloat32(offset + 8, true),
      nx: data.getFloat32(offset + 12, true),
      ny: data.getFloat32(offset + 16, true),
      nz: data.getFloat32(offset + 20, true),
      u: data.getFloat32(offset + 24, true),
      v: data.getFloat32(offset + 28, true)
    });
    offset += 32;
  }

  // Faces
  const faces = [];
  for (let i = 0; i < faceCount; i++) {
    const v = data.getUint16(offset, true);
    faces.push(v);
    offset += 2;
  }

  // LOD Collapses
  const collapses = [];
  for (let i = 0; i < collapseCount; i++) {
    collapses.push({
      indiceLoseCount: data.getInt32(offset, true),
      indiceChangeCount: data.getInt32(offset + 4, true),
      verticeLoseCount: data.getInt32(offset + 8, true),
      indexChange: data.getInt32(offset + 12, true),
      collapseTo: data.getInt32(offset + 16, true),
      shouldCollapse: data.getInt32(offset + 20, true),
    });
    offset += 24;
  }

  // Index Changes for LOD
  const indexChanges = [];
  for (let i = 0; i < indexChangeCount; i++) {
    indexChanges.push(data.getInt32(offset, true));
    offset += 4;
  }

  // LOD Control Points
  const LODCtrlCount = data.getInt32(offset, true);
  offset += 4;

  const LODCtrls = [];
  for (let i = 0; i < LODCtrlCount; i++) {
    LODCtrls.push({
      fDist: data.getFloat32(offset, true),
      verticeCount: data.getInt32(offset + 4, true)
    });
    offset += 8;
  }

  // Apply LOD logic
  let i = 0;
  let c = 0;
  let iVerticeCount = 0;

  while (LODCtrls[i] && LODCtrls[i].verticeCount > iVerticeCount) {
    if (c >= collapseCount) break;
    let collapse = collapses[c];
    if (collapse.verticeLoseCount + iVerticeCount > LODCtrls[i].verticeCount) break;

    iVerticeCount += collapse.verticeLoseCount;
    let min = collapse.indexChange;
    let max = min + collapse.indiceChangeCount;
    for (let j = min; j < max; j++) {
      faces[indexChanges[j]] = iVerticeCount - 1;
    }
    c++;
  }

  while (c < collapseCount && collapses[c].shouldCollapse) {
    let collapse = collapses[c];
    iVerticeCount += collapse.verticeLoseCount;
    let min = collapse.indexChange;
    let max = min + collapse.indiceChangeCount;
    for (let j = min; j < max; j++) {
      faces[indexChanges[j]] = iVerticeCount - 1;
    }
    c++;
  }

  return {
    meshName,
    count: {
      collapse: collapseCount,
      indexChange: indexChangeCount,
      vertice: { min: verticeMinCount, max: verticeCount },
      indice: { min: faceMinCount, max: faceCount }
    },
    vertices,
    faces
  };
}

/**
 * NEW: N3CPlug Loader
 * Parses effect/socket points from .n3cplug files
 */
function readN3CPlug(data) {
  let offset = 0;
  const enc = new TextDecoder('utf-8');

  // Name (Header)
  const nameLen = data.getInt32(offset, true);
  const name = enc.decode(data.buffer.slice(offset + 4, offset + 4 + nameLen));
  offset += 4 + nameLen;

  // Skip mystery int (usually 0)
  offset += 4;

  // Point Count
  const count = data.getInt32(offset, true);
  offset += 4;

  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      pos: {
        x: data.getFloat32(offset, true),
        y: data.getFloat32(offset + 4, true),
        z: data.getFloat32(offset + 8, true)
      },
      rot: {
        x: data.getFloat32(offset + 12, true),
        y: data.getFloat32(offset + 16, true),
        z: data.getFloat32(offset + 20, true)
      },
      scale: {
        x: data.getFloat32(offset + 24, true),
        y: data.getFloat32(offset + 28, true),
        z: data.getFloat32(offset + 32, true)
      }
    });
    offset += 36; // 9 * 4 bytes
  }

  return { name, points };
}