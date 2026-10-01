import bpy
import math
import mathutils
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT = os.path.join(ROOT, "assets", "blender")
SOURCE = os.path.join(OUTPUT, "shinjuku-camera-matched.blend")
WIDTH = 650
HEIGHT = 450
PX = 25.0

if not os.path.exists(SOURCE):
    raise FileNotFoundError(SOURCE)

bpy.ops.wm.open_mainfile(filepath=SOURCE)


def world_x(pixel_x):
    return (pixel_x - WIDTH / 2) / PX


def world_z(pixel_y):
    return (HEIGHT - pixel_y) / PX


def material(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        shader.inputs["Emission Color"].default_value = (*emission, 1)
        shader.inputs["Emission Strength"].default_value = strength
    return value


def replace_material(object_name, value):
    obj = bpy.data.objects.get(object_name)
    if not obj:
        return
    obj.data.materials.clear()
    obj.data.materials.append(value)


def tube_screen(name, pixel_points, y, radius, value):
    if len(pixel_points) < 2:
        return
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new("POLY")
    spline.points.add(len(pixel_points) - 1)
    for point, (pixel_x, pixel_y) in zip(spline.points, pixel_points):
        point.co = (world_x(pixel_x), y, world_z(pixel_y), 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(value)
    return obj


def screen_face(name, pixel_points, y, value):
    vertices = [(world_x(pixel_x), y, world_z(pixel_y)) for pixel_x, pixel_y in pixel_points]
    mesh = bpy.data.meshes.new(f"{name} geometry")
    mesh.from_pydata(vertices, [], [tuple(range(len(vertices)))])
    mesh.materials.append(value)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def point_in_polygon(x, y, polygon):
    inside = False
    previous = polygon[-1]
    for current in polygon:
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            crossing = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < crossing:
                inside = not inside
        previous = current
    return inside


def clipped_diagonal_family(name, polygon, y_depth, slope, intercepts, value, radius):
    for line_index, intercept in enumerate(intercepts):
        runs = []
        current_run = []
        for pixel_y in range(-30, 425, 5):
            pixel_x = intercept + slope * (pixel_y - 195)
            if point_in_polygon(pixel_x, pixel_y, polygon):
                current_run.append((pixel_x, pixel_y))
            elif current_run:
                runs.append(current_run)
                current_run = []
        if current_run:
            runs.append(current_run)
        for run_index, run in enumerate(runs):
            tube_screen(
                f"{name} {line_index:02d}-{run_index}",
                run,
                y_depth,
                radius,
                value,
            )


# Remove every photographic dependency from the delivered scene.
camera = bpy.context.scene.camera
camera.data.background_images.clear()
for image in list(bpy.data.images):
    if image.source == "FILE":
        bpy.data.images.remove(image)

glass_dark = material(
    "Cocoon graphite glass",
    (0.035, 0.12, 0.18),
    metallic=0.46,
    roughness=0.17,
    emission=(0.025, 0.08, 0.12),
    strength=0.15,
)
glass_mid = material(
    "Cool office glass",
    (0.16, 0.31, 0.41),
    metallic=0.34,
    roughness=0.22,
    emission=(0.08, 0.18, 0.25),
    strength=0.08,
)
bronze = material(
    "Sompo warm bronze",
    (0.30, 0.20, 0.14),
    metallic=0.38,
    roughness=0.28,
    emission=(0.19, 0.085, 0.035),
    strength=0.12,
)
silver = material(
    "Right tower silver",
    (0.42, 0.53, 0.63),
    metallic=0.52,
    roughness=0.2,
    emission=(0.22, 0.34, 0.46),
    strength=0.08,
)
off_white = material("Annex warm white", (0.76, 0.79, 0.78), metallic=0.08, roughness=0.44)
hall_white = material("Cocoon Hall ceramic", (0.88, 0.91, 0.89), metallic=0.12, roughness=0.25)
window_dark = material("Architectural window lines", (0.025, 0.045, 0.06), metallic=0.5, roughness=0.2)
rib_white = material("Cocoon structural ribs", (0.91, 0.93, 0.91), metallic=0.28, roughness=0.18)
rib_shadow = material("Cocoon secondary ribs", (0.22, 0.32, 0.35), metallic=0.42, roughness=0.2)
street_dark = material("Street silhouette", (0.09, 0.11, 0.11), metallic=0.14, roughness=0.58)
sign_blue = material("Traffic sign blue", (0.02, 0.12, 0.32), metallic=0.18, roughness=0.34)
sign_red = material("Traffic sign red", (0.62, 0.025, 0.018), metallic=0.2, roughness=0.32)

replace_material("01 Sompo Japan Building - left tower", bronze)
replace_material("02 Left foreground office", glass_mid)
replace_material("03 Left middle office", glass_mid)
replace_material("04 Mode Gakuen Cocoon Tower", glass_dark)
replace_material("04B Cocoon Tower lower podium", glass_mid)
replace_material("05 Right striped tower", silver)
replace_material("06 Right foreground annex", off_white)
replace_material("07 Mode Gakuen Cocoon Hall", hall_white)

# Sompo tower: dense vertical windows and compact floor bands.
for column in range(1, 19):
    x = 0 + column * 176 / 19
    tube_screen(f"Sompo vertical {column:02d}", [(x, 0), (x, 390)], 0.64, 0.012, window_dark)
for row in range(2, 43):
    y = row * 390 / 43
    tube_screen(f"Sompo floor {row:02d}", [(0, y), (176, y)], 0.63, 0.008, window_dark)

# The reference has a strongly articulated, darker right-hand edge on the
# Sompo tower. This breaks the "flat grid rectangle" silhouette.
tube_screen("Sompo right edge", [(172, 0), (184, 285), (164, 390)], 0.61, 0.032, window_dark)

# Right tower: its horizontal bands are the strongest visual signature.
for row in range(1, 29):
    y = 98 + row * 278 / 29
    tube_screen(f"Right tower band {row:02d}", [(384, y), (575, y)], 0.29, 0.018, window_dark)
for column in range(1, 8):
    x = 383 + column * 191 / 8
    tube_screen(f"Right tower seam {column:02d}", [(x, 100), (x, 378)], 0.285, 0.008, rib_shadow)
for row in range(5, 29, 6):
    y = 98 + row * 278 / 29
    tube_screen(f"Right tower dark mechanical band {row:02d}", [(384, y), (575, y)], 0.275, 0.034, window_dark)

# Smaller offices.
for row in range(8):
    y = 285 + row * 20
    tube_screen(f"Left office floor {row:02d}", [(42, y), (214, y)], -1.02, 0.013, window_dark)
for row in range(9):
    y = 280 + row * 19
    tube_screen(f"Right annex floor {row:02d}", [(484, y), (650, y)], -0.94, 0.01, rib_shadow)

cocoon_outline = [
    (226, -28), (337, -28), (353, 18), (365, 72), (375, 136),
    (379, 202), (374, 264), (361, 322), (344, 371), (325, 421),
    (281, 421), (253, 372), (232, 323), (216, 266), (207, 202),
    (208, 137), (216, 73),
]

clipped_diagonal_family(
    "Cocoon rising rib",
    cocoon_outline,
    -0.86,
    0.46,
    range(125, 475, 23),
    rib_white,
    0.026,
)
clipped_diagonal_family(
    "Cocoon falling rib",
    cocoon_outline,
    -0.87,
    -0.46,
    range(125, 475, 23),
    rib_white,
    0.026,
)
clipped_diagonal_family(
    "Cocoon fine rising rib",
    cocoon_outline,
    -0.89,
    0.46,
    range(135, 465, 12),
    rib_shadow,
    0.009,
)
clipped_diagonal_family(
    "Cocoon fine falling rib",
    cocoon_outline,
    -0.90,
    -0.46,
    range(135, 465, 12),
    rib_shadow,
    0.009,
)

# Visible floor slabs behind the lattice give the tower its real scale.
for floor_y in range(8, 420, 13):
    inside_x = [
        pixel_x
        for pixel_x in range(196, 392)
        if point_in_polygon(pixel_x, floor_y, cocoon_outline)
    ]
    if inside_x:
        tube_screen(
            f"Cocoon floor band {floor_y:03d}",
            [(min(inside_x), floor_y), (max(inside_x), floor_y)],
            -0.84,
            0.007,
            rib_shadow,
        )

# Strong perimeter ribs and a slim central glass seam make the Cocoon Tower
# read like the actual exoskeleton instead of a patterned oval.
tube_screen(
    "Cocoon left perimeter rib",
    [(226, -28), (216, 73), (207, 202), (232, 323), (281, 421)],
    -0.93,
    0.035,
    rib_white,
)
tube_screen(
    "Cocoon right perimeter rib",
    [(337, -28), (365, 72), (379, 202), (361, 322), (325, 421)],
    -0.93,
    0.035,
    rib_white,
)
tube_screen(
    "Cocoon central glass seam",
    [(300, -28), (302, 421)],
    -0.91,
    0.018,
    rib_shadow,
)

# Cocoon Hall triangular lattice.
hall_polygon = [(329, 451)]
for step in range(25):
    theta = math.pi - math.pi * step / 24
    hall_polygon.append((408 + 80 * math.cos(theta), 451 - 88 * math.sin(theta)))
hall_polygon.append((489, 451))
clipped_diagonal_family(
    "Hall rising facet",
    hall_polygon,
    -2.71,
    0.58,
    range(300, 535, 17),
    window_dark,
    0.014,
)
clipped_diagonal_family(
    "Hall falling facet",
    hall_polygon,
    -2.72,
    -0.58,
    range(300, 535, 17),
    window_dark,
    0.014,
)
for y in range(374, 448, 17):
    tube_screen(f"Hall horizontal facet {y}", [(335, y), (483, y)], -2.73, 0.009, rib_shadow)

# Filled black/graphite triangles are the Cocoon Hall's defining feature in
# the reference photograph. Alternate their orientation to keep the dome airy.
facet_width = 10
facet_height = 8
facet_index = 0
for pixel_y in range(374, 446, facet_height):
    grid_row = (pixel_y - 374) // facet_height
    row_offset = grid_row % 2 * (facet_width / 2)
    for pixel_x in range(326, 486, facet_width):
        grid_column = (pixel_x - 326) // facet_width
        x = pixel_x + row_offset
        upward = (grid_column + grid_row) % 2 == 0
        if upward:
            points = [(x, pixel_y + facet_height), (x + facet_width / 2, pixel_y), (x + facet_width, pixel_y + facet_height)]
        else:
            points = [(x, pixel_y), (x + facet_width, pixel_y), (x + facet_width / 2, pixel_y + facet_height)]
        center_x = sum(point[0] for point in points) / 3
        center_y = sum(point[1] for point in points) / 3
        panel_pattern = (grid_column * 7 + grid_row * 3) % 5
        if point_in_polygon(center_x, center_y, hall_polygon) and panel_pattern in (0, 1, 3):
            screen_face(
                f"Hall dark triangular panel {facet_index:03d}",
                points,
                -2.77,
                window_dark if facet_index % 4 else rib_shadow,
            )
            facet_index += 1

# Street signs are small, but they are important scale cues in the photograph.
for index, (pixel_x, pixel_y) in enumerate(((164, 408), (494, 424))):
    location = (world_x(pixel_x), -3.0, world_z(pixel_y))
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32,
        radius=0.20 if index == 0 else 0.14,
        depth=0.045,
        location=location,
        rotation=(math.pi / 2, 0, 0),
    )
    bpy.context.object.name = f"Traffic sign disc {index + 1}"
    bpy.context.object.data.materials.append(sign_blue)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.17 if index == 0 else 0.12,
        minor_radius=0.026,
        major_segments=32,
        minor_segments=8,
        location=(location[0], location[1] - 0.03, location[2]),
        rotation=(math.pi / 2, 0, 0),
    )
    bpy.context.object.name = f"Traffic sign red ring {index + 1}"
    bpy.context.object.data.materials.append(sign_red)
    tube_screen(
        f"Traffic sign slash {index + 1}",
        [(pixel_x - 3, pixel_y + 3), (pixel_x + 3, pixel_y - 3)],
        -3.04,
        0.018,
        sign_red,
    )

