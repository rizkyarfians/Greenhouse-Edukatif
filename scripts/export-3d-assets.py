"""Export reusable GLBs from the greenhouse model without re-encoding meshes."""

from copy import deepcopy
import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "greenhouse.glb"
OUTPUT = ROOT / "assets" / "3d"

ASSETS = {
    "greenhouse-frame": ("Frame",),
    "greenhouse-roof": ("Roof",),
    "greenhouse-shell": ("WallScreens", "Vestibule"),
    "greenhouse-floor": ("Floor", "Drainage"),
    "melon-row": ("Row_A01", "Row_A01_DripLine", "Row_A01_Trellis"),
    "water-tank": ("Raw_Water_Tank",),
    "nutrient-mixing-tank": ("Mixing_Tank",),
    "nutrient-stock-ab": ("Nutrient_Stock",),
    "irrigation-network": (
        "Irrigation",
        *(f"Row_{zone}{row:02}_DripLine" for zone in "AB" for row in range(1, 5)),
    ),
    "irrigation-pump": ("Pump",),
    "irrigation-filter": ("Filter",),
    "irrigation-valve": ("Valve_A",),
    "flow-meter": ("Flow_A",),
    "air-temperature-humidity-sensor": ("Climate_Front_Sensor",),
    "growing-medium-moisture-sensor": ("Moisture_A",),
    "tank-level-sensor": ("Level_Raw",),
    "ec-ph-sensor": ("EC_pH",),
    "iot-control-panel": ("Control_Panel",),
}


def read_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    json_size, json_type = struct.unpack_from("<I4s", data, 12)
    bin_size, bin_type = struct.unpack_from("<I4s", data, 20 + json_size)
    if (magic, version, length, json_type, bin_type) != (
        b"glTF", 2, len(data), b"JSON", b"BIN\x00"
    ) or length != 28 + json_size + bin_size:
        raise ValueError(f"Expected a GLB 2.0 file with JSON and BIN chunks: {path}")
    return json.loads(data[20:20 + json_size]), data[28 + json_size:]


def write_glb(path, document, binary):
    json_data = json.dumps(document, separators=(",", ":")).encode()
    json_data += b" " * (-len(json_data) % 4)
    binary += b"\x00" * (-len(binary) % 4)
    path.write_bytes(b"".join((
        struct.pack("<4sII", b"glTF", 2, 28 + len(json_data) + len(binary)),
        struct.pack("<I4s", len(json_data), b"JSON"),
        json_data,
        struct.pack("<I4s", len(binary), b"BIN\x00"),
        binary,
    )))


def extract(document, binary, name, roots):
    result = {"asset": deepcopy(document["asset"]), "scene": 0}
    copied = {}
    output_binary = bytearray()

    def copy_index(table, index):
        key = (table, index)
        if key in copied:
            return copied[key]

        entries = result.setdefault(table, [])
        item = deepcopy(document[table][index])
        copied[key] = len(entries)
        entries.append(item)

        def remap(owner, field, target_table):
            if field in owner:
                owner[field] = copy_index(target_table, owner[field])

        if table == "nodes":
            remap(item, "mesh", "meshes")
            if "children" in item:
                item["children"] = [copy_index("nodes", i) for i in item["children"]]
        elif table == "meshes":
            for primitive in item["primitives"]:
                primitive["attributes"] = {
                    semantic: copy_index("accessors", accessor)
                    for semantic, accessor in primitive["attributes"].items()
                }
                remap(primitive, "indices", "accessors")
                remap(primitive, "material", "materials")
        elif table == "materials":
            base_color = item.get("pbrMetallicRoughness", {}).get("baseColorTexture")
            if base_color:
                remap(base_color, "index", "textures")
        elif table == "textures":
            remap(item, "sampler", "samplers")
            remap(item, "source", "images")
        elif table in ("images", "accessors"):
            remap(item, "bufferView", "bufferViews")
        elif table == "bufferViews":
            start = item.get("byteOffset", 0)
            output_binary.extend(b"\x00" * (-len(output_binary) % 4))
            item["byteOffset"] = len(output_binary)
            output_binary.extend(binary[start:start + item["byteLength"]])
        return copied[key]

    selected = [copy_index("nodes", root) for root in roots]
    positions = [
        result["accessors"][primitive["attributes"]["POSITION"]]
        for mesh in result["meshes"]
        for primitive in mesh["primitives"]
    ]
    low = [min(position["min"][axis] for position in positions) for axis in range(3)]
    high = [max(position["max"][axis] for position in positions) for axis in range(3)]
    offset = [(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2]
    if name == "greenhouse-shell":
        # Door leaf geometry is hinge-local. Align the shell with the common
        # greenhouse footprint instead of using those local accessor bounds.
        offset = [4, 0, -10]

    result["scenes"] = [{"name": name, "nodes": [len(result["nodes"])]}]
    result["nodes"].append({
        "name": name,
        "children": selected,
        "translation": [-coordinate for coordinate in offset],
        "extras": {"greenhousePosition": offset},
    })
    result["buffers"] = [{"byteLength": len(output_binary)}]
    return result, bytes(output_binary)


def main():
    document, binary = read_glb(SOURCE)
    nodes = {node["name"]: i for i, node in enumerate(document["nodes"])}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, groups in ASSETS.items():
        result, asset_data = extract(document, binary, name, [nodes[group] for group in groups])
        write_glb(OUTPUT / f"{name}.glb", result, asset_data)


if __name__ == "__main__":
    main()
