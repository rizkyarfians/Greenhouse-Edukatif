import {
  BoxGeometry, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshStandardMaterial, PlaneGeometry,
} from 'three';

export const maxWaterDepth = 5;

export function createRiceFieldModel() {
  const model = new Group();
  model.name = 'Sawah_Padi';
  const material = (color, options) => new MeshStandardMaterial({color, roughness: .86, ...options});

  function add(geometry, surface, x, y, z) {
    const mesh = new Mesh(geometry, surface);
    mesh.position.set(x,y,z);
    model.add(mesh);
    return mesh;
  }

  function box(surface, width, height, length, x, y, z) {
    return add(new BoxGeometry(width,height,length),surface,x,y,z);
  }

  function plane(surface, width, length, x, y, z, columns = 1, rows = 1) {
    const geometry = new PlaneGeometry(width,length,columns,rows);
    geometry.rotateX(-Math.PI / 2);
    return add(geometry,surface,x,y,z);
  }

  let seed = 117;
  function random() {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const dirt = material(0x937351);
  const bundSoil = material(0x987950);
  const grass = material(0x7b884c);
  box(dirt,16,.58,20,0,-.44,0);
  box(dirt,12,.15,18,0,-.076,0);
  box(grass,.9,.15,20,-7.55,-.075,0);
  box(grass,16,.15,1.1,0,-.075,9.45);
  box(grass,16,.15,1.1,0,-.075,-9.45);

  const soilPalette = [0x7e573a,0x845c3f,0x8c6243,0x875d40].map(color => material(color));
  for (let z = 0; z < 9; z++) {
    for (let x = 0; x < 6; x++) {
      plane(soilPalette[Math.floor(random()*soilPalette.length)],
        2,2,x*2-5,0,z*2-8);
    }
  }

  function bund(width, length, x, z) {
    const height = .32;
    const geometry = new BoxGeometry(width,height,length);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      if (vertices.getY(i) < 0) continue;
      vertices.setX(i,vertices.getX(i)*.72);
      vertices.setZ(i,vertices.getZ(i)*.95);
    }
    geometry.computeVertexNormals();
    add(geometry,bundSoil,x,height/2,z);
  }
  bund(.65,18.7,-6.24,0);
  bund(.65,14.8,6.24,-1.78);
  bund(.65,2.75,6.24,7.92);
  bund(12.2,.65,0,-9.03);
  bund(12.2,.65,0,9.03);
  box(bundSoil,.45,.14,19.1,7.76,-.08,0);

  const canal = material(0x568a94,{roughness:.45});
  plane(canal,1.05,18.9,7.06,-.075,0);
  const gateFrame = material(0x8a9b91,{metalness:.25});
  const gate = material(0x45554a);
  box(gateFrame,.12,.7,.12,6.23,.32,5.69);
  box(gateFrame,.12,.7,.12,6.23,.32,6.54);
  box(gateFrame,.16,.13,.98,6.23,.66,6.12);
  const closedGate = box(gate,.12,.34,.78,6.23,.16,6.12);
  const openGate = box(gate,.12,.34,.78,6.23,.47,6.12);
  const inlet = plane(canal,1.15,.73,6.35,.014,6.12);

  const leafColors = [0x718c31,0x66862d,0x839b3b];
  const leaves = leafColors.map(() => []);
  for (let row = 0; row < 14; row++) {
    for (let column = 0; column < 10; column++) {
      const x = (column-4.5)*1.12 + (random()-.5)*.22;
      const z = (row-6.5)*1.17 + (random()-.5)*.22;
      const phase = random()*Math.PI*2;
      for (let blade = 0; blade < 6; blade++) {
        const angle = phase + blade*Math.PI/3 + (random()-.5)*.4;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);
        const height = .31 + random()*.37;
        const width = .018 + height*.04;
        const lean = .16 + random()*.18;
        const base = [x+dz*width,0,z-dx*width];
        const middleLeft = [x+dx*lean*.42+dz*width,height*.66,z+dz*lean*.42-dx*width];
        const middleRight = [x+dx*lean*.42-dz*width,height*.60,z+dz*lean*.42+dx*width];
        const tip = [x+dx*lean,height,z+dz*lean];
        const vertices = leaves[blade % leaves.length];
        // The Canvas fallback culls back faces, so give the thin blades both windings.
        vertices.push(...base,...middleLeft,...middleRight,...base,...middleRight,...middleLeft,
          ...middleLeft,...tip,...middleRight,...middleRight,...tip,...middleLeft);
      }
    }
  }
  for (const [index, vertices] of leaves.entries()) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();
    add(geometry,material(leafColors[index]),0,0,0);
  }

  const floodSurface = material(0x63a6ab,{
    side:DoubleSide, transparent:true, opacity:.46, depthWrite:false, roughness:.43,
  });
  const waterLevels = Array.from({length:maxWaterDepth},(_,index) =>
    plane(floodSurface,12,18,0,.016 + index*.022,0,8,12));

  return {
    model,
    setIrrigation(depth, active) {
      waterLevels.forEach((water, index) => water.visible = index + 1 === depth);
      inlet.visible = Boolean(active);
      openGate.visible = Boolean(active);
      closedGate.visible = !active;
    },
  };
}
