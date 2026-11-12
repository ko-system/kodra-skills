---
slug: forms-validation
name: Forms and validation
version: 1.0.0
description: Accessible forms with react-hook-form, zod and shadcn/ui Form, covering inline errors, pending and disabled states, success feedback and server-side validation with shared schemas.
when_to_use: When building sign-up, contact, booking, checkout, settings or any create/edit form, or when a form submits twice, loses input, shows unclear errors or trusts client-only validation.
tags: [forms, validation, react-hook-form, zod, ux]
roles: [frontend-developer, backend-developer, qa-tester]
license: MIT
references:
  - file: references/advanced-patterns.md
    description: Field arrays, multi-step wizards, file uploads, dependent fields, edit forms, Thai phone and ID formats, and server error mapping.
---

# Forms and validation

Stack: `react-hook-form` + `zod` + `@hookform/resolvers/zod` + shadcn/ui
`Form` components (already installed in the KODRA scaffold). One zod schema is
the single source of truth for types, client validation and server validation.

## Rules

1. **Schema first.** Define a zod schema; derive the TypeScript type with
   `z.infer`. Put shared schemas in `src/lib/schemas/<name>.ts` so server
   routes can import the same file.
2. **Validate on the server too.** Client validation is UX; the server route,
   edge function or database constraint is the security boundary. Re-parse the
   body with the same schema and return field errors.
3. **Every field has a visible label**, a helpful description when the format
   is not obvious, and an inline error under the field.
4. **Validation timing:** `mode: "onTouched"` (validate after first blur, then
   on change). Don't scream at users while they are still typing the first time.
5. **Submit button stays enabled** until submission starts, then shows a
   pending state and is disabled to prevent double submits.
6. **On success** show what happened (toast or inline message) and reset or
   navigate. **On failure** keep the user's input, show the error near the
   form, and move focus to the first invalid field (react-hook-form does this
   by default).
7. **Use the right input:** `type="email"`, `inputMode="numeric"`,
   `autoComplete` tokens (`name`, `email`, `tel`, `street-address`,
   `postal-code`, `one-time-code`, `new-password`), so browsers and phones help.

## Canonical form

```tsx
// src/lib/schemas/contact.ts
import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email, like name@example.com"),
  phone: z
    .string()
    .trim()
    .regex(
      /^0\d{8,9}$/,
      "Enter a Thai phone number starting with 0 (9-10 digits)",
    )
    .optional()
    .or(z.literal("")),
  topic: z.enum(["booking", "billing", "other"], {
    required_error: "Choose a topic",
  }),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a bit more (at least 10 characters)")
    .max(2000),
  consent: z.boolean().refine((v) => v, "Please accept to continue"),
});
export type ContactInput = z.infer<typeof contactSchema>;
```

```tsx
// src/components/ContactForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { contactSchema, type ContactInput } from "@/lib/schemas/contact";

export function ContactForm() {
  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
      consent: false,
    },
  });

  async function onSubmit(values: ContactInput) {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.status === 422) {
      const { fieldErrors } = (await res.json()) as {
        fieldErrors: Partial<Record<keyof ContactInput, string>>;
      };
      for (const [field, message] of Object.entries(fieldErrors)) {
        form.setError(field as keyof ContactInput, { type: "server", message });
      }
      return;
    }
    if (!res.ok) {
      form.setError("root", {
        message:
          "We couldn't send your message. Check your connection and try again.",
      });
      return;
    }
    toast.success("Message sent. We'll reply within one business day.");
    form.reset();
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="grid gap-5 sm:grid-cols-2"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="topic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Topic</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a topic" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="booking">Booking</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="other">Something else</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone (optional)</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  {...field}
                />
              </FormControl>
              <FormDescription>Only if you prefer a call back.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea rows={5} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem className="flex items-start gap-3 sm:col-span-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  I agree to be contacted about this request
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        {errors.root && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {errors.root.message}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {isSubmitting ? "Sending..." : "Send message"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

Notes:

- `noValidate` turns off native browser bubbles so zod messages are the only
  ones shown.
- Always pass `defaultValues` (empty strings, not `undefined`) so inputs are
  controlled from the first render.
- Use `value={field.value}` on Select/RadioGroup (not `defaultValue`) so
  `form.reset()` clears them.
- When the form submits through a TanStack Query mutation, use
  `mutation.isPending` instead of `isSubmitting`, and call `mutateAsync` in
  `onSubmit` so react-hook-form awaits it.

## Server validation

Parse with the same schema and return 422 with field errors:

```ts
const parsed = contactSchema.safeParse(body);
if (!parsed.success) {
  return Response.json(
    { fieldErrors: parsed.error.flatten().fieldErrors },
    { status: 422 },
  );
}
```

`flatten().fieldErrors` gives `string[]` per field; send the first message
(`fieldErrors.email?.[0]`) or adapt the client loop. Database constraints (unique
email, foreign keys) are mapped to field errors too: catch the unique
violation and return `{ fieldErrors: { email: "This email is already registered" } }`.
In Supabase apps with RLS-only access, validate again in a database
constraint or an edge function; never rely on the client.

## Error message style

- Say what to do, not what went wrong: "Enter a date after today", not "Invalid date".
- Use the user's terms and show the expected format inline ("DD/MM/YYYY").
- One message per field at a time; don't repeat the label.
- Write messages in the app's language; zod messages are plain strings, so
  pass translated text (see the thai-localization skill).

## States checklist

- [ ] Empty: labels, helpful placeholders (examples, not instructions).
- [ ] Typing: no errors until the first blur.
- [ ] Invalid: red border + message under the field (`FormMessage`), focus moves to the first error on submit.
- [ ] Submitting: button disabled with spinner and progress label; inputs stay readable.
- [ ] Server error: message above the submit button with `role="alert"`; input preserved.
- [ ] Success: toast or inline confirmation; form reset or redirect.
- [ ] Unsaved changes on long forms: warn before navigating away (`formState.isDirty`).
