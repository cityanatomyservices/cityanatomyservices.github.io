"""
bake-ao.py - runs INSIDE Blender. Bakes ambient occlusion for one GLB into
its vertex colours and writes a new GLB that carries them.

    blender.exe -b --python bake-ao.py -- IN.glb OUT.glb [EDGE_M] [SAMPLES]

(tools/models/bake-ao.sh runs it for every model; you do not call this by
hand.) Paths are Windows paths because Blender is the Windows install.

WHY: on the web page the models are lit by one sun and a sky light, with
real-time shadows but no ambient occlusion, the soft darkening where
surfaces meet that gives a Blender render its depth. Baking that darkening
into the model once, here, lets the page show it at no cost.

HOW: per vertex, not per texture. A texture needs a UV layout, and laying
out a whole building together with its hundreds of trees gave the big roofs
no room at all (first try, 2026-10-26: the baked image was black with a
sprinkle of leaves). Vertex colours need no layout: Cycles writes one
occlusion value at every vertex and the graphics card blends between them.
The catch is that a wall with four corners only gets four values, so first
every long edge is split until no edge is longer than EDGE_M metres (default
6), which puts a vertex every few metres across walls, roofs and plazas.
glTF carries the result as COLOR_0, which multiplies the base colour, and
three.js honours that out of the box.
"""
import math
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]
EDGE_M = float(argv[2]) if len(argv) > 2 else 6.0
SAMPLES = int(argv[3]) if len(argv) > 3 else 32
AO_DISTANCE_M = 30.0   # how far a surface "looks" for things that shade it


def log(*a):
    print('[bake-ao]', *a, flush=True)


def use_gpu(scene):
    """Cycles on the GPU when there is one; falls back to the CPU quietly."""
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type != 'CPU']
            if gpus:
                for d in prefs.devices:
                    d.use = d.type != 'CPU'
                scene.cycles.device = 'GPU'
                log('rendering on', kind, gpus[0].name)
                return
        except Exception as e:  # noqa: BLE001 - any failure means "no such device"
            log(kind, 'not available:', e)
    scene.cycles.device = 'CPU'
    log('rendering on CPU')


def split_long_edges(obj, max_len):
    """Split edges longer than max_len in halves, pass after pass, so every
    face has a vertex at least every max_len metres."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for _ in range(8):
        long_edges = [e for e in bm.edges if e.calc_length() > max_len]
        if not long_edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == 'MESH']
    log('imported', len(meshes), 'meshes from', SRC)

    # one object: simpler to bake and to export
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    before = len(obj.data.vertices)
    split_long_edges(obj, EDGE_M)
    log('joined; vertices', before, '->', len(obj.data.vertices), 'after splitting edges over', EDGE_M, 'm')

    # the colour attribute the bake writes into
    ca = obj.data.color_attributes.new(name='AO', type='BYTE_COLOR', domain='CORNER')
    obj.data.color_attributes.active_color = ca
    obj.data.color_attributes.render_color_index = obj.data.color_attributes.find('AO')

    # multiply the attribute into every material's base colour: that is what
    # tells the glTF exporter to write it out as COLOR_0
    for slot in obj.material_slots:
        mat = slot.material
        if mat is None or not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None:
            continue
        base = bsdf.inputs['Base Color']
        attr = nt.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'AO'
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        if base.is_linked:
            nt.links.new(base.links[0].from_socket, mix.inputs[6])
        else:
            mix.inputs[6].default_value = base.default_value
        nt.links.new(attr.outputs['Color'], mix.inputs[7])
        nt.links.new(mix.outputs[2], base)

    world = bpy.data.worlds.new('Bake')
    scene.world = world
    world.light_settings.distance = AO_DISTANCE_M
    scene.render.engine = 'CYCLES'
    use_gpu(scene)
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = False
    scene.render.bake.target = 'VERTEX_COLORS'
    scene.render.bake.use_selected_to_active = False
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    log('baking AO to vertex colours,', SAMPLES, 'samples')
    bpy.ops.object.bake(type='AO')
    log('bake done')

    bpy.ops.export_scene.gltf(
        filepath=DST, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True,
        export_texcoords=False, export_normals=True, export_materials='EXPORT')
    log('wrote', DST)


main()
