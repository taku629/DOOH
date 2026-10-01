import bpy
import math
import mathutils
import os
import random

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT = os.path.join(ROOT, "assets", "blender")
REFERENCE = os.path.join(OUTPUT, "reference", "shinjuku-reference.png")
os.makedirs(OUTPUT, exist_ok=True)
random.seed(20365)

# Reference calibration:
# 650 x 450 source image, 25 px per Blender unit.
PX = 25.0
FRAME_WIDTH = 650
FRAME_HEIGHT = 450


def world_x(pixel_x):
    return (pixel_x - FRAME_WIDTH / 2) / PX


def world_z(pixel_y):
    return (FRAME_HEIGHT - pixel_y) / PX


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return value


sky_blue = (.22, .52, .82)
cocoon_glass = material("Cocoon blue glass", (.16, .31, .41), metallic=.38, roughness=.16)
cocoon_shadow = material("Cocoon inner shadow", (.045, .10, .14), metallic=.24, roughness=.25)
rib_white = material("Cocoon white diagrid", (.88, .91, .90), metallic=.28, roughness=.24)
floor_dark = material("Cocoon floor bands", (.055, .09, .11), metallic=.25, roughness=.26)
bronze = material("Left bronze tower", (.29, .22, .17), metallic=.22, roughness=.39)
bronze_dark = material("Left tower grid", (.11, .095, .085), metallic=.32, roughness=.32)
silver = material("Right silver tower", (.56, .61, .64), metallic=.42, roughness=.22)
blue_band = material("Right blue glass bands", (.10, .19, .26), metallic=.46, roughness=.18)
white_panel = material("White annex", (.79, .81, .80), metallic=.12, roughness=.46)
dark_window = material("Dark windows", (.07, .10, .12), metallic=.3, roughness=.26)
dome_white = material("Cocoon hall white triangle", (.91, .92, .89), metallic=.18, roughness=.3)
dome_dark = material("Cocoon hall dark triangle", (.07, .11, .13), metallic=.28, roughness=.25)
crane_red = material("Crane red", (.58, .035, .025), metallic=.35, roughness=.34)
ground_mat = material("Ground", (.16, .18, .18), metallic=.08, roughness=.72)
signal_blue = material("Traffic blue", (.04, .16, .42), metallic=.2, roughness=.35)
signal_red = material("Traffic red", (.64, .03, .025), metallic=.2, roughness=.35)
tree_green = material("Tree foliage", (.18, .29, .12), roughness=.7)


