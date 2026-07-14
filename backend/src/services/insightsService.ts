import OpenAI from 'openai';
import type { InsightsResult, MatchResult } from '@whispper/shared';
import { config } from '../config';

const INSIGHTS_SYSTEM_PROMPT = `Eres un consultor senior de investigación de mercado.

Genera insights accionables a partir de la transcripción y las respuestas estructuradas de una entrevista.

Responde ÚNICAMENTE JSON con esta estructura exacta:
{
  "resumen_ejecutivo": "string (3-5 oraciones)",
  "principales_hallazgos": ["string"],
  "temas_recurrentes": ["string"],
  "sentimiento_general": "positivo|neutral|negativo|mixto",
  "palabras_clave": ["string"],
  "oportunidades_detectadas": ["string"]
}

Sé conciso. Máximo 5 ítems por lista. Idioma: español.`;

/**
 * Generación de insights ejecutivos con GPT.
 */
export class InsightsService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY no configurada');
      this.client = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.client;
  }

  async generate(transcript: string, match: MatchResult): Promise<InsightsResult> {
    const payload = {
      respuestas_estructuradas: match.preguntas,
      extracto_transcripcion: transcript.slice(0, 8000),
    };

    const completion = await this.getClient().chat.completions.create({
      model: config.openai.gptModel,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Genera insights:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('GPT no devolvió insights');

    return JSON.parse(raw) as InsightsResult;
  }
}

export const insightsService = new InsightsService();
