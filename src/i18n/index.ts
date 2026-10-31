// All user-facing strings come from translation files (R-I18N-01); v1 ships English and Hindi (R-I18N-02).
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import hi from './hi.json';

export const LANGUAGES = ['en', 'hi'] as const;

// eslint-disable-next-line import/no-named-as-default-member -- configuring the default instance
void i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18next;