def cube(name, location, scale, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Small architectural bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def tube(name, points, mat, radius=.035, resolution=1):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = resolution
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinates in zip(spline.points, points):
        point.co = (*coordinates, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def triangular_prism(name, x_left, x_right, z_left, z_right, y_center, depth, mat):
    vertices = [
        (x_left, y_center - depth / 2, z_left),
        (x_right, y_center - depth / 2, z_left),
        (x_right, y_center - depth / 2, z_right),
        (x_left, y_center + depth / 2, z_left),
        (x_right, y_center + depth / 2, z_left),
        (x_right, y_center + depth / 2, z_right),
    ]
    faces = [
        (0, 1, 2),
        (3, 5, 4),
        (0, 3, 4, 1),
        (1, 4, 5, 2),
        (2, 5, 3, 0),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def point_at(obj, target):
    obj.rotation_euler = (mathutils.Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def cocoon_radius(t):
    # Measured silhouette: the real tower is slimmer than an ellipse.  The
    # widest zone sits around the middle and both ends taper continuously.
    shifted = min(1.0, max(0.0, t * .96 + .035))
    return 1.68 + 1.52 * (math.sin(math.pi * shifted) ** .72)


def cocoon_depth(t):
    return cocoon_radius(t) * .54


def create_cocoon_tower():
    base_z = world_z(438)
    top_z = world_z(-44)
    height = top_z - base_z
    rings = 64
    segments = 72
    vertices = []
    faces = []
    center_x = world_x(294)

    for ring in range(rings + 1):
        t = ring / rings
        rx = cocoon_radius(t)
        ry = cocoon_depth(t)
        z = base_z + height * t
        for segment in range(segments):
            angle = math.tau * segment / segments
            # Reference leans imperceptibly to the right near the upper third.
            lean = .10 * math.sin(math.pi * t)
            vertices.append((center_x + lean + rx * math.cos(angle), ry * math.sin(angle), z))
    for ring in range(rings):
        for segment in range(segments):
            a = ring * segments + segment
            b = ring * segments + (segment + 1) % segments
            c = (ring + 1) * segments + (segment + 1) % segments
            d = (ring + 1) * segments + segment
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new("Measured cocoon envelope")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(cocoon_glass)
    tower = bpy.data.objects.new("Mode Gakuen Cocoon Tower 203.65m", mesh)
    bpy.context.collection.objects.link(tower)

    # Three stronger vertical facade zones visible in the photograph.
    for angle in (math.radians(72), math.radians(108), math.radians(180)):
        points = []
        for step in range(80):
            t = step / 79
            rx = cocoon_radius(t)
            ry = cocoon_depth(t)
            points.append((
                center_x + rx * math.cos(angle),
                ry * math.sin(angle) - .015,
                base_z + height * t,
            ))
        tube(f"Cocoon primary facade spine {angle}", points, rib_white, .052, 2)

    # The exterior reads as broad diagonal diamonds, not a tight helix.
    for direction in (-1, 1):
        for strand in range(7):
            phase = math.tau * strand / 7 + (0.12 if direction > 0 else -.08)
            points = []
            for step in range(112):
                t = step / 111
                angle = phase + direction * math.tau * 1.18 * t
                rx = cocoon_radius(t) + .045
                ry = cocoon_depth(t) + .045
                points.append((
                    center_x + rx * math.cos(angle),
                    ry * math.sin(angle),
                    base_z + height * t,
                ))
            tube(f"Cocoon curved diagrid {direction} {strand}", points, rib_white, .046, 2)

    # Finer printed/ribbed lattice visible between the primary structural diamonds.
    for direction in (-1, 1):
        for strand in range(11):
            phase = math.tau * strand / 11 + (0.07 if direction > 0 else -.05)
            points = []
            for step in range(132):
                t = step / 131
                angle = phase + direction * math.tau * 2.08 * t
                rx = cocoon_radius(t) + .028
                ry = cocoon_depth(t) + .028
                points.append((
                    center_x + rx * math.cos(angle),
                    ry * math.sin(angle) - .008,
                    base_z + height * t,
                ))
            tube(f"Cocoon secondary lattice {direction} {strand}", points, rib_white, .018, 1)

    # 50-storey scale, every second band visible to avoid moire at mobile size.
    for floor in range(2, 50, 2):
        t = floor / 50
        rx = cocoon_radius(t) + .012
        ry = cocoon_depth(t) + .012
        points = []
        for segment in range(73):
            angle = math.tau * segment / 72
            points.append((
                center_x + rx * math.cos(angle),
                ry * math.sin(angle),
                base_z + height * t,
            ))
        tube(f"Cocoon floor line {floor:02d}", points, floor_dark, .012, 1)
    return tower


def facade_tower(name, left_px, right_px, top_px, bottom_px, depth, body_mat, grid_mat, horizontal=False):
    left = world_x(left_px)
    right = world_x(right_px)
    top = world_z(top_px)
    bottom = world_z(bottom_px)
    width = right - left
    height = top - bottom
    center_x = (left + right) / 2
    center_z = (top + bottom) / 2
    body = cube(name, (center_x, 1.8, center_z), (width / 2, depth / 2, height / 2), body_mat, .035)
    facade_y = 1.8 - depth / 2 - .025
    if horizontal:
        for row in range(1, 29):
            z = bottom + height * row / 29
            cube(f"{name} horizontal band {row:02d}", (center_x, facade_y, z), (width / 2, .025, .028), grid_mat)
        for column in range(1, 8):
            x = left + width * column / 8
            cube(f"{name} vertical seam {column:02d}", (x, facade_y - .003, center_z), (.016, .026, height / 2), body_mat)
    else:
        for column in range(1, 19):
            x = left + width * column / 19
            cube(f"{name} vertical grid {column:02d}", (x, facade_y, center_z), (.018, .026, height / 2), grid_mat)
        for row in range(1, 42):
            z = bottom + height * row / 42
            cube(f"{name} floor grid {row:02d}", (center_x, facade_y - .003, z), (width / 2, .026, .014), grid_mat)
    return body


def create_cocoon_hall():
    # Photo bounds approximately x=335..475, y=354..449.
    center_x = world_x(405)
    center_z = world_z(405)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1, location=(center_x, -.82, center_z))
    dome = bpy.context.object
    dome.name = "Mode Gakuen Cocoon Hall faceted shell"
    dome.scale = (2.95, 1.48, 1.92)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    dome.data.materials.append(dome_white)
    dome.data.materials.append(dome_dark)
    for polygon in dome.data.polygons:
        center = polygon.center
        pattern = (
            polygon.index % 5 == 0 or
            (polygon.index + int((center.x + 3) * 4)) % 9 == 0 or
            (center.z > .2 and polygon.index % 13 == 0)
        )
        polygon.material_index = 1 if pattern else 0
    cube("Cocoon Hall plinth", (center_x, -.62, .18), (3.1, 1.55, .18), cocoon_shadow, .06)
    return dome


def create_crane():
    x = world_x(191)
    bottom = world_z(418)
    top = world_z(101)
    tube("Reference red crane mast", [(x, .3, bottom), (x, .3, top)], crane_red, .045)
    tube("Reference red crane jib", [(x, .3, top), (x + 1.25, .3, top + 1.55)], crane_red, .038)
    for index in range(11):
        z = bottom + (top - bottom) * index / 11
        tube(f"Crane diagonal {index}", [(x - .11, .3, z), (x + .11, .3, z + .56)], crane_red, .014)


def create_traffic_and_trees():
    # Small foreground cues from the reference; deliberately low-poly at mobile scale.
    for px in (236, 517, 551):
        x = world_x(px)
        cube(f"Traffic pole {px}", (x, -1.25, .72), (.025, .025, .72), dark_window)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.16, depth=.045, location=(x, -1.27, 1.37), rotation=(math.pi / 2, 0, 0))
        sign = bpy.context.object
        sign.data.materials.append(signal_blue)
        bpy.ops.mesh.primitive_torus_add(major_radius=.12, minor_radius=.026, major_segments=24, minor_segments=8, location=(x, -1.30, 1.37), rotation=(math.pi / 2, 0, 0))
        bpy.context.object.data.materials.append(signal_red)
    for px in (402, 445, 507):
        x = world_x(px)
        cube(f"Tree trunk {px}", (x, -1.18, .48), (.025, .025, .48), bronze_dark)
        for index in range(7):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.22, location=(x + random.uniform(-.3, .3), -1.2, .8 + index * .16))
            leaf = bpy.context.object
            leaf.scale = (1.0, .6, 1.45)
            leaf.data.materials.append(tree_green)


# Background architecture matched to source image bounds.
facade_tower("Left bronze high-rise", 21, 184, -17, 390, 2.8, bronze, bronze_dark, horizontal=False)
facade_tower("Right striped glass tower", 381, 573, 116, 374, 2.65, silver, blue_band, horizontal=True)
triangular_prism(
    "Right tower perspective crown",
    world_x(381),
    world_x(573),
    world_z(116),
    world_z(91),
    1.8,
    2.65,
    silver,
)
facade_tower("Left foreground office", -18, 133, 185, 439, 2.15, silver, blue_band, horizontal=True)
facade_tower("Left mid-rise", 43, 212, 282, 443, 1.9, silver, blue_band, horizontal=True)
facade_tower("Right white annex", 558, 676, 194, 445, 2.2, white_panel, dark_window, horizontal=False)
create_cocoon_tower()
create_cocoon_hall()
create_crane()
create_traffic_and_trees()
cube("Reference ground strip", (0, 2.8, -.18), (15, 8, .18), ground_mat)

# Orthographic camera keeps the same measured proportions as the supplied photograph.
bpy.ops.object.camera_add(location=(0, -42, 9))
camera = bpy.context.object
camera.name = "650x450 reference-matched camera"
camera.data.type = "ORTHO"
# Blender 5.2 uses the horizontal span for this landscape camera.
camera.data.ortho_scale = FRAME_WIDTH / PX
camera.data.lens = 50
point_at(camera, (0, 0, 9))
bpy.context.scene.camera = camera

if os.path.exists(REFERENCE):
    background = camera.data.background_images.new()
    background.image = bpy.data.images.load(REFERENCE)
    background.alpha = .38
    background.display_depth = "BACK"

bpy.ops.object.light_add(type="SUN", location=(-6, -10, 24))
sun = bpy.context.object
sun.name = "Reference upper-right sunlight"
sun.data.energy = 2.65
sun.rotation_euler = (math.radians(24), math.radians(-19), math.radians(-34))

bpy.ops.object.light_add(type="AREA", location=(1, -14, 15))
fill = bpy.context.object
fill.name = "Reference frontal sky fill"
fill.data.energy = 820
fill.data.size = 18
point_at(fill, (0, 1, 8))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = FRAME_WIDTH
scene.render.resolution_y = FRAME_HEIGHT
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.filepath = os.path.join(OUTPUT, "shinjuku-strict-preview.png")
scene.world.use_nodes = True
world_background = scene.world.node_tree.nodes.get("Background")
world_background.inputs["Color"].default_value = (*sky_blue, 1)
world_background.inputs["Strength"].default_value = .78
scene.view_settings.look = "AgX - Medium High Contrast"

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTPUT, "shinjuku-strict.blend"))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUTPUT, "shinjuku-strict.glb"),
    export_format="GLB",
    export_apply=True,
    export_cameras=True,
    export_lights=False,
)
bpy.ops.render.render(write_still=True)
print("Generated strict reference-matched Shinjuku scene:", OUTPUT)
