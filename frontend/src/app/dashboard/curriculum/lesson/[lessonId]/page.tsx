'use client'

import { useParams, useRouter } from 'next/navigation'
import { Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLessonQuery } from '@/components/curriculum/hooks'
import { HymnPresentation } from '@/components/curriculum/hymn-presentation'
import { PresentationViewer } from '@/components/curriculum/presentation-viewer'

export default function LessonDetailPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = params.lessonId as string

  const { data: lesson, isLoading, error } = useLessonQuery(lessonId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin h-10 w-10 border-4 border-gold-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Music className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-600">Hymn not found</h2>
          <Button variant="link" onClick={() => router.push('/dashboard/curriculum')}
            className="mt-4 text-blue-700 hover:text-blue-700 underline">
            Back to Curriculum
          </Button>
        </div>
      </div>
    )
  }

  if (lesson.presentationData) {
    return (
      <PresentationViewer
        data={lesson.presentationData}
        title={lesson.title}
        titleCoptic={lesson.titleCoptic}
        titleAr={lesson.titleAr}
        onExit={() => router.push('/dashboard/curriculum')}
      />
    )
  }

  if (lesson.presentationHtml) {
    return (
      <HymnPresentation
        htmlContent={lesson.presentationHtml}
        title={lesson.title}
        titleCoptic={lesson.titleCoptic}
        onExit={() => router.push('/dashboard/curriculum')}
      />
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center text-gray-400">
        <Music className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No presentation content for this hymn</p>
        <Button variant="link" onClick={() => router.push('/dashboard/curriculum')}
          className="mt-3 text-blue-700 hover:text-blue-700 underline">
          Back to Curriculum
        </Button>
      </div>
    </div>
  )
}
