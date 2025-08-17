import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LanguageContextType {
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;
  t: (key: string) => string;
}

const translations = {
  ar: {
    // Header
    'site.name': 'منطوق',
    'site.tagline': 'مساعد قوانين المناقصات',
    'auth.login': 'تسجيل الدخول',
    'auth.start': 'ابدأ الآن',
    
    // Hero Section
    'hero.title': 'مرحباً بك في منطوق',
    'hero.subtitle': 'مساعدك القانوني الذكي المتخصص في قوانين المناقصات القطرية',
    'hero.description': 'احصل على استشارات قانونية فورية ودقيقة حول قوانين المناقصات والعطاءات في دولة قطر مدعومة بأحدث تقنيات الذكاء الاصطناعي',
    'hero.start_chat': 'ابدأ المحادثة الآن',
    'hero.learn_more': 'تعرف على المزيد',
    
    // Features
    'features.title': 'لماذا تختار منطوق للمناقصات؟',
    'features.subtitle': 'المزج المثالي بين الخبرة القانونية والذكاء الاصطناعي في مجال المناقصات القطرية',
    'features.legal_expertise.title': 'خبرة قانونية متخصصة',
    'features.legal_expertise.desc': 'معرفة عميقة بقوانين المناقصات القطرية ولوائح الشراء الحكومي والأحكام القضائية ذات الصلة',
    'features.qatar_law.title': 'قوانين قطر المحدثة',
    'features.qatar_law.desc': 'تحديث مستمر بأحدث التعديلات على قوانين المناقصات والعطاءات في دولة قطر',
    'features.instant_response.title': 'استجابة فورية ودقيقة',
    'features.instant_response.desc': 'احصل على إجابات قانونية فورية ومدروسة حول استفساراتك في مجال المناقصات',
    
    // Stats
    'stats.available': 'متاح دائماً',
    'stats.accuracy': 'دقة عالية',
    'stats.laws': 'قانون محدث',
    'stats.unlimited': 'استشارات لا محدودة',
    
    // CTA
    'cta.title': 'ابدأ رحلتك مع الاستشارة القانونية الذكية',
    'cta.subtitle': 'انضم إلى المحامين والشركات التي تثق في منطوق للحصول على استشارات المناقصات',
    'cta.join': 'احصل على استشارة الآن',
    
    // Footer
    'footer.copyright': '© 2024 منطوق. متخصص في قوانين المناقصات القطرية.'
  },
  en: {
    // Header
    'site.name': 'Mantooq',
    'site.tagline': 'Tender Laws Assistant',
    'auth.login': 'Login',
    'auth.start': 'Start Now',
    
    // Hero Section
    'hero.title': 'Welcome to Mantooq',
    'hero.subtitle': 'Your smart legal assistant specialized in Qatari tender laws',
    'hero.description': 'Get instant and accurate legal consultations on tender and procurement laws in the State of Qatar, powered by the latest AI technology',
    'hero.start_chat': 'Start Chat Now',
    'hero.learn_more': 'Learn More',
    
    // Features
    'features.title': 'Why Choose Mantooq for Tenders?',
    'features.subtitle': 'The perfect blend of legal expertise and artificial intelligence in Qatari tender laws',
    'features.legal_expertise.title': 'Specialized Legal Expertise',
    'features.legal_expertise.desc': 'Deep knowledge of Qatari tender laws, government procurement regulations, and related judicial rulings',
    'features.qatar_law.title': 'Updated Qatar Laws',
    'features.qatar_law.desc': 'Continuously updated with the latest amendments to tender and procurement laws in the State of Qatar',
    'features.instant_response.title': 'Instant & Accurate Response',
    'features.instant_response.desc': 'Get immediate and well-considered legal answers to your tender-related inquiries',
    
    // Stats
    'stats.available': 'Always Available',
    'stats.accuracy': 'High Accuracy',
    'stats.laws': 'Updated Law',
    'stats.unlimited': 'Unlimited Consultations',
    
    // CTA
    'cta.title': 'Start Your Journey with Smart Legal Consultation',
    'cta.subtitle': 'Join lawyers and companies who trust Mantooq for tender consultations',
    'cta.join': 'Get Consultation Now',
    
    // Footer
    'footer.copyright': '© 2024 Mantooq. Specialized in Qatari Tender Laws.'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['ar']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};