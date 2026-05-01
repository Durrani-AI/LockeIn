import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const smokeEmail = process.env.LOCKEDIN_E2E_EMAIL?.trim() || "";
const smokePassword = process.env.LOCKEDIN_E2E_PASSWORD?.trim() || "";
const smokeCvPath = process.env.LOCKEDIN_E2E_CV_PATH?.trim() || "";
const smokeJsearchQuery = process.env.LOCKEDIN_E2E_JSEARCH_QUERY?.trim() || "";
const requireGroqGeneration = (process.env.LOCKEDIN_E2E_REQUIRE_GROQ || "").toLowerCase() === "true";

test.describe("Authenticated smoke flow", () => {
  test.skip(!smokeEmail || !smokePassword, "Set LOCKEDIN_E2E_EMAIL and LOCKEDIN_E2E_PASSWORD to run smoke tests.");

  test("sign in, prepare profile, generate cover letter, and verify documents", async ({ page }) => {
    const runStamp = new Date().toISOString();

    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    // Ensure React hydration has attached form handlers before submit.
    await page.waitForTimeout(1000);
    const signInForm = page.locator("form", {
      has: page.getByRole("button", { name: /^Sign in$/ }),
    });
    const signInEmail = signInForm.locator('input[type="email"]');
    const signInPassword = signInForm.locator('input[type="password"]');
    const signInSubmit = signInForm.getByRole("button", { name: /^Sign in$/ });

    await expect(signInSubmit).toBeVisible();

    await signInEmail.fill(smokeEmail);
    await expect(signInEmail).toHaveValue(smokeEmail);
    await signInPassword.fill(smokePassword);
    await expect(signInPassword).toHaveValue(smokePassword);

    await signInSubmit.click();

    let authenticated = false;
    try {
      await page.waitForURL(/\/app(?:\/)?$/, { timeout: 30_000 });
      authenticated = true;
    } catch {
      const invalidLoginToast = page.getByText(/Invalid login credentials/i).first();
      if (await invalidLoginToast.isVisible()) {
        await page.getByRole("tab", { name: "Create account" }).click();

        const createForm = page.locator("form", {
          has: page.getByRole("button", { name: /^Create account$/ }),
        });
        const createEmail = createForm.locator('input[type="email"]');
        const createPassword = createForm.locator('input[type="password"]');
        const createSubmit = createForm.getByRole("button", {
          name: "Create account",
        });

        await createEmail.fill(smokeEmail);
        await createPassword.fill(smokePassword);
        await createSubmit.click();

        await page.waitForURL(/\/app(?:\/)?$/, { timeout: 30_000 });
        authenticated = true;
      }
    }

    if (!authenticated) {
      throw new Error(
        "Authentication failed. Ensure LOCKEDIN_E2E_EMAIL/LOCKEDIN_E2E_PASSWORD are valid, or reset the account password in Supabase Auth.",
      );
    }

    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            document.cookie
              .split(";")
              .map((cookie) => cookie.trim())
              .some((cookie) => cookie.startsWith("lockedin_csrf_token=")),
          ),
        { timeout: 20_000 },
      )
      .toBe(true);

    await expect(page.getByRole("heading", { name: "Let's tailor an application." })).toBeVisible();

    await page.goto("/app/voice");
    await expect(page.getByRole("heading", { name: "Voice profile" })).toBeVisible();
    await page.getByLabel("Values, themes, or things you care about").fill(`Smoke profile update ${runStamp}`);
    await page.getByLabel("Anything specific about your voice").fill(
      "Write in a clear, concise tone. Prefer specifics over generic claims.",
    );
    await page.getByRole("button", { name: /Save & continue|Update profile/ }).click();

    await page.goto("/app/cv");
    await expect(page.getByRole("heading", { name: "Your CV" })).toBeVisible();

    const parsedBadge = page.getByText("Parsed").first();
    if (!(await parsedBadge.isVisible())) {
      if (!smokeCvPath) {
        throw new Error(
          "No parsed CV found. Set LOCKEDIN_E2E_CV_PATH to a valid PDF so smoke test can upload and parse one.",
        );
      }

      const resolvedCvPath = path.resolve(smokeCvPath);
      if (!fs.existsSync(resolvedCvPath)) {
        throw new Error(`LOCKEDIN_E2E_CV_PATH file not found: ${resolvedCvPath}`);
      }

      await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(resolvedCvPath);
      await expect(page.getByText("Parsed").first()).toBeVisible({ timeout: 120_000 });
    }

    await page.goto("/app/jobs");
    await expect(page.getByRole("heading", { name: "Application Tracker" })).toBeVisible();

    if (smokeJsearchQuery) {
      await page
        .getByPlaceholder("Optional JSearch query (defaults to backend setting)")
        .fill(smokeJsearchQuery);
      await page.getByRole("button", { name: "Import from JSearch" }).click();
      await page.waitForLoadState("networkidle");
    }

    if (await page.getByText("No roles match your filters.").isVisible()) {
      throw new Error(
        "Jobs table is empty after load. Import jobs through JSearch (or seed catalog) before running this smoke test.",
      );
    }

    const firstJobLink = page.locator('tbody a[href^="/app/jobs/"]').first();
    await expect(firstJobLink).toBeVisible({ timeout: 20_000 });
    await Promise.all([page.waitForURL(/\/app\/jobs\/.+/, { timeout: 30_000 }), firstJobLink.click()]);

    await expect(page.getByRole("button", { name: "Generate cover letter" })).toBeVisible();
    await page
      .getByLabel("Anything specific to mention? (optional)")
      .fill(`Smoke run ${runStamp}. Highlight quantified impact where possible.`);
    await page.getByRole("button", { name: "Generate cover letter" }).click();

    await expect(page.getByText("Your cover letter")).toBeVisible({ timeout: 120_000 });

    const generatedLetter = (await page.locator("article").last().textContent()) || "";
    if (requireGroqGeneration && /temporary fallback while groq-backed generation is being configured/i.test(generatedLetter)) {
      throw new Error(
        "Fallback letter detected. Set GROQ_API_KEY in backend-fastapi/.env and restart the API before smoke tests.",
      );
    }

    await page.goto("/app/history");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open job" }).first()).toBeVisible();
  });
});
