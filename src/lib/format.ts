export const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export const formatPhone = (s?: string | null) => {
  if (!s) return "";
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
};

export const initials = (name?: string | null) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/**
 * Extrai apenas o nome limpo do logradouro (rua, avenida), removendo números e bairros residuais.
 */
export function cleanStreetName(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw).trim();
  if (s.includes(" - ")) {
    s = s.split(/\s+-\s+/)[0].trim();
  }
  s = s.replace(/(?:,\s*(?:\d+[A-Za-z]?|S\/N|\d+))\s*$/i, "").trim();
  s = s.replace(/(?:,\s*(?:\d+[A-Za-z]?|S\/N|\d+))\s*$/i, "").trim();
  return s.replace(/[\s,-]+$/, "").trim();
}

/**
 * Monta o endereço de entrega completo de forma canônica e sem repetições.
 */
export function formatCleanDeliveryAddress(
  rawStreet?: string | null,
  rawNum?: string | null,
  rawNeigh?: string | null,
  rawComp?: string | null
): string {
  let street = cleanStreetName(rawStreet);
  let num = (rawNum || "").trim();
  let neigh = (rawNeigh || "").trim();
  let comp = (rawComp || "").trim();

  if (!street && rawStreet) street = String(rawStreet).trim();

  let res = street;
  if (num && num !== "S/N") {
    res += `, ${num}`;
  } else if (num === "S/N") {
    res += ", S/N";
  }

  if (neigh) {
    res += ` - ${neigh}`;
  }

  if (comp) {
    res += ` (${comp})`;
  }

  return res;
}

/**
 * Sanitiza e deduplica endereços corrompidos com múltiplos loops ou repetições para exibição em tela.
 */
export function formatDisplayAddress(raw?: string | null): string {
  if (!raw) return "—";
  const s = String(raw).trim();
  if (!s) return "—";

  const firstDash = s.indexOf(" - ");
  if (firstDash === -1) {
    const numMatch = s.match(/,\s*(\d+[A-Za-z]?|S\/N)/i);
    const street = s.replace(/,\s*(?:\d+[A-Za-z]?|S\/N).*$/i, "").replace(/[\s,]+$/, "").trim();
    return street + (numMatch ? `, ${numMatch[1]}` : "");
  }

  const streetPart = s.slice(0, firstDash);
  const afterDash = s.slice(firstDash + 3);
  const streetName = streetPart.replace(/,\s*(?:\d+[A-Za-z]?|S\/N).*$/i, "").replace(/[\s,]+$/, "").trim();
  const numMatch = streetPart.match(/,\s*(\d+[A-Za-z]?|S\/N)/i);
  const num = numMatch ? numMatch[1] : "";
  const neigh = afterDash.split(/\s*,\s*(?:\d+|S\/N)\s*-\s*(?=[*A-Za-z])/i)[0].trim();

  return streetName + (num ? `, ${num}` : "") + (neigh ? ` - ${neigh}` : "");
}
