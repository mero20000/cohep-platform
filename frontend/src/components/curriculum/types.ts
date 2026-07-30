import type { LucideIcon } from 'lucide-react'

export interface Level {
  id: string; name: string; nameAr?: string; number: number;
  description?: string; descriptionAr?: string; status?: string; orderIndex?: number;
  levelSubjects?: Array<{ subject: Subject }>;
  _count?: { lessons: number; students: number }
}
export interface Subject {
  id: string; name: string; nameAr?: string; nameCoptic?: string; color?: string; description?: string
}
export type ItemStatus = 'pending' | 'allocated' | 'in_progress' | 'completed'

export interface SubjectItem {
  id: string; subjectId?: string; whenLabel?: string; name: string;
  nameAr?: string; nameCoptic?: string; level?: number;
  descriptionAr?: string; sessionsGroup1?: number; sessionsGroup2?: number;
  sessionsGroup3?: number; sessionsGroup4?: number; optional?: boolean;
  orderIndex: number; presentationUrl?: string; presentationData?: PresentationData;
  hazzat?: string; educationLanguages?: string[]; _count?: { lessons: number };
  levels?: Array<{ levelNumber: number }>;
  subject?: { id: string; name: string; nameAr?: string; nameCoptic?: string; color?: string };
  status?: ItemStatus;
  active?: boolean
}

export interface Lesson {
  id: string; title: string; titleAr?: string; titleCoptic?: string;
  description?: string; descriptionAr?: string; descriptionCoptic?: string;
  estimatedDurationMinutes?: number; sessionsCount: number;
  status: string; orderIndex: number;
  presentationHtml?: string;
  presentationData?: PresentationData;
  subjectItemId?: string;
  subjectItem?: SubjectItem;
  level: { number: number; name: string }; subject: { name: string; nameCoptic?: string };
  sessions: Array<{ id: string; title: string; orderIndex: number }>;
}
export interface Allocation {
  id: string; term: number; weekNumber: number; orderIndex: number;
  status: string; scheduledDate?: string; notes?: string;
  academicYear: { name: string };
  level: { number: number; name: string };
  subject: { name: string; nameCoptic?: string };
  lesson: { id: string; title: string; titleAr?: string; titleCoptic?: string; estimatedDurationMinutes?: number; sessionsCount: number; status: string };
  groupNumber?: number;
}
export interface AcademicYear {
  id: string; name: string; isCurrent: boolean; startDate: string; endDate: string; activeDays?: number[]
}
export interface AcademicWeek {
  id: string; weekNumber: number; term: number;
  startDate: string; endDate: string; isAvailable: boolean;
}
export interface Group {
  id: string; name: string; levelId?: string;
}
export interface SubjectStyle {
  bg: string; text: string; border: string; dot: string; light: string; hover: string;
  icon: LucideIcon; label: string
}
export interface LessonFormData {
  title: string; titleAr: string; titleCoptic: string;
  description: string; descriptionAr: string; descriptionCoptic: string;
  estimatedDurationMinutes: number; sessionsCount: number; status: string;
  presentationHtml: string;
  presentationData?: PresentationData;
  subjectItemId?: string;
  audioUrl?: string;
  audioOriginalName?: string;
}

export interface PresentationData {
  format: 'both' | 'en' | 'cop' | 'ar';
  speaker?: string;
  verses: { en: string; cop: string; ar: string }[];
  note?: string;
}
