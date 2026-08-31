import { test, expect } from "@playwright/test";

test.describe("NeuroMove Browser Smoke Test", () => {
  test("open homepage -> verify NeuroMove title -> navigate routes -> verify modes", async ({
    page,
  }) => {
    // 1. Open homepage
    await page.goto("/");

    // 2. Verify NeuroMove branding and title
    await expect(page).toHaveTitle(/NeuroMove/i);
    await expect(
      page.getByRole("heading", { name: "NEUROMOVE", exact: false }).first()
    ).toBeVisible();

    // 3. Navigate to Live Control
    const liveLink = page.getByRole("link", { name: /launch live control/i }).first();
    await liveLink.click();

    // 4. Verify URL and Live Control header
    await expect(page).toHaveURL(/.*\/live/);
    await expect(
      page.getByRole("heading", { name: /live command center/i })
    ).toBeVisible();

    // 5. Verify SIMULATION mode badge is clearly visible
    const modeBadge = page.getByTestId("mode-badge").first();
    await expect(modeBadge).toBeVisible();
    await expect(modeBadge).toHaveText(/simulation/i);

    // 6. Navigate to EEG Lab
    const eegLink = page.getByRole("link", { name: /eeg lab/i }).first();
    await eegLink.click();
    await expect(page).toHaveURL(/.*\/eeg/);
    await expect(
      page.getByRole("heading", { name: /eeg lab/i })
    ).toBeVisible();

    // 7. Navigate to System Diagnostics
    const systemLink = page.getByRole("link", { name: /system diagnostics/i }).first();
    await systemLink.click();
    await expect(page).toHaveURL(/.*\/system/);
    await expect(
      page.getByRole("heading", { name: /system diagnostics/i })
    ).toBeVisible();
  });
});
