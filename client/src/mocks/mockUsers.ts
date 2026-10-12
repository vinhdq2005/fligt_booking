
export type DemoUser = {
  id: string
  name: string
  email: string
  password: string
}

export const mockUsers: DemoUser[] = [
  {
    id: 'user-001',
    name: 'Người dùng demo',
    email: 'demo@example.com',
    password: '123456',
  },
]

const USERS_STORAGE_KEY = 'flight-booking-demo-users'

export function getDemoUsers(): DemoUser[] {
  try {
    const savedUsers = localStorage.getItem(USERS_STORAGE_KEY)

    if (!savedUsers) {
      return [...mockUsers]
    }

    const parsed: unknown = JSON.parse(savedUsers)

    if (!Array.isArray(parsed)) {
      return [...mockUsers]
    }

    const validUsers = parsed.filter(
      (user): user is DemoUser =>
        typeof user === 'object' &&
        user !== null &&
        typeof user.id === 'string' &&
        typeof user.name === 'string' &&
        typeof user.email === 'string' &&
        typeof user.password === 'string',
    )

    const allUsers = [...mockUsers]

    for (const user of validUsers) {
      const alreadyExists = allUsers.some(
        (item) => item.email.toLowerCase() === user.email.toLowerCase(),
      )

      if (!alreadyExists) {
        allUsers.push(user)
      }
    }

    return allUsers
  } catch {
    return [...mockUsers]
  }
}

export function saveDemoUser(newUser: DemoUser): void {
  const users = getDemoUsers()

  const alreadyExists = users.some(
    (user) => user.email.toLowerCase() === newUser.email.toLowerCase(),
  )

  if (alreadyExists) {
    throw new Error('Email này đã được đăng ký.')
  }

  const updatedUsers = [...users, newUser]

  localStorage.setItem(
    USERS_STORAGE_KEY,
    JSON.stringify(updatedUsers),
  )
}