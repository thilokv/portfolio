import { expect, test } from "@playwright/test";
import { login, setEnglish, PASSWORD } from "./helpers";

test.describe("authentication", () => {
  test("rejects wrong passwords and protects routes", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await page.fill("#email", "admin@demo.careos.local");
    await page.fill("#password", "wrong-password-123");
    await page.click("button[type=submit]");
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in, shows a live dashboard and signs out", async ({ page }) => {
    await login(page, "coordinator");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Hello/ })).toBeVisible();
    await expect(page.getByText("Registered children")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/children");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("child management", () => {
  test("registers, finds and edits a child", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/children/new");
    await page.getByRole("button", { name: "Register child" }).click();
    await expect(page.getByText("This field is required.").first()).toBeVisible();
    const name = `E2E Child ${Date.now()}`;
    await page.fill("#fullName", name);
    const dob = new Date(Date.now() - 900 * 86400_000).toISOString().slice(0, 10);
    await page.fill("#dateOfBirth", dob);
    await page.fill("[id='g.fullName']", "E2E Parent");
    await page.fill("[id='g.phone']", "9876501234");
    await page.check("#consentRegistration");
    await page.getByRole("button", { name: "Register child" }).click();
    await expect(page).toHaveURL(/\/children\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText(/CDC-\d{4}/).first()).toBeVisible();

    await page.goto(`/children?q=${encodeURIComponent(name)}`);
    await expect(page.getByTestId("children-list").getByText(name)).toBeVisible();
    await page.getByTestId("children-list").getByText(name).click();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.fill("#parentConcerns", "Edited concern (E2E test)");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Edited concern (E2E test)")).toBeVisible();
  });

  test("administrators cannot open clinical sections", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/children");
    await page.getByTestId("children-list").getByText("Aarav Demo").click();
    await page.waitForURL(/\/children\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("link", { name: "Progress" })).toHaveCount(0);
    const url = page.url();
    await page.goto(`${url}/progress`);
    await expect(page).toHaveURL(url);
  });
});

test.describe("therapy workflow", () => {
  test("therapist starts, documents, completes and signs a session", async ({ page }) => {
    await login(page, "speech");
    await setEnglish(page);
    await page.goto("/schedule");
    const row = page.getByTestId("schedule-list").locator("li").filter({ hasText: "Harshini Demo" });
    await row.getByRole("button", { name: "Start session" }).click();
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/);
    await page.fill("#s-act", "Picture book naming (E2E)");
    await page.fill("#s-resp", "Named 3 pictures with a verbal prompt (E2E)");
    await page.fill("#wf-expressive", "Two single words observed (E2E)");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Session note saved")).toBeVisible();
    await page.getByRole("button", { name: "Complete session" }).click();
    await expect(page.getByText(/Session completed/)).toBeVisible();
    await page.getByRole("button", { name: "Sign note" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/is locked/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save note" })).toHaveCount(0);
  });

  test("schedules a new appointment", async ({ page }) => {
    await login(page, "coordinator");
    await page.goto("/schedule/new");
    await page.selectOption("#a-child", { label: "Lasya Demo (CDC-0008)" });
    await page.selectOption("#a-staff", { label: "Kiran Kumar (Demo)" });
    const d = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
    await page.fill("#a-start", `${d}T15:30`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(new RegExp(`/schedule\\?date=${d}`));
    await expect(page.getByTestId("schedule-list").getByText("Lasya Demo")).toBeVisible();
  });

  test("unassigned therapists cannot open another child's record", async ({ page }) => {
    await login(page, "coordinator");
    await page.goto("/children?q=Deekshitha");
    await page.getByTestId("children-list").getByText("Deekshitha Demo").click();
    await page.waitForURL(/\/children\/[0-9a-f-]{36}$/);
    const url = page.url();
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await login(page, "speech");
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("Deekshitha")).toHaveCount(0);
  });

  test("progress charts and plans render from recorded data", async ({ page }) => {
    await login(page, "speech");
    await page.goto("/children?q=Aarav");
    await page.getByTestId("children-list").getByText("Aarav Demo").click();
    await page.getByRole("link", { name: "Progress" }).click();
    await expect(page.getByTestId("progress-goal")).toHaveCount(2);
    await expect(page.getByText(/4 with trial data/)).toBeVisible();
    await page.getByRole("link", { name: "Development plan" }).click();
    await expect(page.getByTestId("goal-item")).toHaveCount(2);
  });
});

test.describe("language switching", () => {
  test("switches the interface between English and Telugu", async ({ page }) => {
    await login(page, "ot");
    await setEnglish(page);
    await expect(page.getByRole("link", { name: "Children" }).first()).toBeVisible();
    await page.getByTestId("lang-te").first().click();
    await expect(page.getByRole("link", { name: "పిల్లలు" }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "te");
    await page.reload();
    await expect(page.getByRole("link", { name: "పిల్లలు" }).first()).toBeVisible();
    await setEnglish(page);
    await expect(page.getByRole("link", { name: "Children" }).first()).toBeVisible();
  });
});

test.describe("parent portal", () => {
  test("parents cannot download staff exports", async ({ page }) => {
    await login(page, "parent");
    const res = await page.request.get("/api/export/children");
    expect(res.status()).toBe(403);
  });

  test("@mobile parent sees only approved information for their own child", async ({ page }) => {
    await login(page, "parent");
    await expect(page).toHaveURL(/\/portal/);
    await setEnglish(page);
    await expect(page.getByTestId("portal-child")).toHaveCount(1);
    await expect(page.getByTestId("portal-child")).toContainText("Aarav");
    await page.goto("/portal/reports");
    await expect(page.getByTestId("portal-reports").locator("li")).toHaveCount(1);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/portal$/);
    const res = await page.goto("/children");
    expect(page.url()).toMatch(/\/portal$/);
    expect(res?.ok()).toBe(true);
    await page.goto("/portal/messages");
    await page.fill("#fb-subject", "Question (E2E)");
    await page.fill("#fb-body", "Can we change Thursday's time? (E2E)");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Question (E2E)")).toBeVisible();
  });

  test("staff downloads require authorization", async ({ request }) => {
    const res = await request.get("/api/documents/00000000-0000-4000-8000-000000000000", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/login");
    const exp = await request.get("/api/export/children", { maxRedirects: 0 });
    expect(exp.status()).toBe(307);
  });
});

test("password is never sent back in pages", async ({ page }) => {
  await login(page, "admin");
  const html = await page.content();
  expect(html).not.toContain(PASSWORD);
});
