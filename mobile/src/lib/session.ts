import * as SecureStore from 'expo-secure-store'

export interface Session {
  token: string
  studentCode: string
}

const KEY = 'cohep.portal.session'

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session))
}

export async function getSavedSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Session>
    if (parsed.token && parsed.studentCode) return parsed as Session
    return null
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY)
}
