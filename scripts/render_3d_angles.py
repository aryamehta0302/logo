import trimesh
import numpy as np

def render_angles():
    scene = trimesh.load('AccuMedic_Logo_3D.glb')
    
    # 1. Front View
    try:
        png_front = scene.save_image(resolution=[1536, 1024])
        with open('preview_front.png', 'wb') as f:
            f.write(png_front)
        print("Saved preview_front.png")
    except Exception as e:
        print("Front render error:", e)

    # 2. Dramatic 3D Angle (25 deg Y, -10 deg X)
    rot_y = trimesh.transformations.rotation_matrix(np.radians(25), [0, 1, 0])
    rot_x = trimesh.transformations.rotation_matrix(np.radians(-10), [1, 0, 0])
    transform = np.dot(rot_x, rot_y)
    
    scene.apply_transform(transform)
    try:
        png_3d = scene.save_image(resolution=[1536, 1024])
        with open('preview_perspective_3d.png', 'wb') as f:
            f.write(png_3d)
        print("Saved preview_perspective_3d.png")
    except Exception as e:
        print("Perspective render error:", e)

    # 3. Side Bevel Profile (55 deg Y)
    rot_side = trimesh.transformations.rotation_matrix(np.radians(30), [0, 1, 0])
    scene.apply_transform(rot_side)
    try:
        png_side = scene.save_image(resolution=[1536, 1024])
        with open('preview_bevel_side.png', 'wb') as f:
            f.write(png_side)
        print("Saved preview_bevel_side.png")
    except Exception as e:
        print("Side render error:", e)

if __name__ == '__main__':
    render_angles()
