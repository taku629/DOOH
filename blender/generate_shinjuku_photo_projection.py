import bpy
import math
import os
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT = os.path.join(ROOT, "assets", "blender")
REFERENCE = os.path.join(OUTPUT, "reference", "shinjuku-reference.png")

WIDTH = 650
HEIGHT = 450
PLANE_WIDTH = 13.0
PLANE_HEIGHT = PLANE_WIDTH * HEIGHT / WIDTH

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

if not os.path.exists(REFERENCE):
    raise FileNotFoundError(REFERENCE)

image = bpy.data.images.load(REFERENCE, check_existing=False)
image.name = "Authoritative Shinjuku reference 650x450"
image.colorspace_settings.name = "sRGB"
image.alpha_mode = "STRAIGHT"

vertices = [
    (-PLANE_WIDTH / 2, 0, -PLANE_HEIGHT / 2),
    (PLANE_WIDTH / 2, 0, -PLANE_HEIGHT / 2),
    (PLANE_WIDTH / 2, 0, PLANE_HEIGHT / 2),
    (-PLANE_WIDTH / 2, 0, PLANE_HEIGHT / 2),
]
faces = [(0, 1, 2, 3)]
mesh = bpy.data.meshes.new("Reference projection plane mesh")
mesh.from_pydata(vertices, [], faces)
mesh.uv_layers.new(name="Reference UV")
uv_data = mesh.uv_layers.active.data
uv_coordinates = ((0, 0), (1, 0), (1, 1), (0, 1))
for loop, uv in zip(mesh.loops, uv_coordinates):
    uv_data[loop.index].uv = uv

projection = bpy.data.objects.new("PHOTO PROJECTION — Shinjuku exact view", mesh)
bpy.context.collection.objects.link(projection)

material = bpy.data.materials.new("Unlit reference projection")
material.use_nodes = True
nodes = material.node_tree.nodes
links = material.node_tree.links
nodes.clear()

output_node = nodes.new("ShaderNodeOutputMaterial")
emission_node = nodes.new("ShaderNodeEmission")
texture_node = nodes.new("ShaderNodeTexImage")
texture_node.image = image
texture_node.interpolation = "Closest"
texture_node.extension = "CLIP"
emission_node.inputs["Strength"].default_value = 1.0
links.new(texture_node.outputs["Color"], emission_node.inputs["Color"])
links.new(emission_node.outputs["Emission"], output_node.inputs["Surface"])
projection.data.materials.append(material)

bpy.ops.object.camera_add(location=(0, -10, 0), rotation=(math.pi / 2, 0, 0))
camera = bpy.context.object
camera.name = "EXACT 650x450 CAMERA"
camera.data.type = "ORTHO"
camera.data.ortho_scale = PLANE_WIDTH
camera.data.lens = 50
camera.rotation_euler = (math.pi / 2, 0, 0)
bpy.context.scene.camera = camera

background = camera.data.background_images.new()
background.image = image
background.alpha = .5
background.display_depth = "BACK"

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = WIDTH
scene.render.resolution_y = HEIGHT
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.color_depth = "8"
scene.render.film_transparent = False
scene.render.filepath = os.path.join(OUTPUT, "shinjuku-photo-projection-preview.png")
scene.render.use_file_extension = True

scene.world.use_nodes = True
world_background = scene.world.node_tree.nodes.get("Background")
world_background.inputs["Color"].default_value = (0, 0, 0, 1)
world_background.inputs["Strength"].default_value = 0

scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

projection["purpose"] = "Fixed-camera photo projection for pixel-matched mobile composition"
projection["reference_width"] = WIDTH
projection["reference_height"] = HEIGHT
projection["source_image"] = "assets/blender/reference/shinjuku-reference.png"

# Keep the reference available when the blend file is opened directly from
# Windows or moved away from this repository.
image.pack()

# Make the file understandable immediately after opening in Blender.
projection.select_set(True)
bpy.context.view_layer.objects.active = projection
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type != "VIEW_3D":
            continue
        viewport = area.spaces.active
        viewport.shading.type = "MATERIAL"
        viewport.region_3d.view_perspective = "CAMERA"

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTPUT, "shinjuku-photo-projection.blend"))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUTPUT, "shinjuku-photo-projection.glb"),
    export_format="GLB",
    export_apply=True,
    export_cameras=True,
    export_lights=False,
)
bpy.ops.render.render(write_still=True)
shutil.copyfile(
    REFERENCE,
    os.path.join(OUTPUT, "shinjuku-photo-projection-exact.png"),
)
print("Generated exact-view photo projection:", OUTPUT)
