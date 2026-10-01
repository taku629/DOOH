import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "assets", "blender")
BLEND = os.path.join(OUT, "shinjuku-light-canyon.blend")
PREVIEW = os.path.join(OUT, "shinjuku-light-canyon-preview.png")
GLB = os.path.join(OUT, "shinjuku-light-canyon.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metallic=0.0, roughness=0.45, alpha=1.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, alpha)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Alpha"].default_value = alpha
    if emission:
        p.inputs["Emission Color"].default_value = (*emission, 1)
        p.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        m.surface_render_method = "DITHERED"
    return m


stone = mat("Warm monochrome concrete", (0.34, 0.36, 0.35), 0.08, 0.58)
dark = mat("Graphite windows", (0.045, 0.055, 0.052), 0.35, 0.26)
glass = mat("Smoked city glass", (0.12, 0.16, 0.17), 0.46, 0.18)
silver = mat("Cocoon silver ribs", (0.68, 0.71, 0.69), 0.55, 0.2)
mist = mat("Urban mist", (0.72, 0.75, 0.73), 0.0, 0.8, 0.12)
warm = mat("Warm window light", (0.75, 0.42, 0.17), 0.05, 0.3, 1, (0.95, 0.42, 0.1), 2.4)
blue = mat("Cool window light", (0.12, 0.34, 0.46), 0.1, 0.25, 1, (0.08, 0.36, 0.62), 1.6)
road = mat("Street graphite", (0.025, 0.03, 0.028), 0.05, 0.72)


