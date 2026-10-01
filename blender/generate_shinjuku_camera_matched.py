import bpy
import math
import mathutils
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT = os.path.join(ROOT, "assets", "blender")
REFERENCE = os.path.join(OUTPUT, "reference", "shinjuku-reference.png")

WIDTH = 650
HEIGHT = 450
PX = 25.0

if not os.path.exists(REFERENCE):
    raise FileNotFoundError(REFERENCE)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def world_x(pixel_x):
    return (pixel_x - WIDTH / 2) / PX


def world_z(pixel_y):
    return (HEIGHT - pixel_y) / PX


def point_at(obj, target):
    obj.rotation_euler = (
        mathutils.Vector(target) - obj.location
    ).to_track_quat("-Z", "Y").to_euler()


def basic_material(name, color, metallic=0.0, roughness=0.5):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return value


def projected_material(image):
    value = bpy.data.materials.new("CAMERA MATCH - projected facades")
    value.use_nodes = True
    nodes = value.node_tree.nodes
    links = value.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.interpolation = "Linear"
    texture.extension = "EXTEND"
    shader.inputs["Metallic"].default_value = 0.06
    shader.inputs["Roughness"].default_value = 0.46
    shader.inputs["Emission Strength"].default_value = 0.08
    links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    links.new(texture.outputs["Color"], shader.inputs["Emission Color"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return value


def assign_camera_uv(obj):
    mesh = obj.data
    uv_layer = mesh.uv_layers.new(name="650x450 camera match")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            world = obj.matrix_world @ vertex.co
            uv_layer.data[loop_index].uv = (
                (world.x * PX + WIDTH / 2) / WIDTH,
                world.z * PX / HEIGHT,
            )


def extruded_photo_mesh(name, pixel_outline, depth, y_center, material):
    count = len(pixel_outline)
    front_y = y_center - depth / 2
    back_y = y_center + depth / 2
    front = [(world_x(x), front_y, world_z(y)) for x, y in pixel_outline]
    back = [(world_x(x), back_y, world_z(y)) for x, y in pixel_outline]
    vertices = front + back
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))

    mesh = bpy.data.meshes.new(f"{name} geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_camera_uv(obj)
    obj["construction"] = "Independent extruded building mesh"
    obj["source_view"] = "650x450 Shinjuku reference"
    return obj


def tube(name, points, radius, material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinates in zip(spline.points, points):
        point.co = (*coordinates, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(material)
    return obj


reference = bpy.data.images.load(REFERENCE, check_existing=False)
reference.name = "Packed Shinjuku camera-match texture"
reference.colorspace_settings.name = "sRGB"
reference.pack()

facade = projected_material(reference)
crane_red = basic_material("Crane red", (0.58, 0.025, 0.018), metallic=0.2, roughness=0.34)
tree_green = basic_material("Tree green", (0.18, 0.30, 0.12), roughness=0.72)
tree_brown = basic_material("Tree trunk", (0.18, 0.105, 0.05), roughness=0.72)
clay = basic_material("CLAY - inspect the modeled volumes", (0.38, 0.45, 0.49), metallic=0.16, roughness=0.36)

# Pixel-measured silhouettes from the supplied 650 x 450 photograph.
extruded_photo_mesh(
    "01 Sompo Japan Building - left tower",
    [(-12, -18), (172, -18), (185, 285), (163, 391), (132, 450), (-12, 450)],
    3.4,
    2.4,
    facade,
)
extruded_photo_mesh(
    "02 Left foreground office",
    [(-10, 270), (119, 272), (135, 450), (-10, 450)],
    2.6,
    0.8,
    facade,
)
extruded_photo_mesh(
    "03 Left middle office",
    [(43, 281), (210, 280), (218, 450), (38, 450)],
    2.2,
    0.1,
    facade,
)
extruded_photo_mesh(
    "04 Mode Gakuen Cocoon Tower",
    [
        (226, -28), (337, -28), (353, 18), (365, 72), (375, 136),
        (379, 202), (374, 264), (361, 322), (344, 371), (325, 421),
        (281, 421), (253, 372), (232, 323), (216, 266), (207, 202),
        (208, 137), (216, 73),
    ],
    4.2,
    1.3,
    facade,
)
extruded_photo_mesh(
    "04B Cocoon Tower lower podium",
    [(204, 276), (386, 276), (392, 450), (199, 450)],
    1.2,
    2.2,
    facade,
)
extruded_photo_mesh(
    "05 Right striped tower",
    [(383, 97), (548, 96), (574, 126), (576, 378), (381, 379)],
    3.5,
    2.1,
    facade,
)
extruded_photo_mesh(
    "06 Right foreground annex",
    [(484, 277), (650, 249), (670, 450), (480, 450)],
    2.8,
    0.5,
    facade,
)

hall_outline = [(329, 451)]
for step in range(25):
    theta = math.pi - math.pi * step / 24
    hall_outline.append((408 + 80 * math.cos(theta), 451 - 88 * math.sin(theta)))
hall_outline.append((489, 451))
extruded_photo_mesh(
    "07 Mode Gakuen Cocoon Hall",
    hall_outline,
    3.1,
    -1.1,
    facade,
)

# A real 3D crane and street trees remain separate from the facade volumes.
crane_x = world_x(190)
tube(
    "08 Construction crane mast",
    [(crane_x, -1.5, world_z(448)), (crane_x, -1.5, world_z(107))],
    0.035,
    crane_red,
)
tube(
    "08 Construction crane jib",
    [(crane_x, -1.5, world_z(107)), (world_x(225), -1.5, world_z(25))],
    0.035,
    crane_red,
)

for px in (396, 433, 506):
    x = world_x(px)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12,
        radius=0.035,
        depth=1.4,
        location=(x, -1.8, 0.7),
    )
    bpy.context.object.data.materials.append(tree_brown)
    for index in range(5):
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=1,
            radius=0.24,
            location=(x + (index % 2) * 0.17 - 0.08, -1.8, 0.95 + index * 0.18),
        )
        leaf = bpy.context.object
        leaf.scale = (1.0, 0.65, 1.28)
        leaf.data.materials.append(tree_green)

bpy.ops.object.camera_add(location=(0, -44, 9))
camera = bpy.context.object
camera.name = "650x450 PHOTO-MATCH CAMERA"
camera.data.type = "ORTHO"
camera.data.ortho_scale = WIDTH / PX
point_at(camera, (0, 0, 9))
bpy.context.scene.camera = camera

# The reference is available only as a viewport guide; there is no renderable
# photo plane in the scene.
background = camera.data.background_images.new()
background.image = reference
background.alpha = 0.32
background.display_depth = "BACK"

bpy.ops.object.light_add(type="SUN", location=(-6, -10, 24))
sun = bpy.context.object
sun.name = "Upper-right daylight"
sun.data.energy = 1.75
sun.rotation_euler = (math.radians(24), math.radians(-18), math.radians(-34))

bpy.ops.object.light_add(type="AREA", location=(0, -14, 13))
fill = bpy.context.object
fill.name = "Front sky fill"
fill.data.energy = 560
fill.data.size = 16
point_at(fill, (0, 0, 8))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = WIDTH
scene.render.resolution_y = HEIGHT
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.film_transparent = False
scene.world.use_nodes = True
world = scene.world.node_tree.nodes.get("Background")
world.inputs["Color"].default_value = (0.24, 0.55, 0.86, 1)
world.inputs["Strength"].default_value = 0.88
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

scene["delivery_type"] = "Photo-matched, independently modeled 3D building volumes"
scene["contains_renderable_photo_plane"] = False
scene["reference_resolution"] = "650x450"

for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type != "VIEW_3D":
            continue
        viewport = area.spaces.active
        viewport.shading.type = "MATERIAL"
        viewport.region_3d.view_perspective = "CAMERA"

beauty_path = os.path.join(OUTPUT, "shinjuku-camera-matched-preview.png")
clay_path = os.path.join(OUTPUT, "shinjuku-camera-matched-clay.png")
blend_path = os.path.join(OUTPUT, "shinjuku-camera-matched.blend")
glb_path = os.path.join(OUTPUT, "shinjuku-camera-matched.glb")

scene.render.filepath = clay_path
scene.view_layers[0].material_override = clay
bpy.ops.render.render(write_still=True)

scene.view_layers[0].material_override = None
scene.render.filepath = beauty_path
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format="GLB",
    export_apply=True,
    export_cameras=True,
    export_lights=False,
)

print("Generated photo-matched multi-building scene:", blend_path)
print("Renderable photo plane:", scene["contains_renderable_photo_plane"])
