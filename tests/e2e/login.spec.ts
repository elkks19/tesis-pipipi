import { expect, test } from "@playwright/test";

test("login fallido no expone la contrasena en la URL", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /iniciar sesion/i })).toBeVisible();

  await page.getByLabel(/correo electronico/i).fill("nadie@example.test");
  await page.getByLabel(/contraseña/i).fill("clave-super-secreta");
  await page.getByRole("button", { name: /^entrar$/i }).click();

  await expect(page).toHaveURL((url) => {
    expect(url.searchParams.get("password")).toBeNull();
    expect(url.href).not.toContain("clave-super-secreta");
    return true;
  });
});
