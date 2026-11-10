const fcpcUfcGovernanceExamUrl =
  "https://www.qconcursos.com/questoes-de-concursos/provas/fcpc-2025-ufc-analista-de-tecnologia-da-informacao-area-governanca-de-ti/questoes?exclude_nullified=false&exclude_outdated=false";

function normalizeForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function qconcursosUrl(query: string, subjectName?: string): string {
  if (
    subjectName &&
    normalizeForMatching(subjectName) ===
      normalizeForMatching("Governança de TI e de Dados")
  ) {
    return fcpcUfcGovernanceExamUrl;
  }

  const url = new URL("https://www.qconcursos.com/nova-busca");
  url.searchParams.set("q", query);
  return url.toString();
}
