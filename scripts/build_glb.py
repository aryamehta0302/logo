import cv2
import numpy as np
import trimesh
from PIL import Image

# 1. Load meshy model geometry
meshy_scene = trimesh.load('meshy_reference_model.glb')
geom_name = list(meshy_scene.geometry.keys())[0]
emblem_mesh = meshy_scene.geometry[geom_name].copy()

# Apply node transform
node_transform = meshy_scene.graph['0'][0]
emblem_mesh.apply_transform(node_transform)

# Smooth mesh vertex normals for mirror-like liquid metal
emblem_mesh.re-index() if hasattr(emblem_mesh, 're-index') else None

min_x, min_y, min_z = emblem_mesh.bounds[0]
max_x, max_y, max_z = emblem_mesh.bounds[1]
ext_x, ext_y, ext_z = emblem_mesh.extents

# Center precisely at (0, 0, 0)
center_x = (min_x + max_x) / 2.0
center_y = (min_y + max_y) / 2.0
center_z = (min_z + max_z) / 2.0

emblem_mesh.apply_translation([-center_x, -center_y, -center_z])

# Scale to target width = 8.0 units
S = 8.0 / ext_x
emblem_mesh.apply_scale(S)

scaled_min = emblem_mesh.bounds[0]
scaled_max = emblem_mesh.bounds[1]
scaled_ext = emblem_mesh.extents

# Smooth the texture slightly so any pixel noise is completely vanished
tex_img = cv2.imread('public/emblem_texture.png', cv2.IMREAD_UNCHANGED)
# Bilateral filter preserves sharp color edges while smoothing all grain/roughness!
bgr = tex_img[:, :, :3]
alpha = tex_img[:, :, 3]
smooth_bgr = cv2.bilateralFilter(bgr, d=7, sigmaColor=35, sigmaSpace=35)
smooth_rgba = np.dstack([smooth_bgr, alpha])
cv2.imwrite('public/emblem_texture_smooth.png', smooth_rgba)
print("Saved public/emblem_texture_smooth.png with silky smooth bilateral filter")

# Compute UVs
verts = emblem_mesh.vertices
fx = (verts[:, 0] - scaled_min[0]) / scaled_ext[0]
fy = (verts[:, 1] - scaled_min[1]) / scaled_ext[1]

# In reference image bounds:
pad_x = 10
pad_y = 10
crop_x0 = max(0, 294 - pad_x)
crop_y0 = max(0, 21 - pad_y)
crop_w = (min(1536, 1217 + pad_x)) - crop_x0
crop_h = (min(1024, 770 + pad_y)) - crop_y0

px_in_crop = (294 - crop_x0) + fx * 923.0
py_in_crop = (770 - crop_y0) - fy * 749.0

u = np.clip(px_in_crop / float(crop_w), 0.0, 1.0)
v = np.clip(1.0 - (py_in_crop / float(crop_h)), 0.0, 1.0)
uvs = np.column_stack([u, v]).astype(np.float32)

# Load into PIL
pil_smooth = Image.open('public/emblem_texture_smooth.png')

# Create ultra-smooth polished metallic PBR material (NO noisy normal map, mirror-smooth roughness: 0.06)
mat = trimesh.visual.material.PBRMaterial(
    name='AccuMedic_PolishedGold_Metallic',
    metallicFactor=0.90,
    roughnessFactor=0.06,
    baseColorFactor=[1.0, 1.0, 1.0, 1.0],
    baseColorTexture=pil_smooth
)

mesh = trimesh.Trimesh(
    vertices=emblem_mesh.vertices,
    faces=emblem_mesh.faces,
    vertex_normals=emblem_mesh.vertex_normals,
    visual=trimesh.visual.TextureVisuals(uv=uvs, material=mat),
    process=False
)

scene = trimesh.Scene()
scene.add_geometry(mesh, node_name='AccuMedic_Logo')

# Export GLB
glb_bytes = scene.export(file_type='glb')
with open('public/AccuMedic_Logo_3D.glb', 'wb') as f:
    f.write(glb_bytes)
with open('AccuMedic_Logo_3D.glb', 'wb') as f:
    f.write(glb_bytes)
print(f"Exported ultra-smooth metallic AccuMedic_Logo_3D.glb ({len(glb_bytes):,} bytes)")

# Offline render
rot_y = trimesh.transformations.rotation_matrix(np.radians(25), [0, 1, 0])
rot_x = trimesh.transformations.rotation_matrix(np.radians(-10), [1, 0, 0])
scene.apply_transform(np.dot(rot_x, rot_y))
png = scene.save_image(resolution=[1200, 1200])
with open('preview_smooth_metallic.png', 'wb') as f:
    f.write(png)
print("Saved preview_smooth_metallic.png")
