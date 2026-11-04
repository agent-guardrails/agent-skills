# Browser QA

A browser bug requires a rendered browser. Use a standards-based automation capability such as Playwright, WebDriver, or the host's equivalent. Do not replace browser QA with an HTTP client: cookies, storage, service workers, client code, permissions, and viewport state matter.

Use a fresh, task-owned profile for public or unauthenticated flows. Use an attached user session only when the bug requires existing authentication and the user has authorized interaction with that session. Never copy a live profile, read credentials, clear user data, or navigate unrelated tabs.

Capture four signals:

1. Observable DOM state through roles, names, values, or text.
2. Console errors.
3. The specific request and response associated with the action; subscribe before triggering it.
4. Screenshot or trace evidence when useful.

Wait for semantic state such as a URL, DOM condition, or response, not an arbitrary sleep. Re-query locators after navigation or major DOM replacement. Match viewport, device scale, input mode, and headed or headless mode to the reported environment.

Example shape, adapted to the installed browser library:

```js
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const response = page.waitForResponse((value) => value.url().includes("/api/submit"));
await page.goto(url);
await page.getByRole("button", { name: "Submit" }).click();
const result = await response;
await expect(page.getByRole("status")).toHaveText("Complete");
await browser.close();
```

Journal profile and trace paths. Close browser contexts in failure-safe cleanup and remove only task-owned profiles. Keep authentication-bearing traces private.
