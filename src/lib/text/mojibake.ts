const vietnameseCharacters =
  "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ" +
  "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ";

const punctuationMap: Record<string, string> = {
  Â·: "·",
  "Â ": " ",
  "Â ": " ",
  "â€“": "–",
  "â€”": "—",
  "â€˜": "‘",
  "â€™": "’",
  "â€œ": "“",
  "â€": "”",
  "â€¦": "…",
};

const mojibakeMarkers = /Ã|Ä|Å|Æ|Â|áº|á»|â€/;
let vietnameseMojibakeMap: Record<string, string> | null = null;

function buildVietnameseMojibakeMap() {
  const encoder = new TextEncoder();
  const windows1252Decoder = new TextDecoder("windows-1252");
  const entries: Record<string, string> = { ...punctuationMap };

  for (const character of vietnameseCharacters) {
    const bytes = encoder.encode(character);
    const latin1Mojibake = String.fromCharCode(...bytes);
    const windows1252Mojibake = windows1252Decoder.decode(bytes);
    entries[latin1Mojibake] = character;
    entries[windows1252Mojibake] = character;
  }

  return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => right.length - left.length));
}

export function normalizeVietnameseMojibake(value: unknown) {
  const text = String(value ?? "");

  if (!mojibakeMarkers.test(text)) {
    return text;
  }

  vietnameseMojibakeMap ??= buildVietnameseMojibakeMap();

  let normalized = text;

  for (const [mojibake, character] of Object.entries(vietnameseMojibakeMap)) {
    normalized = normalized.replaceAll(mojibake, character);
  }

  return normalized;
}
