import type { getStats } from './db.js';

export interface LeadForMessage {
  id?: number;
  name: string;
  phone: string;
  email?: string | null;
  service?: string | null;
  message?: string | null;
  created_at?: string;
}

export function formatLeadMessage(lead: LeadForMessage) {
  const lines = [
    '🔔 <b>Новая заявка с сайта</b>',
    '',
    lead.id ? `#${lead.id}` : '',
    `👤 <b>Имя:</b> ${escapeHtml(lead.name)}`,
    `📞 <b>Телефон:</b> ${escapeHtml(lead.phone)}`,
  ].filter(Boolean);

  if (lead.email) lines.push(`✉️ <b>Email:</b> ${escapeHtml(lead.email)}`);
  if (lead.service) lines.push(`🏗 <b>Направление:</b> ${escapeHtml(lead.service)}`);
  if (lead.message) lines.push(`💬 <b>Сообщение:</b> ${escapeHtml(lead.message)}`);
  if (lead.created_at) lines.push(`🕒 <b>Время:</b> ${escapeHtml(lead.created_at)}`);

  return lines.join('\n');
}

export function formatStatsMessage(stats: ReturnType<typeof getStats>) {
  const periodLabel = stats.period === 'today' ? 'сегодня' : stats.period === 'week' ? '7 дней' : '30 дней';
  const services = stats.leads.byService.length
    ? stats.leads.byService.map(item => `• ${escapeHtml(item.service)}: ${item.count}`).join('\n')
    : '• Пока нет заявок по направлениям';
  const sections = stats.topSections.length
    ? stats.topSections.slice(0, 5).map(item => `• ${escapeHtml(item.section)}: ${item.count}`).join('\n')
    : '• Пока нет активных секций';

  return [
    `📊 <b>Статистика за ${periodLabel}</b>`,
    '',
    `👥 Визиты: <b>${stats.traffic.visits}</b>`,
    `👤 Уникальные: <b>${stats.traffic.uniqueVisitors}</b>`,
    `📝 Заявки: <b>${stats.leads.period}</b>`,
    `🎯 Конверсия: <b>${stats.engagement.conversionRate}%</b>`,
    `🔘 Клики по кнопкам: <b>${stats.engagement.ctaClicks}</b>`,
    `📜 Средний скролл: <b>${stats.engagement.averageScrollDepth}%</b>`,
    '',
    '<b>Направления:</b>',
    services,
    '',
    '<b>Активные секции:</b>',
    sections,
  ].join('\n');
}

export function formatLeadList(leads: LeadForMessage[]) {
  if (!leads.length) return 'Заявок пока нет.';

  return leads.map((lead) => [
    `#${lead.id} — ${escapeHtml(lead.created_at || '')}`,
    `👤 ${escapeHtml(lead.name)} — ${escapeHtml(lead.phone)}`,
    lead.service ? `🏗 ${escapeHtml(lead.service)}` : '',
    lead.message ? `💬 ${escapeHtml(trimText(lead.message, 120))}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
}

export function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trimText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
