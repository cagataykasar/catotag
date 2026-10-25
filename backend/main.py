import xml.etree.ElementTree as ET

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import models  # noqa: F401  (registers tables on Base.metadata)
from auth import router as auth_router
from config import CORS_ORIGINS
from db import Base, engine
from routers import tag_router, user_router

# Create missing tables on startup (no migrations yet)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="catotag API",
    description="online time based XML creator",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(tag_router)

@app.get("/")
def read_root():
    return {"message": "XML Creator API is running"}

@app.post("/generate-xml")
async def generate_xml(request: Request):
    # Same schema as the frontend export (repeated <instance> under <ALL_INSTANCES>)
    payload = await request.json()
    root = ET.Element("file")
    sort_info = ET.SubElement(root, "SORT_INFO")
    ET.SubElement(sort_info, "sort_type").text = "sort order"
    all_instances = ET.SubElement(root, "ALL_INSTANCES")
    for inst in payload.get("instances", []):
        code = str(inst.get("code", "")).upper()
        label = inst.get("label") or {}
        node = ET.SubElement(all_instances, "instance")
        ET.SubElement(node, "ID").text = str(int(inst.get("ID", 0) or 0))
        ET.SubElement(node, "code").text = code
        ET.SubElement(node, "start").text = f"{float(inst.get('start', 0) or 0):.3f}"
        ET.SubElement(node, "end").text = f"{float(inst.get('end', 0) or 0):.3f}"
        label_node = ET.SubElement(node, "label")
        ET.SubElement(label_node, "group").text = "Event"
        ET.SubElement(label_node, "text").text = str(label.get("text") or code).upper()
    ET.indent(root, space="  ")
    xml_bytes = ET.tostring(root, encoding="UTF-8", xml_declaration=True)
    return Response(content=xml_bytes, media_type="application/xml")
