import dicttoxml

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(
    title="catotag API",
    description="online time based XML creator",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "XML Creator API is running"}

@app.post("/generate-xml")
async def generate_xml(request: Request):
    payload = await request.json()
    instances = payload.get("instances", [])
    file_obj = {
        "SORT_INFO": {"sort_type": "sort order"},
        "ALL_INSTANCES": {
            "instance": [
                {
                    "ID": inst.get("ID", 0),
                    "code": inst.get("code", ""),
                    "start": inst.get("start", 0),
                    "end": inst.get("end", 0),
                    "label": {
                        "group": inst.get("label", {}).get("group", "Event"),
                        "text": inst.get("label", {}).get("text", inst.get("code", "")),
                    },
                }
                for inst in instances
            ]
        },
    }
    xml_bytes = dicttoxml.dicttoxml(
        file_obj, custom_root='file', attr_type=False
    )
    return Response(content=xml_bytes, media_type="application/xml")