# Street base prevents the model from floating in the UI fade.
bpy.ops.mesh.primitive_cube_add(location=(0, 2.8, -0.18), scale=(14.2, 5.5, 0.18))
ground = bpy.context.object
ground.name = "Modeled street base"
ground.data.materials.append(street_dark)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = WIDTH
scene.render.resolution_y = HEIGHT
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.film_transparent = False
scene.render.filepath = os.path.join(OUTPUT, "shinjuku-modeled-design-preview.png")
scene.world.use_nodes = True
world = scene.world.node_tree.nodes.get("Background")
world.inputs["Color"].default_value = (0.18, 0.45, 0.75, 1)
world.inputs["Strength"].default_value = 0.68

# A warm, camera-side key light restores the material separation visible in
# the real daylight photo while keeping every facade fully procedural.
bpy.ops.object.light_add(type="AREA", location=(-7.0, -18.0, 23.0))
key_light = bpy.context.object
key_light.name = "Reference daylight key"
key_light.data.energy = 760
key_light.data.shape = "DISK"
key_light.data.size = 12
key_direction = mathutils.Vector((0, 0, 8.5)) - key_light.location
key_light.rotation_euler = key_direction.to_track_quat("-Z", "Y").to_euler()
key_light.data.color = (1.0, 0.83, 0.68)
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast"

scene["delivery_type"] = "Procedural-material architectural 3D model"
scene["uses_photographic_texture"] = False
scene["contains_renderable_photo_plane"] = False

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTPUT, "shinjuku-modeled-design.blend"))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUTPUT, "shinjuku-modeled-design.glb"),
    export_format="GLB",
    export_apply=True,
    export_cameras=True,
    export_lights=False,
)
bpy.ops.render.render(write_still=True)

print("Generated pure modeled design:", OUTPUT)
print("Photographic textures:", scene["uses_photographic_texture"])
