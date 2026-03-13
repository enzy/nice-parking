import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <div class="container">
      <div class="legal-page">
        <h1>Privacy Policy</h1>
        <p class="legal-updated">Last updated: March 13, 2026</p>

        <section>
          <h2>Overview</h2>
          <p>
            Nice Parking ("the Service") is an internal tool for managing
            parking spot reservations. We are committed to keeping your
            experience simple and transparent.
          </p>
        </section>

        <section>
          <h2>Information We Collect</h2>
          <p>
            The Service does not collect, store, or share any personal data
            beyond what is strictly necessary for authentication. When you sign
            in with Google, we receive your name and email address solely to
            identify you within the application. This information is stored in
            session cookies and is not persisted in any database or shared with
            third parties.
          </p>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            We use essential cookies only to maintain your authentication
            session. No tracking, analytics, or advertising cookies are used.
          </p>
        </section>

        <section>
          <h2>Data Sharing</h2>
          <p>
            We do not sell, trade, or transfer your information to any third
            parties. No analytics or tracking services are used.
          </p>
        </section>

        <section>
          <h2>Data Retention</h2>
          <p>
            Session data is retained only for the duration of your authenticated
            session. No personal data is stored permanently.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            If you have questions about this privacy policy, please contact the
            application administrator.
          </p>
        </section>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Privacy Policy - Parking",
};
