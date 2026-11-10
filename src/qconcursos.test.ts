import { describe, expect, it } from "vitest";
import { qconcursosUrl } from "./qconcursos";

describe("qconcursosUrl", () => {
  it("opens the matching UFC/FCPC exam question list directly", () => {
    expect(
      qconcursosUrl(
        "Governança de TI: conceitos, alinhamento e avaliação",
        "Governança de TI e de Dados",
      ),
    ).toBe(
      "https://www.qconcursos.com/questoes-de-concursos/provas/fcpc-2025-ufc-analista-de-tecnologia-da-informacao-area-governanca-de-ti/questoes?exclude_nullified=false&exclude_outdated=false",
    );
  });

  it("searches other subjects and topics across contests", () => {
    expect(qconcursosUrl("Modelagem relacional", "Banco de Dados")).toBe(
      "https://www.qconcursos.com/nova-busca?q=Modelagem+relacional",
    );
  });
});
