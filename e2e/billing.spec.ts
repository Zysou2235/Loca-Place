import { test, expect } from "@playwright/test";

/**
 * Tests Stripe — nécessitent STRIPE_SECRET_KEY (clé test sk_test_…).
 * Sans clé valide, ces tests sont skippés pour éviter de polluer un
 * compte live ou de planter sur une erreur d'API.
 *
 * Cartes de test Stripe :
 *   - 4242 4242 4242 4242  → paiement OK
 *   - 4000 0025 0000 3155  → 3D Secure requis
 *   - 4000 0000 0000 9995  → solde insuffisant
 *
 * Pour lancer ces tests : exporter STRIPE_SECRET_KEY=sk_test_… puis
 *   npx playwright test e2e/billing.spec.ts
 */

const STRIPE_AVAILABLE = !!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");

test.skip(!STRIPE_AVAILABLE, "Stripe test key absent — tests skippés");

test.describe("Tunnel d'abonnement (Stripe test mode)", () => {
  test("Souscription Essentiel avec 4242 4242 4242 4242", async ({ page }) => {
    const email = `stripe-${Date.now()}@test.escalebox.fr`;

    // Signup
    await page.goto("/host/signup");
    await page.fill('input[name="name"]', "Stripe Tester");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "motdepassesolide123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/host/);

    // Va sur billing → clique S'abonner sur Essentiel
    await page.goto("/host/billing");
    await page.getByRole("link", { name: /S.abonner/i }).first().click();

    // Tunnel : étape infos
    await page.waitForURL(/\/host\/billing\/commande/);
    await page.fill('input[name="companyName"]', "Stripe Tester SAS");
    await page.fill('input[name="phone"]', "0612345678");
    await page.fill('input[name="billingLine1"]', "1 rue Test");
    await page.fill('input[name="billingZip"]', "69002");
    await page.fill('input[name="billingCity"]', "Lyon");
    await page.click('button[type="submit"]');

    // Étape livraison
    await page.waitForURL(/step=livraison/);
    await page.getByLabel(/DPD/i).click();
    await page.click('button[type="submit"]');

    // Étape paiement → bouton qui crée la Checkout Session Stripe
    await page.waitForURL(/step=paiement/);
    await page.click('button[type="submit"]');

    // Redirige vers checkout.stripe.com
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });

    // Saisie carte test
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="cardNumber"]', "4242424242424242");
    await page.fill('input[name="cardExpiry"]', "12 / 30");
    await page.fill('input[name="cardCvc"]', "123");
    await page.fill('input[name="billingName"]', "Stripe Tester");
    await page.click('button[type="submit"]');

    // Retour sur le dashboard avec session_id
    await page.waitForURL(/\/host\?session_id=/, { timeout: 30_000 });
    await expect(
      page.getByText(/votre abonnement est actif/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
