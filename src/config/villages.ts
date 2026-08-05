/** Well-known shared village for all free (non-org) learners. */
export const FREE_USERS_VILLAGE_ID = 'a0000000-0000-4000-8000-0000000000ff'

export const FREE_USERS_VILLAGE_NAME = 'Free Learners Village'

export const isSharedFreeVillage = (villageId?: string | null): boolean =>
  Boolean(villageId && villageId.trim().toLowerCase() === FREE_USERS_VILLAGE_ID)
