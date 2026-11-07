// The turning leaf: a 32 x 12 grid bent on the CPU each frame. Each row along the spine is a curve of constant
// arc length (so the paper never stretches), built from its tangent angle along the page:
//   phi(s) = spineAngle + (angle - spineAngle) * h(s) + dir * curl * s^2 + dir * corner(z) * s^2
// - angle: the leaf's turn (0 flat on the right, PI flat on the left);
// - spineAngle and h(s): the bound edge, which follows the turn a little behind or ahead of the leaf's middle;
// - curl > 0 bends the free edge ahead of the turn (a C, standing up), curl < 0 leaves it trailing (an S, falling);
// - corner(z): the outer corner nearest the viewer leads the lift, so the fold line starts tilted and straightens.
import { PlaneGeometry, Mesh, MeshStandardMaterial, FrontSide, BackSide } from 'three';

export const SEG_X = 32;
export const SEG_Z = 12;

export function createLeaf(W, H) {
  const geometry = new PlaneGeometry(W, H, SEG_X, SEG_Z);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(W / 2, 0, 0);
  const pos = geometry.getAttribute('position');
  const front = new MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: FrontSide });
  const back = new MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: BackSide });
  const frontMesh = new Mesh(geometry, front);
  const backMesh = new Mesh(geometry, back);
  for (const m of [frontMesh, backMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  const cols = SEG_X + 1;
  const rows = SEG_Z + 1;
  const ds = W / SEG_X;
  /**
   * Poses the leaf.
   * @param p turn position, 0 (right) to 1 (left)
   * @param dir +1 for a forward turn, -1 for a backward one
   * @param lift 0..1, the lift phase before the flight
   */
  function pose(p, dir, lift) {
    const q = dir > 0 ? p : 1 - p; // progress along this turn, 0 at its start
    const angle = Math.PI * p;
    const smooth = p * p * (3 - 2 * p);
    const spineAngle = Math.PI * smooth;
    // The C while it rises, the S as it falls; the lift's own bend fades as the flight takes over.
    const flightCurl = 1.15 * Math.sin(Math.PI * q) * (1 - 1.75 * q);
    const liftCurl = 0.55 * lift * (1 - q) * (1 - q);
    const curl = flightCurl + liftCurl;
    const cornerLead = 0.5 * lift * Math.max(0, 1 - 2.2 * q);
    for (let j = 0; j < rows; j++) {
      // Row j runs from the head (z = -H/2) to the foot (z = +H/2), the corner nearest the camera.
      const zt = j / SEG_Z;
      // A backward turn lifts the left page's outer corner; the same corner (the foot) leads.
      const corner = cornerLead * zt;
      let x = 0;
      let y = 0;
      for (let i = 0; i < cols; i++) {
        const idx = j * cols + i;
        pos.setX(idx, x);
        pos.setY(idx, y + 0.0008);
        const s = (i + 0.5) / SEG_X;
        const h = Math.min(1, s / 0.14);
        const hs = h * h * (3 - 2 * h);
        const phi = spineAngle + (angle - spineAngle) * hs + dir * (curl + corner) * s * s;
        x += Math.cos(phi) * ds;
        y += Math.sin(phi) * ds;
      }
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  pose(0, 1, 0);
  return { geometry, front, back, frontMesh, backMesh, pose };
}
