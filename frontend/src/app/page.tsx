'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HeroCross3D } from '@/components/hero-cross-3d'
import { HeroAlpha } from '@/components/hero-alpha-omega'
import {
  ArrowRight, BookOpen, BarChart3, Trophy,
  Users, Calendar, GraduationCap, Globe, Music,
  CheckCircle2, Star, ChevronRight, Cross, CalendarPlus,
  ClipboardCheck, Target, Award, Sparkles, Heart, Shield, Code2, SlidersHorizontal, Zap,
  Quote, Church, BookMarked, PlayCircle, Music2, Music3, FileMusic, Crown,
  Bell, Megaphone, UserCheck, Download, Layers, FileDown, GitBranch, Lock, Wifi
} from 'lucide-react'

// ─── CONTENT ────────────────────────────────────────────────────────────────

const content = {
  en: {
    meta: {
      title: 'COHEP | Coptic Orthodox Hymn Education Platform',
      description: 'Free, open-source platform to teach Coptic hymns, track student progress, engage parents, and preserve 1,700 years of Coptic Orthodox heritage.',
    },
    nav: {
      whyMatters: 'Why It Matters',
      curriculum: 'Curriculum',
      openSource: 'Open Source',
      community: 'Features',
      signIn: 'Sign In',
      getStarted: 'Register Your Church',
    },
    hero: {
      eyebrow: 'Free · Open-Source · Built for the Church',
      headline: 'Every child belongs\nin the Church.',
      quote: '"Children must feel the Church considers them members, not merely their parents\' companions."',
      quoteAttrib: '- H.G. Bishop Samuel',
      sub: 'Every church can teach authentic Coptic hymns, track progress, engage parents, and pass 1,700 years of living tradition forward.',
      cta1: 'Register Your Church',
      cta2: 'Explore the Platform',
    },
    stats: {
      items: [
        { value: '255+', label: 'Hymns in the library' },
        { value: '10', label: 'Levels of formation' },
        { value: '1,700', label: 'Years of living tradition' },
        { value: '100%', label: 'Free & open-source' },
      ],
    },
    challenge: {
      eyebrow: 'The Challenge',
      headline: 'Faithful servants. Fragile systems.',
      body: 'Every week, servants across the Coptic world teach hymns from memory, track students on paper, and rely on WhatsApp groups to keep parents informed. They are faithful. But the system was never built to support them.\n\nWhen a servant burns out, the knowledge goes with them. When a child falls behind, no one knows. When a parent cannot see what their child is learning, belonging is quietly lost.\n\nThis is not a failure of faith. It is a failure of infrastructure.',
    },
    solution: {
      eyebrow: 'The Response',
      headline: 'That\'s why COHEP exists.',
      body: 'COHEP is not software. It is a ministry. A free, open-source platform built by the Coptic Orthodox community to give every servant the tools they need: without cost, without complexity, without compromise.\n\nThe Church is the teacher. The servant is the hero. COHEP simply holds the records, tracks the progress, and keeps the threads from fraying.',
      cta: 'Explore the Platform',
    },
    vision: {
      eyebrow: 'Vision',
      headline: 'One global community of churches, one living tradition.',
      body: 'Imagine thousands of Coptic churches around the world (from Cairo to Sydney, from Los Angeles to London) sharing a single curriculum, collaborating on hymn recordings, and tracking the spiritual growth of an entire generation. Not as a corporation. As a Church.\n\nThat is what COHEP is building toward.',
    },
    audience: {
      eyebrow: 'Who COHEP Serves',
      headline: 'One platform. Every calling.',
      cards: [
        {
          icon: Church,
          title: 'Bishops & Priests',
          sub: 'For those who lead',
          desc: 'Oversee hymn education across your entire diocese. Approve curricula, monitor progress, and ensure every church under your care is building on the same authentic foundation.',
          features: ['Diocese-wide oversight', 'Curriculum approval', 'Multi-church analytics', 'Servant management'],
        },
        {
          icon: Users,
          title: 'Servants & Hymn Teachers',
          sub: 'For those who teach',
          desc: 'Plan every lesson, mark attendance, assess students, and track progress, all in one place. Spend your energy on teaching, not on paperwork.',
          features: ['Lesson planning', 'Attendance tracking', 'Oral & written assessments', 'Progress dashboards'],
        },
        {
          icon: Heart,
          title: 'Parents',
          sub: 'For those who raise',
          desc: 'Watch your child\'s spiritual journey unfold. See their attendance, progress, earned badges, and certificates through a dedicated parent portal.',
          features: ['Real-time progress', 'Attendance alerts', 'Badges & certificates', 'Church announcements'],
        },
        {
          icon: Star,
          title: 'Students',
          sub: 'For those who learn',
          desc: 'Learn hymns, earn XP, climb the leaderboard, and discover your place in the Body of Christ. Every lesson is a step toward belonging.',
          features: ['Gamified learning', 'XP & badges', 'Hymn library access', 'Coptic language study'],
        },
      ],
    },
    curriculum: {
      eyebrow: 'Educational Journey',
      headline: '10 levels. A lifetime of worship.',
      sub: 'From the Coptic alphabet to leading Tasbeha: a complete, structured journey from beginner to certified hymn teacher.',
      levels: [
        { range: '1-3', title: 'Foundation', desc: 'Basic hymns, Coptic alphabet, and liturgical introduction', icon: Music2 },
        { range: '4-6', title: 'Intermediate', desc: 'Complex melodies, rites study, and Coptic grammar', icon: Music3 },
        { range: '7-8', title: 'Advanced', desc: 'Liturgical analysis, advanced hymns, and theology', icon: FileMusic },
        { range: '9-10', title: 'Mastery', desc: 'Leadership training, teaching methods, and certification', icon: Crown },
      ],
    },
    pillars: {
      eyebrow: 'What Every Child Deserves to Know',
      headline: 'Three pillars of Coptic heritage.',
      sub: 'A complete curriculum covering hymns, rites, and language: the living foundation of 1,700 years of unbroken tradition.',
      items: [
        {
          icon: Music,
          title: 'Coptic Hymns',
          desc: '255+ hymns (Doxologies, Tasbeha, Liturgical Responses, and seasonal hymns) with Coptic script, transliteration, and audio guides.',
          list: ['Doxologies', 'Tasbeha hymns', 'Seasonal hymns', 'Liturgical responses'],
        },
        {
          icon: Cross,
          title: 'Church Rites',
          desc: 'Understand the structure and theology of Coptic liturgical rites and sacraments through structured, progressive study.',
          list: ['Holy Liturgy', 'Baptism rite', 'Wedding rite', 'Funeral rite'],
        },
        {
          icon: BookOpen,
          title: 'Coptic Language',
          desc: 'From the alphabet to grammar to fluency: master the language that connects every believer to the original voice of the Church.',
          list: ['Coptic alphabet', 'Grammar rules', 'Vocabulary', 'Reading practice'],
        },
      ],
    },
    formation: {
      eyebrow: 'Formation, Not Just Education',
      headline: 'A child who sings "Khere Ne Maria" today will teach it to the next generation.',
      body: 'COHEP tracks more than grades. It tracks growth in knowledge, participation, and love for the Church. Every lesson is one more thread in the tapestry of a life formed by worship.\n\nEvery child in your church deserves to know these hymns. Not because they have to. Because they belong.',
    },
    howItWorks: {
      eyebrow: 'How It Works',
      headline: 'From registration to teaching in minutes.',
      steps: [
        { num: '01', icon: Church, title: 'Register your church', desc: 'Create your church profile and set up your academic year. Takes about 5 minutes.' },
        { num: '02', icon: BookMarked, title: 'Customize your curriculum', desc: 'Choose hymns, set levels, and assign lessons. The platform handles the scheduling.' },
        { num: '03', icon: Users, title: 'Invite your servants', desc: 'Add servants, assign them to groups, and give them the tools to teach.' },
        { num: '04', icon: Award, title: 'Teach and track growth', desc: 'Mark attendance, assess students, and watch them earn XP, badges, and certificates.' },
      ],
    },
    openSource: {
      eyebrow: 'Free. Open. Ours. Forever.',
      headline: 'Built by the community, owned by the Church.',
      sub: 'COHEP is open-source. Every line of code belongs to the Church. No investors, no paywalls, no vendor lock-in, ever.',
      items: [
        { icon: Heart, title: 'Free forever', desc: 'No paywalls, no hidden costs, no credit card. Always free for every church, everywhere.' },
        { icon: Code2, title: 'Fully open-source', desc: 'Browse, audit, and contribute on GitHub. Transparency is built into every feature.' },
        { icon: Shield, title: 'Your data stays yours', desc: 'Self-host or use our cloud. Your data belongs to your church, not to us.' },
        { icon: SlidersHorizontal, title: 'Fully customizable', desc: 'Adapt curricula, hymns, roles, and pacing to your church\'s specific tradition.' },
        { icon: Globe, title: 'Community-governed', desc: 'Built by Coptic developers, servants, and clergy worldwide. The community decides the roadmap.' },
        { icon: GitBranch, title: 'Contribute freely', desc: 'Code, translations, hymn data, curriculum design: all contributions are welcome on GitHub.' },
      ],
      cta: 'View on GitHub',
    },
    features: {
      eyebrow: 'Platform Capabilities',
      headline: 'Everything a church needs to teach hymns well.',
      groups: [
        {
          title: 'Teaching & Curriculum',
          icon: BookOpen,
          items: ['Structured curriculum management', 'Academic calendar', 'Weekly lesson planning', 'Hymn library (255+ hymns)', 'Coptic language lessons', 'Church rites & rituals', 'Audio recordings & videos', 'PowerPoint lessons', 'PDF resources'],
        },
        {
          title: 'Student & Parent',
          icon: Users,
          items: ['Student management', 'Parent portal', 'Attendance tracking', 'Gamification (XP, badges, certificates)', 'Progress tracking', 'Oral & written exams', 'Practical hymn recitation', 'Audio/video submissions', 'Notifications & announcements'],
        },
        {
          title: 'Administration',
          icon: BarChart3,
          items: ['Church hierarchy', 'Multi-role security', 'Curriculum allocation', 'Analytics & dashboards', 'Reporting', 'PDF/Excel exports', 'Church events & feast management', 'Pending registration approval', 'Multi-church oversight'],
        },
      ],
    },
    faq: [
      { q: 'Is COHEP really free?', a: 'Yes. COHEP is completely free and open-source. No paywalls, no premium tiers, no hidden fees. It is a ministry, not a business.' },
      { q: 'Do I need technical skills to set it up?', a: 'Not at all. COHEP is designed for servants and clergy of any technical background. If you can use a web browser, you can use COHEP. Setup takes about 5 minutes.' },
      { q: 'Is my church\'s data secure?', a: 'Yes. COHEP is open-source so security can be audited by anyone. Your data is encrypted and belongs entirely to your church. Self-hosting is always an option.' },
      { q: 'Can I customize the curriculum for my tradition?', a: 'Absolutely. Every church can customize levels, hymns, and pacing. You follow your tradition while benefiting from a shared global structure.' },
      { q: 'Who maintains COHEP?', a: 'COHEP is maintained by a community of Coptic Orthodox developers, servants, and clergy. The roadmap is community-driven and transparent.' },
      { q: 'Can our diocese manage multiple churches?', a: 'Yes. COHEP has full multi-church support with diocese-level oversight, allowing bishops and administrators to manage multiple churches from one account.' },
      { q: 'What languages are supported?', a: 'English and Arabic are supported today. The architecture supports adding more languages, and we welcome translation contributions from the community.' },
      { q: 'Does it work on phones and tablets?', a: 'Yes. COHEP works on any device: phone, tablet, or computer. The interface is fully responsive and designed to be used in the classroom.' },
    ],
    cta: {
      headline: 'The Church\'s heritage.\nYour children\'s future.',
      sub: 'Join hundreds of servants already using COHEP to preserve Coptic heritage and form the next generation of faithful worshippers.',
      btn1: 'Register Your Church',
      btn2: 'Explore the Platform',
      btn3: 'View on GitHub',
      trust: 'Free forever · No credit card · Open-source',
    },
    footer: {
      tagline: 'Free, open-source Coptic Orthodox hymn education.',
      copyright: '© 2026 Coptic Orthodox Hymn Education Platform (COHEP). All rights reserved.',
      newsletter: 'Stay updated',
      newsletterDesc: 'Platform news, new hymns, and community updates.',
      emailPlaceholder: 'your@email.com',
      emailLabel: 'Email address',
      subscribeBtn: 'Subscribe',
      linksLabel: 'Links',
      subscribeSuccess: 'Thanks for subscribing!',
      subscribeError: 'Something went wrong. Try again.',
      links: [
        { label: 'Why It Matters', href: '#why' },
        { label: 'Curriculum', href: '#curriculum' },
        { label: 'Open Source', href: '#open-source' },
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Sign In', href: '/auth/login' },
      ],
    },
  },
  ar: {
    meta: {
      title: 'كوهيب | منصة تعليم التراتيب القبطية الأرثوذكسية',
      description: 'منصة مجانية مفتوحة المصدر لتعليم التراتيب القبطية، تتبع تقدم الطلاب، وإشراك الأهالي، والحفاظ على 1700 عام من التراث القبطي الأرثوذكسي.',
    },
    nav: {
      whyMatters: 'لماذا هذا مهم',
      curriculum: 'المنهج',
      openSource: 'مصدر مفتوح',
      community: 'المزايا',
      signIn: 'تسجيل الدخول',
      getStarted: 'سجّل كنيستك',
    },
    hero: {
      eyebrow: 'مجاني · مصدر مفتوح · بُني للكنيسة',
      headline: 'كل طفل له\nمكانه في الكنيسة.',
      quote: '"الأطفال في حاجة إلى الشعور بأن الكنيسة تعتبرهم أعضاء فيها، وليس مجرد مرافقين لوالديهم."',
      quoteAttrib: '- نيافة الأنبا صموئيل',
      sub: 'كوهيب تمكّن كل كنيسة من تعليم التراتيب الأصيلة، وتتبع التقدم، وإشراك الأهالي، ونقل 1700 عام من التراث الحي.',
      cta1: 'سجّل كنيستك',
      cta2: 'استكشف المنصة',
    },
    stats: {
      items: [
        { value: '+255', label: 'ترنيمة في المكتبة' },
        { value: '10', label: 'مستويات من التكوين' },
        { value: '1,700', label: 'عاماً من التراث الحي' },
        { value: '100%', label: 'مجاني ومفتوح المصدر' },
      ],
    },
    challenge: {
      eyebrow: 'التحدي',
      headline: 'خدام أوفياء. أنظمة هشة.',
      body: 'في كل أسبوع، يُعلّم الخدام التراتيب من حفظهم، ويتابعون الطلاب على الورق، ويعتمدون على مجموعات واتساب للتواصل مع الأهالي. هم أوفياء. لكن النظام لم يُبنَ ليدعمهم.\n\nحين يحترق خادم، تذهب معه المعرفة. حين يتأخر طفل، لا أحد يعلم. حين لا يرى الأب ما يتعلمه طفله، يُفقد الانتماء بصمت.\n\nهذا ليس إخفاقاً في الإيمان. إنه إخفاق في البنية التحتية.',
    },
    solution: {
      eyebrow: 'الاستجابة',
      headline: 'لهذا السبب وُجدت كوهيب.',
      body: 'كوهيب ليست برنامجاً. إنها خدمة. منصة مجانية مفتوحة المصدر بناها مجتمع الكنيسة القبطية الأرثوذكسية لمنح كل خادم الأدوات التي يحتاجها: بدون تكلفة، بدون تعقيد، بدون تنازل.\n\nالكنيسة هي المعلم. الخادم هو البطل. كوهيب تحتفظ بالسجلات وتتابع التقدم وتمنع الخيوط من الانقطاع.',
      cta: 'استكشف المنصة',
    },
    vision: {
      eyebrow: 'الرؤية',
      headline: 'مجتمع كنائس عالمي واحد، وتراث حي واحد.',
      body: 'تخيّل آلاف الكنائس القبطية حول العالم (من القاهرة إلى سيدني، من لوس أنجلوس إلى لندن) تتشارك منهجاً واحداً، وتتعاون على تسجيلات التراتيب، وتتابع النمو الروحي لجيل كامل. لا كشركة. بل ككنيسة.\n\nهذا ما تسعى كوهيب إلى بنائه.',
    },
    audience: {
      eyebrow: 'من تخدم كوهيب',
      headline: 'منصة واحدة. كل دعوة.',
      cards: [
        {
          icon: Church,
          title: 'الأساقفة والكهنة',
          sub: 'لمن يقودون',
          desc: 'أشرف على تعليم التراتيب في أبرشيتك بأكملها. اعتمد المناهج، وتابع التقدم، وتأكد من أن كل كنيسة تبني على الأساس الأصيل ذاته.',
          features: ['إشراف على مستوى الأبرشية', 'اعتماد المناهج', 'تحليلات متعددة الكنائس', 'إدارة الخدام'],
        },
        {
          icon: Users,
          title: 'الخدام ومعلمو التراتيب',
          sub: 'لمن يُعلّمون',
          desc: 'خطط لكل درس، وسجّل الحضور، وقيّم الطلاب، وتابع التقدم، كل ذلك في مكان واحد. أمضِ طاقتك في التعليم، لا في الأوراق.',
          features: ['تخطيط الدروس', 'تتبع الحضور', 'التقييم الشفهي والكتابي', 'لوحات التقدم'],
        },
        {
          icon: Heart,
          title: 'أولياء الأمور',
          sub: 'لمن يُربّون',
          desc: 'شاهد رحلة طفلك الروحية تتكشّف. اطّلع على حضوره وتقدمه والشارات والشهادات التي حصل عليها من بوابة مخصصة لك.',
          features: ['التقدم الفوري', 'تنبيهات الحضور', 'الشارات والشهادات', 'إعلانات الكنيسة'],
        },
        {
          icon: Star,
          title: 'الطلاب',
          sub: 'لمن يتعلمون',
          desc: 'تعلّم التراتيب، واكسب نقاط XP، واصعد في لوحة المسابقة، واكتشف مكانك في جسد المسيح. كل درس خطوة نحو الانتماء.',
          features: ['التعلم التفاعلي', 'نقاط XP والشارات', 'مكتبة التراتيب', 'دراسة اللغة القبطية'],
        },
      ],
    },
    curriculum: {
      eyebrow: 'الرحلة التعليمية',
      headline: '10 مستويات. عبادة مدى الحياة.',
      sub: 'من الأبجدية القبطية إلى قيادة التسبحة: رحلة كاملة ومنظّمة من المبتدئ إلى معلم التراتيب المعتمد.',
      levels: [
        { range: '1-3', title: 'الأساسيات', desc: 'التراتيب الأساسية والأبجدية القبطية والمقدمة الليتورجية', icon: Music2 },
        { range: '4-6', title: 'المتوسط', desc: 'الألحان المعقدة ودراسة الطقوس والقواعد القبطية', icon: Music3 },
        { range: '7-8', title: 'المتقدم', desc: 'التحليل الليتورجي والتراتيب المتقدمة واللاهوت', icon: FileMusic },
        { range: '9-10', title: 'الإتقان', desc: 'تدريب القيادة وأساليب التدريس والاعتماد', icon: Crown },
      ],
    },
    pillars: {
      eyebrow: 'ما يستحقه كل طفل أن يعرفه',
      headline: 'ثلاث ركائز للتراث القبطي.',
      sub: 'منهج شامل يغطي التراتيب والطقوس واللغة: الأساس الحي لـ 1700 عام من التقليد المتواصل.',
      items: [
        {
          icon: Music,
          title: 'التراتيب القبطية',
          desc: '+255 ترنيمة (الدوكسولوجيا والتسبحة والردود الليتورجية والتراتيب الموسمية) مع النص القبطي والتحويل الصوتي والأدلة الصوتية.',
          list: ['الدوكسولوجيا', 'تراتيب التسبحة', 'التراتيب الموسمية', 'الردود الليتورجية'],
        },
        {
          icon: Cross,
          title: 'الطقوس الكنسية',
          desc: 'افهم بنية ولاهوت الطقوس والأسرار القبطية من خلال دراسة منظّمة ومتدرجة.',
          list: ['القداس الإلهي', 'طقس المعمودية', 'طقس الزواج', 'طقس الجنازة'],
        },
        {
          icon: BookOpen,
          title: 'اللغة القبطية',
          desc: 'من الأبجدية إلى القواعد إلى الطلاقة: أتقن اللغة التي تربط كل مؤمن بالصوت الأصيل للكنيسة.',
          list: ['الأبجدية القبطية', 'القواعد النحوية', 'المفردات', 'ممارسة القراءة'],
        },
      ],
    },
    formation: {
      eyebrow: 'تكوين، لا مجرد تعليم',
      headline: 'طفل يتعلم "كيري اليكسون" اليوم سيعلمها للجيل القادم.',
      body: 'كوهيب لا تتتبع الدرجات فقط. إنها تتتبع النمو في المعرفة والمشاركة وحب الكنيسة. كل درس خيط آخر في نسيج حياة مُشكَّلة بالعبادة.\n\nكل طفل في كنيستك يستحق أن يعرف هذه التراتيب. ليس لأنه مُلزَم. بل لأنه ينتمي.',
    },
    howItWorks: {
      eyebrow: 'كيف يعمل',
      headline: 'من التسجيل إلى التعليم في دقائق.',
      steps: [
        { num: '01', icon: Church, title: 'سجّل كنيستك', desc: 'أنشئ ملف كنيستك وحدّد عامك الدراسي. يستغرق حوالي 5 دقائق.' },
        { num: '02', icon: BookMarked, title: 'خصص منهجك', desc: 'اختر التراتيب وحدّد المستويات وعيّن الدروس. المنصة تتولى الجدولة.' },
        { num: '03', icon: Users, title: 'ادعُ خدامك', desc: 'أضف الخدام وعيّنهم للمجموعات وامنحهم أدوات التعليم.' },
        { num: '04', icon: Award, title: 'علّم وتابع النمو', desc: 'سجّل الحضور وقيّم الطلاب وشاهدهم يكسبون نقاط XP والشارات والشهادات.' },
      ],
    },
    openSource: {
      eyebrow: 'مجاني. مفتوح. ملكنا. للأبد.',
      headline: 'بُني بواسطة المجتمع، يملكه الكنيسة.',
      sub: 'كوهيب مصدر مفتوح. كل سطر برمجي مملوك للكنيسة. لا مستثمرين، لا جدران دفع، لا احتكار، أبداً.',
      items: [
        { icon: Heart, title: 'مجاني للأبد', desc: 'لا جدران دفع ولا تكاليف خفية ولا بطاقة ائتمان. مجاني دائماً لكل كنيسة في كل مكان.' },
        { icon: Code2, title: 'مصدر مفتوح بالكامل', desc: 'تصفح وراجع وساهم على GitHub. الشفافية مبنية في كل ميزة.' },
        { icon: Shield, title: 'بياناتك تبقى لك', desc: 'استضف بنفسك أو استخدم سحابتنا. بياناتك مملوكة لكنيستك، ليس لنا.' },
        { icon: SlidersHorizontal, title: 'قابل للتخصيص بالكامل', desc: 'كيّف المناهج والتراتيب والأدوار والوتيرة حسب تقاليد كنيستك.' },
        { icon: Globe, title: 'إدارة المجتمع', desc: 'بُني بواسطة مطورين وخدام وإكليروس أقباط حول العالم. المجتمع يقرر خارطة الطريق.' },
        { icon: GitBranch, title: 'ساهم بحرية', desc: 'الكود والترجمات وبيانات التراتيب وتصميم المناهج: كل المساهمات مرحب بها على GitHub.' },
      ],
      cta: 'اعرض على GitHub',
    },
    features: {
      eyebrow: 'إمكانيات المنصة',
      headline: 'كل ما تحتاجه الكنيسة لتعليم التراتيب بشكل جيد.',
      groups: [
        {
          title: 'التعليم والمنهج',
          icon: BookOpen,
          items: ['إدارة المنهج المنظّم', 'التقويم الأكاديمي', 'تخطيط الدروس الأسبوعية', 'مكتبة التراتيب (+255 ترنيمة)', 'دروس اللغة القبطية', 'الطقوس والشعائر الكنسية', 'التسجيلات الصوتية والمرئية', 'دروس PowerPoint', 'موارد PDF'],
        },
        {
          title: 'الطلاب وأولياء الأمور',
          icon: Users,
          items: ['إدارة الطلاب', 'بوابة أولياء الأمور', 'تتبع الحضور', 'التلعيب (نقاط XP، شارات، شهادات)', 'تتبع التقدم', 'الامتحانات الشفهية والكتابية', 'الترتيل التطبيقي', 'تقديم التسجيلات الصوتية والمرئية', 'الإشعارات والإعلانات'],
        },
        {
          title: 'الإدارة',
          icon: BarChart3,
          items: ['التسلسل الهرمي الكنسي', 'أمان متعدد الأدوار', 'توزيع المنهج', 'التحليلات ولوحات التحكم', 'التقارير', 'تصدير PDF/Excel', 'إدارة الفعاليات والأعياد', 'اعتماد طلبات التسجيل', 'إشراف على كنائس متعددة'],
        },
      ],
    },
    faq: [
      { q: 'هل كوهيب مجانية حقاً؟', a: 'نعم. كوهيب مجانية تماماً ومفتوحة المصدر. لا جدران دفع ولا مستويات مميزة ولا رسوم خفية. هي خدمة وليست شركة.' },
      { q: 'هل أحتاج مهارات تقنية للإعداد؟', a: 'لا على الإطلاق. كوهيب مصممة للخدام والإكليروس من أي خلفية تقنية. إذا كنت تستخدم متصفح الويب، يمكنك استخدام كوهيب. الإعداد يستغرق 5 دقائق.' },
      { q: 'هل بيانات كنيستي آمنة؟', a: 'نعم. كوهيب مفتوحة المصدر بحيث يمكن لأي شخص تدقيق الأمان. بياناتك مشفرة ومملوكة بالكامل لكنيستك. الاستضافة الذاتية متاحة دائماً.' },
      { q: 'هل يمكنني تخصيص المنهج لتقاليد كنيستي؟', a: 'بالتأكيد. كل كنيسة يمكنها تخصيص المستويات والتراتيب والوتيرة. تتبع تقاليدك بينما تستفيد من هيكل عالمي مشترك.' },
      { q: 'من يصون كوهيب؟', a: 'كوهيب تتم صيانتها بواسطة مجتمع من المطورين والخدام والإكليروس الأقباط. خارطة الطريق يقودها المجتمع وبشفافية.' },
      { q: 'هل يمكن لأبرشيتنا إدارة كنائس متعددة؟', a: 'نعم. كوهيب تدعم الإشراف على مستوى الأبرشية بالكامل، مما يتيح للأساقفة والمديرين إدارة كنائس متعددة من حساب واحد.' },
      { q: 'ما اللغات المدعومة؟', a: 'اللغتان الإنجليزية والعربية مدعومتان حالياً. البنية تدعم إضافة المزيد من اللغات، ونرحب بمساهمات الترجمة من المجتمع.' },
      { q: 'هل تعمل على الهواتف والأجهزة اللوحية؟', a: 'نعم. كوهيب تعمل على أي جهاز: هاتف أو حاسوب لوحي أو كمبيوتر. الواجهة متجاوبة بالكامل ومصممة للاستخدام في الفصل الدراسي.' },
    ],
    cta: {
      headline: 'تراث الكنيسة.\nمستقبل أطفالك.',
      sub: 'انضم إلى مئات الخدام الذين يستخدمون كوهيب بالفعل للحفاظ على التراث القبطي وتكوين الجيل القادم من المؤمنين.',
      btn1: 'سجّل كنيستك',
      btn2: 'استكشف المنصة',
      btn3: 'اعرض على GitHub',
      trust: 'مجاني للأبد · بدون بطاقة ائتمان · مصدر مفتوح',
    },
    footer: {
      tagline: 'تعليم التراتيب القبطية مجاناً ومفتوح المصدر.',
      copyright: '© 2026 منصة تعليم التراتيب القبطية الأرثوذكسية (كوهيب). جميع الحقوق محفوظة.',
      newsletter: 'ابق على اطلاع',
      newsletterDesc: 'أخبار المنصة وتراتيب جديدة وتحديثات المجتمع.',
      emailPlaceholder: 'بريدك@الإلكتروني.com',
      emailLabel: 'البريد الإلكتروني',
      subscribeBtn: 'اشتراك',
      linksLabel: 'روابط',
      subscribeSuccess: 'شكراً لاشتراكك!',
      subscribeError: 'حدث خطأ. حاول مجدداً.',
      links: [
        { label: 'لماذا هذا مهم', href: '#why' },
        { label: 'المنهج', href: '#curriculum' },
        { label: 'مصدر مفتوح', href: '#open-source' },
        { label: 'الخصوصية', href: '/privacy' },
        { label: 'الشروط', href: '/terms' },
        { label: 'تسجيل الدخول', href: '/auth/login' },
      ],
    },
  },
}

