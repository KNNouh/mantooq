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
    'hero.title': 'مرحباً بك في منصة منطوق',
    'hero.subtitle': 'منصة قانونية متقدمة تعتمد على تقنيات الذكاء الاصطناعي، متخصصة في تحليل وتفسير أحكام قانون تنظيم المناقصات والمزايدات ولائحته التنفيذية في دولة قطر.',
    'hero.description': 'إجابات قانونية موثوقة وفورية تركز على النصوص الرسمية، وتعتمد على أحدث تقنيات الذكاء الاصطناعي لضمان الشفافية وتعزيز الامتثال القانوني.',
    'hero.start_chat': 'ابدأ المحادثة الآن',
    'hero.learn_more': 'تعرف على المزيد',
    
    // Features
    'features.title': 'منصة مبتكرة تجمع بين المعرفة القانونية العميقة والتقنيات الحديثة في الذكاء الاصطناعي لتوفير مرجع موثوق في مجال المناقصات القطرية.',
    'features.subtitle': '',
    'features.legal_expertise.title': 'معرفة قانونية متخصصة',
    'features.legal_expertise.desc': 'معرفة معمقة بقانون تنظيم المناقصات والمزايدات في دولة قطر ولائحته التنفيذية والقرارات ذات الصلة.',
    'features.qatar_law.title': 'تشريعات محدثة باستمرار',
    'features.qatar_law.desc': 'تحديث دوري يواكب أحدث التعديلات الصادرة على القوانين واللوائح التنفيذية والتعاميم الرسمية.',
    'features.instant_response.title': 'إجابات دقيقة وفورية',
    'features.instant_response.desc': 'توفير إجابات قانونية موثوقة وسريعة استناداً إلى النصوص الرسمية والتشريعات المعتمدة.',
    
    // Stats (updated to remove the third stat)
    'stats.available': 'متاح دائماً',
    'stats.accuracy': 'دقة عالية',
    'stats.unlimited': 'استشارات لا محدودة',
    
    // CTA (removed content as requested)
    'cta.title': '',
    'cta.subtitle': '',
    'cta.join': '',
    
    // Footer
    'footer.copyright': '© 2024 منطوق. متخصص في قوانين المناقصات القطرية.',
    
    // Chat Interface
    'chat.history': 'سجل المحادثات',
    'chat.new': 'محادثة جديدة',
    'chat.max_reached': 'الحد الأقصى',
    'chat.open_in_tab': 'مفتوح في التبويب',
    'chat.assistant': 'منطوق',
    'chat.upload': 'رفع ملف',
    'chat.thinking': 'جاري التفكير...',
    'chat.type_message': 'اكتب رسالتك...',
    'chat.send': 'إرسال',
    'chat.welcome': 'مرحباً بك في منطوق',
    'chat.welcome_desc': 'يمكنك فتح حتى',
    'chat.conversations_simultaneously': 'محادثات في نفس الوقت',
    'chat.click_new_chat': 'اضغط على "محادثة جديدة" أو اختر محادثة من الشريط الجانبي للبدء',
    'chat.start_new': 'بدء محادثة جديدة',
    'chat.tabs': 'التبويبات',
    
    // Out of scope response
    'chat.out_of_scope': 'نود تنبيهك بأن خدمات المنصة تقتصر على الإجابة عن الاستفسارات المتعلقة بقانون المناقصات والمزايدات ولائحته التنفيذية، والقرارات ذات الصلة.\n\nنرجو إعادة صياغة سؤالك ضمن هذا الإطار لنتمكن من مساعدتك بدقة.',
    
    // About section content
    'about.platform_intro': 'نبذة عن منصة منطوق',
    'about.platform_desc': '(منطوق) هي منصة رقمية ذكية متخصصة في تقديم الإجابات القانونية الموثوقة للاستفسارات المتعلقة بقانون تنظيم المناقصات والمزادات بدولة قطر ولائحته التنفيذية والقرارات والتعاميم ذات الصلة. وقد صُممت المنصة لتكون أداة مرجعية داعمة لموظفي الجهات الحكومية، وأعضاء لجان المناقصات، بما يعزز فاعلية الأداء الرقابي، ويرسخ مبادئ الكفاءة والامتثال للضوابط القانونية في بيئة العمل المؤسسي.\n\nوتستند(منطقوق) في بنيتها إلى تقنيات متقدمة في الذكاء الاصطناعي، تتيح تحليل الأسئلة المطروحة بدقة واسترجاع النصوص القانونية ذات الصلة مباشرة من مصادرها الرسمية، مع الالتزام بمعايير عالية من الدقة، والموثوقية، والشفافية في تقديم المحتوى القانوني.',
    'about.why_mantqooq': 'لماذا منطوق ؟',
    'about.why_desc': 'تم اعتماد اسم (منطقوق) ليعكس بصورة دقيقة طبيعة عمل المنصة ورسالتها، حيث يُستخدم مصطلح "المنطقوق" في السياق القانوني للدلالة على الجزء الصريح والواضح من النص أو الحكم، وهو ما نص عليه المشرّع أو القاضي بشكل واضح لا يعتريه لبس أو تأويل.\n\nويجسد هذا المعنى جوهر أهداف المنصة، المتمثل في تقديم إجابات قانونية دقيقة وموثوقة، مستندة إلى النصوص الرسمية لقانون تنظيم المناقصات والمزادات ولائحته التنفيذية، وبأسلوب يضمن وضوح المعلومة وصحتها.',
    'about.meaning_title': 'وتحمل تسمية (منطوق) الدلالات التالية:',
    'about.meaning.clarity': 'الوضوح: عرض النصوص القانونية كما وردت في مصادرها الرسمية.',
    'about.meaning.accuracy': 'الدقة: الالتزام بالتفسير الصحيح المتفق مع مراد المشرّع.',
    'about.meaning.reliability': 'الموثوقية: الاعتماد على المصادر الرسمية والمعتمدة في دولة قطر.',

    // Realtime connection status
    'realtime.connected': 'متصل',
    'realtime.connecting': 'جاري الاتصال...',
    'realtime.disconnected': 'منقطع',
    'realtime.error': 'خطأ في الاتصال',
    'realtime.retry': 'محاولة',
    'realtime.reconnect': 'إعادة الاتصال',
    'about.commitment': 'وعليه، فإن اسم (منطق) يعبر عن التزام المنصة بتقديم المعرفة القانونية وفق أعلى معايير النزاهة والشفافية، وبما يسهم في دعم الجهات الحكومية وأعضاء لجان المناقصات في أداء مهامهم بكفاءة وامتثال تام لأحكام القانون.',
    'about.features_title': 'مزايا المنصة',
    'about.features.ui': 'واجهة استخدام مبسطة باللغة العربية.',
    'about.features.search': 'محرك بحث قانوني دقيق مبني على الذكاء الاصطناعي.',
    'about.features.coverage': 'تغطية شاملة لقانون تنظيم المناقصات والمزايدات بدولة قطر ولائحته التنفيذية.',
    'about.features.updates': 'إمكانية التحديث وفق تعديلات على القانون أو اللائحة التنفيذية أو التعاميم الصادرة في هذا الشأن.',
    'about.features.support': 'دعم فني موجه لأعضاء لجنة المناقصات والمزايدات.',
    'about.usage_title': 'الاستخدامات المقترحة',
    'about.usage.meetings': 'مرجع ذكي أثناء اجتماعات لجان المناقصات.',
    'about.usage.audit': 'أداة مساعدة في التدقيق القانوني السريع.',
    'about.usage.decision': 'دعم اتخاذ القرار لدى الجهات الرقابية.',
    'about.usage.compliance': 'تعزيز ثقافة الالتزام القانوني داخل المؤسسات الحكومية.',
    
     // Navigation
    'nav.admin': 'الإدارة',
    'auth.signout': 'تسجيل الخروج',
    
    // Delete conversation
    'delete.conversation': 'حذف المحادثة',
    'delete.confirm.title': 'تأكيد الحذف',
    'delete.confirm.message': 'هل أنت متأكد من حذف هذه المحادثة؟ سيتم حذف جميع الرسائل نهائياً ولن يمكن استردادها.',
    'delete.confirm.cancel': 'إلغاء',
    'delete.confirm.delete': 'حذف',
    'delete.success': 'تم حذف المحادثة بنجاح',
    'delete.error': 'حدث خطأ في حذف المحادثة'
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
    'footer.copyright': '© 2024 Mantooq. Specialized in Qatari Tender Laws.',
    
    // Realtime connection status
    'realtime.connected': 'Connected',
    'realtime.connecting': 'Connecting...',
    'realtime.disconnected': 'Disconnected', 
    'realtime.error': 'Connection Error',
    'realtime.retry': 'Attempt',
    'realtime.reconnect': 'Reconnect',
    
    // Chat Interface
    'chat.history': 'Chat History',
    'chat.new': 'New Chat',
    'chat.max_reached': 'Max reached',
    'chat.open_in_tab': 'Open in tab',
    'chat.assistant': 'Chat Assistant',
    'chat.upload': 'Upload',
    'chat.thinking': 'Thinking...',
    'chat.type_message': 'Type your message...',
    'chat.send': 'Send',
    'chat.welcome': 'Welcome to Mantooq',
    'chat.welcome_desc': 'You can open up to',
    'chat.conversations_simultaneously': 'conversations simultaneously',
    'chat.click_new_chat': 'Click "New Chat" or select a conversation from the sidebar to get started',
    'chat.start_new': 'Start New Conversation',
    'chat.tabs': 'Tabs',
    
     // Navigation
    'nav.admin': 'Admin',
    'auth.signout': 'Sign Out',
    
    // Delete conversation
    'delete.conversation': 'Delete Conversation',
    'delete.confirm.title': 'Confirm Delete',
    'delete.confirm.message': 'Are you sure you want to delete this conversation? All messages will be permanently deleted and cannot be recovered.',
    'delete.confirm.cancel': 'Cancel',
    'delete.confirm.delete': 'Delete',
    'delete.success': 'Conversation deleted successfully',
    'delete.error': 'Error deleting conversation'
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