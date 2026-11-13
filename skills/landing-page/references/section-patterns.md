# Landing page section patterns

These patterns use the blocks in `src/components/app/` that ship with the KODRA
Vite scaffold. The skeleton below is one example (a proof-led page for a
clinic), not the default order: choose the narrative and each block's variant
from the app's design direction, and replace at least one section with
something built only for this business. In a Next.js app or an older app without these blocks, build the
same structure with shadcn/ui primitives and the same Tailwind tokens. Keep
content in typed arrays at the top of the page file (or `src/content/*.ts`) so
copy edits never touch layout code.

## Example page skeleton (Vite + react-router)

```tsx
// src/pages/Index.tsx
import { Link } from "react-router-dom";
import { CalendarCheck, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/app/SiteHeader";
import { SiteFooter } from "@/components/app/SiteFooter";
import { Hero } from "@/components/app/Hero";
import { Section } from "@/components/app/Section";
import { SectionHeader } from "@/components/app/SectionHeader";
import { FeatureGrid, type Feature } from "@/components/app/FeatureGrid";
import { StepList } from "@/components/app/StepList";
import { Faq, type FaqItem } from "@/components/app/Faq";
import { CtaBand } from "@/components/app/CtaBand";

const PRIMARY_CTA = { label: "Book a free consultation", to: "/book" };

const features: Feature[] = [
  {
    icon: CalendarCheck,
    title: "Same-week appointments",
    text: "Pick a slot online; we confirm within two hours.",
  },
  {
    icon: Clock,
    title: "Evening and weekend hours",
    text: "Open until 8 pm on weekdays and all day Saturday.",
  },
  {
    icon: ShieldCheck,
    title: "Licensed physiotherapists",
    text: "Every therapist is registered and has 5+ years in practice.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "Do I need a doctor's referral?",
    answer: "No. You can book directly; bring any scans you already have.",
  },
  {
    question: "How long is a session?",
    answer: "First visits take 60 minutes, follow-ups 45.",
  },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader
        brand="Northside Physio"
        items={[
          { href: "#services", label: "Services" },
          { href: "#how", label: "How it works" },
          { href: "#faq", label: "FAQ" },
        ]}
        actions={
          <Button asChild size="sm">
            <Link to={PRIMARY_CTA.to}>{PRIMARY_CTA.label}</Link>
          </Button>
        }
      />
      <main id="main">
        <Hero
          variant="split"
          title="Move without pain again, in fewer sessions"
          description="Hands-on physiotherapy with a plan you can follow at home, for back, knee and sports injuries."
          actions={
            <>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to={PRIMARY_CTA.to}>{PRIMARY_CTA.label}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
              >
                <a href="#how">See how it works</a>
              </Button>
            </>
          }
          media={
            <img
              src="/images/clinic.webp"
              alt="Physiotherapist guiding a patient through a knee exercise"
              width={1200}
              height={900}
              fetchPriority="high"
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
          }
        />
        <Section id="services" className="scroll-mt-20">
          <SectionHeader title="Care that fits around your week" />
          <FeatureGrid variant="list" items={features} />
        </Section>
        <Section id="how" tone="muted" spacing="airy" className="scroll-mt-20">
          <SectionHeader title="From first call to back on your feet" />
          <StepList variant="timeline" items={steps} />
        </Section>
        <Section id="faq" width="narrow" className="scroll-mt-20">
          <SectionHeader title="Questions before you book" />
          <Faq items={faqs} />
        </Section>
        <CtaBand
          variant="band"
          title="Your first assessment takes 60 minutes"
          description="Leave with a diagnosis and a written plan."
          actions={
            <Button asChild size="lg">
              <Link to={PRIMARY_CTA.to}>{PRIMARY_CTA.label}</Link>
            </Button>
          }
        />
      </main>
      <SiteFooter brand="Northside Physio" note="© 2026 Northside Physio" />
    </div>
  );
}
```

(`steps` is a `Feature[]` like `features`. Other narratives swap these
blocks: an editorial page might open with `<Hero variant="editorial">` and a
`<Section width="narrow">` story; a catalog page puts the item grid right
after a compact hero.) In Next.js the same page lives in
`app/page.tsx`, uses `next/link` (`<Link href=...>`) and `next/image` for the
hero with `priority`.

## Proof strip variants

Only with real data from the owner.

```tsx
// Numbers: a few real facts as a typographic moment (row, grid or spotlight).
<StatShowcase
  variant="row"
  items={[
    { value: 1280, label: "Patients treated in 2025" },
    { value: 4.9, decimals: 1, label: "Average rating on Google" },
  ]}
/>

// Logos: names the owner gave you.
<LogoMarquee label="Trusted by teams at" items={[{ name: "Acme Foods" }, { name: "Riverbank Co-op" }]} />
```

## Split section (image + text), alternating

```tsx
<Section>
  <div className="grid items-center gap-10 md:grid-cols-2">
    <div className={index % 2 ? "md:order-2" : undefined}>
      <h2 className="text-3xl font-semibold leading-tight">{item.title}</h2>
      <p className="mt-4 max-w-prose text-muted-foreground">{item.text}</p>
    </div>
    <img
      src={item.image}
      alt={item.alt}
      width={960}
      height={720}
      loading="lazy"
      className="w-full rounded-xl object-cover"
    />
  </div>
</Section>
```

Use split sections for the 2-3 most important benefits; use `FeatureGrid` for
the rest. This breaks the "stack of identical cards" look.

## Pricing

```tsx
<PricingTable
  plans={[
    {
      name: "Starter",
      price: "฿490",
      period: "/month",
      description: "For one location.",
      features: ["Online booking", "SMS reminders"],
      cta: (
        <Button asChild variant="outline">
          <Link to="/signup?plan=starter">Start with Starter</Link>
        </Button>
      ),
    },
    {
      name: "Studio",
      price: "฿1,290",
      period: "/month",
      description: "For growing teams.",
      highlighted: true,
      badge: "Most chosen",
      features: ["Everything in Starter", "Up to 10 staff", "Payments"],
      cta: (
        <Button asChild>
          <Link to="/signup?plan=studio">Start with Studio</Link>
        </Button>
      ),
    },
  ]}
/>
```

Rules: one highlighted plan at most; currency and period always visible; the
CTA names the plan; state trial or cancellation terms under the table.

## Lead capture form in the hero

Use when the primary action is "leave your details". Keep it to one or two
fields, inline in `Hero` `children`, built with react-hook-form + zod (see the
forms-validation skill). After submit, replace the form with a success message
that says what happens next ("We'll call you within one business day").

## Sticky mobile CTA (optional)

For long pages on mobile only:

```tsx
<div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
  <Button asChild className="w-full">
    <Link to={PRIMARY_CTA.to}>{PRIMARY_CTA.label}</Link>
  </Button>
</div>
```

Add `pb-20 md:pb-0` to `<main>` so the bar never covers the footer.
