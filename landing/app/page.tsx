import { Hero } from "../components/Hero";
import { Section } from "../components/Section";
import { Services } from "../components/Services";
import { CaseStudies } from "../components/CaseStudies";
import { Contact } from "../components/Contact";
import { Footer } from "../components/Footer";

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-bg-deep">
      <Hero />
      <Section id="services">
        <Services />
      </Section>
      <Section id="case-studies">
        <CaseStudies />
      </Section>
      <Contact />
      <Footer />
    </main>
  );
}
