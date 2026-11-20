import { expect, type Page } from "@playwright/test";

export const PASSWORD = "CareOS-Demo-2026";

export async function login(page: Page, who: string) {
  await page.goto("/login");
  await page.fill("#email", `${who}@demo.careos.local`);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await expect(page).not.toHaveURL(/\/login/);
}

export async function setEnglish(page: Page) {
  const en = page.getByTestId("lang-en").first();
  if ((await en.getAttribute("aria-pressed")) !== "true") {
    await en.click();
    await expect(en).toHaveAttribute("aria-pressed", "true");
  }
}
