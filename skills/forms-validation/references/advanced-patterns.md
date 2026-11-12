# Advanced form patterns

## Edit form (load, then reset)

```tsx
const { data: product, isPending } = useQuery({
  queryKey: ["products", id],
  queryFn: () => getProduct(id),
});
const form = useForm<ProductInput>({
  resolver: zodResolver(productSchema),
  defaultValues: EMPTY_PRODUCT,
});

useEffect(() => {
  if (product) form.reset(toFormValues(product)); // map nulls to "" for inputs
}, [product, form]);

if (isPending) return <FormSkeleton />;
```

Disable the save button until the form is dirty: `disabled={!form.formState.isDirty || isSubmitting}`.
Map API shapes to form shapes in one function (`toFormValues`) and back in
another (`toPayload`), so nulls, dates and numbers are converted in one place.

## Numbers, money and dates

- Inputs return strings. Use `z.coerce.number()` for numeric fields, or keep
  the string and convert in `toPayload`.
- Money: store integer minor units (satang/cents) in the database; parse
  user input with `Math.round(Number(value) * 100)`.
- Dates: use shadcn `Calendar` in a `Popover` for picking; validate ranges with
  `superRefine`. Send ISO strings (`date.toISOString()`), display in the user's
  locale.

```ts
export const bookingSchema = z
  .object({
    checkIn: z.date({ required_error: "Choose a check-in date" }),
    checkOut: z.date({ required_error: "Choose a check-out date" }),
    guests: z.coerce
      .number()
      .int()
      .min(1, "At least 1 guest")
      .max(8, "Up to 8 guests"),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    path: ["checkOut"],
    message: "Check-out must be after check-in",
  });
```

## Dependent fields

```ts
const schema = z.discriminatedUnion("delivery", [
  z.object({
    delivery: z.literal("pickup"),
    branchId: z.string().min(1, "Choose a branch"),
  }),
  z.object({
    delivery: z.literal("ship"),
    address: z.string().min(10, "Enter the full address"),
    postalCode: z.string().regex(/^\d{5}$/, "5-digit postal code"),
  }),
]);
```

Render fields with `const delivery = form.watch("delivery")`. When a field is
hidden, it's no longer validated by a discriminated union; call
`form.unregister` or `shouldUnregister: true` if hidden values must not be sent.

## Field arrays (line items, guests, links)

```tsx
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: "items",
});

{
  fields.map((f, index) => (
    <div key={f.id} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
      <FormField
        control={form.control}
        name={`items.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className={index ? "sr-only" : undefined}>
              Item
            </FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`items.${index}.qty`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className={index ? "sr-only" : undefined}>Qty</FormLabel>
            <FormControl>
              <Input type="number" inputMode="numeric" min={1} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove item ${index + 1}`}
        onClick={() => remove(index)}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  ));
}
<Button
  type="button"
  variant="outline"
  onClick={() => append({ name: "", qty: 1 })}
>
  Add item
</Button>;
```

Use `f.id` as the key (never the index). Validate array length in the schema:
`items: z.array(itemSchema).min(1, "Add at least one item")` and show
`form.formState.errors.items?.root?.message` (or `.message`) above the list.

## Multi-step wizard

- One schema per step; a merged schema for the final submit.
- Keep one `useForm` for all steps so values persist; validate the current
  step with `await form.trigger(stepFields[step])` before moving on.
- Show progress ("Step 2 of 3: Delivery"), allow going back without losing
  data, and put the final review on the last step.
- Persist drafts for long wizards in `sessionStorage` (never passwords or card data).

## File uploads

```ts
const MAX_BYTES = 5 * 1024 * 1024;
const fileSchema = z
  .instanceof(File, { message: "Choose a file" })
  .refine((f) => f.size <= MAX_BYTES, "Files must be 5 MB or smaller")
  .refine(
    (f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type),
    "Use a JPG, PNG or WebP image",
  );
```

```tsx
<FormField
  control={form.control}
  name="photo"
  render={({ field: { value, onChange, ...field } }) => (
    <FormItem>
      <FormLabel>Profile photo</FormLabel>
      <FormControl>
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          {...field}
          onChange={(e) => onChange(e.target.files?.[0])}
        />
      </FormControl>
      <FormDescription>JPG, PNG or WebP, up to 5 MB.</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

Send files with `FormData`, not JSON. Re-check size and type on the server;
store in object storage (Supabase Storage, S3-compatible), not the database.
Show upload progress for large files and a preview for images
(`URL.createObjectURL`, revoked on unmount).

## Passwords and auth forms

- `autoComplete="new-password"` on sign-up, `current-password` on login.
- Show/hide toggle button with `aria-label="Show password"` and `aria-pressed`.
- State the rules up front ("At least 8 characters"); validate length, not
  arbitrary composition rules.
- Generic login errors ("Email or password is incorrect") to avoid account
  enumeration.

## Thai formats

| Field        | Rule                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mobile phone | `^0[689]\d{8}$` (10 digits); landline `^0[2-7]\d{7}$`; strip spaces/dashes before validating                                                           |
| Postal code  | `^\d{5}$`                                                                                                                                              |
| National ID  | 13 digits with a checksum: sum of digit[i] \* (13 - i) for i = 0..11; check = (11 - sum % 11) % 10 equals digit 12. Collect only when legally required |
| Name         | Allow Thai and Latin letters, spaces, `.` and `-`; don't force first/last split if not needed                                                          |

```ts
export function isValidThaiId(id: string) {
  const digits = id.replace(/\D/g, "");
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}
```

## Server error mapping

| Server result                        | UI                                                      |
| ------------------------------------ | ------------------------------------------------------- |
| 422 with `fieldErrors`               | `form.setError(field, { type: "server", message })`     |
| 409 conflict (duplicate, stale edit) | Field error, or root error with a "Reload" action       |
| 401 / 403                            | Root error + sign-in link; keep the input               |
| 429                                  | Root error: "Too many attempts. Try again in a minute." |
| 5xx / network                        | Root error with retry; never clear the form             |

Clear a root error when the user edits any field again:
`form.clearErrors("root")` in an `onChange` wrapper or before resubmitting.

## Testing forms

- Unit-test schemas with valid and invalid fixtures (`schema.safeParse`).
- E2E (qa-smoke-tests skill): fill via `getByLabel`, submit, assert the
  success message; submit empty and assert at least one error message is
  visible.
