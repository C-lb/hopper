// E2E happy path: sign in, log a purchase, see it in the catalogue.
//
// NOT YET EXECUTED. Requires a running app (npm run dev) against a live
// Supabase project with a seeded test user, plus:
//   E2E_EMAIL    - email of a seeded test user
//   E2E_PASSWORD - password of that seeded test user
//
// Run with: E2E_EMAIL=... E2E_PASSWORD=... npm run e2e

import { test, expect } from '@playwright/test'

test('log a purchase and see it in the catalogue', async ({ page }) => {
  // Sign in with a seeded test user (env-provided creds).
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL('**/catalogue')

  // Add a purchase.
  await page.goto('/purchases/new')
  await page.getByLabel('Item name').fill('Test Tee')
  await page.getByLabel(/amount paid/i).fill('20')
  await page.getByRole('button', { name: /add purchase/i }).click()

  await page.waitForURL('**/catalogue')

  // It shows up in the catalogue.
  await expect(page.getByText('Test Tee')).toBeVisible()
})