// ─── SHARED UI COMPONENTS ───────────────────────────────────────────────────

type RevealVariant = 'up' | 'left' | 'right' | 'scale'

// SSR / no-JS safe reveal: content is visible by default; the `.js` class
// (added in layout.tsx) + CSS hide it only when we can animate it in.
function FadeIn({ children, delay = 0, className = '', variant = 'up' }: { children: React.ReactNode; delay?: number; className?: string; variant?: RevealVariant }) {
  return (
    <div
      className={cn('reveal', className)}
      data-variant={variant}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  )
}

function useRevealOnScroll() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.reveal-visible)'))
    if (els.length === 0) return
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach(el => el.classList.add('reveal-visible'))
      return
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible')
          io.unobserve(entry.target)
        }
      })
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

const focusRingDark = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950'
const ctaPrimaryClass = `flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white font-semibold rounded-xl shadow-xl shadow-gold-500/25 transition-all text-sm ${focusRingDark}`
const ctaSecondaryClass = `px-8 py-3.5 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white font-medium rounded-xl transition-all text-sm ${focusRingDark}`

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-xs font-bold tracking-[0.15em] uppercase ${light ? 'text-gold-400' : 'text-gold-600'}`}>
      {children}
    </p>
  )
}

function CrossPatternBg({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${className}`}>
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id="crossP" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M10 2L10 18M2 10L18 10" stroke="currentColor" strokeWidth="0.5" fill="none" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#crossP)" />
      </svg>
    </div>
  )
}

function GradientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-gold-500/8 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-amber-400/8 rounded-full blur-3xl" />
    </div>
  )
}

// Platform preview carousel
function PreviewCarousel({ isAr }: { isAr: boolean }) {
  const [activeTab, setActiveTab] = useState(0)
  const prevTabRef = useRef(0)

  const tabs = [
    { label: isAr ? 'لوحة التحكم' : 'Dashboard', content: <DashboardPreview isAr={isAr} /> },
    { label: isAr ? 'الطلاب' : 'Students', content: <StudentsPreview isAr={isAr} /> },
    { label: isAr ? 'الحضور' : 'Attendance', content: <AttendancePreview isAr={isAr} /> },
    { label: isAr ? 'التلعيب' : 'Gamification', content: <GamificationPreview isAr={isAr} /> },
  ]

  return (
    <FadeIn>
      <div className="relative mx-auto max-w-[900px]">
        <div className="rounded-[14px] bg-gray-800 p-2 sm:p-3 shadow-2xl">
          <div className="flex items-center justify-center mb-2 sm:mb-3 relative">
            <div className="hidden sm:flex absolute left-3 items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            </div>
            <div className="flex items-center gap-2 rounded-full bg-gray-700/80 px-4 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-gray-400 font-medium">cohep.church</span>
            </div>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-white">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: activeTab > prevTabRef.current ? 24 : -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: activeTab > prevTabRef.current ? -24 : 24 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="h-full w-full"
              >
                {tabs[activeTab].content}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => { prevTabRef.current = activeTab; setActiveTab(i) }}
              aria-pressed={activeTab === i}
              className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-all ${
                activeTab === i ? 'bg-gold-500 text-white shadow-lg shadow-gold-200' : 'border border-gray-200 bg-white text-gray-600 hover:border-gold-300 hover:text-gold-700'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </FadeIn>
  )
}

