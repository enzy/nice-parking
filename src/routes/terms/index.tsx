import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <div class="container">
      <div class="legal-page">
        <h1>Terms of Service</h1>
        <p class="legal-updated">Last updated: March 13, 2026</p>

        <section>
          <h2>Acceptance of Terms</h2>
          <p>
            By accessing and using Nice Parking ("the Service"), you agree to be
            bound by these terms. If you do not agree, please do not use the
            Service.
          </p>
        </section>

        <section>
          <h2>Description of Service</h2>
          <p>
            The Service is an internal tool that allows users to view and
            reserve parking spots. It is provided for convenience and internal
            use only.
          </p>
        </section>

        <section>
          <h2>No Warranties</h2>
          <p>
            The Service is provided "as is" and "as available" without
            warranties of any kind, either express or implied. We do not
            guarantee that the Service will be uninterrupted, error-free, or
            that parking spot availability information will always be accurate.
          </p>
        </section>

        <section>
          <h2>Limitation of Liability</h2>
          <p>
            In no event shall the Service providers be liable for any direct,
            indirect, incidental, special, or consequential damages arising out
            of or in connection with the use of the Service.
          </p>
        </section>

        <section>
          <h2>User Conduct</h2>
          <p>
            You agree to use the Service only for its intended purpose of
            managing parking spot reservations. Any misuse or abuse of the
            Service may result in access being revoked.
          </p>
        </section>

        <section>
          <h2>Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. Continued
            use of the Service after changes constitutes acceptance of the
            updated terms.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            If you have questions about these terms, please contact the
            application administrator.
          </p>
        </section>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Terms of Service - Parking",
};
