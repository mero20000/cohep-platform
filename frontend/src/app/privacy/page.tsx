'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, Mail } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'

export default function PrivacyPage() {
  const lang = useLanguage()
  const isAr = lang === 'ar'

  const sections = isAr ? [
    {
      icon: Database,
      title: '1. المعلومات التي نجمعها',
      content: [
        { heading: 'عند التسجيل', text: 'نجمع اسم الكنيسة، البريد الإلكتروني، ورقم الهاتف وبيانات التسجيل الأساسية.' },
        { heading: 'أثناء الاستخدام', text: 'نجمع سجلات الطلاب، بيانات الحضور، نتائج التقييمات، والتقدم التعليمي.' },
        { heading: 'ما لا نجمعه أبداً', text: 'لا نجمع بيانات الدفع ولا نتتبع سلوك المستخدم لأغراض تجارية.' },
      ],
    },
    {
      icon: Shield,
      title: '2. كيفية استخدام معلوماتك',
      list: [
        'تقديم خدمات المنصة وإدارة الحسابات',
        'تتبع الحضور والتقييمات والتقدم التعليمي',
        'إرسال الإشعارات والتحديثات المهمة',
        'تحسين المنصة وتجربة المستخدم',
        'التواصل معك بشأن تحديثات الخدمة',
      ],
    },
    {
      icon: Lock,
      title: '3. مشاركة البيانات',
      content: [
        { heading: 'لا مشاركة مع أطراف ثالثة', text: 'لا نبيع بياناتك ولا نشاركها مع أي طرف خارجي لأغراض تجارية.' },
        { heading: 'الوصول المحدود', text: 'بيانات الطلاب متاحة فقط للكنيسة المسجلة وأولياء الأمور المرتبطين بشكل صريح.' },
        { heading: 'تصدير البيانات', text: 'يمكنك تصدير جميع بيانات كنيستك في أي وقت بصيغ PDF وExcel.' },
      ],
    },
    {
      icon: Shield,
      title: '4. الأمان',
      list: [
        'تشفير SSL/TLS لجميع الاتصالات',
        'تخزين كلمات المرور بتشفير bcrypt',
        'جلسات مصادقة محمية بـ JWT',
        'صلاحيات وصول متعددة المستويات حسب الأدوار',
        'قاعدة بيانات مشفرة ومحمية',
      ],
    },
    {
      icon: UserCheck,
      title: '5. حقوقك',
      list: [
        'طلب تصدير جميع بياناتك الشخصية',
        'طلب تصحيح أي بيانات غير دقيقة',
        'طلب حذف حسابك وبياناتك',
        'سحب الموافقة على معالجة البيانات',
        'الاطلاع على ما نجمعه من بيانات عنك',
      ],
    },
    {
      icon: Mail,
      title: '6. التواصل معنا',
      text: 'للاستفسارات المتعلقة بالخصوصية، يرجى التواصل مع إدارة كنيستك أو مراسلتنا عبر البريد الإلكتروني.',
      email: 'support@cohep.church',
    },
  ] : [
    {
      icon: Database,
      title: '1. Information We Collect',
      content: [
        { heading: 'At registration', text: 'We collect your church name, email address, phone number, and basic registration details.' },
        { heading: 'During use', text: 'We collect student records, attendance data, assessment results, and educational progress.' },
        { heading: 'What we never collect', text: 'We do not collect payment data or track user behaviour for commercial purposes.' },
      ],
    },
    {
      icon: Shield,
      title: '2. How We Use Your Information',
      list: [
        'Providing platform services and managing accounts',
        'Tracking attendance, assessments, and educational progress',
        'Sending notifications and important service updates',
        'Improving the platform and user experience',
        'Communicating with you about service changes',
      ],
    },
    {
      icon: Lock,
      title: '3. Data Sharing',
      content: [
        { heading: 'No third-party sharing', text: 'We do not sell or share your data with any external party for commercial purposes.' },
        { heading: 'Limited access', text: 'Student data is available only to the registered church and explicitly linked parents.' },
        { heading: 'Data export', text: 'You can export all your church data at any time in PDF and Excel formats.' },
      ],
    },
    {
      icon: Shield,
      title: '4. Security',
      list: [
        'SSL/TLS encryption on all connections',
        'Passwords stored with bcrypt hashing',
        'Authentication sessions protected with JWT',
        'Multi-level role-based access controls',
        'Encrypted and protected database storage',
      ],
    },
    {
      icon: UserCheck,
      title: '5. Your Rights',
      list: [
        'Request an export of all your personal data',
        'Request correction of any inaccurate data',
        'Request deletion of your account and data',
        'Withdraw consent for data processing',
        'Access what data we hold about you',
      ],
    },
    {
      icon: Mail,
      title: '6. Contact Us',
      text: 'For privacy inquiries, please contact your church administration or reach us directly by email.',
      email: 'support@cohep.church',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Back link */}
        <Link href="/auth/register" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {isAr ? 'العودة للتسجيل' : 'Back to registration'}
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Image src="/cohep-logo.png" alt="COHEP" width={56} height={56} className="h-14 w-14 rounded-xl object-contain shadow-md shadow-gold-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</h1>
            <p className="text-sm text-gray-400">{isAr ? 'آخر تحديث: يوليو 2026' : 'Last updated: July 2026'}</p>
          </div>
        </div>

        {/* Intro */}
        <p className="text-sm text-gray-600 leading-relaxed mb-8 mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
          {isAr
            ? 'تلتزم منصة COHEP بحماية خصوصية كنيستك وبيانات طلابك. هذه السياسة توضح ما نجمعه وكيف نستخدمه وكيف نحميه.'
            : 'COHEP is committed to protecting your church\'s privacy and your students\' data. This policy explains what we collect, how we use it, and how we protect it.'}
        </p>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, i) => {
            const Icon = section.icon
            return (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-50">
                    <Icon className="h-4 w-4 text-gold-600" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">{section.title}</h2>
                </div>

                {'content' in section && section.content && (
                  <div className="space-y-3">
                    {section.content.map((item: any, j: number) => (
                      <div key={j}>
                        <p className="text-xs font-semibold text-gray-700 mb-0.5">{item.heading}</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {'list' in section && section.list && (
                  <ul className="space-y-2">
                    {section.list.map((item: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {'text' in section && section.text && (
                  <div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">{section.text}</p>
                    {'email' in section && section.email && (
                      <a
                        href={'mailto:' + section.email}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:text-gold-700 transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {section.email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Open source note */}
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-800 leading-relaxed">
            {isAr
              ? '🔓 COHEP مفتوح المصدر بالكامل. يمكن لأي شخص مراجعة الكود المصدري والتحقق من ممارسات الخصوصية على GitHub.'
              : '🔓 COHEP is fully open-source. Anyone can review the source code and verify our privacy practices on GitHub.'}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Coptic Orthodox Hymn Education Platform (COHEP).{' '}
          {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
        </div>
      </div>
    </div>
  )
}
