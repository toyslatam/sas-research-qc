import OpenAI from 'openai';
import type { Category, MatchResult, Question } from '@whispper/shared';
import { config } from '../config';
import { coerceToText } from '../utils/coerceText';

const MATCH_SYSTEM_PROMPT = `Eres un analista de investigación de mercado experto en entrevistas cualitativas en español.

Tu tarea: extraer respuestas del entrevistado a partir de la transcripción, alineándolas con las INTENCIONES del cuestionario (no con el texto literal de la pregunta).

REGLAS DE MATCH SEMÁNTICO:
1. El entrevistador puede reformular, acortar o mezclar preguntas. El entrevistado puede responder sin que pregunten explícitamente.
2. Busca evidencia por TEMA: marcas, canal de compra, motivaciones, precio, satisfacción, etc. según la categoría de cada ítem del cuestionario.
3. Acepta respuestas indirectas: "suelo ir al Price" cuenta para "¿Dónde realiza la compra?"; "compro la roja" puede ser la marca si el contexto lo confirma.
4. Si el entrevistador hizo una pregunta compuesta y el entrevistado respondió solo una parte, extrae lo que corresponda a cada ítem del cuestionario.
5. Si no hay evidencia razonable en toda la transcripción, respuesta: "No mencionado" (confianza ≤ 0.3).
6. Extrae paráfrasis breve y fiel; opcionalmente una cita corta entre comillas si aporta claridad.
7. En "pregunta" usa SIEMPRE el texto exacto del cuestionario (campo pregunta del JSON de entrada).
8. Asigna la categoría del cuestionario. Incluye "confianza" 0–1 (≥0.8 solo con evidencia clara).

PREGUNTAS CON SUB_ITEMS (lista de puntos 2.1, 2.2, opciones múltiples o ítems a verificar):
- Evalúa CADA sub_item por separado en la transcripción.
- En "respuesta" usa viñetas, una por sub_item: "• [sub_item]: [qué dijo concretamente el entrevistado sobre ese punto]".
- No respondas solo "Mencionado". Si hay evidencia, escribe el contenido útil: tarifa, condición, responsable, país, plazo, alcance, excepción o cita breve.
- Si no hay evidencia para un sub_item, escribe exactamente: "• [sub_item]: No mencionado".
- Un solo objeto en preguntas[] por la pregunta principal (no dupliques la pregunta).

EJEMPLO:
- Cuestionario: "¿Qué marca compra habitualmente?"
- En la entrevista: "¿Cuál suele llevarse a casa?" / "La X, la del paquete azul"
- Respuesta válida: "Marca X" con confianza 0.85

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "entrevista": "<id>",
  "preguntas": [
    {
      "pregunta": "<texto exacto del cuestionario>",
      "respuesta": "<solo texto plano, nunca objeto ni array>",
      "categoria": "<categoria>",
      "confianza": 0.9
    }
  ]
}`;

/**
 * Match semántico transcripción ↔ cuestionario vía GPT.
 */
export class MatchService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY no configurada');
      this.client = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.client;
  }

  async extractAnswers(
    interviewId: string,
    transcript: string,
    questions: Question[],
    categories: Category[] = []
  ): Promise<MatchResult> {
    const catById = new Map(categories.map((c) => [c.id, c]));

    const questionnaire = questions.map((q, i) => {
      const cat = q.category_id ? catById.get(q.category_id) : undefined;
      const entry: Record<string, unknown> = {
        orden: i + 1,
        pregunta: q.text,
        categoria: q.category,
        tema: cat?.name ?? q.category,
        descripcion_tema: cat?.description ?? '',
      };
      if (q.sub_items?.length) {
        entry.tipo = 'lista_verificacion';
        entry.sub_items = q.sub_items;
      }
      return entry;
    });

    const userContent = JSON.stringify(
      {
        entrevista_id: interviewId,
        cuestionario: questionnaire,
        transcripcion: transcript.slice(0, 120000),
      },
      null,
      2
    );

    const completion = await this.getClient().chat.completions.create({
      model: config.openai.gptModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: MATCH_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analiza y extrae respuestas:\n${userContent}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('GPT no devolvió contenido para match');

    const parsed = JSON.parse(raw) as MatchResult;

    if (!parsed.preguntas || !Array.isArray(parsed.preguntas)) {
      throw new Error('Formato de match inválido: falta array preguntas');
    }

    parsed.entrevista = interviewId;
    parsed.preguntas = parsed.preguntas.map((p) => {
      const preguntaRaw = coerceToText(p.pregunta, 'Pregunta');
      const normalized = preguntaRaw.trim().toLowerCase();
      const q =
        questions.find((x) => x.text === preguntaRaw) ??
        questions.find((x) => x.text.trim().toLowerCase() === normalized);
      return {
        ...p,
        pregunta: q?.text ?? preguntaRaw,
        respuesta: coerceToText(p.respuesta, 'No mencionado'),
        categoria: coerceToText(p.categoria, q?.category ?? ''),
        confianza:
          typeof p.confianza === 'number' && !Number.isNaN(p.confianza) ? p.confianza : 0.75,
      };
    });
    return parsed;
  }
}

export const matchService = new MatchService();
