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
  if (lead.service) lines.push(`🏗 <b>Направление:</b> ${escapeHtml(formatServiceLabel(lead.service))}`);
  if (lead.message) lines.push(`💬 <b>Сообщение:</b> ${escapeHtml(lead.message)}`);
  if (lead.created_at) lines.push(`🕒 <b>Время:</b> ${escapeHtml(lead.created_at)}`);

  return lines.join('\n');
}

export function formatStatsMessage(stats: ReturnType<typeof getStats>) {
  const periodLabel = stats.period === 'today' ? 'сегодня' : stats.period === 'week' ? '7 дней' : '30 дней';
  const services = stats.leads.byService.length
    ? stats.leads.byService.map(item => `• ${escapeHtml(formatServiceLabel(item.service))}: ${item.count}`).join('\n')
    : '• Пока нет заявок по направлениям';
  const sections = stats.topSections.length
    ? stats.topSections.slice(0, 5).map(item => `• ${escapeHtml(formatSectionLabel(item.section))}: ${item.count}`).join('\n')
    : '• Пока нет активных блоков';

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
    '<b>Где чаще смотрели:</b>',
    sections,
  ].join('\n');
}

export function formatSectionLabel(section: string | null | undefined) {
  const labels: Record<string, string> = {
    hero: 'Главный экран',
    about: 'О компании',
    projects: 'Проекты',
    agclub: 'AG Club Villas',
    services: 'Услуги',
    advantages: 'Преимущества',
    contacts: 'Контакты',
    contact: 'Контакты',
  };
  const key = String(section || '').trim().toLowerCase();
  return labels[key] || section || 'Блок сайта';
}

export function formatServiceLabel(service: string | null | undefined) {
  const labels: Record<string, string> = {
    construction: 'Строительство',
    design: 'Дизайн и реализация',
    land: 'Участки и недвижимость',
    tourism: 'Туристический бизнес под ключ',
    architecture: 'Архитектура',
    investment: 'Инвестиции',
    investments: 'Инвестиции',
    complex: 'Комплексный проект',
    contact: 'Контактная форма',
  };
  const key = String(service || '').trim().toLowerCase();
  return labels[key] || service || 'Не указано';
}

export function formatLeadList(leads: LeadForMessage[]) {
  if (!leads.length) return 'Заявок пока нет.';

  return leads.map((lead) => [
    `#${lead.id} — ${escapeHtml(lead.created_at || '')}`,
    `👤 ${escapeHtml(lead.name)} — ${escapeHtml(lead.phone)}`,
    lead.service ? `🏗 ${escapeHtml(formatServiceLabel(lead.service))}` : '',
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

export function humanizeSiteTerms(text: string) {
  return cleanAssistantText(text)
    .replace(/\bhero\b/gi, 'Главный экран')
    .replace(/\babout\b/gi, 'О компании')
    .replace(/\bprojects\b/gi, 'Проекты')
    .replace(/\bagclub\b/gi, 'AG Club Villas')
    .replace(/\bservices\b/gi, 'Услуги')
    .replace(/\badvantages\b/gi, 'Преимущества')
    .replace(/\bcontacts?\b/gi, 'Контакты')
    .replace(/\bsection\b/gi, 'блок сайта')
    .replace(/\bsections\b/gi, 'блоки сайта');
}

function cleanAssistantText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
