import { createAiReport, getStats, type StatsPeriod } from './db.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export interface AiReportResult {
  period: StatsPeriod;
  model: string;
  report: string;
  stats: ReturnType<typeof getStats>;
  saved: boolean;
}

export async function generateAiReport(period: StatsPeriod = 'week'): Promise<AiReportResult> {
  const stats = getStats(period);
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const model = process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_MODEL;
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || DEFAULT_BASE_URL);

  if (!apiKey) {
    const report = buildFallbackReport(stats);
    createAiReport(period, stats, report, 'fallback');
    return { period, model: 'fallback', report, stats, saved: true };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Ты веб-аналитик сайта премиального девелопмента INTEGRA KOTOVA. Отвечай кратко, по-русски, только по данным. Не выдумывай факты. Дай выводы и конкретные действия для улучшения сайта.',
        },
        {
          role: 'user',
          content: `Проанализируй агрегированную статистику сайта за период ${period}. Персональных данных нет. Данные: ${JSON.stringify(stats)}`,
        },
      ],
      max_tokens: 900,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await response.json() as ChatCompletionResponse;
  const report = extractOutputText(data) || buildFallbackReport(stats);
  createAiReport(period, stats, report, model);

  return { period, model, report, stats, saved: true };
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
}

function extractOutputText(data: ChatCompletionResponse) {
  const firstChoice = data.choices?.[0];
  return (firstChoice?.message?.content || firstChoice?.text || '').trim();
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function buildFallbackReport(stats: ReturnType<typeof getStats>) {
  const lines = [
    `🤖 AI-аналитика за период: ${stats.period}`,
    '',
    `• Визиты: ${stats.traffic.visits}`,
    `• Уникальные посетители: ${stats.traffic.uniqueVisitors}`,
    `• Заявки: ${stats.leads.period}`,
    `• Конверсия в заявку: ${stats.engagement.conversionRate}%`,
    `• Клики по кнопкам: ${stats.engagement.ctaClicks}`,
    `• Средний скролл: ${stats.engagement.averageScrollDepth}%`,
    '',
    'Рекомендации:',
  ];

  if (stats.traffic.visits === 0) {
    lines.push('• Пока нет данных по визитам. Нужно накопить статистику минимум за несколько дней.');
  } else if (stats.leads.period === 0) {
    lines.push('• Заявок пока нет: проверьте заметность формы, кнопок Telegram/WhatsApp и первый экран.');
  } else {
    lines.push('• Есть заявки: усиливайте самые кликабельные направления и повторяйте удачные CTA в ключевых секциях.');
  }

  if (stats.engagement.averageScrollDepth && stats.engagement.averageScrollDepth < 50) {
    lines.push('• Средний скролл низкий: стоит усилить первый экран и быстрее показать выгоды/проекты.');
  }

  if (stats.topSections.length) {
    lines.push(`• Самая активная секция: ${stats.topSections[0].section}. Её можно использовать как основу для улучшения других блоков.`);
  }

  return lines.join('\n');
}
