// Helper to safely encode text for XML
const escapeXml = (str) =>
  str.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));

// Build the XML string in the exact schema the editing software imports; IDs are sequential
export const generateXmlFromInstances = (instancesList) => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<file>\n";
  xml += "  <SORT_INFO>\n";
  xml += "    <sort_type>sort order</sort_type>\n";
  xml += "  </SORT_INFO>\n";
  xml += "  <ALL_INSTANCES>\n";

  instancesList.forEach((inst, id) => {
    const code = escapeXml((inst.code ?? "").toString().toUpperCase());
    const start = Number(inst.start ?? 0).toFixed(3);
    const end = Number(inst.end ?? 0).toFixed(3);
    const labelText = escapeXml((inst.label?.text ?? inst.code ?? "").toString().toUpperCase());

    xml += "    <instance>\n";
    xml += `      <ID>${id}</ID>\n`;
    xml += `      <code>${code}</code>\n`;
    xml += `      <start>${start}</start>\n`;
    xml += `      <end>${end}</end>\n`;
    xml += "      <label>\n";
    xml += "        <group>Event</group>\n";
    xml += `        <text>${labelText}</text>\n`;
    xml += "      </label>\n";
    xml += "    </instance>\n";
  });

  xml += "  </ALL_INSTANCES>\n";
  xml += "</file>";
  return xml;
};

const downloadText = (filename, text, mime = "application/xml;charset=utf-8") => {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking immediately cancels the download on iOS Safari and some Android browsers
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch {
    return false;
  }
};

const dateStamp = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Filesystem-safe name (quotes and slashes break downloads on Android/Windows)
export const buildFileName = (teamA, teamB, date = new Date()) => {
  const clean = (s, fallback) =>
    ((s || "").trim() || fallback).toUpperCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || fallback;
  return `${clean(teamA, "TEAM_A")}_vs_${clean(teamB, "TEAM_B")}_${dateStamp(date)}.xml`;
};

// Share sheet on phones when the browser accepts the file, plain download otherwise
export const exportXml = async (instances, teamA, teamB, date) => {
  const text = generateXmlFromInstances(instances);
  const filename = buildFileName(teamA, teamB, date);
  const isTouch = window.matchMedia?.("(pointer: coarse)").matches;
  if (isTouch && navigator.canShare) {
    try {
      const file = new File([text], filename, { type: "application/xml" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return; // user closed the share sheet
    }
  }
  if (!downloadText(filename, text)) {
    window.alert("Download failed. If you opened this inside another app (WhatsApp, Instagram...), open it in Safari/Chrome instead.");
  }
};
