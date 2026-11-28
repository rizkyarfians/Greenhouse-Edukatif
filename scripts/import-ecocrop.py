"""Retrieve a pinned EcoCrop snapshot and extract the crops used by Automotion."""

import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
from urllib.request import urlopen

COMMIT = "ea43ecd418fd1a1ea08d32c7dce64b7fae02dec4"
SOURCE_URL = f"https://raw.githubusercontent.com/OpenCLIM/ecocrop/{COMMIT}/EcoCrop_DB.csv"
CATALOG_URL = "https://cgiar-climate-data-hub.github.io/catalog/ecocrop/"
DATASHEET_URL = "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id="
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "ecocrop.json"
CROPS = {
    "rice": (1574, "Oryza sativa"),
    "maize": (2175, "Zea mays"),
    "soybean": (1150, "Glycine max"),
    "groundnut": (2199, "Arachis hypogaea"),
    "chili": (618, "Capsicum annuum"),
    "tomato": (1379, "Lycopersicon esculentum"),
    "cabbage": (554, "Brassica oleracea var. capitata"),
    "potato": (1971, "Solanum tuberosum"),
    "cucumber": (817, "Cucumis sativus"),
    "shallot": (1096, "Allium cepa var. aggregatum"),
    "melon": (815, "Cucumis melo"),
}


def value(row, field):
    raw = row[field].strip()
    if raw in ("", "NA"):
        return None
    number = float(raw)
    if not math.isfinite(number):
        raise ValueError(f"Invalid numeric value in {field}: {raw}")
    return int(number) if number.is_integer() else number


def interval(row, first, last):
    low, high = value(row, first), value(row, last)
    if low is not None and high is not None and low > high:
        raise ValueError(f"Inverted {first}/{last} for {row['ScientificName']}")
    return [low, high]


def scoped_ranges(row, optimal, absolute):
    preferred = interval(row, *optimal)
    limits = interval(row, *absolute)
    if all(v is not None for v in preferred + limits) and not (
        limits[0] <= preferred[0] <= preferred[1] <= limits[1]
    ):
        raise ValueError(f"Optimal range outside limits for {row['ScientificName']}: {optimal}")
    return {"optimal": preferred, "absolute": limits}


def extract(content):
    table = csv.DictReader(io.StringIO(content.decode("cp1252"), newline=""))
    wanted = {str(code) for code, _ in CROPS.values()}
    rows = {}
    for row in table:
        code = row["EcoPortCode"].strip()
        if code in wanted:
            if code in rows:
                raise ValueError(f"Duplicate EcoPort code {code}")
            rows[code] = row

    crops = {}
    for crop_id, (code, name) in CROPS.items():
        row = rows.get(str(code))
        if row is None or row["ScientificName"].strip() != name:
            raise ValueError(f"Expected {name} (EcoPort {code})")
        crops[crop_id] = {
            "ecoPortCode": code,
            "sourceScientificName": name,
            "datasheet": f"{DATASHEET_URL}{code}",
            "temperatureC": scoped_ranges(row, ("TOPMN", "TOPMX"), ("TMIN", "TMAX")),
            "soilPh": scoped_ranges(row, ("PHOPMN", "PHOPMX"), ("PHMIN", "PHMAX")),
            "annualRainfallMm": scoped_ranges(row, ("ROPMN", "ROPMX"), ("RMIN", "RMAX")),
            "cropCycleDays": interval(row, "GMIN", "GMAX"),
        }
    return {
        "source": {
            "publisher": "FAO EcoCrop",
            "catalog": CATALOG_URL,
            "snapshot": SOURCE_URL,
            "snapshotSha256": hashlib.sha256(content).hexdigest(),
        },
        "crops": crops,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, help="Read a local copy of the pinned CSV.")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    if args.csv:
        content = args.csv.read_bytes()
    else:
        with urlopen(SOURCE_URL, timeout=30) as response:
            content = response.read()
    data = extract(content)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(data['crops'])} EcoCrop records to {args.output}")


if __name__ == "__main__":
    main()
