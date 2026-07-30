async page => {
  const baseUrl = "http://127.0.0.1:3200";
  const ids = Array.from({ length: 24 }, (_, index) => `B${String(index + 1).padStart(3, "0")}`);
  const current = { route: "/" };
  const consoleIssues = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      consoleIssues.push({ route: current.route, type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push({ route: current.route, text: error.message });
  });

  const routes = ["/", ...ids.map((id) => `/cases/${id}/work`)];
  const results = [];
  for (const route of routes) {
    current.route = route;
    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(350);
    results.push({
      route,
      status: response?.status() ?? null,
      title: await page.title(),
      h1: await page.locator("h1").first().textContent().catch(() => null),
      notFound: (await page.locator("body").innerText()).includes("This page could not be found"),
    });
  }

  current.route = "/";
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const dashboardLinks = await page.locator('a[href^="/cases/B"]').count();
  const dashboardCaseButtons = await page.getByRole("button", { name: /^选择案例 B\d{3}：/ }).count();
  return {
    visited: results.length,
    passed: results.filter((item) => item.status === 200 && !item.notFound).length,
    dashboardLinks,
    dashboardCaseButtons,
    hydrationMismatches: consoleIssues.filter((item) => item.text.includes("hydrated")).length,
    consoleIssues,
    pageErrors,
    results,
  };
}
