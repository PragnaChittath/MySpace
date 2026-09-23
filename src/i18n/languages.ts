export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  region: 'Indian' | 'International';
  script?: string;
  direction?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  // Indian Languages (23)
  { code: 'en', name: 'English', nativeName: 'English', region: 'Indian', direction: 'ltr' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', region: 'Indian', direction: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'Indian', direction: 'ltr' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'Indian', direction: 'ltr' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', region: 'Indian', direction: 'ltr' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', region: 'Indian', direction: 'ltr' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'Indian', direction: 'ltr' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', region: 'Indian', direction: 'ltr' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', region: 'Indian', direction: 'ltr' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', region: 'Indian', direction: 'ltr' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', region: 'Indian', direction: 'ltr' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', region: 'Indian', direction: 'ltr' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', region: 'Indian', direction: 'rtl' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', region: 'Indian', direction: 'ltr' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', region: 'Indian', direction: 'ltr' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', region: 'Indian', direction: 'ltr' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'कॉशुर', region: 'Indian', direction: 'ltr' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي / सिन्धी', region: 'Indian', direction: 'ltr' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', region: 'Indian', direction: 'ltr' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', region: 'Indian', direction: 'ltr' },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', region: 'Indian', direction: 'ltr' },
  { code: 'mni', name: 'Manipuri / Meitei', nativeName: 'মৈতৈলোন্', region: 'Indian', direction: 'ltr' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ / संताली', region: 'Indian', direction: 'ltr' },

  // Major International Languages (19)
  { code: 'es', name: 'Spanish', nativeName: 'Español', region: 'International', direction: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', region: 'International', direction: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', region: 'International', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', region: 'International', direction: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', region: 'International', direction: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', region: 'International', direction: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', region: 'International', direction: 'rtl' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', region: 'International', direction: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', region: 'International', direction: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', region: 'International', direction: 'ltr' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', region: 'International', direction: 'ltr' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', region: 'International', direction: 'ltr' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', region: 'International', direction: 'ltr' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', region: 'International', direction: 'ltr' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', region: 'International', direction: 'ltr' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', region: 'International', direction: 'ltr' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', region: 'International', direction: 'ltr' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', region: 'International', direction: 'rtl' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', region: 'International', direction: 'ltr' }
];

export const DEFAULT_LANGUAGE = 'en';

export function getLanguageInfo(code: string): LanguageInfo {
  const found = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return found || SUPPORTED_LANGUAGES[0];
}
