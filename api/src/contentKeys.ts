export type ContentType = 'text' | 'html' | 'url';

export interface ContentKeyDefinition {
  key: string;
  label: string;
  section: string;
  type: ContentType;
  defaultValue: string;
}

export interface MediaKeyDefinition {
  key: string;
  label: string;
  section: string;
}

export const contentKeys: ContentKeyDefinition[] = [
  {
    key: 'hero_title',
    label: 'Главный заголовок',
    section: 'hero',
    type: 'text',
    defaultValue: 'Создаём ценность.\nУправляем будущим.',
  },
  {
    key: 'hero_subtitle',
    label: 'Подзаголовок',
    section: 'hero',
    type: 'text',
    defaultValue: 'Девелопмент полного цикла от идеи до управления.',
  },
  {
    key: 'hero_cta',
    label: 'Текст кнопки',
    section: 'hero',
    type: 'text',
    defaultValue: 'Связаться',
  },
  {
    key: 'about_title',
    label: 'Заголовок “О компании”',
    section: 'about',
    type: 'text',
    defaultValue: 'Экспертность на каждом этапе',
  },
  {
    key: 'about_text',
    label: 'Текст “О компании”',
    section: 'about',
    type: 'text',
    defaultValue: 'Я верю, что недвижимость — это не просто квадратные метры, а сложная экосистема, где пересекаются смелая архитектура, строгий финансовый расчет и комфорт будущего.',
  },
  {
    key: 'contacts_title',
    label: 'Заголовок контактов',
    section: 'contacts',
    type: 'text',
    defaultValue: 'Обсудим ваш проект',
  },
  {
    key: 'contacts_phone',
    label: 'Телефон',
    section: 'contacts',
    type: 'text',
    defaultValue: '+79881590888',
  },
  {
    key: 'contacts_telegram',
    label: 'Telegram',
    section: 'contacts',
    type: 'text',
    defaultValue: 'designlove5',
  },
  {
    key: 'contacts_whatsapp',
    label: 'WhatsApp',
    section: 'contacts',
    type: 'text',
    defaultValue: '+79881590888',
  },
];

export const mediaKeys: MediaKeyDefinition[] = [
  { key: 'hero_bg', label: 'Главное фото', section: 'hero' },
  { key: 'about_photo', label: 'Фото “О компании”', section: 'about' },
  { key: 'contacts_bg', label: 'Фото контактов', section: 'contacts' },
];

export function findContentKey(key: string) {
  return contentKeys.find((item) => item.key === key);
}

export function findMediaKey(key: string) {
  return mediaKeys.find((item) => item.key === key);
}
