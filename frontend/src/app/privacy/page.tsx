'use client'

import Link from 'next/link'
import { Cross, ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'

export default function PrivacyPage() {
  const lang = useLanguage()
  const isAr = lang === 'ar'

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/auth/register" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 mb-8">
          <ArrowLeft className="h-4 w-4" />
          {isAr ? 'العودة للتسجيل' : 'Back to registration'}
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white">
            <Cross className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</h1>
            <p className="text-sm text-gray-500">{isAr ? 'آخر تحديث: يوليو 2026' : 'Last updated: July 2026'}</p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '1. المعلومات التي نجمعها' : '1. Information We Collect'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'عند التسجيل، نجمع اسم الكنيسة، البريد الإلكتروني، ورقم الهاتف. عند استخدام المنصة، نجمع بيانات الطلاب، الحضور، التقييمات، والتقدم التعليمي.'
                : 'When you register, we collect your church name, email address, and phone number. When using the platform, we collect student records, attendance data, assessments, and educational progress.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '2. كيفية استخدام معلوماتك' : '2. How We Use Your Information'}</h2>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>{isAr ? 'تقديم خدمات المنصة وإدارة الحسابات' : 'Providing platform services and managing accounts'}</li>
              <li>{isAr ? 'تتبع الحضور والتقييمات والتقدم التعليمي' : 'Tracking attendance, assessments, and educational progress'}</li>
              <li>{isAr ? 'إرسال الإشعارات والتحديثات الهامة' : 'Sending notifications and important updates'}</li>
              <li>{isAr ? 'تحسين المنصة وتجربة المستخدم' : 'Improving the platform and user experience'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '3. مشاركة البيانات' : '3. Data Sharing'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'لا نشارك بياناتك مع أطراف ثالثة. بيانات الطلاب متاحة فقط للكنيسة المسجلة وأولياء الأمور المرتبطين. يمكن تصدير البيانات في أي وقت.'
                : 'We do not share your data with third parties. Student data is available only to the registered church and linked parents. Data can be exported at any time.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '4. الأمان' : '4. Security'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'نستخدم تشفير SSL/TLS، تخزين كلمات المرور بشكل آمن، وجلسات مصادقة محمية. نطبق صلاحيات الوصول حسب الأدوار.'
                : 'We use SSL/TLS encryption, secure password storage, and protected authentication sessions. Role-based access controls are enforced.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '5. حقوقك' : '5. Your Rights'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'يمكنك طلب تصدير أو حذف بياناتك في أي وقت بالتواصل مع إدارة الكنيسة.'
                : 'You may request to export or delete your data at any time by contacting your church administration.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '6. الاتصال بنا' : '6. Contact Us'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'للاستفسارات، يرجى التواصل مع إدارة كنيستك أو مراسلتنا على support@niangelos.com'
                : 'For inquiries, please contact your church administration or email us at support@niangelos.com'}
            </p>
          </section>

          <hr className="border-gray-200" />

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? 'خريطة التطوير المقترحة' : 'Proposed Development Roadmap'}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {isAr
                ? 'بناءً على تحليل المنصة، نقترح التركيز على المجالات التالية لتحسين تجربة أولياء الأمور:'
                : 'Based on platform analysis, we propose focusing on the following areas to enhance the parent experience:'}
            </p>
            <div className="space-y-3">
              {[
                {
                  title: isAr ? 'تحسين الصفحة الرئيسية للبوابة' : 'Enhance Portal Home Page',
                  desc: isAr
                    ? 'إضافة الهوية المدرسية (الشعار، اسم الكنيسة)، بيانات التلعيب (النقاط، الشارات، الترتيب)، وشارات صلة القرابة.'
                    : 'Add school branding (logo, church name), gamification data (XP, badges, rank), and relationship/privacy badges to child cards.',
                },
                {
                  title: isAr ? 'فك الربط من الصفحة الرئيسية' : 'Unlink from Home Page',
                  desc: isAr
                    ? 'إضافة زر فك الربط مباشرة على بطاقات الأبناء في الصفحة الرئيسية لتجنب الدخول إلى الإعدادات.'
                    : 'Add an unlink button directly on child cards on the home page to avoid navigating to Settings.',
                },
                {
                  title: isAr ? 'تحسين صفحة تفاصيل الطالب' : 'Enhance Child Detail Page',
                  desc: isAr
                    ? 'إضافة ملخص التلعيب (شريط النقاط، الشارات، الترتيب) إلى صفحة تفاصيل الطالب في البوابة.'
                    : 'Add gamification summary (XP bar, badges, rank) to the child detail page in the portal.',
                },
                {
                  title: isAr ? 'إصلاح أخطاء TypeScript' : 'Fix Pre-existing TypeScript Errors',
                  desc: isAr
                    ? 'إصلاح 6 أخطاء في announcement-store.ts (مفاتيح مكررة)، announcement-form-modal.tsx (نوع priority)، و servants/page.tsx (نوع الدور).'
                    : 'Fix 6 errors in announcement-store.ts (duplicate keys), announcement-form-modal.tsx (priority type), and servants/page.tsx (role type).',
                },
              ].map((item, i) => (
                <div key={i} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h3 className="text-sm font-semibold text-blue-800">{item.title}</h3>
                  <p className="mt-1 text-xs text-blue-700/80">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-12 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Coptic Orthodox Hymn Education Platform (COHEP). {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
        </div>
      </div>
    </div>
  )
}
