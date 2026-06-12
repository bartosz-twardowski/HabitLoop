import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected from /dashboard to /auth/signin", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/auth/signin");
});

test("user can sign in and reach /dashboard", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test to run this test");
  }

  await page.goto("/auth/signin");
  await page.getByLabel("Email").click();
  await page.keyboard.type(email);
  await page.getByLabel("Password", { exact: true }).click();
  await page.keyboard.type(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard");
});
