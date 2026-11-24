import { Color, Matrix4 } from 'three';

const textureColors = {
  Concrete: 0xa5a39a,
  GroundCover: 0x51564a,
  Cocopeat: 0x6a482e,
  GalvanizedSteel: 0x9aabad,
  Melon: 0xa6b05d,
  Foliage: 0x46762d,
  YoungFoliage: 0x67953b,
};

// Render the same model on screens without a WebGL context.
export function canvasRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = new Matrix4();
  let cachedRoot;
  let entries;
  let width, height;
  const ratio = Math.min(devicePixelRatio, 1.5);

  return {
    domElement: canvas,
    dispose() {},
    setSize(w,h) {
      width = w;
      height = h;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    },
    render(scene,camera) {
      const model = scene.children.find(child => child.isGroup);
      if (!model) return;
      if (model !== cachedRoot) {
        cachedRoot = model;
        model.updateMatrixWorld(true);
        entries = [];
        model.traverse(mesh => {
          if (!mesh.isMesh || /_(String|Sling)$/.test(mesh.name)) return;
          const {attributes,index} = mesh.geometry;
          const p = attributes.position;
          const e = mesh.matrixWorld.elements;
          const world = new Float32Array(p.count * 3);
          for (let i=0;i<p.count;i++) {
            const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
            world.set([e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]],i*3);
          }
          const faces = [];
          const count = index ? index.count : p.count;
          for (let i=0;i<count;i+=3) {
            const n = i/3;
            if (/Foliage$/.test(mesh.name) && Math.floor(n/16)%2) continue;
            
            const a=(index ? index.getX(i) : i)*3;
            const b=(index ? index.getX(i+1) : i+1)*3;
            const c=(index ? index.getX(i+2) : i+2)*3;
            const ux=world[b]-world[a],uy=world[b+1]-world[a+1],uz=world[b+2]-world[a+2];
            const vx=world[c]-world[a],vy=world[c+1]-world[a+1],vz=world[c+2]-world[a+2];
            const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
            const light=(nx*.38+ny*.83+nz*.41)/(Math.hypot(nx,ny,nz)||1);
            faces.push({a,b,c,shade:Math.max(0,Math.min(7,Math.round(4+light*3)))});
          }
          entries.push({mesh,faces,world,screen:new Float32Array(world.length)});
        });
      }
      camera.updateMatrixWorld();
      view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      const e = view.elements;
      const visible = [];
      for (const {mesh,faces,world,screen} of entries) {
        if (camera.zoom < 4 && /_(Vine|Cocopeat)$/.test(mesh.name)) continue;
        let current=mesh;
        while (current && current.visible) current=current.parent;
        if (current) continue;
        for (let i=0;i<world.length;i+=3) {
          const x=world[i],y=world[i+1],z=world[i+2];
          screen[i]=(e[0]*x+e[4]*y+e[8]*z+e[12]+1)*width*.5;
          screen[i+1]=(1-e[1]*x-e[5]*y-e[9]*z-e[13])*height*.5;
          screen[i+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
        }
        const mat=mesh.material;
        const groundDepth = mesh.name.startsWith('Floor_') ? (mesh.name.endsWith('GroundCover') ? 2.9 : 3) : null;
        const textureColor = textureColors[mat.name];
        const base = textureColor === undefined ? mat.color.clone() : new Color(textureColor);
        if (mat.emissiveIntensity && mat.emissive.getHex()) base.lerp(mat.emissive,Math.min(.55,mat.emissiveIntensity*1.5));
        const colors=Array.from({length:8},(_,i)=>'#'+base.clone().multiplyScalar(.48+i*.115).getHexString());
        for(const {a,b,c,shade} of faces) {
          const za = screen[a+2], zb = screen[b+2], zc = screen[c+2];
          if (Math.max(za,zb,zc) < -1 || Math.min(za,zb,zc) > 1) continue;
          if (Math.max(screen[a],screen[b],screen[c]) < 0 ||
              Math.min(screen[a],screen[b],screen[c]) > width ||
              Math.max(screen[a+1],screen[b+1],screen[c+1]) < 0 ||
              Math.min(screen[a+1],screen[b+1],screen[c+1]) > height) continue;
          const area=(screen[b]-screen[a])*(screen[c+1]-screen[a+1])-(screen[b+1]-screen[a+1])*(screen[c]-screen[a]);
          if (Math.abs(area)<.11) continue;
          if (area>0 && !mesh.name.endsWith('Foliage')) continue;
          visible.push({screen,a,b,c,depth:groundDepth ?? (screen[a+2]+screen[b+2]+screen[c+2])/3,color:colors[shade],opacity:mat.opacity});
        }
      }
      visible.sort((a,b)=>b.depth-a.depth);
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.clearRect(0,0,width,height);
      for (const {screen,a,b,c,color,opacity} of visible) {
        ctx.globalAlpha=opacity;
        ctx.fillStyle=color;
        ctx.beginPath();
        ctx.moveTo(screen[a],screen[a+1]);
        ctx.lineTo(screen[b],screen[b+1]);
        ctx.lineTo(screen[c],screen[c+1]);
        ctx.closePath();
        ctx.fill();
      }
    },
  };
}
