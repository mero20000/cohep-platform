'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'

export default function TermsPage() {
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
          <Image src="/cohep-logo.png" alt="COHEP" width={40} height={40} className="h-10 w-10 rounded-xl object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isAr ? 'شروط الخدمة' : 'Terms of Service'}</h1>
            <p className="text-sm text-gray-500">{isAr ? 'آخر تحديث: يوليو 2026' : 'Last updated: July 2026'}</p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '1. قبول الشروط' : '1. Acceptance of Terms'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'باستخدام منصة COHEP، فإنك توافق على هذه الشروط. إذا كنت لا توافق، يرجى عدم استخدام المنصة.'
                : 'By using COHEP, you agree to these terms. If you do not agree, please do not use the platform.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '2. المسؤوليات' : '2. Responsibilities'}</h2>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>{isAr ? 'الكنيسة مسؤولة عن دقة بيانات طلابها.' : 'The church is responsible for the accuracy of its student data.'}</li>
              <li>{isAr ? 'المستخدمون مسؤولون عن الحفاظ على سرية حساباتهم.' : 'Users are responsible for maintaining the confidentiality of their accounts.'}</li>
              <li>{isAr ? 'لا يجوز استخدام المنصة لأغراض غير قانونية.' : 'The platform may not be used for unlawful purposes.'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '3. الملكية الفكرية' : '3. Intellectual Property'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'جميع حقوق المنصة ومحتواها محفوظة لـ COHEP. المحتوى التعليمي مملوك للكنائس المسجلة.'
                : 'All rights to the platform and its content are reserved by COHEP. Educational content is owned by the registered churches.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '4. إخلاء المسؤولية' : '4. Disclaimer'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'المنصة متاحة "كما هي". لا نضمن عدم حدوث انقطاع أو أخطاء. نحن لسنا مسؤولين عن أي أضرار ناتجة عن استخدام المنصة.'
                : 'The platform is provided "as is". We do not guarantee uninterrupted or error-free operation. We are not liable for damages arising from platform use.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '5. إنهاء الخدمة' : '5. Termination'}</h2>
            <p className="text-sm text-gray-600">
              {isAr
                ? 'نحتفظ بالحق في تعليق أو إنهاء الوصول لأي مستخدم ينتهك هذه الشروط.'
                : 'We reserve the right to suspend or terminate access for any user who violates these terms.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">{isAr ? '6. الاتصال بنا' : '6. Contact Us'}</h2>
            <p className="text-sm text-gray-600">
              {isAr ? 'للاستفسارات، يرجى مراسلتنا على support@cohep.church' : 'For inquiries, please email us at support@cohep.church'}
            </p>
          </section>
        </div>

        <div className="mt-12 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Coptic Orthodox Hymn Education Platform (COHEP). {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
        </div>
      </div>
    </div>
  )
}