function DashboardPreview({ isAr }: { isAr: boolean }) {
  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gold-500 text-white"><Cross className="h-3.5 w-3.5" /></div>
        <span className="text-xs font-bold text-gray-700">COHEP</span>
        <div className="flex-1" />
        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500">SA</div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden sm:flex w-28 flex-col gap-1 border-r border-gray-100 bg-white p-2">
          {['Dashboard','Curriculum','Students','Attendance','Gamification'].map((item, i) => (
            <div key={item} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${i === 0 ? 'bg-gold-50' : ''}`}>
              <div className={`h-2.5 w-2.5 rounded-sm ${i === 0 ? 'bg-gold-500' : 'bg-gray-200'}`} />
              <span className="text-[9px] text-gray-500 truncate">{isAr ? ['لوحة التحكم','المنهج','الطلاب','الحضور','التلعيب'][i] : item}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 p-3 space-y-2.5 overflow-hidden">
          <div className="grid grid-cols-3 gap-2">
            {[{label: isAr ? 'الطلاب' : 'Students', val: '248', pct: 72}, {label: isAr ? 'نشطون اليوم' : 'Active Today', val: '42', pct: 55}, {label: isAr ? 'الحضور' : 'Attendance', val: '94%', pct: 88}].map((s, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-white p-2.5">
                <div className="text-[9px] text-gray-400 mb-1">{s.label}</div>
                <div className="text-base font-bold text-gray-900">{s.val}</div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-gray-100">
                  <div className="h-1 rounded-full bg-gold-400" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-gray-100 bg-white p-3">
            <div className="text-[9px] font-medium text-gray-500 mb-2">{isAr ? 'تقدم الطلاب' : 'Student Progress'}</div>
            {[80, 65, 90, 45].map((w, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <div className="h-4 w-4 rounded-full bg-gray-100 flex items-center justify-center text-[7px] text-gray-400 font-bold">AB</div>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-gold-400" style={{ width: `${w}%` }} />
                </div>
                <span className="text-[9px] text-gray-400">{w}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentsPreview({ isAr }: { isAr: boolean }) {
  const students = [
    { name: 'George Magdy', code: 'STU-001', level: 'L3', active: true },
    { name: 'Youstina Nader', code: 'STU-042', level: 'L5', active: true },
    { name: 'Mina Bishoy', code: 'STU-017', level: 'L8', active: true },
    { name: 'Mariam Talaat', code: 'STU-093', level: 'L2', active: false },
  ]
  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gold-500 text-white"><Cross className="h-3.5 w-3.5" /></div>
        <span className="text-xs font-bold text-gray-700">{isAr ? 'الطلاب' : 'Students'}</span>
        <div className="flex-1" />
        <div className="h-5 w-16 rounded bg-gold-500 text-center flex items-center justify-center text-[9px] text-white font-medium">{isAr ? '+ طالب' : '+ Add'}</div>
      </div>
      <div className="flex-1 p-3 overflow-hidden">
        <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
          <div className="grid grid-cols-4 border-b border-gray-100 bg-gray-50 px-3 py-2">
            {[isAr ? 'الاسم':'Name', isAr ? 'الكود':'Code', isAr ? 'المستوى':'Level', isAr ? 'الحالة':'Status'].map(h => (
              <span key={h} className="text-[9px] font-semibold text-gray-400 uppercase">{h}</span>
            ))}
          </div>
          {students.map((s, i) => (
            <div key={i} className="grid grid-cols-4 border-b border-gray-50 px-3 py-2.5 text-[10px] text-gray-700">
              <span className="font-medium truncate">{s.name}</span>
              <span className="text-gray-400">{s.code}</span>
              <span>{s.level}</span>
              <span><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${s.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.active ? (isAr ? 'نشط':'Active') : (isAr ? 'غير نشط':'Inactive')}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AttendancePreview({ isAr }: { isAr: boolean }) {
  const rows = [
    { name: 'George M.', status: 'Present', color: 'bg-green-50 text-green-700' },
    { name: 'Youstina N.', status: 'Present', color: 'bg-green-50 text-green-700' },
    { name: 'Mina B.', status: 'Late', color: 'bg-amber-50 text-amber-700' },
    { name: 'Mariam T.', status: 'Absent', color: 'bg-red-50 text-red-600' },
    { name: 'Bishoy H.', status: 'Present', color: 'bg-green-50 text-green-700' },
  ]
  const statusLabel = (s: string) => isAr ? {Present:'حضور',Late:'متأخر',Absent:'غائب'}[s] || s : s
  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gold-500 text-white"><Cross className="h-3.5 w-3.5" /></div>
        <span className="text-xs font-bold text-gray-700">{isAr ? 'الحضور' : 'Attendance'}</span>
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-hidden">
        <div className="grid grid-cols-3 gap-2">
          {[{label: isAr?'حضور':'Present', val:'87%', cls:'text-green-600'},{label: isAr?'متأخر':'Late', val:'8%', cls:'text-amber-600'},{label: isAr?'غائب':'Absent', val:'5%', cls:'text-red-500'}].map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-white p-2 text-center">
              <div className={`text-sm font-bold ${s.cls}`}>{s.val}</div>
              <div className={`text-[9px] ${s.cls}`}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-gray-100 bg-white divide-y divide-gray-50">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2">
              <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center text-[7px] font-bold text-gray-400">{r.name.split(' ').map(n=>n[0]).join('')}</div>
              <span className="flex-1 text-[10px] text-gray-700">{r.name}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${r.color}`}>{statusLabel(r.status)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GamificationPreview({ isAr }: { isAr: boolean }) {
  const leaders = [
    { name: isAr ? 'مينا بيشوي' : 'Mina B.', xp: 2840, pct: 100 },
    { name: isAr ? 'جورج مجدي' : 'George M.', xp: 2510, pct: 88 },
    { name: isAr ? 'يستينا نادر' : 'Youstina N.', xp: 2180, pct: 77 },
    { name: isAr ? 'مريم طلعت' : 'Mariam T.', xp: 1950, pct: 69 },
  ]
  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gold-500 text-white"><Cross className="h-3.5 w-3.5" /></div>
        <span className="text-xs font-bold text-gray-700">{isAr ? 'التلعيب' : 'Gamification'}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700">
          <Trophy className="h-2.5 w-2.5" /> 1,280 XP
        </div>
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-hidden">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-100 bg-white p-3">
            <div className="text-[9px] text-gray-400 mb-1">{isAr ? 'الترتيب' : 'Rank'}</div>
            <div className="text-xl font-bold text-blue-600">#3</div>
            <div className="text-[9px] text-gray-400">{isAr ? 'من 42 طالب' : 'of 42 students'}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-white p-3">
            <div className="text-[9px] text-gray-400 mb-1">{isAr ? 'نقاط XP' : 'Total XP'}</div>
            <div className="text-xl font-bold text-green-600">1,280</div>
            <div className="text-[9px] text-gray-400">{isAr ? 'هذا الفصل' : 'This term'}</div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <div className="text-[9px] font-medium text-gray-500 mb-2">{isAr ? 'قائمة المتصدرين' : 'Leaderboard'}</div>
          {leaders.map((l, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-bold text-gray-400 w-3">{i+1}</span>
              <span className="text-[10px] text-gray-700 flex-1">{l.name}</span>
              <div className="w-16 h-1.5 rounded-full bg-gray-100">
                <div className="h-1.5 rounded-full bg-gold-400" style={{ width: `${l.pct}%` }} />
              </div>
              <span className="text-[9px] text-gray-400">{l.xp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE COMPONENT ────────────────────────────────────────────────────

export default function Home() {
  const [lang, setLang] = useState<'en' | 'ar'>('en')
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [subscribeErrorMsg, setSubscribeErrorMsg] = useState('')
  const t = content[lang]
  const isAr = lang === 'ar'
  const reduce = useReducedMotion()

  useRevealOnScroll()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.documentElement.lang = lang
    document.documentElement.dir = isAr ? 'rtl' : 'ltr'
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lang, isAr])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'COHEP | Coptic Orthodox Hymn Education Platform',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description: 'Free, open-source platform for Coptic Orthodox hymn education.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Organization', name: 'COHEP Community' },
  }

  return (
    <div className={`min-h-screen bg-white ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg">
        {isAr ? 'تخطي إلى المحتوى' : 'Skip to content'}
      </a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 border-b transition-all duration-300 ${scrolled ? 'border-gray-200 bg-white/95 backdrop-blur shadow-sm' : 'border-transparent bg-white/80 backdrop-blur'}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500 text-white shadow-lg shadow-gold-200/50">
              <Cross className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-gray-900 hidden sm:block">COHEP</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5" aria-label={isAr ? 'التنقل الرئيسي' : 'Main navigation'}>
            {[
              { href: '#why', label: t.nav.whyMatters },
              { href: '#curriculum', label: t.nav.curriculum },
              { href: '#open-source', label: t.nav.openSource },
              { href: '#features', label: t.nav.community },
            ].map(item => (
              <a key={item.href} href={item.href} className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              aria-label={lang === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
            >
              {lang === 'en' ? 'عربي' : 'EN'}
            </button>
            <Link href="/auth/login" className="hidden sm:block">
              <Button variant="ghost" size="lg" className="text-gray-600">{t.nav.signIn}</Button>
            </Link>
            <Link href="/auth/register" className="hidden sm:block">
              <Button size="lg" className="bg-gold-500 text-white hover:bg-gold-600 shadow-lg shadow-gold-200/50">{t.nav.getStarted}</Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex md:hidden h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              aria-label={isAr ? 'فتح القائمة' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileMenuOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
              </svg>
            </button>
          </div>

          {mobileMenuOpen && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full left-0 right-0 border-b border-gray-200 bg-white shadow-lg md:hidden">
              <nav className="flex flex-col gap-1 p-4" aria-label={isAr ? 'التنقل الرئيسي' : 'Main navigation'}>
                {[
                  { href: '#why', label: t.nav.whyMatters },
                  { href: '#curriculum', label: t.nav.curriculum },
                  { href: '#open-source', label: t.nav.openSource },
                  { href: '#features', label: t.nav.community },
                ].map(item => (
                  <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100">{item.label}</a>
                ))}
                <hr className="my-1 border-gray-100" />
                <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100">{t.nav.signIn}</Link>
                <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-gold-500 px-3 py-3 text-sm font-medium text-white text-center hover:bg-gold-600">{t.nav.getStarted}</Link>
              </nav>
            </motion.div>
          )}
        </div>
      </header>

      <main id="main-content">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-gray-950 via-gray-900 to-gray-900 min-h-[90vh] flex items-center">
          <HeroAlpha />
          <HeroCross3D />
          <CrossPatternBg className="text-gold-500" />
          <GradientOrbs />

          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:py-36 lg:px-8 w-full">
            <div className="max-w-3xl mx-auto text-center">

              <p
                className="reveal text-xs font-bold tracking-[0.2em] uppercase text-gold-300 mb-6"
                data-variant="up"
                style={{ transitionDelay: '0.05s' }}
              >
                {t.hero.eyebrow}
              </p>

              <h1
                className="reveal text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08] mb-6"
                data-variant="up"
                style={{ whiteSpace: 'pre-line', transitionDelay: '0.15s' }}
              >
                {t.hero.headline}
              </h1>

              <div
                className="reveal mb-7 border-l-2 border-gold-500/50 pl-4 text-left mx-auto max-w-xl"
                data-variant="left"
                style={{ direction: isAr ? 'rtl' : 'ltr', borderLeft: isAr ? 'none' : undefined, borderRight: isAr ? '2px solid rgba(214, 166, 75, 0.5)' : undefined, paddingLeft: isAr ? '0' : '1rem', paddingRight: isAr ? '1rem' : '0', transitionDelay: '0.3s' }}
              >
                <p className="text-base sm:text-lg text-gold-300/90 italic leading-relaxed">{t.hero.quote}</p>
                <p className="mt-1.5 text-xs text-gold-300/90 font-medium">{t.hero.quoteAttrib}</p>
              </div>

              <p
                className="reveal text-base sm:text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto mb-9"
                data-variant="up"
                style={{ transitionDelay: '0.45s' }}
              >
                {t.hero.sub}
              </p>

              <div
                className="reveal flex flex-col sm:flex-row gap-3 justify-center mb-6"
                data-variant="up"
                style={{ transitionDelay: '0.55s' }}
              >
                <motion.a
                  href="/auth/register"
                  whileHover={reduce ? {} : { scale: 1.02 }}
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  className={ctaPrimaryClass}
                >
                  {t.hero.cta1} <ArrowRight className="h-4 w-4 rtl-flip" />
                </motion.a>
                <button
                  onClick={() => document.getElementById('platform-preview')?.scrollIntoView({ behavior: 'smooth' })}
                  className={ctaSecondaryClass}
                >
                  {t.hero.cta2}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── KEY NUMBERS ───────────────────────────────────────────────── */}
        <section aria-label={isAr ? 'أرقام رئيسية' : 'Key numbers'} className="bg-gray-50 py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {t.stats.items.map((s, i) => (
                <FadeIn key={s.label} delay={i * 0.06} className="text-center">
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-3xl sm:text-4xl font-bold tracking-tight text-gold-600">{s.value}</dd>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600">{s.label}</p>
                </FadeIn>
              ))}
            </dl>
          </div>
        </section>

        {/* ── CHALLENGE ─────────────────────────────────────────────────── */}
        <section id="why" aria-labelledby="challenge-heading" className="py-24 sm:py-32 bg-white relative">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <FadeIn variant="up" className="text-center mb-12">
              <h2 id="challenge-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">{t.challenge.headline}</h2>
            </FadeIn>
            <FadeIn variant="up" delay={0.1}>
              <div className="prose prose-gray max-w-none space-y-5">
                {t.challenge.body.split('\n\n').map((p, i) => (
                  <p key={i} className={`text-base sm:text-lg leading-relaxed ${i === 2 ? 'text-gray-900 font-medium border-l-4 border-gold-400 pl-4' : 'text-gray-600'}`}>
                    {p}
                  </p>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── SOLUTION ──────────────────────────────────────────────────── */}
        <section aria-labelledby="solution-heading" className="py-24 sm:py-32 relative bg-gradient-to-b from-gray-950 to-gray-900">
          <CrossPatternBg className="text-gold-500" />
          <GradientOrbs />
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <FadeIn variant="scale">
              <h2 id="solution-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">{t.solution.headline}</h2>
              <div className="mt-6 space-y-4">
                {t.solution.body.split('\n\n').map((p, i) => (
                  <p key={i} className="text-base sm:text-lg leading-relaxed text-gray-300">{p}</p>
                ))}
              </div>
              <div className="mt-9">
                <motion.button
                  onClick={() => document.getElementById('platform-preview')?.scrollIntoView({ behavior: 'smooth' })}
                  whileHover={reduce ? {} : { scale: 1.02 }}
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  className={ctaPrimaryClass}
                >
                  {t.solution.cta} <ArrowRight className="h-4 w-4 rtl-flip" />
                </motion.button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── VISION ────────────────────────────────────────────────────── */}
        <section aria-labelledby="vision-heading" className="py-20 sm:py-28 bg-gray-50">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <FadeIn variant="up">
              <h2 id="vision-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 leading-tight">{t.vision.headline}</h2>
              <div className="mt-5 space-y-4">
                {t.vision.body.split('\n\n').map((p, i) => (
                  <p key={i} className="text-base leading-relaxed text-gray-600">{p}</p>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── WHO WE SERVE ──────────────────────────────────────────────── */}
        <section aria-labelledby="audience-heading" className="py-20 sm:py-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center mb-16" variant="up">
              <h2 id="audience-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">{t.audience.headline}</h2>
            </FadeIn>
            <div className="space-y-10 sm:space-y-16">
              {t.audience.cards.map((card, i) => (
                <FadeIn key={card.title} delay={i * 0.05} className="h-full">
                  <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
                    <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-lg shadow-gold-200/50">
                        <card.icon className="h-7 w-7" />
                      </div>
                      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-gold-600">{card.sub}</p>
                      <h3 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{card.title}</h3>
                      <p className="mt-3 text-base leading-relaxed text-gray-600">{card.desc}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
                      <ul className="space-y-3.5">
                        {card.features.map(f => (
                          <li key={f} className="flex items-start gap-3 text-sm sm:text-base text-gray-700">
                            <CheckCircle2 className="h-5 w-5 text-gold-500 flex-shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── PLATFORM PREVIEW ──────────────────────────────────────────── */}
        <section id="platform-preview" aria-labelledby="preview-heading" className="py-20 sm:py-28 bg-gray-50 overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center mb-12" variant="up">
              <Eyebrow>{isAr ? 'نظرة على المنصة' : 'Platform Preview'}</Eyebrow>
              <h2 id="preview-heading" className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                {isAr ? 'شاهد المنصة أثناء العمل' : 'See the platform in action.'}
              </h2>
              <p className="mt-3 text-base text-gray-600">
                {isAr ? 'واجهة حقيقية مصممة للخدام وأولياء الأمور والطلاب' : 'A real interface designed for servants, parents, and students'}
              </p>
            </FadeIn>
            <div className="max-w-5xl mx-auto">
              <PreviewCarousel isAr={isAr} />
            </div>
          </div>
        </section>

        {/* ── CURRICULUM ────────────────────────────────────────────────── */}
        <section id="curriculum" aria-labelledby="curriculum-heading" className="py-20 sm:py-28 relative bg-gradient-to-b from-gray-950 to-gray-900 overflow-hidden">
          <CrossPatternBg className="text-gold-500" />
          <GradientOrbs />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center mb-12" variant="up">
              <h2 id="curriculum-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{t.curriculum.headline}</h2>
              <p className="mt-3 text-base text-gray-400">{t.curriculum.sub}</p>
            </FadeIn>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-16">
              {t.curriculum.levels.map((level, i) => (
                <FadeIn key={level.range} delay={i * 0.1} className="h-full">
                  <div className="h-full group relative overflow-hidden rounded-2xl border border-gray-700 bg-gray-800/60 p-5 transition-all hover:border-gold-500/40 hover:bg-gray-800 hover:-translate-y-1 flex flex-col">
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold-500/10 blur-xl transition-opacity group-hover:opacity-50" />
                    <div className="relative">
                      <level.icon className="h-8 w-8 text-gold-400 mb-3" />
                      <p className="text-xs font-bold text-gold-400 uppercase tracking-wider">{isAr ? 'مستوى' : 'Level'} {level.range}</p>
                      <h3 className="mt-1.5 text-lg font-bold text-white">{level.title}</h3>
                      <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">{level.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Three pillars */}
            <FadeIn className="mx-auto max-w-2xl text-center mb-10" variant="up">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{t.pillars.headline}</h2>
              <p className="mt-3 text-base text-gray-400">{t.pillars.sub}</p>
            </FadeIn>

            <div className="grid gap-5 lg:grid-cols-3">
              {t.pillars.items.map((p, i) => (
                <FadeIn key={p.title} delay={i * 0.1} className={i === 0 ? 'lg:col-span-1 lg:row-span-2 h-full' : 'lg:col-span-2 h-full'}>
                  <div className={`h-full rounded-2xl border flex flex-col ${i === 0 ? 'border-gold-500/30 bg-gradient-to-br from-gold-500/15 via-gray-800/60 to-gray-800/60 p-8' : 'border-gray-700 bg-gray-800/60 p-7'}`}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-lg shadow-gold-500/20 mb-4">
                      <p.icon className="h-6 w-6" />
                    </div>
                    <h3 className={`font-bold text-white ${i === 0 ? 'text-xl' : 'text-lg'}`}>{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400 flex-1">{p.desc}</p>
                    <ul className={`mt-4 space-y-1.5 ${i === 0 ? '' : 'flex flex-wrap gap-x-6 gap-y-1.5'}`}>
                      {p.list.map(item => (
                        <li key={item} className="flex items-center gap-2 text-xs text-gray-400">
                          <CheckCircle2 className="h-3.5 w-3.5 text-gold-500 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── FORMATION ─────────────────────────────────────────────────── */}
        <section aria-labelledby="formation-heading" className="relative overflow-hidden bg-white py-28 sm:py-40">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <FadeIn variant="scale">
              <svg className="mx-auto h-4 w-24" viewBox="0 0 96 16" fill="none" aria-hidden="true">
                <path d="M0 8h34M62 8h34" stroke="#C9A030" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="45" y="3" width="6" height="6" transform="rotate(45 48 6)" fill="#C9A030" />
              </svg>
              <h2 id="formation-heading" className="mt-8 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 leading-[1.15]">
                {t.formation.headline}
              </h2>
              <div className="mt-8 max-w-2xl mx-auto">
                {t.formation.body.split('\n\n').map((p, i) => (
                  i === 0 ? (
                    <p key={i} className="text-base sm:text-lg leading-relaxed text-gray-600">{p}</p>
                  ) : (
                    <p key={i} className="mt-8 text-lg sm:text-xl font-semibold leading-relaxed text-gold-600">{p}</p>
                  )
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
        <section aria-labelledby="how-heading" className="py-20 sm:py-28 bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center mb-16" variant="up">
              <h2 id="how-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">{t.howItWorks.headline}</h2>
              <p className="mt-3 text-base text-gray-600">{isAr ? 'أربع خطوات تفصل كنيستك عن التعلم الحي.' : 'Four steps stand between your church and living, lasting learning.'}</p>
            </FadeIn>
            <div className="relative mx-auto max-w-2xl">
              {t.howItWorks.steps.map((step, i) => (
                <div key={step.num} className="sticky top-4 sm:top-8 mb-5 sm:mb-8">
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.18)]">
                    <span className="pointer-events-none absolute -right-1 -top-7 select-none text-[7rem] font-bold leading-none text-gold-500/10" aria-hidden="true">
                      {step.num}
                    </span>
                    <div className="relative flex min-h-[48vh] sm:min-h-[55vh] flex-col justify-center p-8 sm:p-12">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-lg shadow-gold-200/50">
                        <step.icon className="h-7 w-7" />
                      </div>
                      <h3 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{step.title}</h3>
                      <p className="mt-3 max-w-md text-base sm:text-lg leading-relaxed text-gray-600">{step.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── OPEN SOURCE ───────────────────────────────────────────────── */}
        <section id="open-source" aria-labelledby="oss-heading" className="py-20 sm:py-28 relative bg-gradient-to-b from-gray-950 to-gray-900">
          <CrossPatternBg className="text-gold-500" />
          <GradientOrbs />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center mb-12" variant="up">
              <h2 id="oss-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{t.openSource.headline}</h2>
              <p className="mt-3 text-base text-gray-400">{t.openSource.sub}</p>
            </FadeIn>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto mb-10">
              {t.openSource.items.map((item, i) => (
                <FadeIn key={item.title} delay={i * 0.06} className="h-full">
                  <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 transition-all hover:bg-gray-800 hover:border-gold-500/30 h-full flex flex-col">
                    <item.icon className="h-6 w-6 text-gold-400 mb-3" />
                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
            <FadeIn className="text-center">
              <a
                href="https://github.com/mero20000/cohep-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gold-500/30 px-6 py-3 text-sm font-medium text-gold-400 hover:bg-gold-500/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
              >
                <GitBranch className="h-4 w-4" />
                {t.openSource.cta}
                <ArrowRight className="h-4 w-4 rtl-flip" />
              </a>
            </FadeIn>
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────────────── */}
        <section id="features" aria-labelledby="features-heading" className="py-20 sm:py-28 bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn className="mx-auto max-w-2xl text-center mb-12" variant="up">
              <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">{t.features.headline}</h2>
            </FadeIn>
            <div className="grid gap-6 lg:grid-cols-3">
              {t.features.groups.map((group, i) => (
                <FadeIn key={group.title} delay={i * 0.1} className="h-full">
                  <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-md shadow-gold-200/50">
                        <group.icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900">{group.title}</h3>
                    </div>
                    <ul className="space-y-2.5 flex-1">
                      {group.items.map(item => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <CheckCircle2 className="h-4 w-4 text-gold-500 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading" className="py-20 sm:py-28 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <FadeIn className="text-center mb-12" variant="up">
              <Eyebrow>{isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}</Eyebrow>
              <h2 id="faq-heading" className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">{isAr ? 'أسئلة شائعة' : 'Common questions'}</h2>
            </FadeIn>
            <div className="space-y-3">
              {t.faq.map((item, i) => (
                <FadeIn key={item.q} delay={i * 0.04}>
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <button
                      id={`faq-q-${i}`}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex w-full items-center justify-between p-5 text-sm font-semibold text-gray-900 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2"
                      aria-expanded={openFaq === i}
                      aria-controls={`faq-panel-${i}`}
                    >
                      <span>{item.q}</span>
                      <ChevronRight className={`h-4 w-4 text-gray-500 flex-shrink-0 transition-transform duration-200 rtl-flip ml-3 ${openFaq === i ? 'rotate-90' : ''}`} aria-hidden="true" />
                    </button>
                    <AnimatePresence initial={false}>
                      {openFaq === i && (
                        <motion.div
                          key="ans"
                          id={`faq-panel-${i}`}
                          role="region"
                          aria-labelledby={`faq-q-${i}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{item.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="cta-heading" className="py-20 sm:py-28 relative bg-gradient-to-b from-gray-950 to-gray-900">
          <CrossPatternBg className="text-gold-500" />
          <GradientOrbs />
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <FadeIn variant="scale">
              <h2 id="cta-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4" style={{ whiteSpace: 'pre-line' }}>
                {t.cta.headline}
              </h2>
              <p className="text-base text-gray-400 max-w-xl mx-auto mb-8">{t.cta.sub}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
                <motion.a
                  href="/auth/register"
                  whileHover={reduce ? {} : { scale: 1.02 }}
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  className={ctaPrimaryClass}
                >
                  {t.cta.btn1} <ArrowRight className="h-4 w-4 rtl-flip" />
                </motion.a>
                <motion.button
                  onClick={() => document.getElementById('platform-preview')?.scrollIntoView({ behavior: 'smooth' })}
                  whileHover={reduce ? {} : { scale: 1.02 }}
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  className={ctaSecondaryClass}
                >
                  {t.cta.btn2}
                </motion.button>
                <a
                  href="https://github.com/mero20000/cohep-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3.5 text-gray-400 hover:text-gray-200 font-medium rounded-xl transition-all text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
                >
                  {t.cta.btn3}
                </a>
              </div>
              <p className="text-xs text-gray-400">{t.cta.trust}</p>
            </FadeIn>
          </div>
        </section>

      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <Link href="/" className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-white shadow-md shadow-gold-200/50">
                  <Cross className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-gray-900">COHEP</span>
              </Link>
              <p className="text-sm text-gray-600 leading-relaxed">{t.footer.tagline}</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-gray-900 mb-1">{t.footer.linksLabel}</p>
              {t.footer.links.map(link => (
                <Link key={link.href} href={link.href} className="inline-block py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">{link.label}</Link>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{t.footer.newsletter}</p>
              <p className="text-xs text-gray-600 mb-3">{t.footer.newsletterDesc}</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const email = fd.get('email') as string
                  setSubscribeStatus('loading')
                  try {
                    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/newsletter/subscribe', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
                    })
                    if (!res.ok) throw new Error(`${res.status}`)
                    setSubscribeStatus('success')
                    ;(e.target as HTMLFormElement).reset()
                  } catch (err) {
                    setSubscribeStatus('error')
                    setSubscribeErrorMsg(String(err))
                  }
                }}
                className="flex gap-2"
              >
                <label htmlFor="footer-email" className="sr-only">{t.footer.emailLabel}</label>
                <input
                  id="footer-email"
                  name="email"
                  type="email"
                  required
                  placeholder={t.footer.emailPlaceholder}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                />
                <button type="submit" disabled={subscribeStatus === 'loading'} className="shrink-0 rounded-lg bg-gold-500 hover:bg-gold-600 px-3 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50">
                  {subscribeStatus === 'loading' ? '…' : subscribeStatus === 'success' ? '✓' : t.footer.subscribeBtn}
                </button>
              </form>
              {subscribeStatus === 'success' && <p className="mt-1.5 text-xs text-green-600">{t.footer.subscribeSuccess}</p>}
              {subscribeStatus === 'error' && <p className="mt-1.5 text-xs text-red-500">{t.footer.subscribeError}</p>}
            </div>
          </div>
          <div className="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-gray-600">
            {t.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  )
}