def cube(name, location, scale, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new("Architectural edge softness", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return o


def tube(name, points, material, radius=0.025):
    c = bpy.data.curves.new(name, "CURVE")
    c.dimensions = "3D"
    c.bevel_depth = radius
    c.bevel_resolution = 1
    s = c.splines.new("POLY")
    s.points.add(len(points) - 1)
    for p, co in zip(s.points, points):
        p.co = (*co, 1)
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    c.materials.append(material)
    return o


def office(name, x, y, width, depth, height, material, horizontal=False, rounded=0.12):
    o = cube(name, (x, y, height / 2), (width / 2, depth / 2, height / 2), material, rounded)
    facade_y = y - depth / 2 - 0.012
    if horizontal:
        for z in [0.45 + i * 0.48 for i in range(int((height - 0.3) / 0.48))]:
            tube(f"{name} floor {z:.2f}", [(x-width/2+.12, facade_y, z), (x+width/2-.12, facade_y, z)], dark, .018)
        for col in range(1, max(2, int(width / 0.8))):
            xx = x - width/2 + col * width / max(2, int(width / 0.8))
            tube(f"{name} seam {col}", [(xx, facade_y-.005, .25), (xx, facade_y-.005, height-.2)], glass, .008)
    else:
        for col in range(1, max(3, int(width / 0.34))):
            xx = x - width/2 + col * width / max(3, int(width / 0.34))
            tube(f"{name} vertical {col}", [(xx, facade_y, .28), (xx, facade_y, height-.2)], dark, .013)
        for floor in range(1, int(height / .42)):
            z = floor * .42
            tube(f"{name} floor {floor}", [(x-width/2+.1, facade_y-.004, z), (x+width/2-.1, facade_y-.004, z)], glass, .008)
    return o


# Deep background towers frame the light route without occupying its center.
office("Sompo-like rounded tower", -6.7, 5.8, 4.1, 2.3, 15.7, stone, False, .34)
office("Keio-style left office", -9.0, 2.8, 4.4, 2.0, 9.4, glass, True, .08)
office("Shinjuku horizontal-band tower", 6.8, 5.0, 4.9, 2.4, 13.8, glass, True, .1)
office("Right foreground office", 9.2, 1.9, 4.6, 2.3, 8.1, stone, True, .08)
office("Left street block", -9.4, -0.2, 5.2, 2.1, 4.3, stone, True, .05)
office("Right street block", 9.6, -0.4, 5.4, 2.0, 4.7, stone, True, .05)

# Cocoon Tower: tapered body and dense diagonal exoskeleton, offset left of the launch axis.
verts = []
faces = []
levels = 22
segments = 24
cx, cy, height = -2.8, 7.1, 18.6
for level in range(levels + 1):
    z = height * level / levels
    t = level / levels
    width = 1.25 + 1.55 * math.sin(math.pi * (0.08 + t * .92))
    depth = .85 + .52 * math.sin(math.pi * (0.08 + t * .92))
    for seg in range(segments):
        a = math.tau * seg / segments
        verts.append((cx + math.cos(a) * width, cy + math.sin(a) * depth, z))
for level in range(levels):
    for seg in range(segments):
        a = level * segments + seg
        b = level * segments + (seg + 1) % segments
        c = (level + 1) * segments + (seg + 1) % segments
        d = (level + 1) * segments + seg
        faces.append((a, b, c, d))
mesh = bpy.data.meshes.new("Cocoon tapered glass geometry")
mesh.from_pydata(verts, [], faces)
cocoon = bpy.data.objects.new("Mode Gakuen Cocoon Tower silhouette", mesh)
bpy.context.collection.objects.link(cocoon)
cocoon.data.materials.append(glass)

front_y = cy - .93
for offset in range(-10, 11):
    pts_up, pts_down = [], []
    for i in range(33):
        z = i * height / 32
        envelope = 1.18 + 1.58 * math.sin(math.pi * (.08 + z / height * .92))
        xu = cx + offset * .34 + (z - height/2) * .23
        xd = cx + offset * .34 - (z - height/2) * .23
        if abs(xu-cx) <= envelope: pts_up.append((xu, front_y, z))
        if abs(xd-cx) <= envelope: pts_down.append((xd, front_y-.012, z))
    if len(pts_up) > 1: tube(f"Cocoon rising rib {offset}", pts_up, silver, .035)
    if len(pts_down) > 1: tube(f"Cocoon falling rib {offset}", pts_down, silver, .035)
for floor in range(1, 37):
    z = floor * height / 38
    envelope = 1.18 + 1.58 * math.sin(math.pi * (.08 + z / height * .92))
    tube(f"Cocoon floor scale {floor}", [(cx-envelope*.92, front_y+.02, z), (cx+envelope*.92, front_y+.02, z)], dark, .009)

# Street-level cues: signs, canopy and luminous windows. These provide scale without photo textures.
cube("West exit canopy", (0, -1.05, 2.35), (3.0, .75, .12), stone, .08)
for x, z, material in [(-7.8, 1.7, blue), (-5.4, 2.6, warm), (6.1, 1.9, warm), (8.0, 2.8, blue)]:
    cube(f"City sign {x}", (x, -1.32, z), (.55, .04, .22), material, .035)
for x in (-7.2, -4.8, 5.1, 7.4):
    tube(f"Street lamp {x}", [(x, -1.7, .1), (x, -1.7, 2.3)], dark, .035)
    bpy.ops.object.light_add(type="POINT", location=(x, -1.65, 2.25))
    lamp = bpy.context.object
    lamp.name = f"Street light glow {x}"
    lamp.data.energy = 38
    lamp.data.color = (1.0, .56, .28) if x > 0 else (.38, .65, 1.0)
    lamp.data.shadow_soft_size = .8

# A dark street wedge creates the C-concept's central perspective corridor.
road_mesh = bpy.data.meshes.new("Perspective street geometry")
road_mesh.from_pydata([(-10,-2,0),(10,-2,0),(3.0,10,0),(-3.0,10,0)], [], [(0,1,2,3)])
street = bpy.data.objects.new("Shinjuku light corridor", road_mesh)
bpy.context.collection.objects.link(street)
street.data.materials.append(road)
for side in (-1, 1):
    tube(f"Perspective curb {side}", [(side*9.2,-1.8,.03),(side*2.2,10,.03)], silver, .025)

# Camera and restrained monochrome lighting.
bpy.ops.object.camera_add(location=(0, -29, 10.1))
camera = bpy.context.object
camera.name = "Mobile UI portrait camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 22.5
camera.rotation_euler = (math.radians(78), 0, 0)
direction = Vector((0, 3.5, 8.6)) - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(-8, -10, 20))
key = bpy.context.object
key.name = "Soft overcast key"
key.data.energy = 950
key.data.shape = "DISK"
key.data.size = 14
key.rotation_euler = (math.radians(28), 0, math.radians(-28))

bpy.ops.object.light_add(type="AREA", location=(8, -6, 10))
fill = bpy.context.object
fill.name = "Cool urban fill"
fill.data.energy = 420
fill.data.color = (.48, .67, .82)
fill.data.size = 10
fill.rotation_euler = (math.radians(55), 0, math.radians(145))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 650
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.render.filepath = PREVIEW
scene.world = bpy.data.worlds.new("Shinjuku overcast world")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.72, .75, .74, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .38
scene.view_settings.look = "AgX - Medium High Contrast"
scene["design_intent"] = "Shinjuku West Exit light canyon for mobile DOOH bow UI"
scene["photographic_textures"] = False

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", export_apply=True, export_cameras=True, export_lights=False)
bpy.ops.render.render(write_still=True)
print(BLEND)
print(PREVIEW)
